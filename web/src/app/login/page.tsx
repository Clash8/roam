'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signIn } from '@/app/actions/auth'
import { LogIn, Mail, Lock } from 'lucide-react'

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, null)

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="glass-strong rounded-3xl p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 mb-2">
              <LogIn className="w-5 h-5 text-fuchsia-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Bentornato</h1>
            <p className="text-gray-400 text-sm">Accedi al tuo account ROAM</p>
          </div>

          {/* Error */}
          {state?.error && (
            <div
              className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm"
              role="alert"
              aria-live="polite"
            >
              {state.error}
            </div>
          )}

          {/* Form */}
          <form action={action} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="tu@esempio.it"
                  className="input-glass input-glass-icon w-full"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="input-glass input-glass-icon w-full"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="btn-primary w-full mt-2"
              aria-busy={pending}
            >
              {pending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Accesso in corso…
                </span>
              ) : (
                'Accedi'
              )}
            </button>
          </form>

          {/* Divider */}
          <p className="text-center text-sm text-gray-500">
            Non hai un account?{' '}
            <Link
              href="/register"
              className="text-fuchsia-400 hover:text-fuchsia-300 font-medium transition-colors"
            >
              Registrati
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
