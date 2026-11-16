/** Normalize DB / client variants for “this safety talk is finished”. */
export function isSafetyTalkCompletedStatus(status: string | null | undefined): boolean {
  const s = String(status || '').trim().toLowerCase();
  return (
    s === 'completed' ||
    s === 'complete' ||
    s === 'done' ||
    s === 'finished' ||
    s === 'closed' ||
    s === 'conducted'
  );
}

export function isSafetyTalkCompletedRow(row: {
  status?: string | null;
  completed_at?: string | null;
  is_completed?: boolean | null;
}): boolean {
  if (row.is_completed === true) return true;
  if (isSafetyTalkCompletedStatus(row.status)) return true;
  const ca = row.completed_at != null && String(row.completed_at).trim() !== '';
  return Boolean(ca);
}
