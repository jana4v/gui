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
        :gridOptions="gridOptions"
        :theme="isDark
          ? themeQuartz.withPart(colorSchemeDarkBlue)
          : themeQuartz.withPart(colorSchemeLightCold)"
        :columnDefs="columnDefsByParameter[parameter]"
        :rowData="tableRows[parameter]"
        :enableRangeSelection="true"
        :enableFillHandle="true"
        :getRowHeight="(params) => getRowHeight(parameter, params)"
        :defaultColDef="defaultColDef"
        :rowGroupPanelShow="'always'"
        :groupDisplayType="'singleColumn'"
        :cellSelection="cellSelectionConfig"
        :suppressClickEdit="true"
        :suppressColumnVirtualisation="true"
        :suppressContextMenu="true"
        :suppressMovableColumns="true"
        :undoRedoCellEditing="true"
        :undoRedoCellEditingLimit="20"
        @cell-double-clicked="onCellDoubleClickedParameter(parameter, $event)"
        @cell-key-down="onCellKeyDownParameter(parameter, $event)"
        @grid-ready="onGridReadyParameter(parameter, $event)"
        @first-data-rendered="onFirstDataRenderedParameter(parameter, $event)"
        @model-updated="onModelUpdatedParameter(parameter, $event)"
      />
    </div>

    <Dialog
      v-model:visible="showFbtDialog"
      modal
      :header="fbtDialogTitle"
      :style="{ width: '620px' }"
      :dismissableMask="true"
    >
      <div class="editor-wrap">
        <HotTable :settings="fbtHotSettings" :data="fbtEditingData" />
      </div>

      <template #footer>
        <Button label="Cancel" icon="pi pi-times" text @click="closeFbtEditor" />
        <Button label="Save" icon="pi pi-check" @click="saveFbtEditor" />
      </template>
    </Dialog>
  </div>
</template>

