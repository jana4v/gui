<template>
  <div class="measure-page">
    <div class="toolbar panel-card">
      <div class="toolbar-item">
        <label>Test Phase</label>
        <Select
          v-model="selectedTestPhase"
          :options="testPhaseOptions"
          class="toolbar-select"
          placeholder="Select Test Phase"
        />
      </div>

      <div class="toolbar-item">
        <label>Sub Test Phase</label>
        <Select
          v-model="selectedSubTestPhase"
          :options="subTestPhaseOptions"
          class="toolbar-select"
          placeholder="Select Sub Test Phase"
        />
      </div>

      <div class="toolbar-item">
        <label>Cal ID</label>
        <Select
          v-model="selectedCalId"
          :options="calIdOptions"
          class="toolbar-select"
          placeholder="Select Cal ID"
        />
      </div>

      <div class="toolbar-item">
        <label>TestPlan Type</label>
        <Select
          v-model="selectedTestPlanType"
          :options="testPlanTypeOptions"
          class="toolbar-select"
          placeholder="Select TestPlan Type"
        />
      </div>

      <div class="toolbar-item mode-item">
        <label>Test Execution Mode</label>
        <Select
          v-model="executionMode"
          :options="executionModeOptions"
          optionLabel="label"
          optionValue="value"
          class="toolbar-select"
          placeholder="Select Mode"
        />
      </div>
    </div>

    <div class="measure-layout">
      <section class="left-pane panel-card">
        <Tabs v-model:value="activeTab" class="measure-tabs">
          <TabList>
            <Tab value="transmitter">Transmitter</Tab>
            <Tab value="receiver">Receiver</Tab>
            <Tab value="transponder">Transponder</Tab>
          </TabList>
          <TabPanels>
            <TabPanel value="transmitter">
              <ag-grid-vue
                class="measure-grid"
                style="width: 100%; height: 500px;"
                :theme="isDark
                  ? themeQuartz.withPart(colorSchemeDarkBlue)
                  : themeQuartz.withPart(colorSchemeLightCold)"
                :columnDefs="transmitterColumnDefs"
                :rowData="transmitterRows"
                :defaultColDef="defaultColDef"
                :rowGroupPanelShow="'always'"
                :enableRangeSelection="true"
                :cellSelection="true"
                :suppressContextMenu="true"
                :suppressMovableColumns="true"
              />
            </TabPanel>
            <TabPanel value="receiver">
              <div class="tab-placeholder">Receiver execution table will be added next.</div>
            </TabPanel>
            <TabPanel value="transponder">
              <div class="tab-placeholder">Transponder execution table will be added next.</div>
            </TabPanel>
          </TabPanels>
        </Tabs>

        <div class="controls-row">
          <Button label="Start" :disabled="isRunning" @click="startExecution" />
          <Button label="Pause" severity="secondary" :disabled="!isRunning" @click="pauseExecution" />
          <Button label="Abort" severity="danger" outlined :disabled="!isRunning" @click="abortExecution" />
        </div>

        <div class="remarks-row">
          <label>Remarks (optional)</label>
          <Textarea v-model="remarks" rows="3" autoResize placeholder="Enter remarks" />
        </div>

        <div class="status-window" aria-label="Test progress window">
          <div class="status-title">
            Test Progress
            <span v-if="isRunning" class="run-badge">RUNNING {{ Math.round(progress) }}%</span>
          </div>
          <div class="status-body">
            <p v-for="(line, idx) in statusLines" :key="idx" class="status-line">{{ line }}</p>
          </div>
        </div>
      </section>

      <section class="right-pane panel-card">
        <div class="panel-header">
          <h3>Live Test Results</h3>
        </div>

        <ag-grid-vue
          class="live-results-grid"
                style="width: 100%; height: 500px;"
          :theme="isDark
            ? themeQuartz.withPart(colorSchemeDarkBlue)
            : themeQuartz.withPart(colorSchemeLightCold)"
          :columnDefs="liveColumnDefs"
          :rowData="liveResults"
          :defaultColDef="defaultColDef"
          :suppressContextMenu="true"
          :suppressMovableColumns="true"
        />
      </section>
    </div>

    <Dialog v-model:visible="showMissingDownlinkDialog" modal :closable="false" header="Downlink Cal Missing" :style="{ width: '40rem' }">
      <p class="dialog-text">
        Downlink cal not present for selected channel(s). Continue will skip these channels and proceed.
      </p>
      <div class="dialog-list">
        <div v-for="(item, idx) in missingDownlinkChannels" :key="idx" class="dialog-row">
          {{ item.code || '-' }} / {{ item.port || '-' }} / {{ item.frequency_label || '-' }} / {{ item.frequency }} MHz
        </div>
      </div>
      <template #footer>
        <Button label="Abort" severity="danger" outlined @click="abortMissingDownlink" />
        <Button label="Continue" @click="continueMissingDownlink" />
      </template>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ModuleRegistry } from 'ag-grid-community';
