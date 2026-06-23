import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function cleanTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((t) => String(t).trim()).filter(Boolean)
}

// POST /api/contacts/manual
// Manual batch add, in two modes. Contacts always upsert on email (latest wins):
// re-adding an email overwrites its fields and moves it into the target group.
// Within-payload duplicates resolve to the last occurrence.
//  - create (groupName): like the CSV import, each call creates a new contact_group.
//  - append (groupId): appends contacts to an existing group, no group created.
// Body: { groupName: string, contacts: [...] } OR { groupId: string, contacts: [...] }
export async function POST(request: NextRequest) {
  let payload: {
    groupId?: string
    groupName?: string
    contacts?: Array<{ email?: string; name?: string; company?: string; tags?: string[] }>
  }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const groupId = typeof payload.groupId === 'string' ? payload.groupId.trim() : ''
  const groupName = payload.groupName?.trim()
  // Append mode requires a groupId; create mode requires a groupName.
  if (!groupId && !groupName) {
    return NextResponse.json({ error: 'a group name is required' }, { status: 400 })
  }

  const rows = Array.isArray(payload.contacts) ? payload.contacts : []

  // Latest-wins within the payload: a Map keyed by email keeps the last occurrence.
  let errored = 0
  const byEmail = new Map<
    string,
    { name: string | null; email: string; company: string | null; tags: string[] }
  >()

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
      tags: cleanTags(row.tags),
    })
  }

  const valid = [...byEmail.values()]
  if (valid.length === 0) {
    return NextResponse.json(
      { error: 'add at least one contact with a valid email' },
      { status: 400 },
    )
  }

  // Resolve the target group: append fetches an existing one, create makes a new one.
  let group: { id: string; name: string }
  if (groupId) {
    const { data: existingGroup, error: fetchErr } = await supabase
      .from('contact_groups')
      .select('id, name')
      .eq('id', groupId)
      .single()
    if (fetchErr || !existingGroup) {
      return NextResponse.json({ error: 'group not found' }, { status: 404 })
    }
    group = existingGroup
  } else {
    // Create the group for this batch (no source file — it's a manual add).
    const { data: newGroup, error: groupErr } = await supabase
      .from('contact_groups')
      .insert({ name: groupName, source_filename: null })
      .select('id, name')
      .single()
    if (groupErr || !newGroup) {
      return NextResponse.json(
        { error: groupErr?.message ?? 'Failed to create group' },
        { status: 500 },
      )
    }
    group = newGroup
  }

  // Distinguish created vs updated by checking which emails already exist.
  const emails = valid.map((r) => r.email)
  const { data: existing } = await supabase.from('contacts').select('email').in('email', emails)
  const existingEmails = new Set((existing ?? []).map((r: { email: string }) => r.email))
  const updated = valid.filter((r) => existingEmails.has(r.email)).length
  const created = valid.length - updated

  // Upsert: overwrite fields and reassign group_id on conflict(email).
  const { error: upsertErr } = await supabase
    .from('contacts')
    .upsert(valid.map((r) => ({ ...r, group_id: group.id })), { onConflict: 'email' })
  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  }

  return NextResponse.json({ groupId: group.id, groupName: group.name, created, updated, errored })
}
