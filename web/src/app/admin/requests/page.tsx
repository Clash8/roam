import { createAdminClient } from '@/lib/supabase-admin'
import { Building2, Users, CalendarDays, Clock, Star } from 'lucide-react'
import { InstagramIcon } from '@/components/InstagramIcon'
import RejectModal from '@/components/RejectModal'
import ApproveModal from '@/components/ApproveModal'

type Status = 'pending' | 'approved' | 'rejected'

const STATUS_MAP: Record<Status, { label: string; className: string }> = {
  pending:  { label: 'In attesa', className: 'badge-pending' },
  approved: { label: 'Approvata', className: 'badge-approved' },
  rejected: { label: 'Rifiutata', className: 'badge-rejected' },
}

export default async function AdminRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>
}) {
  const { status: filterStatus, type: filterType } = await searchParams
  const supabase = createAdminClient()

  let venueOrgQuery = supabase.from('requests').select('*').order('created_at', { ascending: false })
  let eventQuery    = supabase.from('event_requests').select('*').order('created_at', { ascending: false })

  if (filterStatus && filterStatus !== 'all') {
    venueOrgQuery = venueOrgQuery.eq('status', filterStatus)
    eventQuery    = eventQuery.eq('status', filterStatus)
  }

  const [{ data: requests }, { data: eventRequests }, { data: venuesList }, { data: organizersList }] = await Promise.all([
    venueOrgQuery,
    eventQuery,
    supabase.from('venues').select('id, name').order('name'),
    supabase.from('organizers').select('id, name').order('name'),
  ])

  // Merge and sort
  type Row = {
    id: string; status: string; created_at: string; notes?: string; instagram_username?: string
    _table: 'requests' | 'event_requests'
    // requests fields
    item_type?: string; name?: string
    // event_requests fields
    title?: string; date?: string; venue_name?: string; organizer_name?: string
    description?: string; ticket_link?: string
  }

  let allRequests: Row[] = [
    ...(requests ?? []).map(r => ({ ...r, _table: 'requests' as const })),
    ...(eventRequests ?? []).map(r => ({ ...r, _table: 'event_requests' as const })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  if (filterType === 'events') {
    allRequests = allRequests.filter(r => r._table === 'event_requests')
  } else if (filterType === 'venues') {
    allRequests = allRequests.filter(r => r._table === 'requests')
  }

  const buildHref = (params: Record<string, string>) => {
    const p = new URLSearchParams()
    if (filterStatus && filterStatus !== 'all') p.set('status', filterStatus)
    if (filterType) p.set('type', filterType)
    Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); else p.delete(k) })
    const s = p.toString()
    return `/admin/requests${s ? `?${s}` : ''}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label mb-1">Admin</p>
          <h1 className="page-title">Richieste utenti</h1>
        </div>
      </div>

      {/* Type filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: '', label: 'Tutti' },
          { key: 'venues', label: 'Locali / Organizzatori' },
          { key: 'events', label: 'Eventi' },
        ].map(({ key, label }) => (
          <a
            key={key || 'all-types'}
            href={buildHref({ type: key })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
              (!filterType && !key) || filterType === key
                ? 'bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-300'
                : 'border-white/10 text-gray-400 hover:bg-white/5 hover:text-gray-200'
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'approved', 'rejected'].map((s) => (
          <a
            key={s}
            href={buildHref({ status: s === 'all' ? '' : s })}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-200 ${
              (s === 'all' && !filterStatus) || filterStatus === s
                ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                : 'border-white/10 text-gray-400 hover:bg-white/5 hover:text-gray-200'
            }`}
          >
            {s === 'all' ? 'Tutte' : STATUS_MAP[s as Status]?.label ?? s}
          </a>
        ))}
      </div>

      {allRequests.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Clock className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nessuna richiesta trovata.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allRequests.map((req) => {
            const status = STATUS_MAP[req.status as Status] ?? STATUS_MAP.pending
            const isPending = req.status === 'pending'
            const isEvent = req._table === 'event_requests'
            const displayName = isEvent ? req.title : req.name
            const pts = isEvent ? 5 : 2

            return (
              <div key={`${req._table}-${req.id}`} className="glass-card rounded-2xl p-5">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
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
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="font-semibold text-white">{displayName}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-gray-500 capitalize">
                            {isEvent ? 'evento' : req.item_type}
                          </span>
                          <span className="text-gray-700 text-xs">·</span>
                          <span className="text-xs text-gray-500">
                            {new Date(req.created_at).toLocaleDateString('it-IT')}
                          </span>
                          <span className="text-gray-700 text-xs">·</span>
                          <span className="text-xs font-semibold text-amber-400 flex items-center gap-0.5">
                            <Star className="w-3 h-3 fill-amber-400" />
                            +{pts} pts se approvata
                          </span>
                        </div>
                      </div>
                      <span className={status.className}>{status.label}</span>
                    </div>

                    {/* Event-specific details */}
                    {isEvent && (req.date || req.venue_name || req.organizer_name) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-400">
                        {req.date && <span>📅 {req.date}</span>}
                        {req.venue_name && <span>📍 {req.venue_name}</span>}
                        {req.organizer_name && <span>🎧 {req.organizer_name}</span>}
                      </div>
                    )}

                    {req.instagram_username && (
                      <a
                        href={`https://instagram.com/${req.instagram_username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 mt-1.5 transition-colors"
                      >
                        <InstagramIcon className="w-3 h-3" />
                        {req.instagram_username}
                      </a>
                    )}

                    {isEvent && req.description && (
                      <p className="text-sm text-gray-400 mt-2 bg-white/3 rounded-lg px-3 py-2 border border-white/5">
                        {req.description}
                      </p>
                    )}

                    {req.notes && (
                      <p className="text-sm text-gray-400 mt-2 bg-white/3 rounded-lg px-3 py-2 border border-white/5">
                        {req.notes}
                      </p>
                    )}

                    {isPending && (
                      <div className="flex gap-2 mt-4">
                        <ApproveModal
                          request={{
                            id: req.id,
                            _table: req._table,
                            item_type: req.item_type ?? undefined,
                            name: req.name ?? undefined,
                            title: req.title ?? undefined,
                            date: req.date ?? undefined,
                            venue_name: req.venue_name ?? undefined,
                            organizer_name: req.organizer_name ?? undefined,
                            description: req.description ?? undefined,
                            instagram_username: req.instagram_username ?? undefined,
                            ticket_link: req.ticket_link ?? undefined,
                          }}
                          pts={pts}
                          venues={venuesList ?? []}
                          organizers={organizersList ?? []}
                        />
                        <RejectModal id={req.id} isEvent={isEvent} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