import { AllEnterpriseModule } from 'ag-grid-enterprise';
import {
  colorSchemeDarkBlue,
  colorSchemeLightCold,
  themeQuartz,
} from 'ag-grid-community';
import type { ColDef } from 'ag-grid-community';
import { AgGridVue } from 'ag-grid-vue3';
import { initMenu } from '@/composables/tracsV2/SideNav';
import {
  useCalibrationDataApi,
  type MeasureRunStartRequest,
  type MeasureMissingChannel,
  type MeasureRunStartResponse,
  type MeasureTableRow,
  type MeasureOptionsResponse,
} from '@/composables/tracsV2/useCalibrationDataApi';
import { useTransmitterApi, type Transmitter } from '@/composables/tracsV2/useTransmitterApi';

ModuleRegistry.registerModules([AllEnterpriseModule]);

interface MeasureRow {
  code: string;
  port: string;
  frequency: string;
  frequency_label: string;
  power_applicable: boolean;
  frequency_applicable: boolean;
  modulation_index_applicable: boolean;
  spurious_applicable: boolean;
  power_selected: boolean;
  frequency_selected: boolean;
  modulation_index_selected: boolean;
  spurious_selected: boolean;
}

interface LiveResultRow {
  time: string;
  code: string;
  port: string;
  frequency: string;
  result: string;
}

const calibrationApi = useCalibrationDataApi();
const transmitterApi = useTransmitterApi();
const isDark = useDark();

const testPhaseOptions = ref<string[]>([]);
const subTestPhaseOptions = Array.from({ length: 10 }, (_, idx) => `Phase${idx + 1}`);
const calIdOptions = ref<string[]>([]);
const testPlanTypeOptions = ['Detailed', 'Short', 'Minimal'];
const executionModeOptions = [
  { label: 'TestPlan Mode', value: 'testplan' },
  { label: 'Manual Mode', value: 'manual' },
];

const selectedTestPhase = ref<string>('');
const selectedSubTestPhase = ref<string>('Phase1');
const selectedCalId = ref<string>('');
const selectedTestPlanType = ref<string>('Detailed');
const executionMode = ref<'testplan' | 'manual'>('testplan');
const activeTab = ref('transmitter');
const remarks = ref('');
const isRunning = ref(false);
const progress = ref(0);
const statusLines = ref<string[]>(['Ready. Configure selections and click Start.']);
const liveResults = ref<LiveResultRow[]>([]);

const transmitters = ref<Transmitter[]>([]);
const receiverRows = ref<MeasureRow[]>([]);
const transponderRows = ref<MeasureRow[]>([]);
const showMissingDownlinkDialog = ref(false);
const missingDownlinkChannels = ref<MeasureMissingChannel[]>([]);
const pendingMeasurePayload = ref<MeasureRunStartRequest | null>(null);

const defaultColDef: ColDef = {
  resizable: true,
  sortable: true,
  filter: true,
  minWidth: 110,
  enableRowGroup: true,
};

const transmitterColumnDefs: ColDef[] = [
  { field: 'code', headerName: 'Code', minWidth: 120, flex: 1 },
  { field: 'port', headerName: 'Port', minWidth: 110, flex: 1 },
  { field: 'frequency', headerName: 'Frequency', minWidth: 130, flex: 1 },
  { field: 'frequency_label', headerName: 'Freqcy Label', minWidth: 150, flex: 1 },
  buildCheckboxCol('power_selected', 'Power', 'power_applicable'),
  buildCheckboxCol('frequency_selected', 'Frequency', 'frequency_applicable'),
  buildCheckboxCol('modulation_index_selected', 'Modulation Index', 'modulation_index_applicable'),
  buildCheckboxCol('spurious_selected', 'Spurious', 'spurious_applicable'),
];

