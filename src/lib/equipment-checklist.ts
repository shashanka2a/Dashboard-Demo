import { normalizeInstantToYmd } from '@/lib/activity-display-timezone';

export type NormalizedEquipmentChecklist = {
  id: string;
  operatorName: string;
  machineType: string;
  machineNumber: string;
  siteName: string;
  reportDateYmd: string | null;
  loggedAt: string | null;
  signatureUrl: string | null;
};

export type ChecklistDisplayField = {
  label: string;
  value: string;
  group: string;
  highlight?: boolean;
};

export type ChecklistMetric = {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
};

/** Display order + labels for mobile ASV equipment checklist `form_data` keys. */
const FORM_FIELD_SPECS: {
  group: string;
  label: string;
  keys: string[];
  fluid?: { status: string; amount: string; unit: string };
  highlight?: boolean;
}[] = [
  { group: 'Site & machine', label: 'Operator', keys: ['operator_name', 'operatorName', 'operator'] },
  { group: 'Site & machine', label: 'Site name', keys: ['siteName', 'site_name'] },
  { group: 'Site & machine', label: 'Machine type', keys: ['machineType', 'machine_type'] },
  { group: 'Site & machine', label: 'Machine #', keys: ['machineNumber', 'machine_number', 'equipment_id', 'equipmentId', 'unit_number', 'unitNumber'] },
  { group: 'Site & machine', label: 'Last 4 of VIN', keys: ['lastFourVin', 'last_four_vin', 'vin'] },
  { group: 'Site & machine', label: 'Hours', keys: ['asvHours', 'asv_hours', 'hours', 'equipmentHours'] },
  {
    group: 'Fluids',
    label: 'Motor oil',
    keys: [],
    fluid: { status: 'motorOil', amount: 'motorOilAmount', unit: 'motorOilUnit' },
  },
  {
    group: 'Fluids',
    label: 'Hydraulic oil',
    keys: [],
    fluid: { status: 'hydraulicOil', amount: 'hydraulicOilAmount', unit: 'hydraulicOilUnit' },
  },
  {
    group: 'Fluids',
    label: 'Coolant',
    keys: [],
    fluid: { status: 'coolant', amount: 'coolantAmount', unit: 'coolantUnit' },
  },
  { group: 'Fluids', label: 'Fuel level', keys: ['fuel_level', 'fuelLevel'] },
  { group: 'Inspection', label: 'Hoses', keys: ['hoses'] },
  { group: 'Inspection', label: 'Fan belt', keys: ['fanBelt', 'fan_belt'] },
  { group: 'Inspection', label: 'Engine oil', keys: ['engine_oil', 'engineOil'] },
  { group: 'Inspection', label: 'Tires', keys: ['tires'] },
  { group: 'Inspection', label: 'Safety guards', keys: ['safety_guards', 'safetyGuards'] },
  { group: 'Inspection', label: 'Lights / signals', keys: ['lights_signals', 'lightsSignals', 'lights'] },
  { group: 'Inspection', label: 'Fire extinguisher', keys: ['fire_extinguisher', 'fireExtinguisher'] },
  {
    group: 'Inspection',
    label: 'Overall condition',
    keys: ['status', 'overall_condition', 'overallCondition', 'condition'],
    highlight: true,
  },
  { group: 'Attachment', label: 'Attachment applicable', keys: ['attachment_applicable', 'attachmentApplicable'] },
  { group: 'Attachment', label: 'Attachment name', keys: ['attachment_name', 'attachmentName', 'attachment'] },
  { group: 'Attachment', label: 'Attachment #', keys: ['attachment_number', 'attachmentNumber'] },
  { group: 'Attachment', label: 'Attachment condition', keys: ['attachment_condition', 'attachmentCondition'] },
  { group: 'Notes', label: 'Repairs / notes', keys: ['repairsNotes', 'repairs_notes', 'notes'] },
];

const KNOWN_FORM_KEYS = new Set(
  FORM_FIELD_SPECS.flatMap((s) => [
    ...s.keys,
    ...(s.fluid ? [s.fluid.status, s.fluid.amount, s.fluid.unit] : []),
  ])
);

