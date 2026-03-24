import { supabase } from '@/lib/supabase'
import { Calendar, MapPin, Users, ExternalLink, Ticket, Zap } from 'lucide-react'

export const revalidate = 60

const CATEGORIES = ['Tutti', 'Electronic', 'Hip-Hop', 'Techno', 'House', 'Live', 'Club']

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>
}) {
  const { cat } = await searchParams

  let query = supabase
    .from('events')
    .select(`*, venues ( name, address ), organizers ( name )`)
    .order('date', { ascending: true })

  if (cat && cat !== 'Tutti') {
    query = query.contains('category', [cat])
  }

  const { data: events, error } = await query

  if (error) console.error('Error fetching events:', error)

  const todayStr = new Date().toISOString().slice(0, 10)
  const allEvents = events ?? []
  const upcoming = allEvents.filter(e => !e.date || e.date >= todayStr)
  const past = allEvents.filter(e => !!e.date && e.date < todayStr).reverse()
  const displayEvents = [...upcoming, ...past]

  return (
    <div className="max-w-6xl mx-auto px-4 pb-24">
      {/* Hero */}
      <section className="text-center pt-12 pb-14 space-y-5">
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white via-fuchsia-200 to-indigo-400 drop-shadow-2xl leading-none pb-2">
          ROAM
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-xl mx-auto leading-relaxed">
          Le migliori serate underground a Roma.
          <br className="hidden md:block" />
          Aggiornato automaticamente via AI.
        </p>
      </section>

      {/* Filter bar */}
      <div className="flex gap-2 flex-wrap justify-center mb-10">
        {CATEGORIES.map((c) => (
          <a
            key={c}
            href={c === 'Tutti' ? '/' : `/?cat=${encodeURIComponent(c)}`}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 cursor-pointer ${(c === 'Tutti' && !cat) || cat === c
                ? 'bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-300'
                : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-200 bg-white/3'
              }`}
          >
            {c}
          </a>
        ))}
      </div>

      {/* Events grid */}
      {displayEvents.length === 0 ? (
        <div className="text-center py-24 glass rounded-3xl max-w-lg mx-auto">
          <div className="text-5xl mb-4 font-black text-white/10">¯\_(ツ)_/¯</div>
          <h2 className="text-xl font-bold mb-2 text-white">Nessun evento trovato</h2>
          <p className="text-gray-500 text-sm">
            {cat
              ? `Nessun evento nella categoria "${cat}". Prova con un'altra.`
              : 'Il database è vuoto. Esegui lo scraper Python per popolarlo.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {displayEvents.map((event) => {
            const isPast = !!event.date && event.date < todayStr
            return (
            <article
              key={event.id}
              className={`group relative rounded-3xl flex flex-col overflow-hidden glass-card hover:-translate-y-1.5 hover:border-white/15 hover:shadow-fuchsia-500/10 hover:shadow-2xl transition-all duration-300 ease-out${isPast ? ' opacity-50 grayscale' : ''}`}
            >
              {/* Image */}
              <div className="relative h-52 w-full overflow-hidden bg-gray-950 flex-shrink-0">
                {event.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={event.image_url}
                    alt={event.title}
                    loading="lazy"
                    width={600}
                    height={208}
                    className="object-cover w-full h-full opacity-70 group-hover:scale-105 group-hover:opacity-90 transition-all duration-700"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-950 to-indigo-950" />
                )}
                {/* Category badges */}
                <div className="absolute top-3 left-3 flex gap-1.5 flex-wrap z-10">
                  {event.category?.slice(0, 2).map((cat: string, i: number) => (
                    <span
                      key={i}
                      className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white uppercase tracking-wider"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
                {/* Status badges */}
                <div className="absolute top-3 right-3 flex gap-1.5 flex-col items-end z-10">
                  {isPast && (
                    <span className="px-2.5 py-0.5 text-xs font-bold text-white rounded-full bg-black/70 backdrop-blur-md uppercase tracking-wide border border-white/20">
                      Concluso
                    </span>
                  )}
                  {event.is_sold_out && (
                    <span className="px-2.5 py-0.5 text-xs font-bold text-white rounded-full bg-red-600/80 backdrop-blur-md uppercase tracking-wide">
                      Sold Out
                    </span>
                  )}
                  {event.guestlist_only && (
                    <span className="px-2.5 py-0.5 text-xs font-bold text-white rounded-full bg-emerald-600/80 backdrop-blur-md uppercase tracking-wide">
                      Guestlist
                    </span>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-5 flex flex-col flex-grow">
                <h2 className="text-lg font-bold mb-3 line-clamp-2 text-white leading-snug">
                  {event.title}
                </h2>

                <div className="space-y-2 text-sm text-gray-400 mb-4">
                  <div className="flex items-center gap-2.5">
                    <Calendar className="w-3.5 h-3.5 text-fuchsia-400 flex-shrink-0" />
                    <span className="text-gray-200">
                      {event.date
                        ? new Date(event.date + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })
                        : 'TBD'}
                    </span>
                    {event.time && <span className="text-gray-500">· {event.time}</span>}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                    <span className="text-gray-200 line-clamp-1">
                      {event.venues?.name || event.location_name || 'Location segreta'}
                    </span>
                  </div>
                  {event.organizers?.name && (
                    <div className="flex items-center gap-2.5">
                      <Users className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                      <span className="text-gray-200">by {event.organizers.name}</span>
                    </div>
                  )}
                </div>

                {event.price && (
                  <span className="self-start px-3 py-1 mb-3 bg-white/5 rounded-lg text-fuchsia-300 text-sm font-bold border border-white/5">
                    {event.price}
                  </span>
                )}

                <p className="text-gray-500 text-sm line-clamp-2 flex-grow leading-relaxed mb-4">
                  {event.description || event.raw_text}
                </p>

                <div className="flex gap-2 mt-auto pt-3 border-t border-white/8">
                  {event.source_link && (
                    <a
                      href={event.source_link}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 flex justify-center items-center gap-1.5 px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm font-medium transition-colors text-gray-300 hover:text-white cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      IG Post
                    </a>
                  )}
                  {event.ticket_link && (
                    <a
                      href={event.ticket_link}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 flex justify-center items-center gap-1.5 px-3 py-2.5 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 rounded-xl text-sm font-bold shadow-lg shadow-fuchsia-500/20 transition-all text-white cursor-pointer"
                    >
                      <Ticket className="w-3.5 h-3.5" />
                      Tickets
                    </a>
                  )}
                </div>
              </div>
            </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
