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
  type OnBoardLossRowsResponse,
} from '@/composables/tracsV2/useTransmitterApi';

ModuleRegistry.registerModules([AllEnterpriseModule]);

interface LossRow {
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

function mapPowerRowsToLossRows(payload: OnBoardLossRowsResponse): LossRow[] {
  return (payload.rows ?? []).map((item) => ({
    transmitter_code: String(item.transmitter_code ?? ''),
    code: String(item.row?.code ?? ''),
    port: String(item.row?.port ?? ''),
    frequency_label: String(item.row?.frequency_label ?? ''),
    frequency: String(item.row?.frequency ?? ''),
    loss_db: String(item.row?.loss_db ?? '0'),
  }));
}

async function load() {
  const res = await api.getOnBoardLossRows();
  if (res.error.value) {
    toast.add({ severity: 'error', summary: 'Load Failed', detail: 'Unable to load transmitter rows.', life: 3500 });
    return;
  }

  const payload = (res.data.value as OnBoardLossRowsResponse) ?? { unit: 'dB', rows: [] };
  rows.value = mapPowerRowsToLossRows(payload);
}

async function save() {
  saving.value = true;
  try {
    const payloadRows = rows.value.map((r) => ({
      transmitter_code: r.transmitter_code,
      row: {
        code: r.code,
        port: r.port,
        frequency_label: r.frequency_label,
        frequency: r.frequency,
        loss_db: r.loss_db,
      },
    })).filter((r) => r.transmitter_code !== '');

    const res = await api.saveOnBoardLossRows({ rows: payloadRows });
    if (res.error.value) {
      toast.add({ severity: 'error', summary: 'Save Failed', detail: 'Unable to save on board losses.', life: 3500 });
      return;
    }

    const summary = res.data.value as any;
    toast.add({
      severity: 'success',
      summary: 'Saved',
      detail: `On board losses updated (${summary?.updated_rows ?? 0} rows).`,
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