function parseFormData(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

function displayValue(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
  return String(raw).trim();
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function pickFromSources(
  sources: Record<string, unknown>[],
  ...keys: string[]
): string {
  for (const k of keys) {
    for (const src of sources) {
      const v = displayValue(src[k]);
      if (v) return v;
    }
  }
  return '';
}

function formatFluidLine(
  sources: Record<string, unknown>[],
  statusKey: string,
  amountKey: string,
  unitKey: string
): string {
  const status = pickFromSources(sources, statusKey);
  const amount = pickFromSources(sources, amountKey);
  const unit = pickFromSources(sources, unitKey);
  const parts: string[] = [];
  if (status) parts.push(status);
  if (amount) parts.push(unit ? `${amount} ${unit}` : amount);
  return parts.join(' · ');
}

function getFormSources(row: Record<string, unknown>): Record<string, unknown>[] {
  const form = parseFormData(row.form_data);
  return [form, row];
}

/** Read snake_case columns and camelCase keys from `form_data` (mobile payloads). */
export function pickChecklistField(row: Record<string, unknown>, ...keys: string[]): string {
  return pickFromSources(getFormSources(row), ...keys);
}

export function resolveEquipmentChecklistReportYmd(
  row: Record<string, unknown>,
  auditReportDate?: string | null
): string | null {
  if (row.report_date != null && String(row.report_date).trim()) {
    const y = normalizeInstantToYmd(String(row.report_date));
    if (y) return y;
  }
  const fromRow = pickChecklistField(
    row,
    'report_date',
    'reportDate',
    'selected_date',
    'selectedDate',
    'calendar_date',
    'calendarDate',
    'work_date',
    'workDate',
    'field_date',
    'fieldDate',
    'date'
  );
  if (fromRow) {
    const y = normalizeInstantToYmd(fromRow);
    if (y) return y;
  }
  if (auditReportDate != null && String(auditReportDate).trim()) {
    const y = normalizeInstantToYmd(String(auditReportDate));
    if (y) return y;
  }
  return null;
}

/** All checklist fields for UI — driven by real `form_data` shape from the field app. */
export function equipmentChecklistFormDisplayFields(
  row: Record<string, unknown>
): ChecklistDisplayField[] {
  const sources = getFormSources(row);
  const out: ChecklistDisplayField[] = [];
  const usedKeys = new Set<string>();

  for (const spec of FORM_FIELD_SPECS) {
    let value = '';
    if (spec.fluid) {
      value = formatFluidLine(sources, spec.fluid.status, spec.fluid.amount, spec.fluid.unit);
      usedKeys.add(spec.fluid.status);
      usedKeys.add(spec.fluid.amount);
      usedKeys.add(spec.fluid.unit);
    } else {
      value = pickFromSources(sources, ...spec.keys);
      spec.keys.forEach((k) => usedKeys.add(k));
    }
    if (!value) continue;
    out.push({
      label: spec.label,
      value,
      group: spec.group,
      highlight: spec.highlight,
    });
  }

  const form = parseFormData(row.form_data);
  for (const [key, raw] of Object.entries(form)) {
    if (KNOWN_FORM_KEYS.has(key) || usedKeys.has(key)) continue;
    const value = displayValue(raw);
    if (!value) continue;
    out.push({
      label: humanizeKey(key),
      value,
      group: 'Other',
    });
  }

  return out;
}

export function normalizeEquipmentChecklistRow(
  row: Record<string, unknown>,
  auditReportDate?: string | null
): NormalizedEquipmentChecklist {
  const loggedAt =
    row.logged_at != null && String(row.logged_at).trim()
      ? String(row.logged_at)
      : row.created_at != null && String(row.created_at).trim()
        ? String(row.created_at)
        : null;

  return {
    id: String(row.id ?? ''),
    operatorName: pickChecklistField(row, 'operator_name', 'operatorName', 'operator'),
    machineType: pickChecklistField(row, 'machineType', 'machine_type'),
    machineNumber: pickChecklistField(
      row,
      'machineNumber',
      'machine_number',
      'equipment_id',
      'equipmentId',
      'unit_number',
      'unitNumber'
    ),
    siteName: pickChecklistField(row, 'siteName', 'site_name'),
    reportDateYmd: resolveEquipmentChecklistReportYmd(row, auditReportDate),
    loggedAt,
    signatureUrl:
      row.signature_url != null && String(row.signature_url).trim()
        ? String(row.signature_url).trim()
        : pickChecklistField(row, 'signature_url', 'signatureUrl') || null,
  };
}

function metric(label: string, value: string, highlight = false): ChecklistMetric {
  return { label, value: value || '—', unit: '', highlight };
}

/** Metrics for activity feed / detail modal. */
export function equipmentChecklistToMetrics(row: Record<string, unknown>): ChecklistMetric[] {
  return equipmentChecklistFormDisplayFields(row).map((f) =>
    metric(f.label.toUpperCase(), f.value, f.highlight)
  );
}

export function equipmentChecklistMatchesReportDate(
  row: Record<string, unknown>,
  dateYmd: string,
  auditReportDate?: string | null
): boolean {
  const reportYmd = resolveEquipmentChecklistReportYmd(row, auditReportDate);
  if (reportYmd) return reportYmd === dateYmd;
  const loggedAt =
    row.logged_at != null && String(row.logged_at).trim()
      ? String(row.logged_at)
      : row.created_at != null
        ? String(row.created_at)
        : '';
  if (loggedAt) {
    const y = normalizeInstantToYmd(loggedAt);
    if (y) return y === dateYmd;
  }
  return false;
}
