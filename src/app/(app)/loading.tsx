export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-6 px-4 py-8 sm:px-8" aria-busy aria-label="Loading">
      <div className="h-7 w-56 rounded-md bg-hover" />
      <div className="h-40 rounded-xl bg-hover" />
      <div className="grid gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-20 rounded-xl bg-hover" />
        ))}
      </div>
      <div className="h-64 rounded-xl bg-hover" />
    </div>
  );
}
