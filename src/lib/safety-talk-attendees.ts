import type { SupabaseClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidLike(s: string): boolean {
  return UUID_RE.test(s.trim());
}

type ParsedPiece =
  | { kind: 'uuid'; id: string; embeddedName?: string; company?: string }
  | { kind: 'label'; label: string; company?: string };

export type SafetyTalkAttendee = {
  id: string;
  name: string;
  company?: string;
};

function pushPiecesFromValue(x: unknown, into: ParsedPiece[]): void {
  if (x == null) return;

  if (typeof x === 'string') {
    const t = x.trim();
    if (!t) return;
    if (isUuidLike(t)) {
      into.push({ kind: 'uuid', id: t.toLowerCase() });
      return;
    }
    try {
      const p = JSON.parse(t) as unknown;
      if (Array.isArray(p)) {
        for (const el of p) pushPiecesFromValue(el, into);
      }
    } catch {
      into.push({ kind: 'label', label: t });
    }
    return;
  }

  if (typeof x === 'number' && Number.isFinite(x)) {
    const s = String(x);
    if (isUuidLike(s)) into.push({ kind: 'uuid', id: s.toLowerCase() });
    return;
  }

  if (typeof x === 'object' && !Array.isArray(x)) {
    const o = x as Record<string, unknown>;
    const idRaw =
      (typeof o.id === 'string' && o.id) ||
      (typeof o.employee_id === 'string' && o.employee_id) ||
      (typeof o.employeeId === 'string' && o.employeeId) ||
      '';
    const id = idRaw.trim();
    const embedded =
      (typeof o.name === 'string' && o.name.trim()) ||
      (typeof o.full_name === 'string' && o.full_name.trim()) ||
      (typeof o.display_name === 'string' && o.display_name.trim()) ||
      (typeof o.label === 'string' && o.label.trim()) ||
      '';
    const company = typeof o.company === 'string' ? o.company.trim() : undefined;

    if (id && isUuidLike(id)) {
      into.push({ kind: 'uuid', id: id.toLowerCase(), embeddedName: embedded || undefined, company });
      return;
    }
    if (embedded) {
      into.push({ kind: 'label', label: embedded, company });
    }
    return;
  }
}

/** Walk `attendees` jsonb / legacy shapes into structured pieces (uuid vs plain label). */
export function parseAttendeePieces(raw: unknown): ParsedPiece[] {
  const into: ParsedPiece[] = [];
  if (raw == null) return into;

  if (Array.isArray(raw)) {
    for (const x of raw) pushPiecesFromValue(x, into);
    return into;
  }

  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return into;
    try {
      const p = JSON.parse(t) as unknown;
      if (Array.isArray(p)) {
        for (const el of p) pushPiecesFromValue(el, into);
        return into;
      }
    } catch {
      if (isUuidLike(t)) into.push({ kind: 'uuid', id: t.toLowerCase() });
    }
    return into;
  }

  pushPiecesFromValue(raw, into);
  return into;
}

/** Employee UUIDs to resolve via `employees` (deduped). */
export function parseAttendeeEmployeeIds(raw: unknown): string[] {
  const ids = new Set<string>();
  for (const p of parseAttendeePieces(raw)) {
    if (p.kind === 'uuid') ids.add(p.id);
  }
  return [...ids];
}

/** Display name per attendee: DB name for uuid, embedded or literal label otherwise. */
export function resolveAttendeeDisplayNames(raw: unknown, nameById: Map<string, string>): string[] {
  const out: string[] = [];
  for (const p of parseAttendeePieces(raw)) {
    if (p.kind === 'label') {
      out.push(p.label);
      continue;
    }
    const fromDb = nameById.get(p.id)?.trim();
    if (fromDb) {
      out.push(fromDb);
      continue;
    }
    if (p.embeddedName) {
      out.push(p.embeddedName);
      continue;
    }
    out.push('Unknown');
  }
  return out;
}

/** Resolved attendees for API / UI (names from employees table or embedded mobile sign-in rows). */
export function mapSafetyTalkAttendees(
  raw: unknown,
  employeeNameById: Map<string, string>
): SafetyTalkAttendee[] {
  return parseAttendeePieces(raw).map((piece, idx) => {
    if (piece.kind === 'label') {
      return {
        id: `label:${idx}`,
        name: piece.label,
        ...(piece.company ? { company: piece.company } : {}),
      };
    }
    const name =
      employeeNameById.get(piece.id)?.trim() ||
      piece.embeddedName?.trim() ||
      'Unknown employee';
    return {
      id: piece.id,
      name,
      ...(piece.company ? { company: piece.company } : {}),
    };
  });
}

export async function fetchEmployeeNameMap(
  supabase: SupabaseClient,
  employeeIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = [...new Set(employeeIds.map((x) => String(x).trim().toLowerCase()).filter(Boolean))];
  const chunkSize = 200;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabase.from('employees').select('id, name').in('id', chunk);
    if (error) {
      console.warn('[safety-talk-attendees] employees lookup:', error.message);
      continue;
    }
    for (const row of data || []) {
      const id = String((row as { id: string }).id).trim().toLowerCase();
      const name = String((row as { name?: string | null }).name || '').trim() || 'Employee';
      if (id) map.set(id, name);
    }
  }
  return map;
}
