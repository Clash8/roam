'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { submitRequest } from '@/app/actions/auth'
import { ArrowLeft, Building2, Users, CalendarDays, Send, Star } from 'lucide-react'
import { InstagramIcon } from '@/components/InstagramIcon'

const TYPES = [
  { value: 'venue', label: 'Locale', icon: Building2, desc: 'Club, bar, venue', points: 2 },
  { value: 'organizer', label: 'Organizzatore', icon: Users, desc: 'Crew, promoter', points: 2 },
  { value: 'event', label: 'Evento', icon: CalendarDays, desc: 'Segnala un evento', points: 5 },
]

export default function RequestPage() {
  const [state, action, pending] = useActionState(submitRequest, null)
  const [selectedType, setSelectedType] = useState('venue')
  const [formKey, setFormKey] = useState(0)
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    if (state?.success) setShowSuccess(true)
  }, [state])

  if (state?.success && showSuccess) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="glass-strong rounded-3xl p-10 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <Send className="w-7 h-7 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Richiesta inviata!</h1>
          <p className="text-gray-400 text-sm">
            La tua segnalazione è stata ricevuta e sarà esaminata dal team di ROAM.
          </p>
          <div className="flex gap-3 justify-center pt-2">
            <button
              onClick={() => { setShowSuccess(false); setFormKey(k => k + 1) }}
              className="btn-secondary text-sm px-4 py-2"
            >
              Altra richiesta
            </button>
            <Link href="/dashboard" className="btn-primary text-sm px-4 py-2">
              Le mie richieste
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const isEvent = selectedType === 'event'

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Dashboard
      </Link>

      <div className="glass-strong rounded-3xl p-8 space-y-6">
        <div>
          <p className="section-label mb-1">Area utente</p>
          <h1 className="text-2xl font-bold text-white">Nuova richiesta</h1>
          <p className="text-gray-400 text-sm mt-1">
            Segnala un locale, un organizzatore o un evento da aggiungere a ROAM.
          </p>
        </div>

        {state?.error && (
          <div
            className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm"
            role="alert"
            aria-live="polite"
          >
            {state.error}
          </div>
        )}

        <form key={formKey} action={action} className="space-y-5">
          {/* Type selector */}
          <fieldset>
            <legend className="block text-sm font-medium text-gray-300 mb-2">
              Tipo <span className="text-red-400">*</span>
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TYPES.map(({ value, label, icon: Icon, desc, points }) => (
                <label
                  key={value}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-2xl border border-white/10 bg-white/3 cursor-pointer hover:bg-white/6 hover:border-white/20 transition-all duration-200 has-[:checked]:border-fuchsia-500/50 has-[:checked]:bg-fuchsia-500/5"
                  onClick={() => setSelectedType(value)}
                >
                  <input
                    type="radio"
                    name="item_type"
                    value={value}
                    defaultChecked={value === 'venue'}
                    className="sr-only"
                  />
                  <Icon className="w-5 h-5 text-fuchsia-400" />
                  <span className="font-medium text-white text-xs text-center">{label}</span>
                  <span className="text-[10px] text-gray-500 text-center leading-tight">{desc}</span>
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-400">
                    <Star className="w-2.5 h-2.5 fill-amber-400" />
                    +{points} pts
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Title / Name */}
          <div className="space-y-1.5">
            <label htmlFor="name" className="block text-sm font-medium text-gray-300">
              {isEvent ? 'Titolo evento' : 'Nome'} <span className="text-red-400">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              placeholder={isEvent ? 'es. Underground Techno Night' : selectedType === 'organizer' ? 'es. Mania' : 'es. Goa Club'}
              className="input-glass w-full"
            />
          </div>

          {/* Event-specific fields */}
          {isEvent && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="date" className="block text-sm font-medium text-gray-300">Data</label>
                  <input
                    id="date"
                    name="date"
                    type="date"
                    className="input-glass w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="ticket_link" className="block text-sm font-medium text-gray-300">Link biglietti</label>
                  <input
                    id="ticket_link"
                    name="ticket_link"
                    type="url"
                    placeholder="https://…"
                    className="input-glass w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="venue_name" className="block text-sm font-medium text-gray-300">Venue / Locale</label>
                  <input
                    id="venue_name"
                    name="venue_name"
                    type="text"
                    placeholder="es. Goa Club"
                    className="input-glass w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="organizer_name" className="block text-sm font-medium text-gray-300">Organizzatore</label>
                  <input
                    id="organizer_name"
                    name="organizer_name"
                    type="text"
                    placeholder="es. Croccant3"
                    className="input-glass w-full"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="description" className="block text-sm font-medium text-gray-300">Descrizione</label>
                <textarea
                  id="description"
                  name="description"
                  rows={2}
                  placeholder="Dettagli sull'evento…"
                  className="input-glass w-full resize-none"
                />
              </div>
            </>
          )}

          {/* Instagram URL */}
          <div className="space-y-1.5">
            <label htmlFor="instagram_url" className="block text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <InstagramIcon className="w-3.5 h-3.5" />
              {isEvent ? 'Pagina Instagram evento' : 'Profilo Instagram'}
            </label>
            <div className="flex items-center input-glass rounded-xl overflow-hidden">
              <span className="pl-3.5 pr-1 text-gray-500 text-sm whitespace-nowrap select-none">instagram.com/</span>
              <input
                id="instagram_url"
                name="instagram_url"
                type="text"
                placeholder="nomeprofilo"
                className="flex-1 bg-transparent outline-none py-2.5 pr-3.5 text-sm text-white placeholder-gray-600"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-300">
              Note aggiuntive
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              placeholder="Altre informazioni utili…"
              className="input-glass w-full resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="btn-primary w-full"
            aria-busy={pending}
          >
            {pending ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Invio in corso…
              </span>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Invia richiesta
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
