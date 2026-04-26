<template>
  <div class="tp-panel">
    <Toast />
    <div class="tp-header">
      <h2>Test Profiles — Transmitter / Spurious / Profile</h2>
    </div>

    <div class="tp-section">
      <div class="tp-section-header">
        <h3>Spurious Profile</h3>
        <div class="actions">
          <Button label="Refresh" size="small" severity="secondary" @click="load" />
          <Button label="Save" size="small" :loading="saving" @click="save" />
        </div>
      </div>

      <ag-grid-vue
        class="tp-grid"
        style="width: 100%; height: 100%;"
        :theme="isDark
          ? themeQuartz.withPart(colorSchemeDarkBlue)
          : themeQuartz.withPart(colorSchemeLightCold)"
        :columnDefs="columnDefs"
        :rowData="rows"
        :defaultColDef="defaultColDef"
        :suppressContextMenu="true"
        :suppressMovableColumns="true"
        rowGroupPanelShow="always"
        groupDisplayType="singleColumn"
        @grid-ready="onGridReady"
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
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { AgGridVue } from 'ag-grid-vue3';
import {
  useTransmitterApi,
  type ParameterRowsResponse,
  type Transmitter,
} from '@/composables/tracsV2/useTransmitterApi';

ModuleRegistry.registerModules([AllEnterpriseModule]);

const toast = useToast();
const isDark = useDark();
const api = useTransmitterApi();

const PROFILE_OPTIONS = ['Detailed', 'Short', 'Minimal'] as const;

interface SpuriousProfileRow {
  transmitter_code: string;
  code: string;
  port: string;
  frequency_label: string;
  frequency: number | null;
  profile_name: string;
  enable: boolean;
  profiles: string[];
  specification: string | number | null;
  tolerance: string | number | null;
  fbt: (string | number)[][];
  fbt_hot: (string | number)[][];
  fbt_cold: (string | number)[][];
}

const rows = ref<SpuriousProfileRow[]>([]);
const saving = ref(false);
const gridApi = shallowRef<GridApi | null>(null);

const defaultColDef: ColDef = { resizable: true, sortable: true, filter: true, minWidth: 100, enableRowGroup: true };

const columnDefs: ColDef[] = [
  { field: 'code',            headerName: 'Code',            editable: false, minWidth: 80  },
  { field: 'port',            headerName: 'Port',            editable: false, minWidth: 80  },
  { field: 'frequency_label', headerName: 'Freq Label',      editable: false, minWidth: 110 },
  { field: 'frequency',       headerName: 'Frequency (MHz)', editable: false, minWidth: 140 },
  {
    field: 'profiles',
    headerName: 'Profile',
    editable: true,
    cellEditor: 'agRichSelectCellEditor',
    cellEditorParams: {
      values: [...PROFILE_OPTIONS],
      multiSelect: true,
      searchType: 'matchAny',
      filterList: true,
    },
    valueFormatter: (params) =>
      Array.isArray(params.value) ? params.value.join(', ') : (params.value ?? ''),
    minWidth: 220,
    flex: 1,
  },
];

function onGridReady(event: GridReadyEvent) {
  gridApi.value = event.api;
  event.api.sizeColumnsToFit();
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function uniqueByKey(items: SpuriousProfileRow[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.transmitter_code}|${item.code}|${item.port}|${item.frequency_label}|${item.frequency ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toBands(value: unknown): (string | number)[][] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => Array.isArray(item) && item.length >= 2)
    .map((item) => [item[0] as string | number, item[1] as string | number]);
}

function parseProfiles(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }

  return [];
}

function mapParameterRowsToProfileRows(payload: ParameterRowsResponse): SpuriousProfileRow[] {
  return (payload.rows ?? []).map((item) => {
    const profiles = parseProfiles(item.row?.profiles);
    return {
      transmitter_code: String(item.transmitter_code ?? ''),
      code: String(item.row?.code ?? ''),
      port: String(item.row?.port ?? ''),
      frequency_label: String(item.row?.frequency_label ?? ''),
      frequency: toNumberOrNull(item.row?.frequency),
      profile_name: String(item.row?.profile_name ?? (profiles[0] ?? '')),
      enable: item.row?.enable !== false,
      profiles,
      specification: item.row?.specification ?? null,
      tolerance: item.row?.tolerance ?? null,
      fbt: toBands(item.row?.fbt),
      fbt_hot: toBands(item.row?.fbt_hot),
      fbt_cold: toBands(item.row?.fbt_cold),
    };
  });
}

