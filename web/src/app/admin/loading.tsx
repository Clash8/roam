export default function AdminLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
        <div className="h-8 w-40 rounded bg-white/5 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card rounded-2xl p-5 h-24 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
