import { createClient } from '@/lib/supabase-server'
import { OrganizerManager } from './OrganizerManager'

export default async function AdminOrganizersPage() {
  const supabase = await createClient()
  const { data: organizers } = await supabase
    .from('organizers')
    .select('id, name, website_url, instagram_username')
    .order('name', { ascending: true })

  return (
    <div className="space-y-6">
      <OrganizerManager organizers={organizers ?? []} />
    </div>
  )
}
