'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, MapPin, Users, Trash2, Plus, Pencil, X, Loader2 } from 'lucide-react'
import { createEvent, updateEvent, deleteEvent, EventFormData } from './actions'

type Venue = { id: string; name: string }
type Organizer = { id: string; name: string }
type Event = {
  id: string
  title: string
  date: string | null
  time: string | null
  end_time: string | null
  description: string | null
  venue_id: string | null
  organizer_id: string | null
  location_name: string | null
  category: string[] | null
  price: string | null
  ticket_link: string | null
  image_url: string | null
  dresscode: string | null
  min_age: number | null
  guestlist_only: boolean | null
  is_sold_out: boolean | null
  venues: { name: string } | null
  organizers: { name: string } | null
}

const EMPTY_FORM: EventFormData = {
  title: '',
  date: '',
  time: '',
  end_time: '',
  description: '',
  venue_id: '',
  organizer_id: '',
  location_name: '',
  category: '',
  price: '',
  ticket_link: '',
  image_url: '',
  dresscode: '',
  min_age: '',
  guestlist_only: false,
  is_sold_out: false,
}

function eventToForm(e: Event): EventFormData {
  return {
    title: e.title,
    date: e.date ?? '',
    time: e.time ?? '',
    end_time: e.end_time ?? '',
    description: e.description ?? '',
    venue_id: e.venue_id ?? '',
    organizer_id: e.organizer_id ?? '',
    location_name: e.location_name ?? '',
    category: e.category?.join(', ') ?? '',
    price: e.price ?? '',
    ticket_link: e.ticket_link ?? '',
    image_url: e.image_url ?? '',
    dresscode: e.dresscode ?? '',
    min_age: e.min_age != null ? String(e.min_age) : '',
    guestlist_only: e.guestlist_only ?? false,
    is_sold_out: e.is_sold_out ?? false,
  }
}

interface Props {
  events: Event[]
  venues: Venue[]
  organizers: Organizer[]
}

