<template>
  <ag-grid-vue
    style="width: 100%;"
    :columnDefs="columnDefs"
    :defaultColDef="defaultColDef"
    :autoSizeStrategy="autoSizeStrategy"
    :enableRangeSelection="true"
    :enableFillHandle="true"
    rowGroupPanelShow="always"
    groupDisplayType="singleColumn"
    domLayout="autoHeight"
    :undoRedoCellEditing="true"
    :undoRedoCellEditingLimit="10"
    :getRowId="getRowId"
    :theme="isDark
      ? themeQuartz.withPart(colorSchemeDarkBlue)
      : themeQuartz.withPart(colorSchemeLightCold)"
    @grid-ready="onGridReady"
  />
</template>

<script lang="ts" setup>
import { ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import {
  colorSchemeDarkBlue,
  colorSchemeLightCold,
  themeQuartz,
} from 'ag-grid-community';
import type { ColDef, GridApi, GridReadyEvent, ValueGetterParams } from 'ag-grid-community';
import { AgGridVue } from 'ag-grid-vue3';
import type { CalibrationRow } from '@/composables/tracsV2/useTransmitterApi';

ModuleRegistry.registerModules([AllEnterpriseModule]);

const props = defineProps<{
  rowData: CalibrationRow[];
  isEditable: boolean;
}>();

const isDark = useDark();
const gridApi = shallowRef<GridApi | null>(null);

const toNumber = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const computeTotalLoss = (row: CalibrationRow): number =>
  toNumber(row.onboard_loss) + toNumber(row.system_loss) + toNumber(row.fixed_pad) - toNumber(row.antenna_gain);

const columnDefs = computed<ColDef[]>(() => [
  { field: 'code',            headerName: 'Code',               editable: false,            minWidth: 70,  flex: 1   },
  { field: 'port',            headerName: 'Port',               editable: false,            minWidth: 70,  flex: 1   },
  { field: 'frequency_label', headerName: 'Freq Label',         editable: false,            minWidth: 90,  flex: 1.4 },
  { field: 'frequency',       headerName: 'Frequency (MHz)',    editable: false,            minWidth: 110, flex: 1.4 },
  { field: 'onboard_loss',    headerName: 'Onboard Loss (dB)',  editable: props.isEditable, minWidth: 130, flex: 1.4 },
  { field: 'system_loss',     headerName: 'System Loss (dB)',   editable: false,            minWidth: 120, flex: 1.3 },
  { field: 'fixed_pad',       headerName: 'Fixed Pad (dB)',     editable: props.isEditable, minWidth: 120, flex: 1.3 },
  { field: 'antenna_gain',    headerName: 'Antenna Gain (dBi)', editable: props.isEditable, minWidth: 140, flex: 1.4 },
  {
    field: 'total_loss',
    headerName: 'Total Loss (dB)',
    editable: false,
    minWidth: 120,
    flex: 1.3,
    valueGetter: (params: ValueGetterParams<CalibrationRow>) => {
      if (!params.data) return null;
      const total = computeTotalLoss(params.data);
      return Number.isFinite(total) ? Number(total.toFixed(3)) : null;
    },
  },
]);

const defaultColDef: ColDef = {
  resizable: true,
  sortable: true,
  filter: true,
  enableRowGroup: true,
};

const autoSizeStrategy = { type: 'fitGridWidth' } as const;

const getRowId = (params: any) =>
  `${params.data.port}|${params.data.frequency_label}|${params.data.frequency}`;

function onGridReady(event: GridReadyEvent) {
  gridApi.value = event.api;
  if (props.rowData.length > 0) {
    gridApi.value.applyTransaction({ add: props.rowData });
  }
}

function setRows(newRows: CalibrationRow[]) {
  if (!gridApi.value) return;

  const current: CalibrationRow[] = [];
  gridApi.value.forEachNode((n) => { if (n.data) current.push(n.data as CalibrationRow); });

  const key = (r: CalibrationRow) => `${r.port}|${r.frequency_label}|${r.frequency}`;
  const currentMap = new Map(current.map(r => [key(r), r]));
  const newMap = new Map(newRows.map(r => [key(r), r]));

  const toAdd = newRows.filter(r => !currentMap.has(key(r)));
  const toRemove = current.filter(r => !newMap.has(key(r)));
  const toUpdate = newRows.filter(r => {
    const ex = currentMap.get(key(r));
    return ex && ex.code !== r.code;
  });

  gridApi.value.applyTransaction({ add: toAdd, remove: toRemove, update: toUpdate });
}

function getData(): CalibrationRow[] {
  const rows: CalibrationRow[] = [];
  gridApi.value?.forEachNode((n) => {
    if (!n.data) return;
    const row = n.data as CalibrationRow;
    rows.push({
      ...row,
      total_loss: Number(computeTotalLoss(row).toFixed(3)),
    });
  });
  return rows;
}

defineExpose({ getData, setRows });
</script>
