export function ReportsPageSkeleton() {
  return (
    <div className="h-full flex flex-col bg-gray-50 animate-pulse">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="h-6 w-28 bg-gray-200 rounded" />
        <div className="h-4 w-48 bg-gray-100 rounded mt-2" />
        <div className="flex gap-3 mt-4">
          <div className="h-9 w-36 bg-gray-100 rounded-lg" />
          <div className="h-9 w-40 bg-gray-100 rounded-lg" />
          <div className="h-9 w-36 bg-gray-100 rounded-lg" />
        </div>
      </div>
      <div className="flex-1 p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-white rounded-xl border border-gray-100" />
        ))}
      </div>
    </div>
  );
}
