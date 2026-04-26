<template>
  <div class="specs-panel" :class="{ 'single-view': isSingleParameterView }">
    <div class="specs-header">
      <h2>Specifications</h2>
     </div>

    <div
      v-for="parameter in visibleParameters"
      :key="parameter"
      class="spec-section"
      :class="{ 'fill-height': isSingleParameterView }"
    >
      <div class="spec-section-header">
        <div>
          <h3>{{ sectionTitles[parameter] }}</h3>
        
        </div>
        <div class="actions">
          <Button label="Refresh" size="small" severity="secondary" @click="loadParameter(parameter)" />
          <Button
            label="Save"
            size="small"
            :loading="saving[parameter]"
            @click="saveParameter(parameter)"
          />
        </div>
      </div>

      <ag-grid-vue
        class="spec-grid"
        :style="{ width: '100%', height: isSingleParameterView ? '100%' : '320px' }"
        :theme="isDark
          ? themeQuartz.withPart(colorSchemeDarkBlue)
          : themeQuartz.withPart(colorSchemeLightCold)"
        :columnDefs="columnDefsByParameter[parameter]"
        :rowData="tableRows[parameter]"
        :getRowHeight="(params) => getRowHeight(parameter, params)"
        :defaultColDef="defaultColDef"
        :rowGroupPanelShow="'always'"
        :groupDisplayType="'singleColumn'"
        :cellSelection="cellSelectionConfig"
        :suppressContextMenu="true"
        :suppressMovableColumns="true"
        :undoRedoCellEditing="true"
        :undoRedoCellEditingLimit="20"
        @grid-ready="onGridReadyParameter(parameter, $event)"
        @first-data-rendered="onFirstDataRenderedParameter(parameter, $event)"
        @model-updated="onModelUpdatedParameter(parameter, $event)"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useToast } from 'primevue/usetoast';
import { ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import {
  colorSchemeDarkBlue,
  colorSchemeLightCold,
  themeQuartz,
} from 'ag-grid-community';
import type {
  ColDef,
  ColGroupDef,
  FirstDataRenderedEvent,
  GridApi,
  GridReadyEvent,
  RowHeightParams,
  ModelUpdatedEvent,
} from 'ag-grid-community';
import { AgGridVue } from 'ag-grid-vue3';
import PskPmSpuriousFbtCellAgGrid from '@/components/TracsV2/ModulationForms/PskPmSpuriousFbtCellAgGrid.vue';
import {
  useTransmitterApi,
  type ParameterName,
  type ParameterRowsResponse,
} from '@/composables/tracsV2/useTransmitterApi';

ModuleRegistry.registerModules([AllEnterpriseModule]);

const api = useTransmitterApi();
const toast = useToast();
const isDark = useDark();

const props = withDefaults(
  defineProps<{
    activeParameter?: ParameterName | 'all';
  }>(),
  {
    activeParameter: 'all',
  },
);

const parameterOrder: ParameterName[] = ['power', 'frequency', 'modulation_index', 'spurious'];
const visibleParameters = computed<ParameterName[]>(() => {
  if (props.activeParameter === 'all') return parameterOrder;
  return [props.activeParameter];
});
const isSingleParameterView = computed(() => visibleParameters.value.length === 1);

const sectionTitles: Record<ParameterName, string> = {
  power: 'Power',
  frequency: 'Frequency',
  modulation_index: 'Modulation Index',
  spurious: 'Spurious',
};

const spuriousFbtRenderer = markRaw(PskPmSpuriousFbtCellAgGrid);
const spuriousFbtHotRenderer = markRaw(PskPmSpuriousFbtCellAgGrid);
const spuriousFbtColdRenderer = markRaw(PskPmSpuriousFbtCellAgGrid);

type GridColumnDef = ColDef | ColGroupDef;

const tableRows = reactive<Record<ParameterName, Record<string, any>[]>>({
  power: [],
  frequency: [],
  modulation_index: [],
  spurious: [],
});

const columnDefsByParameter = reactive<Record<ParameterName, GridColumnDef[]>>({
  power: [],
  frequency: [],
  modulation_index: [],
  spurious: [],
});

const saving = reactive<Record<ParameterName, boolean>>({
  power: false,
  frequency: false,
  modulation_index: false,
  spurious: false,
});

const gridApis = shallowRef<Partial<Record<ParameterName, GridApi>>>({});

const defaultColDef: ColDef = {
  editable: true,
  sortable: true,
  filter: true,
  resizable: true,
  enableRowGroup: true,
  minWidth: 120,
};

const cellSelectionConfig = {
  mode: 'range' as const,
  handle: {
    mode: 'fill' as const,
    direction: 'y' as const,
    suppressClearOnFillReduction: true,
  },
};

const metaKeys = new Set(['transmitter_code', 'transmitter_name', 'modulation_type']);
const readOnlyKeys = new Set(['code', 'port', 'frequency_label', 'frequency']);

function createBaseColumn(key: string): ColDef {
  return {
    field: key,
    headerName: key.replaceAll('_', ' ').replace(/\b\w/g, (s) => s.toUpperCase()),
    editable: !(metaKeys.has(key) || readOnlyKeys.has(key)),
    valueFormatter: (params) => {
      const v = params.value;
      if (Array.isArray(v) || (v && typeof v === 'object')) {
        return JSON.stringify(v);
      }
      return v as any;
    },
    valueParser: (params) => {
      const oldValue = params.oldValue;
      const newValue = params.newValue;

      if (Array.isArray(oldValue) || (oldValue && typeof oldValue === 'object')) {
        try {
          return JSON.parse(newValue);
        } catch {
          return oldValue;
        }
      }

      if (typeof oldValue === 'number') {
        const parsed = Number(newValue);
        return Number.isFinite(parsed) ? parsed : oldValue;
      }

      return newValue;
    },
    cellEditor: 'agTextCellEditor',
  };
}

function buildColumns(parameter: ParameterName, rows: Record<string, any>[]): GridColumnDef[] {
  const allKeys = new Set<string>();
  rows.forEach((r) => Object.keys(r).forEach((k) => allKeys.add(k)));

  const preferred = ['code', 'port', 'frequency_label', 'frequency'];

  if (parameter === 'modulation_index') {
    const toneCols = [...allKeys].filter((k) =>
      /^fbt(_hot|_cold)?_tone_/i.test(k),
    );

    const groupedToneKeys = new Map<string, { fbt?: string; fbtHot?: string; fbtCold?: string }>();
    for (const key of toneCols) {
      const lower = key.toLowerCase();
      if (lower.startsWith('fbt_hot_tone_')) {
        const tone = key.substring('fbt_hot_tone_'.length);
        groupedToneKeys.set(tone, { ...(groupedToneKeys.get(tone) ?? {}), fbtHot: key });
      } else if (lower.startsWith('fbt_cold_tone_')) {
        const tone = key.substring('fbt_cold_tone_'.length);
        groupedToneKeys.set(tone, { ...(groupedToneKeys.get(tone) ?? {}), fbtCold: key });
      } else if (lower.startsWith('fbt_tone_')) {
        const tone = key.substring('fbt_tone_'.length);
        groupedToneKeys.set(tone, { ...(groupedToneKeys.get(tone) ?? {}), fbt: key });
      }
    }

    const nonToneOrdered = [
      ...preferred.filter((k) => allKeys.has(k)),
      ...[...allKeys].filter(
        (k) => !preferred.includes(k) && !metaKeys.has(k) && !toneCols.includes(k),
      ),
    ];

    const toneGroups: ColGroupDef[] = [...groupedToneKeys.entries()]
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([tone, fields]) => {
        const children: ColDef[] = [];
        if (fields.fbt) children.push({ ...createBaseColumn(fields.fbt), headerName: 'FBT' });
        if (fields.fbtHot) children.push({ ...createBaseColumn(fields.fbtHot), headerName: 'FBT Hot' });
        if (fields.fbtCold) children.push({ ...createBaseColumn(fields.fbtCold), headerName: 'FBT Cold' });

        return {
          headerName: `Tone ${tone} KHz`,
          children,
        };
      });

    return [...nonToneOrdered.map((k) => createBaseColumn(k)), ...toneGroups];
  }

  if (parameter === 'spurious') {
    const hiddenSpuriousKeys = new Set(['profile_name', 'profiles', 'tolerance', 'enable']);
    const ordered = [
      ...preferred.filter((k) => allKeys.has(k)),
      ...[...allKeys].filter((k) => !preferred.includes(k) && !metaKeys.has(k) && !hiddenSpuriousKeys.has(k)),
    ];

    const rendererByField: Record<string, any> = {
      fbt: spuriousFbtRenderer,
      fbt_hot: spuriousFbtHotRenderer,
      fbt_cold: spuriousFbtColdRenderer,
    };

    return ordered.map((key) => {
      if (!rendererByField[key]) return createBaseColumn(key);

      return {
        ...createBaseColumn(key),
        editable: false,
        minWidth: 180,
        width: 210,
        maxWidth: 240,
        cellRenderer: rendererByField[key],
        cellRendererParams: { isEditable: true },
      } as ColDef;
    });
  }

  const ordered = [
    ...preferred.filter((k) => allKeys.has(k)),
    ...[...allKeys].filter((k) => !preferred.includes(k) && !metaKeys.has(k)),
  ];

  return ordered.map((key) => createBaseColumn(key));
}

function flattenRows(parameter: ParameterName, payloadRows: ParameterRowsResponse['rows']): Record<string, any>[] {
  return payloadRows.map((item) => {
    const row = { ...(item.row ?? {}) } as Record<string, any>;

    if (parameter === 'spurious') {
      const hasSpecification = !(row.specification === null || row.specification === undefined || row.specification === '');
      const hasTolerance = !(row.tolerance === null || row.tolerance === undefined || row.tolerance === '');

      // Backward-compatible fallback: old rows used tolerance for default -50.
      if (!hasSpecification && hasTolerance) {
        row.specification = row.tolerance;
      }
    }

    return {
      transmitter_code: item.transmitter_code,
      transmitter_name: item.transmitter_name,
      modulation_type: item.modulation_type,
      ...row,
    };
  });
}

