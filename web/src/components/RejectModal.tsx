'use client'

import { useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { XCircle, X } from 'lucide-react'
import { updateRequestStatusForm, updateEventRequestStatusForm } from '@/app/actions/auth'

interface Props {
  id: string
  isEvent: boolean
}

export default function RejectModal({ id, isEvent }: Props) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const action = isEvent ? updateEventRequestStatusForm : updateRequestStatusForm

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await action(formData)
      setOpen(false)
    })
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-danger">
        <XCircle className="w-3.5 h-3.5" />
        Rifiuta
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="glass-strong rounded-2xl p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-white">Motivo del rifiuto</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                aria-label="Chiudi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              Scrivi un messaggio opzionale per spiegare all&apos;utente perché la richiesta è stata rifiutata.
            </p>

            <form action={handleSubmit}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value="rejected" />

              <textarea
                name="rejection_reason"
                rows={4}
                placeholder="es. Questo locale è già presente nel database…"
                className="input-glass w-full resize-none mb-4"
              />

              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  aria-busy={isPending}
                  className="btn-danger"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  {isPending ? 'Invio…' : 'Conferma rifiuto'}
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
