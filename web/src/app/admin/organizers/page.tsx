import { createAdminClient } from '@/lib/supabase-admin'
import { OrganizerManager } from './OrganizerManager'

export default async function AdminOrganizersPage() {
  const supabase = createAdminClient()
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
