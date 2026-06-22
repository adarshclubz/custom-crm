import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/groups/[groupId]
// A group and the contacts in it, with each lead's status.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ groupId: string }> }
) {
  const { groupId } = await params

  const { data: group, error: gErr } = await supabase
    .from('contact_groups')
    .select('id, name, source_filename, created_at')
    .eq('id', groupId)
    .single()
  if (gErr || !group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 })
  }

  const { data: contacts, error: cErr } = await supabase
    .from('contacts')
    .select('id, name, email, company, tags, status, last_contacted_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })
  if (cErr) {
    return NextResponse.json({ error: cErr.message }, { status: 500 })
  }

  return NextResponse.json({ group, contacts: contacts ?? [] })
}
