<template>
  <div class="downlink-panel">
    <Dialog
      v-model:visible="showPromptDialog"
      modal
      :closable="false"
      :draggable="false"
      :style="{ width: '34rem' }"
      header="Operator Action Required"
    >
      <p class="prompt-message">{{ promptMessage }}</p>
      <template #footer>
        <Button label="Abort" severity="danger" outlined @click="onPromptAbort" />
        <Button label="Connected" @click="onPromptConnected" />
      </template>
    </Dialog>

    <div class="downlink-layout">
      <section class="left-pane pane-card">
        <div class="panel-header">
          <h3>Select Channels</h3>
          <Button label="Refresh" size="small" severity="secondary" :disabled="isRunning" @click="load" />
        </div>

        <ag-grid-vue
          class="downlink-grid"
          style="width: 100%; height: 100%;"
          :theme="isDark
            ? themeQuartz.withPart(colorSchemeDarkBlue)
            : themeQuartz.withPart(colorSchemeLightCold)"
          :columnDefs="columnDefs"
          :rowData="rows"
          :rowSelection="rowSelection"
          :autoGroupColumnDef="autoGroupColumnDef"
          :defaultColDef="defaultColDef"
          :suppressContextMenu="true"
          :suppressMovableColumns="true"
          :suppressGroupChangesColumnVisibility="'suppressHideOnGroup'"
          :groupDefaultExpanded="0"
          rowGroupPanelShow="always"
          groupDisplayType="singleColumn"
          @grid-ready="onGridReady"
          @selection-changed="onSelectionChanged"
        />

        <div class="panel-footer">
          <Button label="Start Cal" class="action-btn" :disabled="isRunning || !props.calId || !hasSelectedChannels" @click="startCal" />
          <Button label="Abort" class="action-btn" severity="danger" outlined :disabled="!isRunning" @click="abortCal" />
        </div>

        <div class="status-window" aria-label="Calibration status window">
          <div class="status-title">
            Status Window
            <span v-if="isRunning" class="run-badge">RUNNING {{ Math.round(progress) }}%</span>
          </div>
          <div class="status-body">
            <p v-for="(line, idx) in statusLines" :key="idx" class="status-line">{{ line }}</p>
          </div>
        </div>
      </section>

      <section class="right-pane pane-card">
        <div class="panel-header right-header">
          <h3>Calibration Data</h3>
        </div>

        <div class="sample-body">
          <div v-if="samples.length === 0" class="placeholder-area">
            <i class="pi pi-chart-line" />
            <p>Calibration data will appear while run is active.</p>
          </div>

          <div v-else class="sample-list">
            <div class="sample-header">
              <span>Channel</span>
              <span>Frequency</span>
              <span>Value (dB)</span>
            </div>
            <div v-for="(s, idx) in samples" :key="`${s.timestamp}-${idx}`" class="sample-row">
              <span>{{ s.code }}/{{ s.port }}</span>
              <span>{{ s.frequency }}</span>
              <span>{{ s.value }}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import {
  colorSchemeDarkBlue,
  colorSchemeLightCold,
  themeQuartz,
} from 'ag-grid-community';
import type { ColDef, GridApi, GridReadyEvent } from 'ag-grid-community';
import { AgGridVue } from 'ag-grid-vue3';
import { useToast } from 'primevue/usetoast';
import {
  useTransmitterApi,
  type CalibrationRowsResponse,
  type Transmitter,
} from '@/composables/tracsV2/useTransmitterApi';
import {
  useCalibrationRunApi,
  type CalibrationChannel,
  type CalibrationRunSnapshot,
  type CalibrationSample,
} from '@/composables/tracsV2/useCalibrationRunApi';

ModuleRegistry.registerModules([AllEnterpriseModule]);

const props = defineProps<{
  calId: string;
  calType: string;
  includeSpuriousBands?: boolean;
}>();

