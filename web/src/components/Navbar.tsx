import Link from 'next/link'
import { createClient } from '@/lib/supabase-server'
import { signOut } from '@/app/actions/auth'
import { LayoutDashboard, LogIn, UserPlus, User, Shield } from 'lucide-react'
import { NavbarLogoutButton } from './LogoutButton'

export default async function Navbar() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const isAdmin = user?.app_metadata?.role === 'admin'

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <nav
        className="mx-auto max-w-6xl px-4 mt-3"
        aria-label="Navigazione principale"
      >
        <div className="glass rounded-2xl h-14 px-5 flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="text-xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-400 to-indigo-400 hover:opacity-80 transition-opacity"
            aria-label="ROAM - Homepage"
          >
            ROAM
          </Link>

          {/* Nav items */}
          <div className="flex items-center gap-1">
            {user ? (
              <>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-amber-300 hover:bg-amber-500/10 hover:text-amber-200 transition-all duration-200"
                  >
                    <Shield className="w-4 h-4" />
                    <span className="hidden sm:inline">Admin</span>
                  </Link>
                )}
                <Link
                  href="/dashboard"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/8 hover:text-white transition-all duration-200"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
                <Link
                  href="/profile"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/8 hover:text-white transition-all duration-200"
                >
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">Profilo</span>
                </Link>
                <form action={signOut}>
                  <NavbarLogoutButton />
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-gray-300 hover:bg-white/8 hover:text-white transition-all duration-200"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Accedi</span>
                </Link>
                <Link
                  href="/register"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 transition-all duration-200 shadow-md shadow-fuchsia-500/20"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Registrati</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  )
}
