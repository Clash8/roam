import { supabase } from '@/lib/supabase'
import { Calendar, MapPin, Clock, ExternalLink, Ticket, Users } from 'lucide-react'

// Allow Next.js to regenerate the page every 60 seconds (ISR)
export const revalidate = 60 

export default async function Home() {
  const { data: events, error } = await supabase
    .from('events')
    .select(`
      *,
      venues ( name, address ),
      organizers ( name )
    `)
    .order('date', { ascending: true })

  if (error) {
    console.error('Error fetching events:', error)
  }

  // Fallback data if DB is empty or error
  const displayEvents = events && events.length > 0 ? events : []

  return (
    <main className="min-h-screen pb-20 selection:bg-fuchsia-500/30">
      <div className="max-w-4xl mx-auto px-4 pt-16">
        <header className="mb-16 text-center space-y-4">
          <div className="inline-block p-1 px-5 rounded-full glass mb-4">
            <span className="text-xs font-bold text-fuchsia-400 uppercase tracking-[0.2em]">
              Aggregatore Eventi Roma
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-500 via-purple-500 to-indigo-500 drop-shadow-lg">
            TRACKER MVP
          </h1>
          <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mt-4">
            I migliori party e le serate underground a Roma. 
            <br className="hidden md:block"/>Costantemente aggiornato tramite AI.
          </p>
        </header>

        {displayEvents.length === 0 ? (
          <div className="text-center py-20 glass rounded-3xl mx-auto max-w-lg">
            <h2 className="text-2xl font-bold mb-2 text-white">Nessun evento!</h2>
            <p className="text-gray-400">Il database è vuoto. Esegui lo scraper Python per popolarlo con nuovi eventi da Instagram.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {displayEvents.map((event) => (
              <div 
                key={event.id}
                className="group relative rounded-3xl flex flex-col overflow-hidden glass hover:-translate-y-2 transition-transform duration-500 ease-out"
              >
                {/* Event Image */}
                <div className="relative h-64 w-full overflow-hidden bg-gray-950">
                  {event.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={event.image_url} 
                      alt={event.title}
                      className="object-cover w-full h-full opacity-70 group-hover:scale-105 group-hover:opacity-100 transition-all duration-700"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 to-purple-900 opacity-40" />
                  )}
                  
                  {/* Category badgets */}
                  <div className="absolute top-4 left-4 flex gap-2 flex-wrap z-10">
                    {event.category?.map((cat: string, i: number) => (
                      <span key={i} className="px-3 py-1 text-xs font-bold rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white uppercase tracking-wider">
                        {cat}
                      </span>
                    ))}
                  </div>
                  
                  {/* Status Badges */}
                  <div className="absolute top-4 right-4 flex gap-2 flex-col items-end z-10">
                    {event.is_sold_out && (
                      <span className="px-3 py-1 text-xs font-bold text-white rounded-full bg-red-600/80 backdrop-blur-md uppercase tracking-wide">
                        Sold Out
                      </span>
                    )}
                    {event.guestlist_only && (
                      <span className="px-3 py-1 text-xs font-bold text-white rounded-full bg-emerald-600/80 backdrop-blur-md uppercase tracking-wide">
                        Guestlist Only
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6 relative flex-grow flex flex-col">
                  <h2 className="text-2xl font-bold mb-4 line-clamp-2 text-white">{event.title}</h2>
                  
                  <div className="space-y-3 text-sm text-gray-300 mb-6 font-medium">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-fuchsia-500/10">
                        <Calendar className="w-4 h-4 text-fuchsia-400" />
                      </div>
                      <span className="text-gray-200">{event.date || 'Data da definire'}</span>
                      {event.time && <span className="text-gray-400">• {event.time}</span>}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-indigo-500/10">
                        <MapPin className="w-4 h-4 text-indigo-400" />
                      </div>
                      <span className="text-gray-200 line-clamp-1">{event.venues?.name || event.location_name || 'Location segreta'}</span>
                    </div>

                    {(event.organizers?.name || event.price) && (
                      <div className="flex items-center justify-between mt-2">
                        {event.organizers?.name && (
                           <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-purple-500/10">
                              <Users className="w-4 h-4 text-purple-400" />
                            </div>
                            <span className="text-gray-200">By {event.organizers.name}</span>
                          </div>
                        )}
                        {event.price && (
                          <span className="px-3 py-1 bg-white/5 rounded-lg text-fuchsia-300 font-bold border border-white/5">
                            {event.price}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="text-gray-400 text-sm line-clamp-3 mb-8 flex-grow leading-relaxed">
                    {event.description || event.raw_text}
                  </p>

                  <div className="flex gap-3 mt-auto pt-4 border-t border-white/10">
                    {event.source_link && (
                      <a 
                        href={event.source_link} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex-1 flex justify-center items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-medium transition-colors text-white"
                      >
                        <ExternalLink className="w-4 h-4" /> IG Post
                      </a>
                    )}
                    {event.ticket_link && (
                      <a 
                        href={event.ticket_link} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex-1 flex justify-center items-center gap-2 px-4 py-3 bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 rounded-xl font-bold shadow-lg shadow-fuchsia-500/25 transition-all text-white"
                      >
                        <Ticket className="w-4 h-4" /> Tickets
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
