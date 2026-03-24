'use client'

import { useActionState } from 'react'
import { changePassword } from '@/app/actions/auth'
import { KeyRound } from 'lucide-react'

export default function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null)

  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-gray-400" />
        <h2 className="font-semibold text-white">Cambia password</h2>
      </div>

      {state?.success && (
        <p role="alert" aria-live="polite" className="text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
          Password aggiornata con successo.
        </p>
      )}
      {state?.error && (
        <p role="alert" aria-live="polite" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          {state.error}
        </p>
      )}

      <form action={action} className="space-y-4">
        <div>
          <label htmlFor="current_password" className="block text-sm text-gray-400 mb-1">Password attuale</label>
          <input
            id="current_password"
            name="current_password"
            type="password"
            required
            autoComplete="current-password"
            className="input-glass w-full"
          />
        </div>
        <div>
          <label htmlFor="new_password" className="block text-sm text-gray-400 mb-1">Nuova password</label>
          <input
            id="new_password"
            name="new_password"
            type="password"
            required
            autoComplete="new-password"
            className="input-glass w-full"
          />
        </div>
        <div>
          <label htmlFor="confirm_password" className="block text-sm text-gray-400 mb-1">Conferma nuova password</label>
          <input
            id="confirm_password"
            name="confirm_password"
            type="password"
            required
            autoComplete="new-password"
            className="input-glass w-full"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="btn-primary w-full py-2.5 rounded-xl"
        >
          {pending ? 'Salvataggio…' : 'Aggiorna password'}
        </button>
      </form>
    </div>
  )
}
