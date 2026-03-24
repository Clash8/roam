'use server'

import { revalidatePath, refresh } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

export async function signIn(prevState: { error: string } | null, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function signUp(prevState: { error: string; success?: boolean } | null, formData: FormData) {
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    options: {
      data: { full_name: formData.get('full_name') as string },
    },
  })

  if (error) return { error: error.message }

  return { error: '', success: true }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}

export async function changePassword(
  prevState: { error: string; success: boolean } | null,
  formData: FormData,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato', success: false }

  const currentPassword = formData.get('current_password') as string
  const newPassword = formData.get('new_password') as string
  const confirmPassword = formData.get('confirm_password') as string

  if (newPassword !== confirmPassword) {
    return { error: 'Le nuove password non coincidono', success: false }
  }
  if (newPassword.length < 6) {
    return { error: 'La password deve essere di almeno 6 caratteri', success: false }
  }

  // Verify current password by re-authenticating
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  })
  if (signInError) return { error: 'Password attuale non corretta', success: false }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) return { error: error.message, success: false }

  return { error: '', success: true }
}

export async function submitRequest(prevState: { error: string; success: boolean } | null, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato', success: false }

  const item_type = formData.get('item_type') as string

  const instagram_username = (formData.get('instagram_url') as string | null)?.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '') || null

  // For venue/organizer requests: block if instagram_username already in venues or organizers
  if (item_type !== 'event' && instagram_username) {
    const admin = createAdminClient()
    const [{ count: inVenues }, { count: inOrganizers }] = await Promise.all([
      admin.from('venues').select('id', { count: 'exact', head: true }).eq('instagram_username', instagram_username),
      admin.from('organizers').select('id', { count: 'exact', head: true }).eq('instagram_username', instagram_username),
    ])
    if ((inVenues ?? 0) > 0 || (inOrganizers ?? 0) > 0) {
      return { error: 'Questo profilo Instagram è già presente nel database.', success: false }
    }
  }

  if (item_type === 'event') {
    const { error } = await supabase.from('event_requests').insert({
      user_id: user.id,
      title: formData.get('name'),
      date: formData.get('date') || null,
      venue_name: formData.get('venue_name') || null,
      organizer_name: formData.get('organizer_name') || null,
      description: formData.get('description') || null,
      instagram_username,
      ticket_link: formData.get('ticket_link') || null,
      notes: formData.get('notes') || null,
    })
    if (error) return { error: igError(error), success: false }
  } else {
    const { error } = await supabase.from('requests').insert({
      user_id: user.id,
      item_type,
      name: formData.get('name'),
      instagram_username,
      notes: formData.get('notes') || null,
    })
    if (error) return { error: igError(error), success: false }
  }

  revalidatePath('/dashboard')
  revalidatePath('/admin')
  return { error: '', success: true }
}

function igError(error: { code?: string; message: string }): string {
  if (error.code === '23505' && error.message.includes('instagram_username')) {
    return 'Questo profilo Instagram è già presente nel database.'
  }
  return error.message
}

