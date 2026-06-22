import { NextRequest, NextResponse } from 'next/server'
import Papa from 'papaparse'
import { supabase } from '@/lib/supabase'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function parseTags(raw: string | undefined): string[] {
  if (!raw?.trim()) return []
  return raw.split(';').map(t => t.trim()).filter(Boolean)
}

// CSV import. Each upload becomes a contact_group. Contacts upsert on email
// (latest wins): re-importing an email overwrites its fields and moves it into
// this upload's group. Within-file duplicates also resolve to the last row.
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const groupNameRaw = (formData.get('groupName') as string | null)?.trim()

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const text = await file.text()

  const { data: rows } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  })

  // Latest-wins within the file: a Map keyed by email keeps the last occurrence.
  let errored = 0
  const byEmail = new Map<string, { name: string | null; email: string; company: string | null; tags: string[] }>()

  for (const row of rows) {
    const email = row.email?.trim().toLowerCase()
    if (!email || !isValidEmail(email)) {
      errored++
      continue
    }
    byEmail.set(email, {
      name: row.name?.trim() || null,
      email,
      company: row.company?.trim() || null,
      tags: parseTags(row.tags),
    })
  }

  const valid = [...byEmail.values()]
  const groupName = groupNameRaw || file.name.replace(/\.csv$/i, '') || 'Imported group'

  // Create the group for this upload.
  const { data: group, error: groupErr } = await supabase
    .from('contact_groups')
    .insert({ name: groupName, source_filename: file.name })
    .select('id, name')
    .single()
  if (groupErr || !group) {
    return NextResponse.json({ error: groupErr?.message ?? 'Failed to create group' }, { status: 500 })
  }

  if (valid.length === 0) {
    return NextResponse.json({ groupId: group.id, groupName: group.name, created: 0, updated: 0, errored })
  }

  // Distinguish created vs updated by checking which emails already exist.
  const emails = valid.map(r => r.email)
  const { data: existing } = await supabase.from('contacts').select('email').in('email', emails)
  const existingEmails = new Set((existing ?? []).map((r: { email: string }) => r.email))
  const updated = valid.filter(r => existingEmails.has(r.email)).length
  const created = valid.length - updated

  // Upsert: overwrite fields and reassign group_id on conflict(email).
  const { error: upsertErr } = await supabase
    .from('contacts')
    .upsert(valid.map(r => ({ ...r, group_id: group.id })), { onConflict: 'email' })
  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  }

  return NextResponse.json({ groupId: group.id, groupName: group.name, created, updated, errored })
}
