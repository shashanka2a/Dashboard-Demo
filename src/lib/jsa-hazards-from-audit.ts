import type { SupabaseClient } from '@supabase/supabase-js';
import type { JsaHazardRow } from '@/lib/jsa-types';
import { normalizeJsaRiskLevel } from '@/lib/jsa-risk';

function parseHazardList(raw: unknown): JsaHazardRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((h): h is Record<string, unknown> => h != null && typeof h === 'object')
    .map((h, i) => {
      return {
        hazard: String(h.hazard ?? '').trim(),
        risk_level: normalizeJsaRiskLevel(h.risk_level),
        control_measure: h.control_measure != null ? String(h.control_measure) : null,
        sort_order: typeof h.sort_order === 'number' ? h.sort_order : i,
      };
    })
    .filter((h) => h.hazard.length > 0)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

/**
 * Hazards recorded in the field app's audit snapshots for a JSA form
 * (`details.snapshot.jsa_hazards`, or `details.related.jsa_hazards`).
 * Newest audit row that actually contains hazards wins.
 */
export async function fetchJsaHazardsFromAudit(
  supabase: SupabaseClient,
  formId: string
): Promise<JsaHazardRow[]> {
  const { data, error } = await supabase
    .from('audit_log')
    .select('created_at, details')
    .eq('entity_type', 'jsa_forms')
    .eq('entity_id', formId)
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.warn('[jsa-hazards-from-audit]', error.message);
    return [];
  }

  for (const row of data ?? []) {
    const details = (row as { details?: Record<string, unknown> }).details ?? {};
    const snapshot = (details.snapshot ?? {}) as Record<string, unknown>;
    const related = (details.related ?? {}) as Record<string, unknown>;
    const list = parseHazardList(snapshot.jsa_hazards);
    if (list.length) return list;
    const rel = parseHazardList(related.jsa_hazards);
    if (rel.length) return rel;
  }
  return [];
}
