import { supabase } from '@/lib/supabase'

export interface GroupDetail {
  id: string
  name: string
  sourceFilename: string | null
  createdAt: string
}

export interface GroupContact {
  id: string
  name: string | null
  email: string
  company: string | null
  tags: string[]
  status: string
  lastContactedAt: string | null
}

export async function getGroupDetail(groupId: string): Promise<{
  group: GroupDetail
  contacts: GroupContact[]
} | null> {
  const { data: group, error } = await supabase
    .from('contact_groups')
    .select('id, name, source_filename, created_at')
    .eq('id', groupId)
    .single()
  if (error || !group) return null

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, email, company, tags, status, last_contacted_at')
    .eq('group_id', groupId)
    .order('created_at', { ascending: true })

  return {
    group: {
      id: group.id,
      name: group.name,
      sourceFilename: (group as { source_filename?: string | null }).source_filename ?? null,
      createdAt: group.created_at,
    },
    contacts: ((contacts ?? []) as {
      id: string; name: string | null; email: string; company: string | null;
      tags: string[] | null; status: string; last_contacted_at: string | null
    }[]).map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      company: c.company,
      tags: Array.isArray(c.tags) ? c.tags : [],
      status: c.status,
      lastContactedAt: c.last_contacted_at,
    })),
  }
}


export interface GroupSummary {
  id: string
  name: string
  sourceFilename: string | null
  createdAt: string
  contactCount: number
  replied: number
  meeting: number
  converted: number
}

export async function listGroups(): Promise<GroupSummary[]> {
  const { data: groups, error } = await supabase
    .from('contact_groups')
    .select('id, name, source_filename, created_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  const { data: contacts } = await supabase
    .from('contacts')
    .select('group_id, status')

  const byGroup = new Map<string, { count: number; replied: number; meeting: number; converted: number }>()
  for (const c of (contacts ?? []) as { group_id: string | null; status: string }[]) {
    if (!c.group_id) continue
    const cur = byGroup.get(c.group_id) ?? { count: 0, replied: 0, meeting: 0, converted: 0 }
    cur.count++
    if (c.status === 'replied') cur.replied++
    if (c.status === 'meeting') cur.meeting++
    if (c.status === 'converted') cur.converted++
    byGroup.set(c.group_id, cur)
  }

  return (groups ?? []).map((g) => {
    const agg = byGroup.get(g.id) ?? { count: 0, replied: 0, meeting: 0, converted: 0 }
    return {
      id: g.id,
      name: g.name,
      sourceFilename: g.source_filename ?? null,
      createdAt: g.created_at,
      contactCount: agg.count,
      replied: agg.replied,
      meeting: agg.meeting,
      converted: agg.converted,
    }
  })
}
