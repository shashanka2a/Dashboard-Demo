/** Neutral loader for dashboard routes (Reports, Incidents, etc.) — not the Activity layout. */
export default function DashboardRouteLoading() {
  return (
    <div className="flex h-full min-h-[12rem] items-center justify-center bg-gray-50">
      <div
        className="h-9 w-9 rounded-full border-2 border-[#FF6633] border-t-transparent animate-spin"
        aria-label="Loading"
      />
    </div>
  );
}
