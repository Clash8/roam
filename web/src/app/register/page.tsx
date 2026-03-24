'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signUp } from '@/app/actions/auth'
import { UserPlus, Mail, Lock, User, MailCheck } from 'lucide-react'

export default function RegisterPage() {
  const [state, action, pending] = useActionState(signUp, null)

  return (
    <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {state?.success ? (
          <div className="glass-strong rounded-3xl p-8 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 mb-2">
              <MailCheck className="w-7 h-7 text-fuchsia-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Controlla la tua email</h1>
            <p className="text-gray-400 text-sm leading-relaxed">
              Ti abbiamo inviato un link di conferma.<br />
              Apri la tua casella e clicca sul link per attivare l&apos;account.
            </p>
            <p className="text-xs text-gray-600 pt-2">
              Non trovi l&apos;email? Controlla anche nella cartella spam.
            </p>
          </div>
        ) : (
        <div className="glass-strong rounded-3xl p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-2">
              <UserPlus className="w-5 h-5 text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Crea il tuo account</h1>
            <p className="text-gray-400 text-sm">Unisciti alla community ROAM</p>
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
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-300">
                Nome completo
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="Mario Rossi"
                  className="input-glass input-glass-icon w-full"
                />
              </div>
            </div>

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
                Password <span className="text-red-400" aria-label="campo obbligatorio">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  placeholder="Minimo 8 caratteri"
                  className="input-glass input-glass-icon w-full"
                />
              </div>
              <p className="text-xs text-gray-500">Minimo 8 caratteri</p>
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
                  Registrazione…
                </span>
              ) : (
                'Crea account'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500">
            Hai già un account?{' '}
            <Link
              href="/login"
              className="text-fuchsia-400 hover:text-fuchsia-300 font-medium transition-colors"
            >
              Accedi
            </Link>
          </p>
        </div>
        )}
      </div>
    </div>
  )
}
