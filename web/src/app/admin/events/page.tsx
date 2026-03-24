import { createAdminClient } from '@/lib/supabase-admin'
import EventsClient from './EventsClient'

export default async function AdminEventsPage() {
  const supabase = createAdminClient()

  const [{ data: events }, { data: venues }, { data: organizers }] = await Promise.all([
    supabase
      .from('events')
      .select('*, venues(name), organizers(name)')
      .order('date', { ascending: false })
      .limit(200),
    supabase.from('venues').select('id, name').order('name'),
    supabase.from('organizers').select('id, name').order('name'),
  ])

  return (
    <div className="space-y-6">
      <EventsClient
        events={events ?? []}
        venues={venues ?? []}
        organizers={organizers ?? []}
      />
    </div>
  )
}
