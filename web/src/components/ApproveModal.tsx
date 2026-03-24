'use client'

import { useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle, X, Building2, Users } from 'lucide-react'
import { approveAndInsertVenueOrOrganizer, approveAndInsertEvent } from '@/app/actions/auth'
import { useRouter } from 'next/navigation'

interface RequestData {
  id: string
  _table: 'requests' | 'event_requests'
  item_type?: string
  name?: string
  title?: string
  date?: string
  venue_name?: string
  organizer_name?: string
  description?: string
  instagram_username?: string
  ticket_link?: string
}

interface VenueOption { id: string; name: string }
interface OrganizerOption { id: string; name: string }

interface Props {
  request: RequestData
  pts: number
  venues?: VenueOption[]
  organizers?: OrganizerOption[]
}

export default function ApproveModal({ request, pts, venues = [], organizers = [] }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const isEvent = request._table === 'event_requests'
  const defaultType = request.item_type === 'organizer' ? 'organizer' : 'venue'
  const [itemType, setItemType] = useState<'venue' | 'organizer'>(defaultType as 'venue' | 'organizer')

  function handleOpen() {
    setOpen(true)
    setError('')
    setItemType(defaultType as 'venue' | 'organizer')
  }

  function handleSubmit(formData: FormData) {
    setError('')
    startTransition(async () => {
      try {
        const result = isEvent
          ? await approveAndInsertEvent(formData)
          : await approveAndInsertVenueOrOrganizer(formData)
        if (result?.error) {
          setError(result.error)
        } else {
          setOpen(false)
          router.refresh()
        }
      } catch {
        setError('Errore durante il salvataggio')
      }
    })
  }

  return (
    <>
      <button type="button" onClick={handleOpen} className="btn-success">
        <CheckCircle className="w-3.5 h-3.5" />
        Approva (+{pts} pts)
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="glass-strong rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">
                {isEvent ? 'Inserisci evento' : 'Approva richiesta'}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                aria-label="Chiudi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <p role="alert" aria-live="polite" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">
                {error}
              </p>
            )}

            <form action={handleSubmit} className="space-y-5">
              <input type="hidden" name="request_id" value={request.id} />
              <input type="hidden" name="request_table" value={request._table} />

              {isEvent ? (
                <EventFields
                  request={request}
                  venues={venues}
                  organizers={organizers}
                />
              ) : (
                <>
                  {/* Type switcher */}
                  <div>
                    <p className="text-sm font-medium text-gray-300 mb-2">Tipo</p>
                    <div className="grid grid-cols-2 gap-3">
                      <TypeCard
                        active={itemType === 'venue'}
                        icon={<Building2 className="w-6 h-6" />}
                        label="Locale"
                        description="Club, bar, venue"
                        onClick={() => setItemType('venue')}
                      />
                      <TypeCard
                        active={itemType === 'organizer'}
                        icon={<Users className="w-6 h-6" />}
                        label="Organizzatore"
                        description="Crew, promoter"
                        onClick={() => setItemType('organizer')}
                      />
                    </div>
                  </div>

                  <input type="hidden" name="item_type" value={itemType} />

                  {/* Shared fields */}
                  <Field label="Nome" name="name" defaultValue={request.name} required />
                  <Field label="Instagram username" name="instagram_username" defaultValue={request.instagram_username} />
                  <Field label="Sito web" name="website_url" type="url" />

                  {/* Venue-only field */}
                  {itemType === 'venue' && (
                    <Field label="Indirizzo" name="address" />
                  )}
                </>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  aria-busy={isPending}
                  className="btn-success"
                >
                  {isPending ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                  {isPending ? 'Salvataggio…' : 'Approva e inserisci'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

/* ─── Type switcher card ─── */

function TypeCard({
  active,
  icon,
  label,
  description,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-xl p-4 border-2 transition-all duration-200 cursor-pointer ${
        active
          ? 'border-fuchsia-500/60 bg-fuchsia-500/10 text-fuchsia-400'
          : 'border-white/10 bg-white/3 text-gray-500 hover:border-white/20 hover:bg-white/5'
      }`}
    >
      {icon}
      <span className={`text-sm font-semibold ${active ? 'text-white' : 'text-gray-300'}`}>{label}</span>
      <span className="text-xs text-gray-500">{description}</span>
    </button>
  )
}

/* ─── Event fields ─── */

function EventFields({
  request,
  venues,
  organizers,
}: {
  request: RequestData
  venues: VenueOption[]
  organizers: OrganizerOption[]
}) {
  return (
    <>
      <Field label="Titolo" name="title" defaultValue={request.title} required />
      <Field label="Data" name="date" type="date" defaultValue={request.date} />
      <Field label="Ora inizio" name="time" type="time" />
      <Field label="Ora fine" name="end_time" type="time" />

      <div>
        <label htmlFor="approve-venue_id" className="block text-sm font-medium text-gray-300 mb-1">
          Locale
        </label>
        <select id="approve-venue_id" name="venue_id" className="input-glass w-full" defaultValue="">
          <option value="">— Nessuno —</option>
          {venues.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
        {request.venue_name && (
          <p className="text-xs text-gray-500 mt-1">Richiesto: {request.venue_name}</p>
        )}
      </div>

      <div>
        <label htmlFor="approve-organizer_id" className="block text-sm font-medium text-gray-300 mb-1">
          Organizzatore
        </label>
        <select id="approve-organizer_id" name="organizer_id" className="input-glass w-full" defaultValue="">
          <option value="">— Nessuno —</option>
          {organizers.map(o => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
        {request.organizer_name && (
          <p className="text-xs text-gray-500 mt-1">Richiesto: {request.organizer_name}</p>
        )}
      </div>

      <Field label="Location (nome)" name="location_name" defaultValue={request.venue_name} />
      <Field label="Descrizione" name="description" defaultValue={request.description} textarea />
      <Field label="Prezzo" name="price" placeholder="es. Gratis, €15, €10-20" />
      <Field label="Link biglietti" name="ticket_link" type="url" defaultValue={request.ticket_link} />
      <Field label="Instagram username" name="instagram_username" defaultValue={request.instagram_username} />
      <Field label="Dresscode" name="dresscode" />
      <Field label="Età minima" name="min_age" type="number" />
    </>
  )
}

/* ─── Reusable field ─── */

function Field({
  label,
  name,
  defaultValue,
  type = 'text',
  required,
  placeholder,
  textarea,
}: {
  label: string
  name: string
  defaultValue?: string | null
  type?: string
  required?: boolean
  placeholder?: string
  textarea?: boolean
}) {
  const id = `approve-${name}`
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">
        {label}
      </label>
      {textarea ? (
        <textarea
          id={id}
          name={name}
          defaultValue={defaultValue ?? ''}
          rows={3}
          placeholder={placeholder}
          className="input-glass w-full resize-none"
        />
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          defaultValue={defaultValue ?? ''}
          required={required}
          placeholder={placeholder}
          className="input-glass w-full"
        />
      )}
    </div>
  )
}
