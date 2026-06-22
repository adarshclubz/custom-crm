import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// POST /api/contacts
// Create a single contact (e.g. a brand-new recipient typed into a single
// campaign). No group — one-off contacts aren't part of a CSV upload. If the
// email already exists, that existing contact is reused (returned), so creating
// a campaign to a known address just works.
// Body: { name?, email, company?, tags? }
export async function POST(request: NextRequest) {
  let payload: { name?: string; email?: string; company?: string; tags?: string[] }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const email = payload.email?.trim().toLowerCase()
  if (!email || !isValidEmail(email)) {
    return NextResponse.json({ error: 'a valid email is required' }, { status: 400 })
  }

  // Reuse an existing contact with this email rather than erroring on the
  // unique constraint.
  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('email', email)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ id: existing.id, existed: true })
  }

  const { data, error } = await supabase
    .from('contacts')
    .insert({
      name: payload.name?.trim() || null,
      email,
      company: payload.company?.trim() || null,
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      group_id: null,
    })
    .select('id')
    .single()
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create contact' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id, existed: false }, { status: 201 })
}