<script lang="ts" setup>
import { HotTable } from '@handsontable/vue3';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/styles/handsontable.css';
import 'handsontable/styles/ht-theme-main-no-icons.css';
import Dialog from 'primevue/dialog';
import { useToast } from 'primevue/usetoast';
import { ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import {
  colorSchemeDarkBlue,
  colorSchemeLightCold,
  themeQuartz,
} from 'ag-grid-community';
import type {
  CellClickedEvent,
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
registerAllModules();

type FbtMatrix = (string | number)[][];

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

const spuriousFbtRenderer = markRaw({ ...PskPmSpuriousFbtCellAgGrid });
const spuriousFbtHotRenderer = markRaw({ ...PskPmSpuriousFbtCellAgGrid });
const spuriousFbtColdRenderer = markRaw({ ...PskPmSpuriousFbtCellAgGrid });

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
const showFbtDialog = ref(false);
const fbtEditingData = ref<FbtMatrix>([['', '']]);
const activeFbtField = ref('');
const activeFbtNode = shallowRef<any>(null);
const fbtDialogTitle = computed(() => {
  const displayName = activeFbtField.value === 'fbt'
    ? 'FBT'
    : activeFbtField.value === 'fbt_hot'
      ? 'FBT Hot'
      : 'FBT Cold';

  const row = (activeFbtNode.value?.data ?? {}) as Record<string, unknown>;
  const code = String(row.code ?? '').trim();
  const port = String(row.port ?? '').trim();
  const frequencyLabel = String(row.frequency_label ?? row.frequency ?? '').trim();
  const rowIdentity = [code, port, frequencyLabel].filter(Boolean).join('_');
  return rowIdentity ? `Edit ${displayName} - ${rowIdentity}` : `Edit ${displayName}`;
});

const fbtHotSettings = computed(() => ({
  licenseKey: 'non-commercial-and-evaluation',
  colHeaders: ['Offset (kHz)', 'Value (dBc)'],
  columns: [
    {
      type: 'numeric',
      locale: 'en-US',
      numericFormat: {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true,
      },
    },
    {
      type: 'numeric',
      locale: 'en-US',
      numericFormat: {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true,
      },
    },
  ],
  rowHeaders: true,
  stretchH: 'all',
  width: '100%',
  minRows: 1,
  minSpareRows: 1,
  contextMenu: true,
  height: 380,
  autoWrapRow: true,
  autoWrapCol: true,
  copyPaste: true,
  fillHandle: {
    direction: 'vertical',
    autoInsertRow: true,
  },
  enterMoves: { row: 1, col: 0 },
  tabMoves: { row: 0, col: 1 },
}));

const defaultColDef: ColDef = {
  editable: true,
  sortable: true,
  filter: true,
  resizable: true,
  enableRowGroup: true,
  minWidth: 120,
};

const gridOptions = {
  singleClickEdit: false,
  suppressClickEdit: true,
  suppressColumnVirtualisation: true,
  suppressAnimationFrame: true,
  processCellForClipboard: (params: any) => {
    if (isFbtField(params.column?.getColId?.() ?? params.column?.colId ?? params.colDef?.field)) {
      return toFbtClipboardText(params.value);
    }
    return params.value;
  },
  processCellFromClipboard: (params: any) => {
    if (isFbtField(params.column?.getColId?.() ?? params.column?.colId ?? params.colDef?.field)) {
      return parseFbtClipboardValue(params.value);
    }
    return params.value;
  },
};

const cellSelectionConfig = {
  mode: 'range' as const,
  handle: {
    mode: 'fill' as const,
    direction: 'xy' as const,
    suppressClearOnFillReduction: true,
    setFillValue: (params: any) => {
      const values = params?.values;
      if (Array.isArray(values) && values.length > 0) {
        const sourceValue = values[values.length - 1];
        if (Array.isArray(sourceValue)) {
          return sourceValue.map((row: any) => Array.isArray(row) ? [...row] : row);
        }
        return sourceValue;
      }

      const currentValue = params?.currentCellValue;
      if (Array.isArray(currentValue)) {
        return currentValue.map((row: any) => Array.isArray(row) ? [...row] : row);
      }
      return currentValue;
    },
  },
};

const metaKeys = new Set(['transmitter_code', 'transmitter_name', 'modulation_type']);
const readOnlyKeys = new Set(['code', 'port', 'frequency_label', 'frequency']);

function isFbtField(field: unknown): field is 'fbt' | 'fbt_hot' | 'fbt_cold' {
  return field === 'fbt' || field === 'fbt_hot' || field === 'fbt_cold';
}

function toFbtClipboardText(value: unknown): string {
  const matrix = ensureFbtMatrix(value);
  const rows = matrix
    .map((row) => row.map((cell) => `${cell ?? ''}`.trim()).filter(Boolean))
    .filter((row) => row.length > 0);

  if (!rows.length) return '';
  return rows.map((row) => row.join(', ')).join('; ');
}

function parseFbtClipboardValue(value: unknown): FbtMatrix {
  if (Array.isArray(value)) {
    return ensureFbtMatrix(value).map((row) => [...row]);
  }

  const text = `${value ?? ''}`.trim();
  if (!text) return [['', '']];

  const tabularRows = text
    .split(/\r?\n/)
    .map((line) => line.split('\t').map((cell) => cell.trim()))
    .filter((row) => row.some(Boolean));

  if (tabularRows.length > 1 || (tabularRows[0]?.length ?? 0) > 1) {
    return tabularRows.map((row) => normalizeFbtRow(row));
  }

  return text
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => normalizeFbtRow(segment.split(',').map((cell) => cell.trim())));
}

function normalizeFbtRow(row: unknown[]): (string | number)[] {
  const normalized = row.slice(0, 2).map((cell) => {
    const text = `${cell ?? ''}`.trim();
    if (text === '') return '';
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : text;
  });

  while (normalized.length < 2) normalized.push('');
  return normalized;
}

function getSelectedFbtTargets(api: GridApi, fallbackEvent?: any): Array<{ rowNode: any; field: 'fbt' | 'fbt_hot' | 'fbt_cold' }> {
  const ranges = api.getCellRanges?.() ?? [];
  const targets: Array<{ rowNode: any; field: 'fbt' | 'fbt_hot' | 'fbt_cold' }> = [];

  for (const range of ranges) {
    const start = Math.min(range.startRow?.rowIndex ?? 0, range.endRow?.rowIndex ?? 0);
    const end = Math.max(range.startRow?.rowIndex ?? 0, range.endRow?.rowIndex ?? 0);
    const fields = (range.columns ?? [])
      .map((column: any) => column.getColId?.() ?? column.colId)
      .filter(isFbtField);

    for (let rowIndex = start; rowIndex <= end; rowIndex += 1) {
      const rowNode = api.getDisplayedRowAtIndex?.(rowIndex);
      if (!rowNode) continue;
      for (const field of fields) {
        targets.push({ rowNode, field });
      }
    }
  }

  if (targets.length > 0) return targets;

  const eventField = fallbackEvent?.colDef?.field;
  if (isFbtField(eventField) && fallbackEvent?.node) {
    return [{ rowNode: fallbackEvent.node, field: eventField }];
  }

  const focused = api.getFocusedCell?.();
  const focusedField = focused?.column?.getColId?.() ?? focused?.column?.colId;
  if (isFbtField(focusedField)) {
    const rowNode = api.getDisplayedRowAtIndex?.(focused.rowIndex);
    if (rowNode) return [{ rowNode, field: focusedField }];
  }

  return [];
}

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
        editable: true,
        minWidth: 180,
        width: 210,
        maxWidth: 240,
        suppressFillHandle: false,
        cellRenderer: rendererByField[key],
        cellRendererParams: { isEditable: true },
        valueSetter: (params) => {
          params.data[key] = params.newValue;
          return true;
        },
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

function onCellDoubleClickedParameter(parameter: ParameterName, event: CellClickedEvent) {
  if (parameter !== 'spurious') return;

  const field = String(event.colDef?.field ?? '');
  if (!isFbtField(field)) return;

  const target = event.event?.target as HTMLElement | null;
  if (target?.closest?.('.ag-fill-handle')) return;

  activeFbtField.value = field;
  activeFbtNode.value = event.node;
  fbtEditingData.value = ensureFbtMatrix(event.value).map(row => [...row]);
  showFbtDialog.value = true;
}

function onCellKeyDownParameter(parameter: ParameterName, event: any) {
  if (parameter !== 'spurious') return;

  const keyboardEvent = event?.event as KeyboardEvent | undefined;
  if (!keyboardEvent) return;

  const field = event?.colDef?.field;
  const targets = getSelectedFbtTargets(event.api, event);
  const isFbtTarget = isFbtField(field) || targets.length > 0;
  if (!isFbtTarget) return;

  const key = keyboardEvent.key.toLowerCase();
  const isCopy = (keyboardEvent.ctrlKey || keyboardEvent.metaKey) && key === 'c';
  const isPaste = (keyboardEvent.ctrlKey || keyboardEvent.metaKey) && key === 'v';
  const isDelete = key === 'delete' || key === 'backspace';

  if (isCopy) {
    event.api?.copySelectedRangeToClipboard?.();
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    return;
  }

  if (isPaste) {
    event.api?.pasteFromClipboard?.();
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
    return;
  }

  if (isDelete) {
    for (const target of targets) {
      target.rowNode?.setDataValue?.(target.field, [['', '']]);
    }
    event.api?.resetRowHeights?.();
    keyboardEvent.preventDefault();
    keyboardEvent.stopPropagation();
  }
}

function ensureFbtMatrix(value: unknown): FbtMatrix {
  if (Array.isArray(value) && value.length > 0 && value.every((row) => Array.isArray(row))) {
    return value as FbtMatrix;
  }
  return [['', '']];
}

function closeFbtEditor() {
  showFbtDialog.value = false;
}

async function saveFbtEditor() {
  const cleanedData = fbtEditingData.value.filter((row) =>
    row.some((cell) => cell !== '' && cell !== null && cell !== undefined),
  );
  const finalData = cleanedData.length > 0 ? cleanedData : [['', '']];

  if (activeFbtField.value && activeFbtNode.value) {
    activeFbtNode.value.setDataValue(activeFbtField.value, finalData);
    await nextTick();
    activeFbtNode.value?.gridApi?.resetRowHeights?.();
  }

  showFbtDialog.value = false;
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