interface DownlinkChannelRow {
  code: string;
  port: string;
  frequency: string;
  frequency_label: string;
}

const isDark = useDark();
const toast = useToast();
const api = useTransmitterApi();
const runApi = useCalibrationRunApi();

const rows = ref<DownlinkChannelRow[]>([]);
const statusLines = ref<string[]>(['Ready. Select channels and click Start Cal.']);
const samples = ref<CalibrationSample[]>([]);
const isRunning = ref(false);
const progress = ref(0);
const runId = ref<string | null>(null);
const showPromptDialog = ref(false);
const promptMessage = ref('Connect Cal Power Sensor to selected cable and confirm.');
const selectedChannelCount = ref(0);

const gridApi = shallowRef<GridApi | null>(null);
let eventSource: EventSource | null = null;

const rowSelection = {
  mode: 'multiRow' as const,
  checkboxes: true,
  headerCheckbox: true,
  checkboxLocation: 'autoGroupColumn' as const,
  enableClickSelection: false,
  hideDisabledCheckboxes: false,
  groupSelects: 'descendants' as const,
};

const autoGroupColumnDef: ColDef = {
  headerName: 'Group',
  minWidth: 200,
  cellRendererParams: { suppressCount: false },
};

const defaultColDef: ColDef = {
  resizable: true,
  sortable: true,
  filter: true,
  minWidth: 120,
  enableRowGroup: true,
};

const hasSelectedChannels = computed(() => {
  return selectedChannelCount.value > 0;
});

const columnDefs: ColDef[] = [
  {
    field: 'code',
    headerName: 'Code',
    editable: false,
    minWidth: 130,
    flex: 1,
  },
  {
    field: 'port',
    headerName: 'Port',
    editable: false,
    rowGroup: true,
    minWidth: 120,
    flex: 1,
  },
  {
    field: 'frequency',
    headerName: 'Frequency',
    editable: false,
    minWidth: 140,
    flex: 1,
  },
  {
    field: 'frequency_label',
    headerName: 'Frequency Label',
    editable: false,
    minWidth: 180,
    flex: 1.2,
  },
  {
    field: 'select',
    headerName: 'Select',
    editable: false,
    filter: false,
    sortable: false,
    resizable: false,
    minWidth: 100,
    maxWidth: 120,
    valueGetter: () => '',
  },
];

function onGridReady(event: GridReadyEvent) {
  gridApi.value = event.api;
  onSelectionChanged();
}

function onSelectionChanged() {
  const apiRef = gridApi.value;
  if (!apiRef) {
    selectedChannelCount.value = 0;
    return;
  }

  selectedChannelCount.value = apiRef
    .getSelectedNodes()
    .filter((node) => !node.group && !!node.data)
    .length;
}

function mapRows(payload: CalibrationRowsResponse): DownlinkChannelRow[] {
  return (payload.rows ?? []).map((item) => ({
    code: String(item.row?.code ?? ''),
    port: String(item.row?.port ?? ''),
    frequency: String(item.row?.frequency ?? ''),
    frequency_label: String(item.row?.frequency_label ?? ''),
  }));
}

