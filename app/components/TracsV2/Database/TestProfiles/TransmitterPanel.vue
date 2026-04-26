<template>
  <div class="tp-tx-panel">
    <Toast />
    <div class="tp-header">
      <h2>Test Profiles — Transmitter</h2>
    </div>

    <!-- ─── Table 1: Spurious Profiles Definitions ─────────────────── -->
    <div class="tp-section">
      <div class="tp-section-header">
        <h3>Spurious Profiles Definitions</h3>
        <div class="actions">
          <Button
            icon="pi pi-plus"
            label="Add Row"
            size="small"
            severity="secondary"
            @click="addDefinitionRow"
          />
          <Button
            icon="pi pi-trash"
            label="Delete"
            size="small"
            severity="danger"
            :disabled="defSelectedRows.length === 0"
            @click="deleteDefinitionRows"
          />
          <Button label="Save" size="small" :loading="savingDefs" @click="saveDefinitions" />
        </div>
      </div>

      <ag-grid-vue
        class="tp-grid"
        style="width: 100%; height: 220px;"
        :theme="isDark
          ? themeQuartz.withPart(colorSchemeDarkBlue)
          : themeQuartz.withPart(colorSchemeLightCold)"
        :columnDefs="defColumnDefs"
        :rowData="defRows"
        :defaultColDef="defaultColDef"
        rowSelection="multiple"
        :suppressContextMenu="true"
        :suppressMovableColumns="true"
        :undoRedoCellEditing="true"
        :undoRedoCellEditingLimit="20"
        @grid-ready="onDefGridReady"
        @selection-changed="onDefSelectionChanged"
      />
    </div>

    <!-- ─── Table 2: Spurious Profile ──────────────────────────────── -->
    <div class="tp-section">
      <div class="tp-section-header">
        <h3>Spurious Profile</h3>
        <div class="actions">
          <Button label="Refresh" size="small" severity="secondary" @click="loadSpuriousProfile" />
          <Button label="Save" size="small" :loading="savingProfile" @click="saveSpuriousProfile" />
        </div>
      </div>

      <ag-grid-vue
        class="tp-grid"
        style="width: 100%; height: 420px;"
        :theme="isDark
          ? themeQuartz.withPart(colorSchemeDarkBlue)
          : themeQuartz.withPart(colorSchemeLightCold)"
        :columnDefs="spuriousProfileColDefs"
        :rowData="spuriousProfileRows"
        :defaultColDef="defaultColDef"
        :suppressContextMenu="true"
        :suppressMovableColumns="true"
        @grid-ready="onProfileGridReady"
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

ModuleRegistry.registerModules([AllEnterpriseModule]);

const toast = useToast();
const isDark = useDark();

const PROFILE_OPTIONS = ['Detailed', 'Short', 'Minimal'] as const;

// ── shared column defaults ─────────────────────────────────────
const defaultColDef: ColDef = {
  resizable: true,
  sortable: true,
  filter: true,
  minWidth: 100,
};

// ══════════════════════════════════════════════════════════════════
// TABLE 1 — Spurious Profiles Definitions
// ══════════════════════════════════════════════════════════════════

interface ProfileDefinitionRow {
  profile_name: string;
  enable: boolean;
  start_frequency: number | null;
  stop_frequency: number | null;
}

const defRows = ref<ProfileDefinitionRow[]>([
  { profile_name: 'Detailed', enable: true, start_frequency: null, stop_frequency: null },
  { profile_name: 'Short',    enable: true, start_frequency: null, stop_frequency: null },
  { profile_name: 'Minimal',  enable: true, start_frequency: null, stop_frequency: null },
]);

const defSelectedRows = ref<ProfileDefinitionRow[]>([]);
const savingDefs = ref(false);
const defGridApi = shallowRef<GridApi | null>(null);

