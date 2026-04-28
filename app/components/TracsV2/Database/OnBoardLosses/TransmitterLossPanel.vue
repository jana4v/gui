<template>
  <div class="obl-panel">
    <Toast />
    <div class="obl-header">
      <h2>On Board Losses / Transmitter</h2>
    </div>

    <div class="obl-section">
      <div class="obl-section-header">
        <h3>Loss</h3>
        <div class="actions">
          <Button label="Refresh" size="small" severity="secondary" @click="load" />
          <Button label="Save" size="small" :loading="saving" @click="save" />
        </div>
      </div>

      <ag-grid-vue
        class="obl-grid"
        style="width: 100%; height: 100%;"
        :theme="isDark
          ? themeQuartz.withPart(colorSchemeDarkBlue)
          : themeQuartz.withPart(colorSchemeLightCold)"
        :columnDefs="columnDefs"
        :rowData="rows"
        :defaultColDef="defaultColDef"
        :cellSelection="cellSelection"
        :suppressContextMenu="true"
        :suppressMovableColumns="true"
        :undoRedoCellEditing="true"
        :undoRedoCellEditingLimit="20"
        rowGroupPanelShow="always"
        groupDisplayType="singleColumn"
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
import type { ColDef } from 'ag-grid-community';
import { AgGridVue } from 'ag-grid-vue3';
import {
  useTransmitterApi,
  type CatalogLossRow,
} from '@/composables/tracsV2/useTransmitterApi';

ModuleRegistry.registerModules([AllEnterpriseModule]);

interface LossRow {
  row_id: number;
  port_id: number;
  frequency_id: number;
  transmitter_code: string;
  code: string;
  port: string;
  frequency_label: string;
  frequency: string;
  loss_db: string;
}

const toast = useToast();
const isDark = useDark();
const api = useTransmitterApi();

const rows = ref<LossRow[]>([]);
const saving = ref(false);

const defaultColDef: ColDef = {
  resizable: true,
  sortable: true,
  filter: true,
  minWidth: 120,
  enableRowGroup: true,
};

const cellSelection = {
  mode: 'range' as const,
  handle: {
    mode: 'fill' as const,
    direction: 'xy' as const,
    suppressClearOnFillReduction: true,
  },
};

const columnDefs: ColDef[] = [
  { field: 'code', headerName: 'Code', editable: false, minWidth: 130, flex: 1 },
  { field: 'port', headerName: 'Port', editable: false, minWidth: 120, flex: 1 },
  { field: 'frequency_label', headerName: 'Frequency Label', editable: false, minWidth: 170, flex: 1.2 },
  { field: 'frequency', headerName: 'Frequency', editable: false, minWidth: 140, flex: 1 },
  { field: 'loss_db', headerName: 'Loss(dB)', editable: true, minWidth: 140, flex: 1 },
];

function mapPowerRowsToLossRows(payload: CatalogLossRow[]): LossRow[] {
  return (payload ?? []).map((item) => ({
    row_id: Number(item.id ?? 0),
    port_id: Number(item.port_id ?? 0),
    frequency_id: Number(item.frequency_id ?? 0),
    transmitter_code: String(item.system_code ?? ''),
    code: String(item.system_code ?? ''),
    port: String(item.port_name ?? ''),
    frequency_label: String(item.frequency_label ?? ''),
    frequency: String(item.frequency_hz ?? ''),
    loss_db: String(item.loss_db ?? '0'),
  }));
}

async function load() {
  const res = await api.getSystemCatalogTransmitterLossRows();
  if (res.error.value) {
    toast.add({ severity: 'error', summary: 'Load Failed', detail: 'Unable to load transmitter rows.', life: 3500 });
    return;
  }

  const payload = (res.data.value as CatalogLossRow[]) ?? [];
  rows.value = mapPowerRowsToLossRows(payload);
}

async function save() {
  saving.value = true;
  try {
    const payloadRows = rows.value.filter((r) => r.transmitter_code !== '');

    const saveResults = await Promise.all(
      payloadRows.map(async (r, index) => api.upsertSystemCatalogTransmitterLossRow(r.transmitter_code, {
        port_id: Number(r.port_id),
        frequency_id: Number(r.frequency_id),
        loss_db: r.loss_db === '' ? null : Number(r.loss_db),
        payload: {},
        sort_order: index,
      })),
    );

    if (saveResults.some((result) => Boolean(result.error.value))) {
      toast.add({ severity: 'error', summary: 'Save Failed', detail: 'Unable to save on board losses.', life: 3500 });
      return;
    }

    toast.add({
      severity: 'success',
      summary: 'Saved',
      detail: `On board losses updated (${payloadRows.length} rows).`,
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
.obl-panel {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 4rem);
  padding: 1.5rem;
  color: #e2e8f0;
  box-sizing: border-box;
}

.obl-header h2 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #22d3ee;
  margin: 0 0 1rem;
}

.obl-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.obl-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  flex-shrink: 0;
}

.obl-section-header h3 {
  font-size: 0.95rem;
  font-weight: 500;
  color: #cbd5e1;
  margin: 0;
}

.actions { display: flex; gap: 0.5rem; }

.obl-grid { flex: 1; min-height: 0; }
</style>