const liveColumnDefs: ColDef[] = [
  { field: 'code', headerName: 'Code', minWidth: 110, flex: 1 },
  { field: 'port', headerName: 'Port', minWidth: 90, flex: 1 },
  { field: 'frequency', headerName: 'Frequency', minWidth: 120, flex: 1 },
  { field: 'result', headerName: 'Result', minWidth: 180, flex: 1.4 },
];

const transmitterRows = computed<MeasureRow[]>(() => buildRows(executionMode.value));

function buildCheckboxCol(field: keyof MeasureRow, headerName: string, applicableField: keyof MeasureRow): ColDef {
  return {
    field: field as string,
    headerName,
    minWidth: 130,
    flex: 1,
    enableFillHandle: true,
    cellRenderer: 'agCheckboxCellRenderer',
    cellEditor: 'agCheckboxCellEditor',
    editable: (params) => Boolean(params.data?.[applicableField]),
    valueGetter: (params) => {
      if (!params.data?.[applicableField]) return null;
      return Boolean(params.data?.[field]);
    },
    valueSetter: (params) => {
      if (!params.data?.[applicableField]) return false;
      params.data[field] = Boolean(params.newValue) as never;
      return true;
    },
  };
}

function keyOf(row: { port: string; frequency_label: string; frequency: string }) {
  return `${row.port}|${row.frequency_label}|${row.frequency}`;
}

function collectBaseRows(tx: Transmitter): Array<{ port: string; frequency_label: string; frequency: string }> {
  const details: any = tx?.modulation_details ?? {};
  const out = new Map<string, { port: string; frequency_label: string; frequency: string }>();

  for (const field of ['power_specs', 'frequency_specs', 'modulation_index_specs', 'spurious_specs']) {
    const rows = Array.isArray(details?.[field]) ? details[field] : [];
    for (const row of rows) {
      const item = {
        port: String(row?.port ?? '').trim(),
        frequency_label: String(row?.frequency_label ?? '').trim(),
        frequency: String(row?.frequency ?? '').trim(),
      };
      if (!item.port || !item.frequency_label || !item.frequency) continue;
      out.set(keyOf(item), item);
    }
  }

  if (out.size === 0) {
    const ports = Array.isArray(details?.ports) ? details.ports : [];
    const freqs = Array.isArray(details?.frequencies) ? details.frequencies : [];
    for (const p of ports) {
      const port = String(Array.isArray(p) ? p[0] : '').trim();
      if (!port) continue;
      for (const f of freqs) {
        const label = String(Array.isArray(f) ? f[0] : '').trim();
        const freq = String(Array.isArray(f) ? f[1] : '').trim();
        if (!label || !freq) continue;
        out.set(`${port}|${label}|${freq}`, { port, frequency_label: label, frequency: freq });
      }
    }
  }

  return Array.from(out.values());
}

function hasSpecRow(rows: any[], base: { port: string; frequency_label: string; frequency: string }): boolean {
  return rows.some((r) =>
    String(r?.port ?? '').trim() === base.port
    && String(r?.frequency_label ?? '').trim() === base.frequency_label
    && String(r?.frequency ?? '').trim() === base.frequency,
  );
}

function buildRows(mode: 'testplan' | 'manual'): MeasureRow[] {
  const output: MeasureRow[] = [];
  for (const tx of transmitters.value) {
    const details: any = tx?.modulation_details ?? {};
    const baseRows = collectBaseRows(tx);
    const modulationType = String(tx?.modulation_type ?? '').trim().toLowerCase();
    const isApplicable = modulationType === 'psk_pm';

    const powerSpecs = Array.isArray(details?.power_specs) ? details.power_specs : [];
    const freqSpecs = Array.isArray(details?.frequency_specs) ? details.frequency_specs : [];
    const modSpecs = Array.isArray(details?.modulation_index_specs) ? details.modulation_index_specs : [];
    const spurSpecs = Array.isArray(details?.spurious_specs) ? details.spurious_specs : [];

    for (const base of baseRows) {
      const fromPlan = {
        power: hasSpecRow(powerSpecs, base),
        frequency: hasSpecRow(freqSpecs, base),
        modulation: hasSpecRow(modSpecs, base),
        spurious: hasSpecRow(spurSpecs, base),
      };

      output.push({
        code: String(tx?.code ?? ''),
        port: base.port,
        frequency: base.frequency,
        frequency_label: base.frequency_label,
        power_applicable: isApplicable,
        frequency_applicable: isApplicable,
        modulation_index_applicable: isApplicable,
        spurious_applicable: isApplicable,
        power_selected: mode === 'testplan' && isApplicable ? fromPlan.power : false,
        frequency_selected: mode === 'testplan' && isApplicable ? fromPlan.frequency : false,
        modulation_index_selected: mode === 'testplan' && isApplicable ? fromPlan.modulation : false,
        spurious_selected: mode === 'testplan' && isApplicable ? fromPlan.spurious : false,
      });
    }
  }

  return output;
}

