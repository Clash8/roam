import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Clock, CheckCircle, XCircle, Building2, Users, CalendarDays, Star, Trophy, Zap, Trash2 } from 'lucide-react'
import { deleteRequest, deleteEventRequest } from '@/app/actions/auth'

const STATUS_MAP = {
  pending: { label: 'In attesa', className: 'badge-pending', icon: Clock },
  approved: { label: 'Approvata', className: 'badge-approved', icon: CheckCircle },
  rejected: { label: 'Rifiutata', className: 'badge-rejected', icon: XCircle },
} as const

type Rank = { name: string; color: string; bg: string; nextAt: number | null; prevAt: number }
function getRank(pts: number): Rank {
  if (pts >= 100) return { name: 'Legend', color: 'text-yellow-300', bg: 'bg-yellow-500/15 border-yellow-500/30', nextAt: null, prevAt: 100 }
  if (pts >= 50)  return { name: 'Insider', color: 'text-purple-300', bg: 'bg-purple-500/15 border-purple-500/30', nextAt: 100, prevAt: 50 }
  if (pts >= 25)  return { name: 'Scout',   color: 'text-blue-300',   bg: 'bg-blue-500/15 border-blue-500/30',   nextAt: 50,  prevAt: 25 }
  if (pts >= 10)  return { name: 'Explorer',color: 'text-green-300',  bg: 'bg-green-500/15 border-green-500/30', nextAt: 25,  prevAt: 10 }
  return                 { name: 'Rookie',  color: 'text-gray-300',   bg: 'bg-white/8 border-white/15',          nextAt: 10,  prevAt: 0  }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: requests }, { data: eventRequests }] = await Promise.all([
    supabase.from('requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('event_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])

  // ── Points ───────────────────────────────────────────────────
  const venueOrgApproved = requests?.filter(r => r.status === 'approved').length ?? 0
  const eventsApproved   = eventRequests?.filter(r => r.status === 'approved').length ?? 0
  const totalPoints = venueOrgApproved * 2 + eventsApproved * 5
  const rank = getRank(totalPoints)
  const progressPct = rank.nextAt
    ? Math.min(100, Math.round(((totalPoints - rank.prevAt) / (rank.nextAt - rank.prevAt)) * 100))
    : 100

  // ── Combined list ────────────────────────────────────────────
  type AnyRequest = { id: string; status: string; name?: string; title?: string; created_at: string; _table: 'requests' | 'event_requests'; item_type?: string; date?: string; rejection_reason?: string | null }
  const allRequests: AnyRequest[] = [
    ...(requests ?? []).map(r => ({ ...r, _table: 'requests' as const })),
    ...(eventRequests ?? []).map(r => ({ ...r, _table: 'event_requests' as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const counts = {
    total: allRequests.length,
    pending: allRequests.filter(r => r.status === 'pending').length,
    approved: allRequests.filter(r => r.status === 'approved').length,
    rejected: allRequests.filter(r => r.status === 'rejected').length,
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

      {/* ── Score hero ─────────────────────────────────────────── */}
      <div className="glass-strong rounded-3xl p-6 relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-fuchsia-600/10 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 w-48 h-48 rounded-full bg-indigo-600/10 blur-3xl" />
        </div>

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          {/* Left: score */}
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-indigo-500/20 border border-fuchsia-500/25 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-8 h-8 text-fuchsia-300" />
            </div>
            <div>
              <p className="section-label mb-0.5">ROAM Score</p>
              <p className="text-5xl font-black text-white tabular-nums leading-none">{totalPoints}</p>
              <p className="text-sm text-gray-500 mt-1">punti totali</p>
            </div>
          </div>

          {/* Right: rank + progress */}
          <div className="flex-1 max-w-xs w-full">
            <div className="flex items-center justify-between mb-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${rank.bg} ${rank.color}`}>
                <Star className="w-3 h-3 fill-current" />
                {rank.name}
              </span>
              {rank.nextAt && (
                <span className="text-xs text-gray-500">
                  {rank.nextAt - totalPoints} pts → {getRank(rank.nextAt).name}
                </span>
              )}
            </div>
            <div className="h-2 bg-white/8 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-fuchsia-500 to-indigo-500 rounded-full transition-all duration-700"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {rank.nextAt && (
              <p className="text-[11px] text-gray-600 mt-1.5">
                {progressPct}% verso {getRank(rank.nextAt).name}
              </p>
            )}
          </div>
        </div>

        {/* How to earn */}
        <div className="relative mt-5 pt-5 border-t border-white/8 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/4 border border-white/8">
            <Building2 className="w-3.5 h-3.5 text-fuchsia-400" />
            <span className="text-xs text-gray-400">Locale / Organizzatore approvato</span>
            <span className="text-xs font-bold text-amber-400 flex items-center gap-0.5">
              <Zap className="w-3 h-3" />+2 pts
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/4 border border-white/8">
            <CalendarDays className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-xs text-gray-400">Evento approvato</span>
            <span className="text-xs font-bold text-amber-400 flex items-center gap-0.5">
              <Zap className="w-3 h-3" />+5 pts
            </span>
          </div>
        </div>
      </div>

      {/* ── Header + new request ────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label mb-1">Area personale</p>
          <h1 className="page-title">Le mie richieste</h1>
        </div>
        <Link href="/dashboard/request" className="btn-primary">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Nuova richiesta</span>
        </Link>
      </div>

      {/* ── Stats grid ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Totali', value: counts.total, color: 'text-white' },
          { label: 'In attesa', value: counts.pending, color: 'text-amber-300' },
          { label: 'Approvate', value: counts.approved, color: 'text-emerald-300' },
          { label: 'Rifiutate', value: counts.rejected, color: 'text-red-300' },
        ].map(s => (
          <div key={s.label} className="glass rounded-2xl p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Requests list ───────────────────────────────────────── */}
      {allRequests.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center mx-auto mb-4">
            <Plus className="w-7 h-7 text-fuchsia-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Nessuna richiesta</h2>
          <p className="text-gray-500 text-sm mb-6">
            Guadagna punti segnalando locali, organizzatori o eventi da aggiungere a ROAM.
          </p>
          <Link href="/dashboard/request" className="btn-primary inline-flex">
            <Plus className="w-4 h-4" />
            Invia la prima richiesta
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {allRequests.map((req) => {
            const status = STATUS_MAP[req.status as keyof typeof STATUS_MAP] ?? STATUS_MAP.pending
            const StatusIcon = status.icon
            const isEvent = req._table === 'event_requests'
            const displayName = isEvent ? req.title : req.name
            const typeLabel = isEvent ? 'evento' : req.item_type
            const pts = isEvent ? 5 : 2

            return (
              <div
                key={`${req._table}-${req.id}`}
                className="glass-card rounded-2xl p-5 flex items-center gap-4 hover:border-white/12 transition-colors"
              >
                {/* Type icon */}
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  {isEvent ? (
                    <CalendarDays className="w-4 h-4 text-indigo-400" />
                  ) : req.item_type === 'venue' ? (
                    <Building2 className="w-4 h-4 text-fuchsia-400" />
                  ) : (
                    <Users className="w-4 h-4 text-blue-400" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{displayName}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500 capitalize">{typeLabel}</span>
                    {req.status === 'approved' && (
                      <>
                        <span className="text-gray-700">·</span>
                        <span className="text-xs font-bold text-amber-400 flex items-center gap-0.5">
                          <Star className="w-3 h-3 fill-amber-400" />
                          +{pts} pts
                        </span>
                      </>
                    )}
                    {isEvent && req.date && (
                      <>
                        <span className="text-gray-700">·</span>
                        <span className="text-xs text-gray-500">{req.date}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status + date + delete */}
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <span className={status.className}>
                    <span className="flex items-center gap-1">
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </span>
                  <span className="text-xs text-gray-600">
                    {new Date(req.created_at).toLocaleDateString('it-IT')}
                  </span>
                  {req.status === 'rejected' && req.rejection_reason && (
                    <p className="text-xs text-red-400/80 text-right max-w-[160px] leading-snug">
                      {req.rejection_reason}
                    </p>
                  )}
                  {req.status !== 'approved' && (
                    <form
                      action={async () => {
                        'use server'
                        if (isEvent) await deleteEventRequest(req.id)
                        else await deleteRequest(req.id)
                      }}
                    >
                      <button
                        type="submit"
                        className="text-gray-600 hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10"
                        title="Elimina richiesta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
