/** Normalize incident workflow status for open vs closed lists. */
export function isIncidentOpenStatus(status: string | null | undefined): boolean {
  const s = String(status || '').trim().toLowerCase();
  if (!s) return true;
  return (
    s === 'open' ||
    s === 'active' ||
    s === 'in progress' ||
    s === 'in_progress' ||
    s === 'pending' ||
    s === 'investigating'
  );
}

export function isIncidentClosedStatus(status: string | null | undefined): boolean {
  const s = String(status || '').trim().toLowerCase();
  return (
    s === 'closed' ||
    s === 'resolved' ||
    s === 'complete' ||
    s === 'completed' ||
    s === 'done'
  );
}

export function incidentStatusLabel(status: string | null | undefined): string {
  const raw = String(status || '').trim();
  if (!raw) return 'Open';
  return raw;
}