function pushStatus(message: string) {
  const stamp = new Date().toLocaleTimeString();
  statusLines.value = [`[${stamp}] ${message}`, ...statusLines.value].slice(0, 200);
}

function pushLive(result: string) {
  const row: LiveResultRow = {
    time: new Date().toLocaleTimeString(),
    code: transmitterRows.value[0]?.code ?? '-',
    port: transmitterRows.value[0]?.port ?? '-',
    frequency: transmitterRows.value[0]?.frequency ?? '-',
    result,
  };
  liveResults.value = [row, ...liveResults.value].slice(0, 200);
}

function toApiRow(row: MeasureRow): MeasureTableRow {
  return {
    code: String(row.code ?? '').trim(),
    port: String(row.port ?? '').trim(),
    frequency_label: String(row.frequency_label ?? '').trim(),
    frequency: String(row.frequency ?? '').trim(),
    power_selected: Boolean(row.power_selected),
    frequency_selected: Boolean(row.frequency_selected),
    modulation_index_selected: Boolean(row.modulation_index_selected),
    spurious_selected: Boolean(row.spurious_selected),
  };
}

async function runMeasureExecution(payload: MeasureRunStartRequest) {
  const res = await calibrationApi.startMeasureRun(payload);
  if (res.error.value || !res.data.value) {
    isRunning.value = false;
    progress.value = 0;
    pushStatus('Measure execution failed to start.');
    return;
  }

  const response = res.data.value as MeasureRunStartResponse;
  if (response.requires_confirmation && Array.isArray(response.missing_downlink_channels) && response.missing_downlink_channels.length > 0) {
    pendingMeasurePayload.value = payload;
    missingDownlinkChannels.value = response.missing_downlink_channels;
    showMissingDownlinkDialog.value = true;
    isRunning.value = false;
    progress.value = 0;
    pushStatus('Downlink cal missing for selected channel(s). Awaiting user decision.');
    return;
  }

  const rows = Array.isArray(response.results) ? response.results : [];
  progress.value = 100;
  isRunning.value = false;

  for (const row of rows) {
    pushStatus(row.message);
    liveResults.value = [
      {
        time: new Date(row.timestamp).toLocaleTimeString(),
        code: row.code,
        port: row.port,
        frequency: String(row.frequency),
        result: `${row.parameter.toUpperCase()}: ${row.final_value.toFixed(1)} dBm (${row.status})`,
      },
      ...liveResults.value,
    ].slice(0, 200);
  }

  if (rows.length === 0) {
    pushLive('No selected parameter rows to execute');
  }
}

async function startExecution() {
  if (isRunning.value) return;
  const calId = String(selectedCalId.value ?? '').trim();
  if (calId === '') {
    pushStatus('Select Cal ID before starting execution.');
    return;
  }

  isRunning.value = true;
  progress.value = 5;
  pushStatus(`Execution started in ${executionMode.value === 'testplan' ? 'TestPlan' : 'Manual'} mode.`);

  const payload: MeasureRunStartRequest = {
    test_phase: String(selectedTestPhase.value ?? '').trim(),
    sub_test_phase: String(selectedSubTestPhase.value ?? '').trim(),
    cal_id: calId,
    test_plan_type: String(selectedTestPlanType.value ?? '').trim(),
    execution_mode: executionMode.value,
    remarks: String(remarks.value ?? '').trim(),
    continue_on_missing_downlink_cal: false,
    transmitter_rows: transmitterRows.value.map(toApiRow),
    receiver_rows: receiverRows.value.map(toApiRow),
    transponder_rows: transponderRows.value.map(toApiRow),
  };

  await runMeasureExecution(payload);
}

function abortMissingDownlink() {
  showMissingDownlinkDialog.value = false;
  pendingMeasurePayload.value = null;
  missingDownlinkChannels.value = [];
  isRunning.value = false;
  progress.value = 0;
  pushStatus('Execution aborted by user due to missing downlink cal channels.');
}

