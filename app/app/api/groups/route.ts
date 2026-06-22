import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/groups
// Lists contact groups (one per CSV upload) with a contact count each.
export async function GET() {
  const { data: groups, error } = await supabase
    .from('contact_groups')
    .select('id, name, source_filename, created_at')
    .order('created_at', { ascending: false })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: contacts } = await supabase.from('contacts').select('group_id')
  const counts = new Map<string, number>()
  for (const c of (contacts ?? []) as { group_id: string | null }[]) {
    if (c.group_id) counts.set(c.group_id, (counts.get(c.group_id) ?? 0) + 1)
  }

  return NextResponse.json({
    groups: (groups ?? []).map((g) => ({ ...g, contactCount: counts.get(g.id) ?? 0 })),
  })
}
