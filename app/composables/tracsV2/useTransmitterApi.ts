// ── Types ─────────────────────────────────────────────────────────────────────

export interface PowerRow {
  code: string;
  port: string;
  frequency_label: string;
  frequency: string;
  specification: string | number | null;
  tolerance: string | number | null;
  fbt: string | number | null;
  fbt_hot: string | number | null;
  fbt_cold: string | number | null;
}

export interface FrequencyRow {
  code: string;
  port: string;
  frequency_label: string;
  frequency: string;
  tolerance: string | number | null;
  fbt: string | number | null;
  fbt_hot: string | number | null;
  fbt_cold: string | number | null;
}

export interface ModulationIndexRow {
  code: string;
  port: string;
  frequency_label: string;
  frequency: string;
  specification: string | number | null;
  tolerance: string | number | null;
  [key: string]: string | number | null;
}

export interface SpuriousRow {
  code: string;
  port: string;
  frequency_label: string;
  frequency: string;
  specification: string | number | null;
  tolerance: string | number | null;
  fbt: (string | number)[][];
  fbt_hot: (string | number)[][];
  fbt_cold: (string | number)[][];
}

export interface CalibrationSpecLegacyRow {
  code: string;
  port: string;
  frequency_label: string;
  frequency: string;
  onboard_loss: string | number | null;
  system_loss: string | number | null;
  fixed_pad: string | number | null;
  antenna_gain: string | number | null;
  total_loss: string | number | null;
}

export interface TestProfileSpuriousRow {
  code: string;
  port: string;
  frequency_label: string;
  frequency: string;
  profile_name: string;
  spurious_search_bands: (string | number)[][];
  enable: boolean;
}

export interface SpuriousBandConfigRow {
  profile_name: string;
  enable: boolean;
  start_frequency: number | null;
  stop_frequency: number | null;
}

export interface PskPmDetails {
  ports: string[][];
  sub_carriers: (number | string)[][];
  frequencies: string[][];
  power_specs?: PowerRow[];
  frequency_specs?: FrequencyRow[];
  modulation_index_specs?: ModulationIndexRow[];
  spurious_specs?: SpuriousRow[];
  calibration_specs?: CalibrationSpecLegacyRow[];
  on_board_loss_specs?: Array<{
    code: string;
    port: string;
    frequency_label: string;
    frequency: string;
    loss_db: string | number | null;
  }>;
  test_profile_spurious_specs?: TestProfileSpuriousRow[];
}

export interface Transmitter {
  name: string;
  code: string;
  system_type: string;
  modulation_type: string;
  modulation_details: PskPmDetails;
}

export type ParameterName = 'power' | 'frequency' | 'modulation_index' | 'spurious';

export interface ParameterRowView {
  transmitter_code: string;
  transmitter_name?: string | null;
  modulation_type: string;
  row: Record<string, any>;
}

export interface ParameterRowsResponse {
  parameter: ParameterName;
  unit: string;
  rows: ParameterRowView[];
}

export interface ParameterRowsUpdateRequest {
  rows: Array<{
    transmitter_code: string;
    row: Record<string, any>;
  }>;
}

export interface ParameterRowsUpdateResponse {
  parameter: ParameterName;
  unit: string;
  updated_transmitters: number;
  updated_rows: number;
}

export interface OnBoardLossRow {
  code: string;
  port: string;
  frequency_label: string;
  frequency: string;
  loss_db: string | number | null;
}

export interface OnBoardLossRowView {
  transmitter_code: string;
  transmitter_name?: string | null;
  modulation_type: string;
  row: OnBoardLossRow;
}

export interface OnBoardLossRowsResponse {
  unit: string;
  rows: OnBoardLossRowView[];
}

export interface OnBoardLossRowsUpdateRequest {
  rows: Array<{
    transmitter_code: string;
    row: OnBoardLossRow;
  }>;
}

export interface OnBoardLossRowsUpdateResponse {
  unit: string;
  updated_transmitters: number;
  updated_rows: number;
}

