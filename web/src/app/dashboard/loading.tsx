export default function DashboardLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Score hero skeleton */}
      <div className="glass-strong rounded-3xl p-6 h-44 animate-pulse" />

      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-3 w-16 rounded bg-white/5 animate-pulse" />
          <div className="h-8 w-48 rounded bg-white/5 animate-pulse" />
        </div>
        <div className="h-10 w-36 rounded-xl bg-white/5 animate-pulse" />
      </div>

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl p-4 h-20 animate-pulse" />
        ))}
      </div>

      {/* List skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass-card rounded-2xl p-5 h-20 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
