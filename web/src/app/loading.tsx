export default function HomeLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 pb-24">
      {/* Hero skeleton */}
      <section className="text-center pt-12 pb-14 space-y-5">
        <div className="h-20 w-64 mx-auto rounded-2xl bg-white/5 animate-pulse" />
        <div className="h-6 w-96 max-w-full mx-auto rounded-lg bg-white/5 animate-pulse" />
      </section>

      {/* Filter bar skeleton */}
      <div className="flex gap-2 flex-wrap justify-center mb-10">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-9 w-20 rounded-full bg-white/5 animate-pulse" />
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass-card rounded-3xl overflow-hidden">
            <div className="h-52 bg-white/5 animate-pulse" />
            <div className="p-5 space-y-3">
              <div className="h-5 w-3/4 rounded bg-white/5 animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-white/5 animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-white/5 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