function mapRowsFromTransmitters(items: Transmitter[]): DownlinkChannelRow[] {
  const out: DownlinkChannelRow[] = [];
  const seen = new Set<string>();

  for (const tx of items ?? []) {
    const specs = tx?.modulation_details?.power_specs ?? [];
    for (const row of specs) {
      const mapped: DownlinkChannelRow = {
        code: String(row?.code ?? tx?.code ?? ''),
        port: String(row?.port ?? ''),
        frequency: String(row?.frequency ?? ''),
        frequency_label: String(row?.frequency_label ?? ''),
      };
      const key = `${mapped.code}|${mapped.port}|${mapped.frequency_label}|${mapped.frequency}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push(mapped);
      }
    }
  }

  return out;
}

function collectSelectedChannels(): CalibrationChannel[] {
  const selected: CalibrationChannel[] = [];
  const apiRef = gridApi.value;
  if (!apiRef) return selected;

  for (const node of apiRef.getSelectedNodes()) {
    if (node.group || !node.data) continue;
    selected.push({
      code: String(node.data.code ?? ''),
      port: String(node.data.port ?? ''),
      frequency_label: String(node.data.frequency_label ?? ''),
      frequency: String(node.data.frequency ?? ''),
    });
  }

  return selected;
}

function isSnapshotForCurrentCalType(snapshot: Partial<CalibrationRunSnapshot>) {
  const snapshotType = String(snapshot?.cal_type ?? '').trim().toLowerCase();
  const currentType = String(props.calType ?? '').trim().toLowerCase();
  return !!snapshotType && snapshotType === currentType;
}

function isSnapshotForCurrentSelection(snapshot: Partial<CalibrationRunSnapshot>) {
  if (!isSnapshotForCurrentCalType(snapshot)) return false;
  const currentCalId = String(props.calId ?? '').trim();
  if (!currentCalId) return true;
  return String(snapshot?.cal_id ?? '').trim() === currentCalId;
}

function isStaleAbortingSnapshot(snapshot: Partial<CalibrationRunSnapshot>) {
  if (String(snapshot?.state ?? '') !== 'aborting') return false;
  const updatedAtMs = Date.parse(String(snapshot?.updated_at ?? ''));
  if (Number.isNaN(updatedAtMs)) return false;
  return Date.now() - updatedAtMs > 15000;
}

function resetRunUi(message?: string) {
  runId.value = null;
  isRunning.value = false;
  progress.value = 0;
  showPromptDialog.value = false;
  samples.value = [];
  if (message) {
    statusLines.value = [message];
  }
}

function attachRunSnapshot(snapshot: CalibrationRunSnapshot) {
  if (!isSnapshotForCurrentSelection(snapshot)) return;
  if (isStaleAbortingSnapshot(snapshot)) {
    resetRunUi('Ready. Select channels and click Start Cal.');
    return;
  }
  runId.value = snapshot.run_id;
  isRunning.value = ['created', 'awaiting_operator', 'running', 'aborting'].includes(snapshot.state);
  progress.value = snapshot.progress ?? 0;
  statusLines.value = snapshot.status_lines?.length
    ? snapshot.status_lines
    : ['Ready. Select channels and click Start Cal.'];
  samples.value = snapshot.samples ?? [];
  showPromptDialog.value = snapshot.state === 'awaiting_operator' && !!snapshot.prompt_message;
  promptMessage.value = snapshot.prompt_message || promptMessage.value;
}

function setupStream(id: string) {
  if (process.server) return;
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  eventSource = new EventSource(runApi.streamUrl(id));
  eventSource.onmessage = () => {
    // noop (named events are used)
  };

  eventSource.addEventListener('snapshot', (evt: MessageEvent) => {
    const payload = JSON.parse(evt.data) as CalibrationRunSnapshot;
    attachRunSnapshot(payload);
  });

  eventSource.addEventListener('status', (evt: MessageEvent) => {
    const payload = JSON.parse(evt.data);
    if (payload?.status_line) {
      statusLines.value = [payload.status_line, ...statusLines.value.filter((x) => x !== payload.status_line)].slice(0, 200);
    }
    if (typeof payload?.progress === 'number') progress.value = payload.progress;
    if (typeof payload?.state === 'string') {
      isRunning.value = ['created', 'awaiting_operator', 'running', 'aborting'].includes(payload.state);
      showPromptDialog.value = payload.state === 'awaiting_operator';
      if (['completed', 'failed', 'aborted'].includes(payload.state)) {
        showPromptDialog.value = false;
      }
    }
    if (typeof payload?.prompt_message === 'string') {
      promptMessage.value = payload.prompt_message;
    }
  });

  eventSource.addEventListener('prompt', (evt: MessageEvent) => {
    const payload = JSON.parse(evt.data);
    promptMessage.value = payload?.prompt_message || 'Connect Cal Power Sensor and confirm.';
    showPromptDialog.value = true;
    if (payload?.status_line) {
      statusLines.value = [payload.status_line, ...statusLines.value.filter((x) => x !== payload.status_line)].slice(0, 200);
    }
  });

  eventSource.addEventListener('sample', (evt: MessageEvent) => {
    const payload = JSON.parse(evt.data);
    if (payload?.sample) {
      samples.value = [payload.sample as CalibrationSample, ...samples.value].slice(0, 120);
    }
    if (payload?.status_line) {
      statusLines.value = [payload.status_line, ...statusLines.value.filter((x) => x !== payload.status_line)].slice(0, 200);
    }
    if (typeof payload?.progress === 'number') progress.value = payload.progress;
  });

  eventSource.addEventListener('end', () => {
    isRunning.value = false;
    emit('update:isRunning', false);
    showPromptDialog.value = false;
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  });

  eventSource.onerror = () => {
    // Browser reconnects EventSource automatically. Keep silent to avoid toast spam.
  };
}

async function load() {
  const res = await api.getCalibrationRows();
  if (!res.error.value) {
    const payload = (res.data.value as CalibrationRowsResponse) ?? { unit: 'dB', rows: [] };
    const mapped = mapRows(payload);
    if (mapped.length > 0) {
      rows.value = mapped;
      pushStatus(`Loaded ${mapped.length} channel rows from calibration data.`);
      return;
    }
  }

  const txRes = await api.getTransmitters();
  if (!txRes.error.value && Array.isArray(txRes.data.value)) {
    const fallbackRows = mapRowsFromTransmitters(txRes.data.value as Transmitter[]);
    rows.value = fallbackRows;
    pushStatus(`Loaded ${fallbackRows.length} channel rows from transmitters.`);
    return;
  }

  rows.value = [];
  pushStatus('No channel rows found.');
}

async function startCal() {
  const calId = props.calId?.trim();
  if (!calId) {
    toast.add({ severity: 'warn', summary: 'Cal ID Required', detail: 'Please enter/select Cal ID.', life: 3000 });
    return;
  }

  const channels = collectSelectedChannels();
  if (channels.length === 0) {
    toast.add({ severity: 'warn', summary: 'No Channels Selected', detail: 'Select at least one channel to start calibration.', life: 3000 });
    return;
  }

  const res = await runApi.startRun({
    cal_id: calId,
    cal_type: props.calType,
    include_spurious_bands: props.includeSpuriousBands ?? null,
    channels,
  });

  if (res.error.value) {
    const msg = (res.error.value as any)?.data?.detail || 'Unable to start calibration run.';
    toast.add({ severity: 'error', summary: 'Start Failed', detail: String(msg), life: 3500 });
    return;
  }

  const snapshot = res.data.value as CalibrationRunSnapshot;
  attachRunSnapshot(snapshot);
  setupStream(snapshot.run_id);
  toast.add({ severity: 'success', summary: 'Started', detail: `Calibration run ${snapshot.run_id}`, life: 2500 });
}

async function abortCal() {
  if (!runId.value) return;
  const res = await runApi.abortRun(runId.value);
  if (res.error.value) {
    toast.add({ severity: 'error', summary: 'Abort Failed', detail: 'Unable to abort run.', life: 3000 });
    return;
  }
  showPromptDialog.value = false;
}

async function onPromptConnected() {
  if (!runId.value) return;
  const res = await runApi.respondPrompt(runId.value, { action: 'connected' });
  if (res.error.value) {
    toast.add({ severity: 'error', summary: 'Action Failed', detail: 'Unable to send operator confirmation.', life: 3000 });
    return;
  }
  attachRunSnapshot(res.data.value as CalibrationRunSnapshot);
}

async function onPromptAbort() {
  if (!runId.value) return;
  const res = await runApi.respondPrompt(runId.value, { action: 'abort' });
  if (res.error.value) {
    toast.add({ severity: 'error', summary: 'Action Failed', detail: 'Unable to send operator abort.', life: 3000 });
    return;
  }
  attachRunSnapshot(res.data.value as CalibrationRunSnapshot);
}

function pushStatus(message: string) {
  const t = new Date();
  const stamp = `${t.toLocaleTimeString()}`;
  statusLines.value = [`[${stamp}] ${message}`, ...statusLines.value].slice(0, 200);
}

onMounted(async () => {
  await load();

  const active = await runApi.getActiveRun();
  if (!active.error.value && active.data.value) {
    const snapshot = active.data.value as CalibrationRunSnapshot;
    if (isSnapshotForCurrentSelection(snapshot)) {
      attachRunSnapshot(snapshot);
      if (snapshot.run_id) setupStream(snapshot.run_id);
    } else {
      resetRunUi('Ready. Select channels and click Start Cal.');
    }
  } else {
    resetRunUi('Ready. Select channels and click Start Cal.');
  }
});

watch(
  () => [props.calType, props.calId],
  async () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }

    const active = await runApi.getActiveRun();
    if (!active.error.value && active.data.value) {
      const snapshot = active.data.value as CalibrationRunSnapshot;
      if (isSnapshotForCurrentSelection(snapshot)) {
        attachRunSnapshot(snapshot);
        if (snapshot.run_id) setupStream(snapshot.run_id);
        return;
      }
    }

    resetRunUi('Ready. Select channels and click Start Cal.');
  }
);

onBeforeUnmount(() => {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
});
</script>

<style scoped>
.downlink-panel {
  height: 100%;
  min-height: 0;
  padding: 1rem 1.25rem;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.prompt-message {
  color: #94a3b8;
  line-height: 1.5;
  margin: 0;
}

.downlink-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.pane-card {
  min-height: 0;
  background: #0d1b2e;
  border: 1px solid #1e3050;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.left-pane,
.right-pane {
  min-width: 0;
  height: 100%;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #1e3050;
}

.panel-header h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  color: #22d3ee;
}

.downlink-grid {
  flex: 1;
  min-height: 0;
  height: 100%;
}

:deep(.downlink-grid .ag-root-wrapper),
:deep(.downlink-grid .ag-root),
:deep(.downlink-grid .ag-body-viewport) {
  min-height: 180px;
}

.panel-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid #1e3050;
}

.action-btn {
  min-height: 2.5rem;
  padding: 0 1rem;
  font-size: 0.95rem;
  font-weight: 600;
}

.status-window {
  border-top: 1px solid #1e3050;
  background: #091425;
  min-height: 160px;
  max-height: 260px;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.status-title {
  padding: 0.55rem 1rem;
  color: #22d3ee;
  font-size: 0.85rem;
  font-weight: 600;
  border-bottom: 1px solid #1e3050;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.run-badge {
  color: #0f172a;
  background: #22d3ee;
  border-radius: 999px;
  padding: 0.12rem 0.5rem;
  font-size: 0.72rem;
  font-weight: 700;
}

.status-body {
  padding: 0.55rem 1rem;
  overflow-y: auto;
  color: #94a3b8;
  font-size: 0.82rem;
  line-height: 1.35;
}

.status-line {
  margin: 0 0 0.25rem 0;
}

.right-header {
  justify-content: flex-start;
}

.sample-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.sample-list {
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.sample-header {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 0.6rem;
  padding: 0 0.55rem;
  color: #94a3b8;
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.sample-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 0.6rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid #1e3050;
  border-radius: 6px;
  color: #cbd5e1;
  font-size: 0.83rem;
}

.placeholder-area {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  color: #64748b;
}

.placeholder-area .pi {
  font-size: 2rem;
  color: #22d3ee;
}

@media (max-width: 1100px) {
  .downlink-layout {
    grid-template-columns: 1fr;
  }
}
</style>
