'use server'

import { createAdminClient } from '@/lib/supabase-admin'
import { revalidatePath } from 'next/cache'

export interface EventFormData {
  title: string
  date: string
  time: string
  end_time: string
  description: string
  venue_id: string
  organizer_id: string
  location_name: string
  category: string        // comma-separated → stored as array
  price: string
  ticket_link: string
  image_url: string
  dresscode: string
  min_age: string
  guestlist_only: boolean
  is_sold_out: boolean
}

function toRow(data: EventFormData) {
  return {
    title: data.title.trim(),
    date: data.date || null,
    time: data.time || null,
    end_time: data.end_time || null,
    description: data.description || null,
    venue_id: data.venue_id || null,
    organizer_id: data.organizer_id || null,
    location_name: data.location_name || null,
    category: data.category
      ? data.category.split(',').map((s) => s.trim()).filter(Boolean)
      : null,
    price: data.price || null,
    ticket_link: data.ticket_link || null,
    image_url: data.image_url || null,
    dresscode: data.dresscode || null,
    min_age: data.min_age ? parseInt(data.min_age, 10) : null,
    guestlist_only: data.guestlist_only,
    is_sold_out: data.is_sold_out,
  }
}

export async function createEvent(data: EventFormData): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('events').insert(toRow(data))
  if (error) return { error: error.message }
  revalidatePath('/admin/events')
  return {}
}

export async function updateEvent(id: string, data: EventFormData): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('events').update(toRow(data)).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/events')
  return {}
}

export async function deleteEvent(id: string): Promise<{ error?: string }> {
  const supabase = createAdminClient()
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/events')
  return {}
}
