// ── Types ─────────────────────────────────────────────────────────────────────

export interface CalIdsResponse {
  cal_ids: string[];
}

export interface CalSgCompletedFrequenciesResponse {
  cal_id: string;
  frequencies: number[];
}

export interface CalSgDataRow {
  frequency: number;
  value?: number;
  sa_loss?: number;
  dl_pm_loss?: number;
  datetime: string;
}

export interface CalSgDataRowsResponse {
  cal_id: string;
  rows: CalSgDataRow[];
}

export interface CalibrationReportGenerateRequest {
  cal_id: string;
  cal_type: string;
}

export interface CalibrationReportGenerateResponse {
  cal_id: string;
  cal_type: string;
  satellite_name: string;
  results_directory: string;
  calibration_data_directory: string;
  pdf_path: string | null;
  excel_path: string | null;
  pdf_generated: boolean;
  excel_rows_appended: number;
  message: string;
}

// ── Internal fetch helper (same base URL as transmitter API) ──────────────────
const BASE_URL = 'http://localhost:8001';

const apiFetch = async (path: string, options: Record<string, any> = {}) => {
  try {
    const data = await $fetch(`${BASE_URL}/${path}`, options);
    return { data: ref(data), error: ref(null) };
  } catch (err) {
    return { data: ref(null), error: ref(err) };
  }
};

// ── Composable ────────────────────────────────────────────────────────────────

export const useCalibrationDataApi = () => {
  /**
   * Fetch distinct cal_ids from the CalibrationData collection.
   * @param calType  optional filter – one of: uplink | downlink | fixedpad | calSG | injectcal
   */
  const getCalIds = (calType?: string) => {
    const query = calType ? `?cal_type=${encodeURIComponent(calType)}` : '';
    return apiFetch(`api/v2/calibration/cal-ids${query}`);
  };

  const getCalSgCompletedFrequencies = (calId: string, calType: string = 'cal_sg') => {
    const normalizedType = String(calType ?? '').trim().toLowerCase();
    const path = normalizedType === 'inject_cal'
      ? 'api/v2/calibration/inject-cal/completed-frequencies'
      : 'api/v2/calibration/cal-sg/completed-frequencies';
    return apiFetch(`${path}?cal_id=${encodeURIComponent(calId)}`);
  };

  const getCalSgData = (calId: string, calType: string = 'cal_sg') => {
    const normalizedType = String(calType ?? '').trim().toLowerCase();
    const path = normalizedType === 'inject_cal'
      ? 'api/v2/calibration/inject-cal/data'
      : 'api/v2/calibration/cal-sg/data';
    return apiFetch(`${path}?cal_id=${encodeURIComponent(calId)}`);
  };

  const generateReport = (payload: CalibrationReportGenerateRequest) =>
    apiFetch('api/v2/calibration/reports/generate', { method: 'POST', body: payload });

  return { getCalIds, getCalSgCompletedFrequencies, getCalSgData, generateReport };
};
