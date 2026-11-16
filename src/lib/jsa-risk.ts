import type { JsaRiskLevel } from '@/lib/jsa-types';

/**
 * Field app sends "Low" | "Medium" | "High"; the DB table uses "L" | "M" | "H".
 * Accept both (and common variants) so the level is never silently downgraded.
 */
export function normalizeJsaRiskLevel(raw: unknown): JsaRiskLevel {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'h' || v.startsWith('high') || v === 'critical' || v === 'severe') return 'H';
  if (v === 'l' || v.startsWith('low') || v === 'minor') return 'L';
  return 'M';
}

export function jsaRiskLabel(level: JsaRiskLevel): 'Low' | 'Medium' | 'High' {
  return level === 'H' ? 'High' : level === 'L' ? 'Low' : 'Medium';
}