export interface CalibrationLossRow {
  code: string;
  port: string;
  frequency_label: string;
  frequency: string;
  system_loss: string | number | null;
  fixed_pad_loss: string | number | null;
  antenna_gain: string | number | null;
  total_loss: string | number | null;
}

export interface CalibrationRowView {
  transmitter_code: string;
  transmitter_name?: string | null;
  modulation_type: string;
  row: CalibrationLossRow;
}

export interface CalibrationRowsResponse {
  unit: string;
  rows: CalibrationRowView[];
}

export interface CalibrationRowsUpdateRequest {
  rows: Array<{
    transmitter_code: string;
    row: CalibrationLossRow;
  }>;
}

export interface CalibrationRowsUpdateResponse {
  unit: string;
  updated_transmitters: number;
  updated_rows: number;
}

export interface InstrumentCatalogResponse {
  instruments: Record<string, string[]>;
}

export interface ProjectInstrumentRow {
  instrument_name: string;
  model: string;
  address_main: string;
  address_redt: string;
  use_redt: boolean;
}

export interface ProjectInstrumentsResponse {
  rows: ProjectInstrumentRow[];
}

export interface ProjectInstrumentsSaveRequest {
  rows: ProjectInstrumentRow[];
}

export interface ProjectInstrumentsSaveResponse {
  saved_rows: number;
}

export interface ConfigurationValueResponse {
  parameter: string;
  value: string;
}

export interface ConfigurationValueSaveRequest {
  value: string;
}

export interface ProjectPowerMeterRow {
  powerMeter: string;
  channel: 'A' | 'B';
}

export interface ProjectPowerMetersResponse {
  rows: ProjectPowerMeterRow[];
}

export interface ProjectPowerMetersSaveRequest {
  rows: ProjectPowerMeterRow[];
}

export interface ProjectPowerMetersSaveResponse {
  saved_rows: number;
}

export interface TsmPathRow {
  code: string;
  port: string;
  path1: string | null;
  path2: string | null;
  path3: string | null;
  path4: string | null;
  path5: string | null;
  path6: string | null;
}

export interface TsmPathsResponse {
  rows: TsmPathRow[];
}

export interface TsmPathsSaveRequest {
  rows: TsmPathRow[];
}

export interface TsmPathsSaveResponse {
  saved_rows: number;
}

export interface EnvDataRow {
  parameter: string;
  value: string;
}

export interface EnvDataRowsResponse {
  rows: EnvDataRow[];
}

export interface EnvDataRowsSaveRequest {
  rows: EnvDataRow[];
}

export interface EnvDataRowsSaveResponse {
  saved_rows: number;
}

export interface EnvDataDirectorySelectResponse {
  path: string | null;
}

export type TransmitterSavePayload = Omit<Transmitter, 'system_type'> & {
  system_type?: string;
};

// TRACS_V2 backend runs on port 8001
const BASE_URL = 'http://localhost:8001';

// Use $fetch (works in any context including Pinia stores)
// Returns { data, error } shape consistent with useFetch for components
const apiFetch = async (path: string, options: Record<string, any> = {}) => {
  try {
    const data = await $fetch(`${BASE_URL}/${path}`, options);
    return { data: ref(data), error: ref(null) };
  } catch (err) {
    return { data: ref(null), error: ref(err) };
  }
};

// ── Composable ────────────────────────────────────────────────────────────────

