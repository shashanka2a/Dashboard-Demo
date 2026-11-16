/** Injured person block stored in incidents.injured_employee_info (jsonb array). */

export type InjuredEmployeeInfo = {
  name?: string;
  gender?: string;
  jobTitle?: string;
  dateOfBirth?: string;
  dateOfHire?: string;
  /** Set when field staff checks "Unknown" for date of birth. */
  dateOfBirthUnknown?: boolean;
  /** Set when field staff checks "Unknown" for hire date. */
  dateOfHireUnknown?: boolean;
};

function isUnknownValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const t = value.trim().toLowerCase();
  return t === 'unknown' || t === 'n/a' || t === 'na';
}

function asEmployeeObject(raw: unknown): InjuredEmployeeInfo | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  return {
    name: typeof o.name === 'string' ? o.name : undefined,
    gender: typeof o.gender === 'string' ? o.gender : undefined,
    jobTitle: typeof o.jobTitle === 'string' ? o.jobTitle : undefined,
    dateOfBirth: typeof o.dateOfBirth === 'string' ? o.dateOfBirth : undefined,
    dateOfHire: typeof o.dateOfHire === 'string' ? o.dateOfHire : undefined,
    dateOfBirthUnknown: o.dateOfBirthUnknown === true || isUnknownValue(o.dateOfBirth),
    dateOfHireUnknown: o.dateOfHireUnknown === true || isUnknownValue(o.dateOfHire),
  };
}

export function parseInjuredEmployeeInfo(raw: unknown): InjuredEmployeeInfo[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(asEmployeeObject).filter((x): x is InjuredEmployeeInfo => x !== null);
}

export function injuredEmployeeDisplayName(emp: InjuredEmployeeInfo): string {
  return (emp.name || '').trim() || 'Unnamed';
}

export function formatEmployeeDate(value?: string, unknownFlag?: boolean): string {
  if (unknownFlag) return 'Unknown';
  const t = (value || '').trim();
  if (!t) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [y, m, d] = t.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
  return t;
}

/** True when any injured person still has DOB or hire date marked unknown. */
export function incidentEmployeeInfoIncomplete(raw: unknown): boolean {
  const list = parseInjuredEmployeeInfo(raw);
  if (list.length === 0) return false;
  return list.some((emp) => emp.dateOfBirthUnknown || emp.dateOfHireUnknown);
}

export function normalizeInjuredEmployeeForSave(emp: InjuredEmployeeInfo): InjuredEmployeeInfo {
  const dobUnknown = !!emp.dateOfBirthUnknown || isUnknownValue(emp.dateOfBirth);
  const hireUnknown = !!emp.dateOfHireUnknown || isUnknownValue(emp.dateOfHire);
  const dateOfBirth = dobUnknown ? '' : (emp.dateOfBirth || '').trim();
  const dateOfHire = hireUnknown ? '' : (emp.dateOfHire || '').trim();

  return {
    name: emp.name?.trim() || undefined,
    gender: emp.gender?.trim() || undefined,
    jobTitle: emp.jobTitle?.trim() || undefined,
    dateOfBirth,
    dateOfHire,
    dateOfBirthUnknown: dobUnknown,
    dateOfHireUnknown: hireUnknown,
  };
}

export function normalizeInjuredEmployeeInfoForSave(raw: unknown): InjuredEmployeeInfo[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === 'string') {
        const name = item.trim();
        return name ? { name } : null;
      }
      const parsed = asEmployeeObject(item);
      return parsed ? normalizeInjuredEmployeeForSave(parsed) : null;
    })
    .filter((x): x is InjuredEmployeeInfo => x !== null);
}