export default function EventsClient({ events, venues, organizers }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<Event | null>(null)
  const [form, setForm] = useState<EventFormData>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function openCreate() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setEditTarget(null)
    setModal('create')
  }

  function openEdit(event: Event) {
    setForm(eventToForm(event))
    setFormError(null)
    setEditTarget(event)
    setModal('edit')
  }

  function closeModal() {
    setModal(null)
    setEditTarget(null)
    setFormError(null)
  }

  function handleField(key: keyof EventFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      setFormError('Il titolo è obbligatorio.')
      return
    }
    setFormError(null)
    startTransition(async () => {
      const result =
        modal === 'edit' && editTarget
          ? await updateEvent(editTarget.id, form)
          : await createEvent(form)
      if (result.error) {
        setFormError(result.error)
      } else {
        closeModal()
        router.refresh()
      }
    })
  }

  function handleDelete(id: string) {
    setDeletingId(id)
    startTransition(async () => {
      await deleteEvent(id)
      setDeletingId(null)
      router.refresh()
    })
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label mb-1">Admin</p>
          <h1 className="page-title">Eventi</h1>
          <p className="text-sm text-gray-500 mt-1">
            Visualizza, crea e gestisci gli eventi.
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm px-4 py-2">
          <Plus className="w-4 h-4" />
          Aggiungi
        </button>
      </div>

      {/* List */}
      {events.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <CalendarDays className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 mb-4">Nessun evento. Creane uno o esegui lo scraper.</p>
          <button onClick={openCreate} className="btn-primary text-sm px-4 py-2">
            <Plus className="w-4 h-4" />
            Aggiungi evento
          </button>
        </div>
      ) : (
        <div className="space-y-3 mt-6">
          {events.map((event) => (
            <div
              key={event.id}
              className="glass-card rounded-2xl p-4 flex items-center gap-4 hover:border-white/12 transition-colors"
            >
              {/* Image */}
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-900 flex-shrink-0">
                {event.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={event.image_url}
                    alt=""
                    width={56}
                    height={56}
                    className="object-cover w-full h-full opacity-80"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-fuchsia-950 to-indigo-950" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white truncate">{event.title}</p>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                  {event.date && (
                    <span className="flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" />
                      {event.date}
                    </span>
                  )}
                  {event.venues?.name && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {event.venues.name}
                    </span>
                  )}
                  {event.organizers?.name && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {event.organizers.name}
                    </span>
                  )}
                </div>
              </div>

              {/* Category */}
              {event.category?.[0] && (
                <span className="hidden sm:block px-2.5 py-1 text-xs font-medium rounded-lg bg-white/5 text-gray-400 border border-white/8 flex-shrink-0">
                  {event.category[0]}
                </span>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => openEdit(event)}
                  className="p-1.5 rounded-lg hover:bg-white/8 text-gray-600 hover:text-gray-200 transition-all duration-200"
                  aria-label={`Modifica evento ${event.title}`}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(event.id)}
                  disabled={deletingId === event.id}
                  className="p-1.5 rounded-lg hover:bg-red-500/15 text-gray-600 hover:text-red-400 transition-all duration-200 disabled:opacity-40"
                  aria-label={`Elimina evento ${event.title}`}
                >
                  {deletingId === event.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="glass-strong rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/8">
              <h2 className="text-lg font-bold text-white">
                {modal === 'create' ? 'Nuovo evento' : 'Modifica evento'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-white/8 text-gray-500 hover:text-white transition-colors"
                aria-label="Chiudi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal body */}
            <form id="event-form" onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-4 py-4 sm:px-6 sm:py-5 space-y-4">
              {/* Title */}
              <div>
                <label htmlFor="ev-title" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Titolo *
                </label>
                <input
                  id="ev-title"
                  type="text"
                  className="input-glass w-full"
                  value={form.title}
                  onChange={(e) => handleField('title', e.target.value)}
                  placeholder="Nome dell'evento"
                  required
                />
              </div>

              {/* Date / Time / End time */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="ev-date" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Data
                  </label>
                  <input
                    id="ev-date"
                    type="date"
                    className="input-glass w-full"
                    value={form.date}
                    onChange={(e) => handleField('date', e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="ev-time" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Ora inizio
                  </label>
                  <input
                    id="ev-time"
                    type="text"
                    className="input-glass w-full"
                    value={form.time}
                    onChange={(e) => handleField('time', e.target.value)}
                    placeholder="22:00"
                  />
                </div>
                <div>
                  <label htmlFor="ev-end-time" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Ora fine
                  </label>
                  <input
                    id="ev-end-time"
                    type="text"
                    className="input-glass w-full"
                    value={form.end_time}
                    onChange={(e) => handleField('end_time', e.target.value)}
                    placeholder="04:00"
                  />
                </div>
              </div>

              {/* Venue / Organizer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ev-venue" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Locale
                  </label>
                  <select
                    id="ev-venue"
                    className="input-glass w-full"
                    value={form.venue_id}
                    onChange={(e) => handleField('venue_id', e.target.value)}
                  >
                    <option value="">— nessuno —</option>
                    {venues.map((v) => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="ev-organizer" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Organizzatore
                  </label>
                  <select
                    id="ev-organizer"
                    className="input-glass w-full"
                    value={form.organizer_id}
                    onChange={(e) => handleField('organizer_id', e.target.value)}
                  >
                    <option value="">— nessuno —</option>
                    {organizers.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Location name */}
              <div>
                <label htmlFor="ev-location" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Nome location (testo libero)
                </label>
                <input
                  id="ev-location"
                  type="text"
                  className="input-glass w-full"
                  value={form.location_name}
                  onChange={(e) => handleField('location_name', e.target.value)}
                  placeholder="es. Piper Club, Roma"
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="ev-desc" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                  Descrizione
                </label>
                <textarea
                  id="ev-desc"
                  rows={3}
                  className="input-glass w-full resize-none"
                  value={form.description}
                  onChange={(e) => handleField('description', e.target.value)}
                  placeholder="Descrizione dell'evento…"
                />
              </div>

              {/* Category / Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ev-category" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Categorie (virgola)
                  </label>
                  <input
                    id="ev-category"
                    type="text"
                    className="input-glass w-full"
                    value={form.category}
                    onChange={(e) => handleField('category', e.target.value)}
                    placeholder="Musica, Clubbing"
                  />
                </div>
                <div>
                  <label htmlFor="ev-price" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Prezzo
                  </label>
                  <input
                    id="ev-price"
                    type="text"
                    className="input-glass w-full"
                    value={form.price}
                    onChange={(e) => handleField('price', e.target.value)}
                    placeholder="€10 / gratuito"
                  />
                </div>
              </div>

              {/* Ticket link / Image URL */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ev-ticket" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Link biglietti
                  </label>
                  <input
                    id="ev-ticket"
                    type="url"
                    className="input-glass w-full"
                    value={form.ticket_link}
                    onChange={(e) => handleField('ticket_link', e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div>
                  <label htmlFor="ev-image" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    URL immagine
                  </label>
                  <input
                    id="ev-image"
                    type="url"
                    className="input-glass w-full"
                    value={form.image_url}
                    onChange={(e) => handleField('image_url', e.target.value)}
                    placeholder="https://…"
                  />
                </div>
              </div>

              {/* Dresscode / Min age */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ev-dresscode" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Dress code
                  </label>
                  <input
                    id="ev-dresscode"
                    type="text"
                    className="input-glass w-full"
                    value={form.dresscode}
                    onChange={(e) => handleField('dresscode', e.target.value)}
                    placeholder="Smart casual"
                  />
                </div>
                <div>
                  <label htmlFor="ev-minage" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Età minima
                  </label>
                  <input
                    id="ev-minage"
                    type="number"
                    min={0}
                    max={99}
                    className="input-glass w-full"
                    value={form.min_age}
                    onChange={(e) => handleField('min_age', e.target.value)}
                    placeholder="18"
                  />
                </div>
              </div>

              {/* Checkboxes */}
              <div className="flex items-center gap-6 pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-fuchsia-500 rounded"
                    checked={form.guestlist_only}
                    onChange={(e) => handleField('guestlist_only', e.target.checked)}
                  />
                  <span className="text-sm text-gray-300">Solo guestlist</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-fuchsia-500 rounded"
                    checked={form.is_sold_out}
                    onChange={(e) => handleField('is_sold_out', e.target.checked)}
                  />
                  <span className="text-sm text-gray-300">Sold out</span>
                </label>
              </div>

              {/* Error */}
              {formError && (
                <p className="text-sm text-red-400" role="alert" aria-live="polite">
                  {formError}
                </p>
              )}
            </form>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/8">
              <button type="button" onClick={closeModal} className="btn-secondary text-sm px-4 py-2">
                Annulla
              </button>
              <button
                type="submit"
                form="event-form"
                disabled={isPending}
                aria-busy={isPending}
                className="btn-primary text-sm px-5 py-2"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {modal === 'create' ? 'Crea evento' : 'Salva modifiche'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
