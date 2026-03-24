import { createAdminClient } from '@/lib/supabase-admin'
import Link from 'next/link'
import { Inbox, Building2, Users, CalendarDays, ArrowRight } from 'lucide-react'

export default async function AdminOverviewPage() {
  const supabase = createAdminClient()

  const [
    { count: pendingVenueOrg },
    { count: pendingEvents },
    { count: venues },
    { count: organizers },
    { count: events },
  ] = await Promise.all([
    supabase.from('requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('event_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('venues').select('id', { count: 'exact', head: true }),
    supabase.from('organizers').select('id', { count: 'exact', head: true }),
    supabase.from('events').select('id', { count: 'exact', head: true }),
  ])

  const pendingRequests = (pendingVenueOrg ?? 0) + (pendingEvents ?? 0)

  const stats = [
    {
      label: 'Richieste in attesa',
      value: pendingRequests ?? 0,
      icon: Inbox,
      href: '/admin/requests',
      color: 'text-amber-300',
      bg: 'bg-amber-500/10 border-amber-500/20',
      iconColor: 'text-amber-400',
      urgent: (pendingRequests ?? 0) > 0,
    },
    {
      label: 'Locali',
      value: venues ?? 0,
      icon: Building2,
      href: '/admin/venues',
      color: 'text-fuchsia-300',
      bg: 'bg-fuchsia-500/10 border-fuchsia-500/20',
      iconColor: 'text-fuchsia-400',
      urgent: false,
    },
    {
      label: 'Organizzatori',
      value: organizers ?? 0,
      icon: Users,
      href: '/admin/organizers',
      color: 'text-indigo-300',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      iconColor: 'text-indigo-400',
      urgent: false,
    },
    {
      label: 'Eventi',
      value: events ?? 0,
      icon: CalendarDays,
      href: '/admin/events',
      color: 'text-purple-300',
      bg: 'bg-purple-500/10 border-purple-500/20',
      iconColor: 'text-purple-400',
      urgent: false,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <p className="section-label mb-1">Pannello di controllo</p>
        <h1 className="page-title">Panoramica</h1>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Link
              key={s.label}
              href={s.href}
              className={`glass-card rounded-2xl p-5 flex items-center gap-4 hover:border-white/15 transition-all duration-200 group ${s.urgent ? 'ring-1 ring-amber-500/30' : ''}`}
            >
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                <Icon className={`w-5 h-5 ${s.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-xs text-gray-500 leading-tight">{s.label}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-gray-300 transition-colors flex-shrink-0" />
            </Link>
          )
        })}
      </div>

      {(pendingRequests ?? 0) > 0 && (
        <div className="glass rounded-2xl p-5 border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-amber-200">
                {pendingRequests} {(pendingRequests ?? 0) > 1 ? 'richieste' : 'richiesta'} in attesa
              </p>
              <p className="text-sm text-amber-400/70 mt-0.5">
                Revisiona e approva le segnalazioni degli utenti.
              </p>
            </div>
            <Link href="/admin/requests" className="btn-primary text-sm px-4 py-2 flex-shrink-0">
              Gestisci
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
