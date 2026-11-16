export type JsaRiskLevel = 'L' | 'M' | 'H';

export type JsaHazardRow = {
  id?: string;
  hazard: string;
  risk_level: JsaRiskLevel;
  control_measure: string | null;
  sort_order?: number;
};

export type JsaCrewSignature = {
  name: string;
  signature_url?: string | null;
  signed_at?: string | null;
};

export type JsaFormRow = {
  id: string;
  project_id: string;
  report_date: string;
  logged_at: string;
  site_name: string | null;
  client_name: string | null;
  field_supervisor: string | null;
  gate_gps_coordinates: string | null;
  specific_areas: string | null;
  success_lookback: string | null;
  selected_objectives: string[];
  completed_checks: string[];
  first_aid_location: string | null;
  nearest_hospital: string | null;
  emergency_signal: string | null;
  stop_work_authority_confirmed: boolean;
  one_thing_dangerous: string | null;
  crew_signatures: JsaCrewSignature[];
  signed_at: string | null;
  pdf_url: string | null;
  status: 'draft' | 'signed';
  submitted_by_name: string | null;
  submitted_by_user_id: string | null;
  hazards?: JsaHazardRow[];
};

export type JsaReportListItem = {
  id: string;
  projectName: string;
  projectId: string;
  date: string;
  timestamp: string;
  reportSigned: boolean;
  fieldSupervisor: string | null;
  siteName: string | null;
};