async function continueMissingDownlink() {
  const payload = pendingMeasurePayload.value;
  showMissingDownlinkDialog.value = false;
  missingDownlinkChannels.value = [];
  pendingMeasurePayload.value = null;
  if (!payload) return;

  isRunning.value = true;
  progress.value = 5;
  pushStatus('Continuing execution by skipping channels with missing downlink cal.');
  await runMeasureExecution({
    ...payload,
    continue_on_missing_downlink_cal: true,
  });
}

function pauseExecution() {
  if (!isRunning.value) return;
  pushStatus('Execution paused.');
  pushLive('Execution paused');
}

function abortExecution() {
  if (!isRunning.value) return;
  isRunning.value = false;
  progress.value = 0;
  pushStatus('Execution aborted by user.');
  pushLive('Execution aborted');
}

async function loadMeasureOptions() {
  const res = await calibrationApi.getMeasureOptions();
  if (res.error.value || !res.data.value) {
    pushStatus('Unable to load measure options.');
    return;
  }

  const payload = res.data.value as MeasureOptionsResponse;
  testPhaseOptions.value = payload.test_phases ?? [];
  calIdOptions.value = payload.cal_ids ?? [];

  if (!selectedTestPhase.value && testPhaseOptions.value.length > 0) {
    selectedTestPhase.value = testPhaseOptions.value[0];
  }

  if (!selectedCalId.value) {
    selectedCalId.value = payload.default_cal_id ?? calIdOptions.value[0] ?? '';
  }
}

async function loadTransmitters() {
  const res = await transmitterApi.getTransmitters();
  if (res.error.value || !Array.isArray(res.data.value)) {
    pushStatus('Unable to load transmitter data for measure table.');
    return;
  }
  transmitters.value = res.data.value as Transmitter[];
}

onMounted(async () => {
  await Promise.all([loadMeasureOptions(), loadTransmitters()]);
});

definePageMeta({
  title: 'TRACS V2 Measure',
});

initMenu(0);
</script>

<style scoped>
.measure-page {
  height: calc(100vh - 4rem);
  min-height: 0;
  padding: 0.75rem 1.25rem 1rem;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow: hidden;
  background: #081525;
}

.panel-card {
  background: #0d1b2e;
  border: 1px solid #1e3050;
  border-radius: 8px;
}

.toolbar {
  padding: 0.75rem;
  display: grid;
  grid-template-columns: repeat(5, minmax(170px, 1fr));
  gap: 0.75rem;
}

.toolbar-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.toolbar-item label {
  color: #94a3b8;
  font-size: 0.78rem;
  font-weight: 600;
}

.toolbar-select {
  width: 100%;
}

.mode-item {
  min-width: 220px;
}

.measure-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1.65fr 1fr;
  gap: 0.75rem;
}

.left-pane,
.right-pane {
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.measure-tabs {
  flex: 1;
  min-height: 0;
  padding: 0.5rem;
}

.tab-placeholder {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
}

.controls-row {
  display: flex;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
}

.remarks-row {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.4rem 0.75rem;
}

.remarks-row label {
  color: #94a3b8;
  font-size: 0.8rem;
  font-weight: 600;
}

.status-window {
  margin: 0.5rem 0.75rem 0.75rem;
  border: 1px solid #1e3050;
  border-radius: 8px;
  background: #091425;
  min-height: 180px;
  display: flex;
  flex-direction: column;
}

.status-title {
  padding: 0.55rem 0.75rem;
  color: #22d3ee;
  font-size: 0.82rem;
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
  padding: 0.12rem 0.45rem;
  font-size: 0.72rem;
  font-weight: 700;
}

.status-body {
  padding: 0.55rem 0.75rem;
  overflow-y: auto;
  color: #94a3b8;
  font-size: 0.8rem;
  line-height: 1.35;
}

.status-line {
  margin: 0 0 0.24rem 0;
}

.panel-header {
  padding: 0.7rem 0.85rem;
  border-bottom: 1px solid #1e3050;
}

.panel-header h3 {
  margin: 0;
  color: #22d3ee;
  font-size: 0.95rem;
}

.live-results-grid {
  flex: 1;
  min-height: 0;
}

@media (max-width: 1350px) {
  .toolbar {
    grid-template-columns: repeat(3, minmax(170px, 1fr));
  }
}

@media (max-width: 1100px) {
  .measure-layout {
    grid-template-columns: 1fr;
  }
  .toolbar {
    grid-template-columns: repeat(2, minmax(170px, 1fr));
  }
}
</style>
