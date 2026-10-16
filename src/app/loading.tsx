export default function Loading() {
  return (
    <main aria-label="Loading page" aria-busy="true" className="mx-auto w-full max-w-5xl animate-pulse px-4 py-8">
      <div className="mb-8 h-8 w-48 rounded bg-muted" />
      <div className="mb-8 h-36 rounded-xl border border-border bg-card" />
      <div className="space-y-4">
        {[0, 1, 2].map((item) => (
          <div key={item} className="rounded-xl border border-border bg-card p-5">
            <div className="mb-5 h-5 w-40 rounded bg-muted" />
            <div className="space-y-4">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center justify-between gap-4">
                  <div className="h-4 w-2/5 rounded bg-muted" />
                  <div className="h-4 w-12 rounded bg-muted" />
                  <div className="h-4 w-2/5 rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
