export default function MatchLoading() {
  return (
    <main aria-label="Loading match" className="mx-auto w-full max-w-6xl animate-pulse px-3 pb-12 pt-8 sm:px-6">
      <div className="mb-4 h-4 w-24 rounded bg-slate-200" />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="h-12 border-b border-slate-100 bg-slate-50" />
        <div className="grid min-h-64 grid-cols-[1fr_auto_1fr] items-center gap-4 px-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-slate-200" />
          <div className="h-12 w-32 rounded bg-slate-200" />
          <div className="mx-auto h-16 w-16 rounded-full bg-slate-200" />
        </div>
      </div>
      <div className="mt-6 h-12 border-b border-slate-200" />
      <div className="mt-5 grid gap-5 lg:grid-cols-2"><div className="h-72 rounded-lg bg-slate-100" /><div className="h-72 rounded-lg bg-slate-100" /></div>
    </main>
  )
}