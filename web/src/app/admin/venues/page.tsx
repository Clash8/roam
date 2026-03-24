import { createAdminClient } from '@/lib/supabase-admin'
import { VenueManager } from './VenueManager'

export default async function AdminVenuesPage() {
  const supabase = createAdminClient()
  const { data: venues } = await supabase
    .from('venues')
    .select('id, name, address, website_url, instagram_username')
    .order('name', { ascending: true })

  return (
    <div className="space-y-6">
      <VenueManager venues={venues ?? []} />
    </div>
  )
}
