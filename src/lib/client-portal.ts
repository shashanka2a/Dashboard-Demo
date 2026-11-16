/** Client portal DTOs — safe subset of field data (no incidents / employee PII). */

export type ClientProjectSummary = {
  id: string;
  name: string;
  client_name: string | null;
  job_number: string | null;
  status: string;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  acres_completed: number | null;
};

export type ClientCompanyContact = {
  company_name: string;
  company_phone: string | null;
  company_email: string | null;
};

export type ClientWickdContact = {
  name: string;
  phone: string | null;
  email: string | null;
};

export type ClientSuperintendent = {
  name: string | null;
  phone: string | null;
};

export type ClientMaintenanceEvent = {
  id: string;
  label: string;
  date: string | null;
  kind: 'wicking' | 'spraying' | 'mowing' | 'other';
  upcoming: boolean;
};

export type ClientWatchlistItem = {
  id: string;
  section: 'weeds' | 'problems' | 'hazards';
  title: string;
  description: string;
  location: string | null;
  priority: string | null;
  status: string | null;
};

export type ClientPhoto = {
  id: string;
  url: string;
  caption: string;
  tags: string[];
  date: string | null;
};

export type ClientDailyReport = {
  id: string;
  report_date: string | null;
  prepared_by: string | null;
  report_signed: boolean;
  signed_at: string | null;
};

export type ClientMapping = {
  kmz_url: string | null;
  google_earth_url: string | null;
  preview_image_url: string | null;
};

export type ClientPortalAdminSettings = {
  project_id: string;
  project_name: string;
  job_number: string | null;
  client_portal_enabled: boolean;
  cover_photo_url: string | null;
  cover_photo_public_id: string | null;
  kmz_url: string | null;
  kmz_public_id: string | null;
  kmz_filename: string | null;
  kmz_uploaded_at: string | null;
  google_earth_url: string | null;
  /** From latest wicking chemicals_logs row for this project (not editable). */
  last_wicking_date: string | null;
  /** From latest spraying chemicals_logs row for this project (not editable). */
  last_spraying_date: string | null;
  last_mowing_date: string | null;
  next_wicking_date: string | null;
  next_spraying_date: string | null;
  next_mowing_date: string | null;
  portal_url: string;
  assigned_clients: Array<{ id: string; name: string; email: string | null }>;
  /** Stored allowlist; null = use default exclusions (Equipment, Chemicals, Safety). */
  client_portal_allowed_photo_tags: string[] | null;
  /** All tag names available to toggle (company tags + internal defaults). */
  available_photo_tags: string[];
  /** Effective allowlist after applying project override or defaults. */
  resolved_allowed_photo_tags: string[];
};

export type ClientOverview = {
  project: ClientProjectSummary;
  company: ClientCompanyContact;
  wickd_contact: ClientWickdContact | null;
  superintendent: ClientSuperintendent;
  contract_po: string | null;
  contract_expiration: string | null;
  client_company_name: string | null;
  cover_photo_url: string | null;
  mapping: ClientMapping;
  progress: {
    acres_completed: number | null;
    last_spraying_date: string | null;
    last_wicking_date: string | null;
    water_usage_latest: number | null;
    green_space_latest: number | null;
  };
  maintenance: ClientMaintenanceEvent[];
  watchlist: ClientWatchlistItem[];
  photos: ClientPhoto[];
  reports: ClientDailyReport[];
};

export function formatClientAddress(p: ClientProjectSummary): string {
  const parts = [
    p.street_address,
    [p.city, p.state].filter(Boolean).join(', '),
    p.zip_code,
    p.country && p.country !== 'United States' ? p.country : null,
  ].filter(Boolean);
  return parts.join(' · ') || '—';
}

export function formatClientDate(ymd: string | null | undefined): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}/.test(ymd)) return '—';
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return ymd.slice(0, 10);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