const defColumnDefs: ColDef[] = [
  {
    field: 'profile_name',
    headerName: 'Profile Name',
    editable: true,
    cellEditor: 'agSelectCellEditor',
    cellEditorParams: { values: [...PROFILE_OPTIONS] },
    checkboxSelection: true,
    headerCheckboxSelection: true,
    minWidth: 160,
    flex: 1,
  },
  {
    field: 'enable',
    headerName: 'Enable',
    editable: true,
    cellDataType: 'boolean',
    cellRenderer: 'agCheckboxCellRenderer',
    minWidth: 100,
    maxWidth: 120,
  },
  {
    field: 'start_frequency',
    headerName: 'Start Frequency (MHz)',
    editable: true,
    cellDataType: 'number',
    minWidth: 170,
    flex: 1,
  },
  {
    field: 'stop_frequency',
    headerName: 'Stop Frequency (MHz)',
    editable: true,
    cellDataType: 'number',
    minWidth: 170,
    flex: 1,
  },
];

function onDefGridReady(event: GridReadyEvent) {
  defGridApi.value = event.api;
  event.api.sizeColumnsToFit();
}

function onDefSelectionChanged(event: any) {
  defSelectedRows.value = event.api.getSelectedRows() as ProfileDefinitionRow[];
}

function addDefinitionRow() {
  defRows.value = [
    ...defRows.value,
    { profile_name: 'Detailed', enable: true, start_frequency: null, stop_frequency: null },
  ];
}

function deleteDefinitionRows() {
  const selected = defGridApi.value?.getSelectedRows() ?? [];
  defRows.value = defRows.value.filter((r) => !selected.includes(r));
  defSelectedRows.value = [];
}

async function saveDefinitions() {
  savingDefs.value = true;
  try {
    const rows: ProfileDefinitionRow[] = [];
    defGridApi.value?.forEachNode((n) => { if (n.data) rows.push(n.data as ProfileDefinitionRow); });
    // TODO: replace with API call
    await new Promise((r) => setTimeout(r, 300));
    toast.add({ severity: 'success', summary: 'Saved', detail: 'Spurious Profiles Definitions saved.', life: 3000 });
  } finally {
    savingDefs.value = false;
  }
}

// ══════════════════════════════════════════════════════════════════
// TABLE 2 — Spurious Profile
// ══════════════════════════════════════════════════════════════════

interface SpuriousProfileRow {
  code: string;
  port: string;
  frequency_label: string;
  frequency: number | null;
  profiles: string[];
}

const spuriousProfileRows = ref<SpuriousProfileRow[]>([]);
const savingProfile = ref(false);
const profileGridApi = shallowRef<GridApi | null>(null);

const spuriousProfileColDefs: ColDef[] = [
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

function onProfileGridReady(event: GridReadyEvent) {
  profileGridApi.value = event.api;
  event.api.sizeColumnsToFit();
}

async function loadSpuriousProfile() {
  // TODO: replace with API call
  toast.add({ severity: 'info', summary: 'Info', detail: 'No data source configured yet.', life: 3000 });
}

async function saveSpuriousProfile() {
  savingProfile.value = true;
  try {
    const rows: SpuriousProfileRow[] = [];
    profileGridApi.value?.forEachNode((n) => { if (n.data) rows.push(n.data as SpuriousProfileRow); });
    // TODO: replace with API call
    await new Promise((r) => setTimeout(r, 300));
    toast.add({ severity: 'success', summary: 'Saved', detail: 'Spurious Profile saved.', life: 3000 });
  } finally {
    savingProfile.value = false;
  }
}
</script>

<style scoped>
.tp-tx-panel {
  padding: 1.5rem;
  color: #e2e8f0;
}

.tp-header h2 {
  font-size: 1.2rem;
  font-weight: 600;
  color: #22d3ee;
  margin: 0 0 1.5rem;
}

.tp-section {
  margin-bottom: 2rem;
}

.tp-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.tp-section-header h3 {
  font-size: 0.95rem;
  font-weight: 500;
  color: #cbd5e1;
  margin: 0;
}

.actions {
  display: flex;
  gap: 0.5rem;
}
</style>

