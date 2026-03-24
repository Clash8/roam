'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteOrganizer, insertOrganizer, updateOrganizer } from '@/app/actions/auth'
import { Users, Globe, Trash2, Plus, Pencil, X } from 'lucide-react'
import { InstagramIcon } from '@/components/InstagramIcon'

type Organizer = {
  id: string
  name: string
  website_url: string | null
  instagram_username: string | null
}

type DialogTarget = null | 'add' | Organizer

export function OrganizerManager({ organizers }: { organizers: Organizer[] }) {
  const router = useRouter()
  const [dialog, setDialog] = useState<DialogTarget>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeletingId(id)
    await deleteOrganizer(id)
    setDeletingId(null)
    router.refresh()
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label mb-1">Admin</p>
          <h1 className="page-title">Organizzatori</h1>
        </div>
        <button
          className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
          onClick={() => setDialog('add')}
        >
          <Plus className="w-4 h-4" />
          Aggiungi
        </button>
      </div>

      {organizers.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <Users className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nessun organizzatore nel database.</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl overflow-x-auto">
          <table className="w-full text-sm min-w-[320px]" role="table">
            <thead>
              <tr className="border-b border-white/8">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider">Nome</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Link</th>
                <th className="px-5 py-3.5 w-24"><span className="sr-only">Azioni</span></th>
              </tr>
            </thead>
            <tbody>
              {organizers.map((org, i) => (
                <tr
                  key={org.id}
                  className={`border-b border-white/5 hover:bg-white/3 transition-colors ${i === organizers.length - 1 ? 'border-0' : ''}`}
                >
                  <td className="px-5 py-4 font-medium text-white">{org.name}</td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      {org.website_url && (
                        <a
                          href={org.website_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg hover:bg-white/8 text-gray-500 hover:text-gray-200 transition-all"
                          aria-label={`Sito web di ${org.name}`}
                        >
                          <Globe className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {org.instagram_username && (
                        <a
                          href={`https://instagram.com/${org.instagram_username}`}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg hover:bg-white/8 text-gray-500 hover:text-indigo-300 transition-all"
                          aria-label={`Instagram di ${org.name}`}
                        >
                          <InstagramIcon className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {!org.website_url && !org.instagram_username && (
                        <span className="text-gray-600">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        onClick={() => setDialog(org)}
                        className="p-1.5 rounded-lg hover:bg-white/8 text-gray-600 hover:text-gray-200 transition-all duration-200"
                        aria-label={`Modifica ${org.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(org.id)}
                        disabled={deletingId === org.id}
                        className="p-1.5 rounded-lg hover:bg-red-500/15 text-gray-600 hover:text-red-400 transition-all duration-200 disabled:opacity-50"
                        aria-label={`Elimina ${org.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog !== null && (
        <OrganizerDialog
          target={dialog}
          onClose={() => setDialog(null)}
          onSuccess={() => { setDialog(null); router.refresh() }}
        />
      )}
    </>
  )
}

function OrganizerDialog({
  target,
  onClose,
  onSuccess,
}: {
  target: DialogTarget
  onClose: () => void
  onSuccess: () => void
}) {
  const isAdd = target === 'add'
  const org = isAdd ? null : (target as Organizer)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()

  const igHandle = org?.instagram_username ?? ''

  function handleSubmit(formData: FormData) {
    setError('')
    startTransition(async () => {
      const action = isAdd ? insertOrganizer : updateOrganizer
      const result = await action(null, formData)
      if (result?.error) {
        setError(result.error)
      } else {
        onSuccess()
      }
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-2xl p-6 w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-white">
            {isAdd ? 'Nuovo organizzatore' : 'Modifica organizzatore'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            aria-label="Chiudi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form action={handleSubmit} className="space-y-4">
          {!isAdd && <input type="hidden" name="id" value={org!.id} />}

          <div>
            <label htmlFor="org-name" className="block text-sm font-medium text-gray-300 mb-1.5">
              Nome *
            </label>
            <input
              id="org-name"
              name="name"
              type="text"
              required
              defaultValue={org?.name ?? ''}
              className="input-glass w-full"
              placeholder="Nome organizzatore"
            />
          </div>

          <div>
            <label htmlFor="org-instagram" className="block text-sm font-medium text-gray-300 mb-1.5">
              Handle Instagram
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm select-none">@</span>
              <input
                id="org-instagram"
                name="instagram_handle"
                type="text"
                defaultValue={igHandle}
                className="input-glass w-full pl-7"
                placeholder="handle"
              />
            </div>
          </div>

          <div>
            <label htmlFor="org-website" className="block text-sm font-medium text-gray-300 mb-1.5">
              Sito web
            </label>
            <input
              id="org-website"
              name="website_url"
              type="url"
              defaultValue={org?.website_url ?? ''}
              className="input-glass w-full"
              placeholder="https://..."
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm" role="alert" aria-live="polite">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 py-2.5">
              Annulla
            </button>
            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className="btn-primary flex-1 py-2.5"
            >
              {isPending ? 'Salvataggio…' : isAdd ? 'Aggiungi' : 'Salva'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
