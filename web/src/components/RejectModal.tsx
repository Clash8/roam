'use client'

import { useRef, useState } from 'react'
import { XCircle, X } from 'lucide-react'
import { updateRequestStatusForm, updateEventRequestStatusForm } from '@/app/actions/auth'

interface Props {
  id: string
  isEvent: boolean
}

export default function RejectModal({ id, isEvent }: Props) {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const action = isEvent ? updateEventRequestStatusForm : updateRequestStatusForm

  function openModal() {
    setOpen(true)
    dialogRef.current?.showModal()
  }

  function closeModal() {
    setOpen(false)
    dialogRef.current?.close()
  }

  return (
    <>
      <button type="button" onClick={openModal} className="btn-danger">
        <XCircle className="w-3.5 h-3.5" />
        Rifiuta
      </button>

      <dialog
        ref={dialogRef}
        className="glass-strong rounded-3xl p-0 w-full max-w-md m-auto backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        onClose={() => setOpen(false)}
        onClick={(e) => { if (e.target === dialogRef.current) closeModal() }}
      >
        {open && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Motivo del rifiuto</h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-gray-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                aria-label="Chiudi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-gray-400">
              Scrivi un messaggio opzionale per spiegare all&apos;utente perché la richiesta è stata rifiutata.
            </p>

            <form action={action} onSubmit={() => closeModal()}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="status" value="rejected" />

              <textarea
                name="rejection_reason"
                rows={4}
                placeholder="es. Questo locale è già presente nel database…"
                className="input-glass w-full resize-none mb-4"
              />

              <div className="flex gap-3 justify-end">
                <button type="button" onClick={closeModal} className="btn-secondary">
                  Annulla
                </button>
                <button type="submit" className="btn-danger">
                  <XCircle className="w-3.5 h-3.5" />
                  Conferma rifiuto
                </button>
              </div>
            </form>
          </div>
        )}
      </dialog>
    </>
  )
}
