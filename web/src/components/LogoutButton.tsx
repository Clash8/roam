'use client'

import { useFormStatus } from 'react-dom'
import { Loader2 } from 'lucide-react'

function SpinnerButton({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={className}
    >
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : label}
    </button>
  )
}

export function NavbarLogoutButton() {
  return (
    <SpinnerButton
      label="Esci"
      className="px-4 py-2 rounded-xl text-sm font-medium text-gray-400 hover:bg-white/8 hover:text-white transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    />
  )
}

export function ProfileLogoutButton() {
  return (
    <SpinnerButton
      label="Disconnetti"
      className="btn-danger w-full py-3 rounded-2xl text-base disabled:opacity-50 disabled:cursor-not-allowed"
    />
  )
}
