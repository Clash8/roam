import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Inbox, Building2, Users, CalendarDays, ChevronRight } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/admin', label: 'Panoramica', icon: LayoutDashboard },
  { href: '/admin/requests', label: 'Richieste', icon: Inbox },
  { href: '/admin/venues', label: 'Locali', icon: Building2 },
  { href: '/admin/organizers', label: 'Organizzatori', icon: Users },
  { href: '/admin/events', label: 'Eventi', icon: CalendarDays },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (user.app_metadata?.role !== 'admin') redirect('/')

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-gray-300 transition-colors">ROAM</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-amber-300">Admin</span>
      </div>

      {/* Mobile nav — horizontal scrollable tabs */}
      <nav
        aria-label="Navigazione admin"
        className="flex md:hidden gap-1.5 overflow-x-auto pb-4 mb-4 scrollbar-hide"
        style={{ scrollbarWidth: 'none' }}
      >
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-400 hover:bg-white/8 hover:text-white transition-all duration-200 glass flex-shrink-0"
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="flex gap-6 items-start">
        {/* Desktop sidebar */}
        <aside className="hidden md:block w-52 flex-shrink-0 sticky top-24">
          <div className="glass rounded-2xl p-2">
            <p className="section-label px-3 py-2">Pannello Admin</p>
            <nav aria-label="Navigazione admin">
              {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:bg-white/8 hover:text-white transition-all duration-200 group"
                >
                  <Icon className="w-4 h-4 group-hover:text-fuchsia-400 transition-colors" />
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>

        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}