async function awardPoints(userId: string, points: number) {
  const supabase = createAdminClient()
  const { data: existing } = await supabase
    .from('user_points')
    .select('total_points')
    .eq('user_id', userId)
    .single()

  if (existing) {
    await supabase
      .from('user_points')
      .update({ total_points: existing.total_points + points, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
  } else {
    await supabase
      .from('user_points')
      .insert({ user_id: userId, total_points: points })
  }
}

export async function updateRequestStatusForm(formData: FormData) {
  const id = formData.get('id') as string
  const status = formData.get('status') as 'approved' | 'rejected'
  const rejection_reason = (formData.get('rejection_reason') as string | null)?.trim() || null
  return updateRequestStatus(id, status, rejection_reason)
}

export async function updateEventRequestStatusForm(formData: FormData) {
  const id = formData.get('id') as string
  const status = formData.get('status') as 'approved' | 'rejected'
  const rejection_reason = (formData.get('rejection_reason') as string | null)?.trim() || null
  return updateEventRequestStatus(id, status, rejection_reason)
}

export async function updateRequestStatus(id: string, status: 'approved' | 'rejected', rejection_reason: string | null = null) {
  const supabase = createAdminClient()

  const { data: req } = await supabase
    .from('requests')
    .select('user_id')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('requests')
    .update({ status, rejection_reason: status === 'rejected' ? rejection_reason : null })
    .eq('id', id)
  if (error) throw new Error(error.message)

  if (status === 'approved' && req?.user_id) {
    await awardPoints(req.user_id, 2)
  }

  revalidatePath('/admin/requests')
  revalidatePath('/admin')
  refresh()
}

export async function updateEventRequestStatus(id: string, status: 'approved' | 'rejected', rejection_reason: string | null = null) {
  const supabase = createAdminClient()

  const { data: req } = await supabase
    .from('event_requests')
    .select('user_id')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('event_requests')
    .update({ status, rejection_reason: status === 'rejected' ? rejection_reason : null })
    .eq('id', id)
  if (error) throw new Error(error.message)

  if (status === 'approved' && req?.user_id) {
    await awardPoints(req.user_id, 5)
  }

  revalidatePath('/admin/requests')
  revalidatePath('/admin')
  refresh()
}

export async function deleteRequest(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('requests').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
}

export async function deleteEventRequest(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('event_requests').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/dashboard')
}

export async function deleteVenue(id: string) {
  const supabase = createAdminClient()
  await supabase.from('venues').delete().eq('id', id)
  revalidatePath('/admin/venues')
}

export async function insertVenue(_prev: null, formData: FormData) {
  const supabase = createAdminClient()
  const igHandle = (formData.get('instagram_handle') as string | null)?.trim().replace(/^@/, '') || null
  const { error } = await supabase.from('venues').insert({
    name: formData.get('name') as string,
    address: (formData.get('address') as string | null)?.trim() || null,
    website_url: (formData.get('website_url') as string | null)?.trim() || null,
    instagram_username: igHandle || null,
  })
  if (error) return { error: igError(error) }
  revalidatePath('/admin/venues')
  return { error: '' }
}

export async function updateVenue(_prev: null, formData: FormData) {
  const supabase = createAdminClient()
  const id = formData.get('id') as string
  const igHandle = (formData.get('instagram_handle') as string | null)?.trim().replace(/^@/, '') || null
  const { error } = await supabase.from('venues').update({
    name: formData.get('name') as string,
    address: (formData.get('address') as string | null)?.trim() || null,
    website_url: (formData.get('website_url') as string | null)?.trim() || null,
    instagram_username: igHandle || null,
  }).eq('id', id)
  if (error) return { error: igError(error) }
  revalidatePath('/admin/venues')
  return { error: '' }
}

export async function deleteOrganizer(id: string) {
  const supabase = createAdminClient()
  await supabase.from('organizers').delete().eq('id', id)
  revalidatePath('/admin/organizers')
}

export async function insertOrganizer(_prev: null, formData: FormData) {
  const supabase = createAdminClient()
  const igHandle = (formData.get('instagram_handle') as string | null)?.trim().replace(/^@/, '') || null
  const { error } = await supabase.from('organizers').insert({
    name: formData.get('name') as string,
    website_url: (formData.get('website_url') as string | null)?.trim() || null,
    instagram_username: igHandle || null,
  })
  if (error) return { error: igError(error) }
  revalidatePath('/admin/organizers')
  return { error: '' }
}

export async function updateOrganizer(_prev: null, formData: FormData) {
  const supabase = createAdminClient()
  const id = formData.get('id') as string
  const igHandle = (formData.get('instagram_handle') as string | null)?.trim().replace(/^@/, '') || null
  const { error } = await supabase.from('organizers').update({
    name: formData.get('name') as string,
    website_url: (formData.get('website_url') as string | null)?.trim() || null,
    instagram_username: igHandle || null,
  }).eq('id', id)
  if (error) return { error: igError(error) }
  revalidatePath('/admin/organizers')
  return { error: '' }
}
