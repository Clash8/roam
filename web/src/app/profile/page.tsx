import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Mail, Shield, Calendar, User, Star, Zap } from 'lucide-react'
import { signOut } from '@/app/actions/auth'
import ChangePasswordForm from './ChangePasswordForm'
import { ProfileLogoutButton } from '@/components/LogoutButton'

const LEVELS = [
  { min: 0,   label: 'Esploratore',  color: 'text-gray-400',    border: 'border-gray-500/30',   bg: 'bg-gray-500/10' },
  { min: 10,  label: 'Scopritore',   color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
  { min: 25,  label: 'Conoscitore',  color: 'text-sky-400',     border: 'border-sky-500/30',     bg: 'bg-sky-500/10' },
  { min: 50,  label: 'Insider',      color: 'text-indigo-400',  border: 'border-indigo-500/30',  bg: 'bg-indigo-500/10' },
  { min: 100, label: 'Ambassador',   color: 'text-fuchsia-400', border: 'border-fuchsia-500/30', bg: 'bg-fuchsia-500/10' },
]

function getLevel(points: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].min) return { ...LEVELS[i], number: i + 1 }
  }
  return { ...LEVELS[0], number: 1 }
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { count: totalRequests } = await supabase
    .from('requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { count: approvedRequests } = await supabase
    .from('requests')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'approved')

  const { data: pointsRow } = await supabase
    .from('user_points')
    .select('total_points')
    .eq('user_id', user.id)
    .maybeSingle()

  const totalPoints = pointsRow?.total_points ?? 0
  const level = getLevel(totalPoints)

  const isAdmin = user.app_metadata?.role === 'admin'
  const displayName = user.user_metadata?.full_name || user.email || 'Utente'
  const joinedDate = new Date(user.created_at).toLocaleDateString('it-IT', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="glass-strong rounded-3xl p-8">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-black text-white">
              {displayName[0].toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white truncate">{displayName}</h1>
            <p className="text-gray-400 text-sm mt-0.5">{user.email}</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                isAdmin
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  : 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-300'
              }`}>
                {isAdmin ? 'Amministratore' : 'Utente'}
              </span>
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${level.bg} ${level.border} ${level.color}`}>
                <Zap className="w-3 h-3" />
                Lv.{level.number} {level.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-3">
              <Star className="w-4 h-4 text-fuchsia-400" />
              <span className="text-white font-black text-lg leading-none">{totalPoints}</span>
              <span className="text-gray-400 text-sm">Roam Score</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="glass rounded-2xl p-5 text-center">
          <p className="text-3xl font-black text-white">{totalRequests ?? 0}</p>
          <p className="text-sm text-gray-400 mt-1">Richieste inviate</p>
        </div>
        <div className="glass rounded-2xl p-5 text-center">
          <p className="text-3xl font-black text-emerald-400">{approvedRequests ?? 0}</p>
          <p className="text-sm text-gray-400 mt-1">Approvate</p>
        </div>
      </div>

      {/* Details */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-white">Dettagli account</h2>
        <div className="space-y-3">
          {[
            { icon: Mail, label: 'Email', value: user.email },
            { icon: Shield, label: 'Ruolo', value: isAdmin ? 'Amministratore' : 'Utente' },
            { icon: Calendar, label: 'Iscritto il', value: joinedDate },
            { icon: User, label: 'ID utente', value: user.id, mono: true },
          ].map(({ icon: Icon, label, value, mono }) => (
            <div key={label} className="flex items-center gap-3 text-sm">
              <div className="p-2 rounded-lg bg-white/5">
                <Icon className="w-4 h-4 text-gray-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                <p className={mono ? 'text-gray-500 font-mono text-xs break-all' : 'text-gray-200'}>
                  {value}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ChangePasswordForm />

      <form action={signOut}>
        <ProfileLogoutButton />
      </form>
    </div>
  )
}