function mapTransmittersToProfileRows(list: Transmitter[]): SpuriousProfileRow[] {
  const out: SpuriousProfileRow[] = [];

  for (const tx of list) {
    const specs = tx.modulation_details?.spurious_specs ?? [];
    for (const row of specs) {
      out.push({
        transmitter_code: String(tx.code ?? ''),
        code: String(row.code ?? ''),
        port: String(row.port ?? ''),
        frequency_label: String(row.frequency_label ?? ''),
        frequency: toNumberOrNull(row.frequency),
        profile_name: String((row as any).profile_name ?? ''),
        enable: (row as any).enable !== false,
        profiles: [],
        specification: row.specification ?? null,
        tolerance: row.tolerance ?? null,
        fbt: toBands(row.fbt),
        fbt_hot: toBands(row.fbt_hot),
        fbt_cold: toBands(row.fbt_cold),
      });
    }
  }

  return out;
}

async function load() {
  // Primary source: normalized spurious parameter rows endpoint.
  const parameterRes = await api.getParameterRows('spurious');
  if (!parameterRes.error.value && parameterRes.data.value) {
    const payload = parameterRes.data.value as ParameterRowsResponse;
    rows.value = uniqueByKey(mapParameterRowsToProfileRows(payload));
    return;
  }

  // Fallback source: full transmitter list and local spurious_specs.
  const txRes = await api.getTransmitters();
  if (!txRes.error.value && txRes.data.value) {
    const txList = txRes.data.value as Transmitter[];
    rows.value = uniqueByKey(mapTransmittersToProfileRows(txList));
    return;
  }

  toast.add({ severity: 'error', summary: 'Load Failed', detail: 'Unable to load applicable spurious transmitter rows.', life: 3500 });
}

async function save() {
  saving.value = true;
  try {
    const data: SpuriousProfileRow[] = [];
    gridApi.value?.forEachNode((n) => { if (n.data) data.push(n.data as SpuriousProfileRow); });

    const payload = {
      rows: data
        .map((r) => ({
          transmitter_code: String(r.transmitter_code ?? ''),
          row: {
            code: String(r.code ?? ''),
            port: String(r.port ?? ''),
            frequency_label: String(r.frequency_label ?? ''),
            frequency: r.frequency === null ? '' : String(r.frequency),
            profile_name: String(r.profile_name ?? ''),
            enable: r.enable !== false,
            specification: r.specification ?? null,
            tolerance: r.tolerance ?? -50,
            fbt: r.fbt?.length ? r.fbt : [['', '']],
            fbt_hot: r.fbt_hot?.length ? r.fbt_hot : [['', '']],
            fbt_cold: r.fbt_cold?.length ? r.fbt_cold : [['', '']],
            // Keep selected profile labels and single profile name aligned.
            profiles: (r.profiles?.length ? [...r.profiles] : (String(r.profile_name ?? '').trim() ? [String(r.profile_name ?? '').trim()] : [])),
          },
        }))
        .filter((r) => r.transmitter_code !== ''),
    };

    const res = await api.saveParameterRows('spurious', payload);
    if (res.error.value) {
      toast.add({ severity: 'error', summary: 'Save Failed', detail: 'Unable to save spurious profile rows.', life: 3500 });
      return;
    }

    const summary = res.data.value as any;
    toast.add({
      severity: 'success',
      summary: 'Saved',
      detail: `Spurious Profile updated (${summary?.updated_rows ?? 0} rows).`,
      life: 3000,
    });

    await load();
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void load();
});
</script>

<style scoped>
.tp-panel {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 4rem);
  padding: 1.5rem;
  color: #e2e8f0;
  box-sizing: border-box;
}

.tp-header h2 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #22d3ee;
  margin: 0 0 1rem;
}

.tp-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.tp-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  flex-shrink: 0;
}

.tp-section-header h3 {
  font-size: 0.95rem;
  font-weight: 500;
  color: #cbd5e1;
  margin: 0;
}

.actions { display: flex; gap: 0.5rem; }

.tp-grid { flex: 1; min-height: 0; }
</style>