async function loadParameter(parameter: ParameterName) {
  const res = await api.getParameterRows(parameter);
  if (res.error.value) {
    toast.add({
      severity: 'error',
      summary: 'Load Failed',
      detail: `Unable to load ${sectionTitles[parameter]} rows.`,
      life: 3500,
    });
    return;
  }

  const data = res.data.value as ParameterRowsResponse;
  const rows = flattenRows(parameter, data.rows ?? []);

  tableRows[parameter] = rows;
  columnDefsByParameter[parameter] = buildColumns(parameter, rows);
  gridApis.value[parameter]?.setGridOption('columnDefs', columnDefsByParameter[parameter]);
  gridApis.value[parameter]?.setGridOption('rowData', tableRows[parameter]);

  // Auto-size after rows are rendered.
  setTimeout(() => autoSizeDisplayedColumns(parameter), 0);
}

async function saveParameter(parameter: ParameterName) {
  try {
    saving[parameter] = true;
    const gridRows: Record<string, any>[] = [];
    gridApis.value[parameter]?.forEachNode((n) => {
      if (n.data) gridRows.push(n.data as Record<string, any>);
    });

    const payload = {
      rows: gridRows.map((r) => {
        const row: Record<string, any> = {};
        Object.keys(r).forEach((k) => {
          if (!metaKeys.has(k)) row[k] = r[k];
        });
        return {
          transmitter_code: String(r.transmitter_code ?? ''),
          row,
        };
      }).filter((r) => r.transmitter_code !== ''),
    };

    const res = await api.saveParameterRows(parameter, payload);
    if (res.error.value) {
      toast.add({
        severity: 'error',
        summary: 'Save Failed',
        detail: `Unable to save ${sectionTitles[parameter]} rows.`,
        life: 3500,
      });
      return;
    }

    const response = res.data.value as any;
    toast.add({
      severity: 'success',
      summary: 'Saved',
      detail: `${sectionTitles[parameter]} updated (${response?.updated_rows ?? 0} rows).`,
      life: 3000,
    });

    await loadParameter(parameter);
  } finally {
    saving[parameter] = false;
  }
}

function onGridReady(parameter: ParameterName, event: GridReadyEvent) {
  gridApis.value[parameter] = event.api;
  setTimeout(() => autoSizeDisplayedColumns(parameter), 0);
}

function onGridReadyParameter(parameter: ParameterName, event: GridReadyEvent) {
  onGridReady(parameter, event);
}

function autoSizeDisplayedColumns(parameter: ParameterName) {
  const gridApi = gridApis.value[parameter];
  if (!gridApi) return;

  const displayed = gridApi.getAllDisplayedColumns();
  const colIds = displayed.map((c) => c.getColId());
  if (colIds.length > 0) {
    gridApi.autoSizeColumns(colIds, false);
  }
}

function onFirstDataRenderedParameter(parameter: ParameterName, _event: FirstDataRenderedEvent) {
  setTimeout(() => autoSizeDisplayedColumns(parameter), 0);
}

function onModelUpdatedParameter(parameter: ParameterName, _event: ModelUpdatedEvent) {
  setTimeout(() => autoSizeDisplayedColumns(parameter), 0);
}

function getRowHeight(parameter: ParameterName, params: RowHeightParams): number {
  if (parameter !== 'spurious') return 42;

  const row = (params.data ?? {}) as Record<string, any>;
  const rowCount = (value: unknown): number => (Array.isArray(value) ? Math.max(value.length, 1) : 1);
  const maxRows = Math.max(
    rowCount(row.fbt),
    rowCount(row.fbt_hot),
    rowCount(row.fbt_cold),
  );

  // Grow with row count but cap height; preview itself can scroll for long lists.
  const previewRows = maxRows;
  const headerHeight = 20;
  const tableRowHeight = 12;
  const containerPadding = 1;
  const baseHeight = containerPadding + headerHeight + (previewRows * tableRowHeight);
  return Math.max(45, baseHeight);
}

onMounted(async () => {
  for (const parameter of visibleParameters.value) {
    await loadParameter(parameter);
  }
});

watch(
  () => props.activeParameter,
  async () => {
    for (const parameter of visibleParameters.value) {
      await loadParameter(parameter);
    }
  },
);
</script>

<style scoped>
.specs-panel {
  padding: 1rem;
}

.specs-panel.single-view {
  height: calc(100vh - 2rem);
  display: flex;
  flex-direction: column;
}

.specs-header {
  margin-bottom: 1rem;
}

.specs-header h2 {
  margin: 0;
  color: #22d3ee;
}

.specs-header p {
  margin: 0.35rem 0 0;
  color: #94a3b8;
}

.spec-section {
  border: 1px solid #1e3a5f;
  border-radius: 8px;
  padding: 0.75rem;
  margin-bottom: 1rem;
  background: #0b182a;
}

.spec-section.fill-height {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.spec-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.65rem;
}

.spec-section-header h3 {
  margin: 0;
  color: #e2e8f0;
}

.spec-section-header small {
  color: #94a3b8;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.spec-grid {
  min-height: 0;
}
</style>
