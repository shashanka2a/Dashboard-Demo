export function reportListRangeBounds(range: string | null): { from: string | null; to: string | null } {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const to = `${yyyy}-${mm}-${dd}`;

  if (!range || range === 'all') return { from: null, to: null };
  if (range === 'today') return { from: to, to };

  const days = range === '7d' ? 7 : range === '30d' ? 30 : null;
  if (!days) return { from: null, to: null };

  const start = new Date(today);
  start.setDate(start.getDate() - (days - 1));
  const from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  return { from, to };
}

export function filterDailyReportsByDateRange<
  T extends { date: string },
>(items: T[], from: string | null, to: string | null): T[] {
  return items.filter((r) => {
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    return true;
  });
}