export const useTransmitterApi = () => {
  const getTransmitters = () => apiFetch('api/v2/transmitters');

  const saveTransmitter = (payload: TransmitterSavePayload) =>
    apiFetch('api/v2/transmitters', { method: 'POST', body: payload });

  const deleteTransmitter = (code: string) =>
    apiFetch(`api/v2/transmitters/${code}`, { method: 'DELETE' });

  const getModulationTypes = () => apiFetch('api/v2/modulation-types');

  const getParameterRows = (parameter: ParameterName) =>
    apiFetch(`api/v2/transmitters/parameters/${parameter}`);

  const saveParameterRows = (parameter: ParameterName, payload: ParameterRowsUpdateRequest) =>
    apiFetch(`api/v2/transmitters/parameters/${parameter}`, { method: 'PUT', body: payload });

  const getOnBoardLossRows = () =>
    apiFetch('api/v2/transmitters/on-board-losses');

  const saveOnBoardLossRows = (payload: OnBoardLossRowsUpdateRequest) =>
    apiFetch('api/v2/transmitters/on-board-losses', { method: 'PUT', body: payload });

  const getCalibrationRows = () =>
    apiFetch('api/v2/transmitters/calibration');

  const saveCalibrationRows = (payload: CalibrationRowsUpdateRequest) =>
    apiFetch('api/v2/transmitters/calibration', { method: 'PUT', body: payload });

  const getInstrumentCatalog = () =>
    apiFetch('api/v2/test-systems/instruments/catalog');

  const getProjectInstruments = () =>
    apiFetch('api/v2/test-systems/project-instruments');

  const saveProjectInstruments = (payload: ProjectInstrumentsSaveRequest) =>
    apiFetch('api/v2/test-systems/project-instruments', { method: 'PUT', body: payload });

  const getConfigurationValue = (parameter: string) =>
    apiFetch(`api/v2/test-systems/configuration/${encodeURIComponent(parameter)}`);

  const saveConfigurationValue = (parameter: string, payload: ConfigurationValueSaveRequest) =>
    apiFetch(`api/v2/test-systems/configuration/${encodeURIComponent(parameter)}`, { method: 'PUT', body: payload });

  const getProjectPowerMeters = () =>
    apiFetch('api/v2/test-systems/project-power-meters');

  const saveProjectPowerMeters = (payload: ProjectPowerMetersSaveRequest) =>
    apiFetch('api/v2/test-systems/project-power-meters', { method: 'PUT', body: payload });

  const getProjectTsmPaths = () =>
    apiFetch('api/v2/test-systems/project-tsm-paths');

  const saveProjectTsmPaths = (payload: TsmPathsSaveRequest) =>
    apiFetch('api/v2/test-systems/project-tsm-paths', { method: 'PUT', body: payload });

  const getSpuriousBandConfigs = () =>
    apiFetch('api/v2/spurious-bands');

  const saveSpuriousBandConfigs = (bands: SpuriousBandConfigRow[]) =>
    apiFetch('api/v2/spurious-bands', { method: 'PUT', body: { bands } });

  const getEnvDataRows = () =>
    apiFetch('api/v2/env-data');

  const saveEnvDataRows = (payload: EnvDataRowsSaveRequest) =>
    apiFetch('api/v2/env-data', { method: 'PUT', body: payload });

  const createEnvDataRow = (payload: EnvDataRow) =>
    apiFetch('api/v2/env-data', { method: 'POST', body: payload });

  const updateEnvDataRow = (parameter: string, payload: EnvDataRow) =>
    apiFetch(`api/v2/env-data/${encodeURIComponent(parameter)}`, { method: 'PUT', body: payload });

  const deleteEnvDataRow = (parameter: string) =>
    apiFetch(`api/v2/env-data/${encodeURIComponent(parameter)}`, { method: 'DELETE' });

  const selectEnvDataDirectory = () =>
    apiFetch('api/v2/env-data/select-directory');

  return {
    getTransmitters,
    saveTransmitter,
    deleteTransmitter,
    getModulationTypes,
    getParameterRows,
    saveParameterRows,
    getOnBoardLossRows,
    saveOnBoardLossRows,
    getCalibrationRows,
    saveCalibrationRows,
    getInstrumentCatalog,
    getProjectInstruments,
    saveProjectInstruments,
    getConfigurationValue,
    saveConfigurationValue,
    getProjectPowerMeters,
    saveProjectPowerMeters,
    getProjectTsmPaths,
    saveProjectTsmPaths,
    getSpuriousBandConfigs,
    saveSpuriousBandConfigs,
    getEnvDataRows,
    saveEnvDataRows,
    createEnvDataRow,
    updateEnvDataRow,
    deleteEnvDataRow,
    selectEnvDataDirectory,
  };
};
