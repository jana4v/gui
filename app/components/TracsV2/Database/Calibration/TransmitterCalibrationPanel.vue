<template>
  <div class="cal-panel">
    <Toast />
    <div class="cal-header">
      <h2>Calibration / Transmitter</h2>
    </div>

    <div class="cal-section">
      <div class="cal-section-header">
        <h3>Calibration</h3>
        <div class="actions">
          <Button label="Refresh" size="small" severity="secondary" @click="load" />
          <Button label="Save" size="small" :loading="saving" @click="save" />
        </div>
      </div>

      <ag-grid-vue
        class="cal-grid"
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
        @cell-value-changed="onCellValueChanged"
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
import type { CellValueChangedEvent, ColDef } from 'ag-grid-community';
import { AgGridVue } from 'ag-grid-vue3';
import {
  useTransmitterApi,
  type CalibrationRowsResponse,
} from '@/composables/tracsV2/useTransmitterApi';

ModuleRegistry.registerModules([AllEnterpriseModule]);

interface CalibrationGridRow {
  transmitter_code: string;
  code: string;
  port: string;
  frequency_label: string;
  frequency: string;
  system_loss: string;
  fixed_pad_loss: string;
  antenna_gain: string;
  total_loss: string;
}

const toast = useToast();
const isDark = useDark();
const api = useTransmitterApi();

const rows = ref<CalibrationGridRow[]>([]);
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
  { field: 'system_loss', headerName: 'System Loss(dB)', editable: false, minWidth: 160, flex: 1 },
  { field: 'fixed_pad_loss', headerName: 'Fixed Pad Loss(dB)', editable: true, minWidth: 170, flex: 1.1 },
  { field: 'antenna_gain', headerName: 'Antenna Gain(dBi)', editable: true, minWidth: 170, flex: 1.1 },
  { field: 'total_loss', headerName: 'Total Loss(dB)', editable: false, minWidth: 150, flex: 1 },
];

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '';
  return String(Math.round(value * 1000) / 1000);
}

function calculateTotalLoss(row: CalibrationGridRow): string {
  const total = toNumber(row.antenna_gain) - toNumber(row.system_loss) - toNumber(row.fixed_pad_loss);
  return formatNumber(total);
}

function mapRows(payload: CalibrationRowsResponse): CalibrationGridRow[] {
  return (payload.rows ?? []).map((item) => {
    const row: CalibrationGridRow = {
      transmitter_code: String(item.transmitter_code ?? ''),
      code: String(item.row?.code ?? ''),
      port: String(item.row?.port ?? ''),
      frequency_label: String(item.row?.frequency_label ?? ''),
      frequency: String(item.row?.frequency ?? ''),
      system_loss: String(item.row?.system_loss ?? '0'),
      fixed_pad_loss: String(item.row?.fixed_pad_loss ?? '0'),
      antenna_gain: String(item.row?.antenna_gain ?? '0'),
      total_loss: String(item.row?.total_loss ?? '0'),
    };
    row.total_loss = calculateTotalLoss(row);
    return row;
  });
}

function recalculateAllTotals() {
  rows.value = rows.value.map((r) => ({ ...r, total_loss: calculateTotalLoss(r) }));
}

function onCellValueChanged(event: CellValueChangedEvent) {
  const field = String(event.colDef.field ?? '');
  if (field !== 'fixed_pad_loss' && field !== 'antenna_gain') return;

  const row = event.data as CalibrationGridRow;
  row.total_loss = calculateTotalLoss(row);
}

async function load() {
  const res = await api.getCalibrationRows();
  if (res.error.value) {
    toast.add({ severity: 'error', summary: 'Load Failed', detail: 'Unable to load calibration rows.', life: 3500 });
    return;
  }

  const payload = (res.data.value as CalibrationRowsResponse) ?? { unit: 'dB', rows: [] };
  rows.value = mapRows(payload);
  recalculateAllTotals();
}

async function save() {
  saving.value = true;
  try {
    recalculateAllTotals();

    const payloadRows = rows.value
      .map((r) => ({
        transmitter_code: r.transmitter_code,
        row: {
          code: r.code,
          port: r.port,
          frequency_label: r.frequency_label,
          frequency: r.frequency,
          system_loss: r.system_loss,
          fixed_pad_loss: r.fixed_pad_loss,
          antenna_gain: r.antenna_gain,
          total_loss: r.total_loss,
        },
      }))
      .filter((r) => r.transmitter_code !== '');

    const res = await api.saveCalibrationRows({ rows: payloadRows });
    if (res.error.value) {
      toast.add({ severity: 'error', summary: 'Save Failed', detail: 'Unable to save calibration rows.', life: 3500 });
      return;
    }

    const summary = res.data.value as any;
    toast.add({
      severity: 'success',
      summary: 'Saved',
      detail: `Calibration updated (${summary?.updated_rows ?? 0} rows).`,
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
.cal-panel {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 4rem);
  padding: 1.5rem;
  color: #e2e8f0;
  box-sizing: border-box;
}

.cal-header h2 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #22d3ee;
  margin: 0 0 1rem;
}

.cal-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.cal-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  flex-shrink: 0;
}

.cal-section-header h3 {
  font-size: 0.95rem;
  font-weight: 500;
  color: #cbd5e1;
  margin: 0;
}

.actions { display: flex; gap: 0.5rem; }

.cal-grid { flex: 1; min-height: 0; }
</style>
