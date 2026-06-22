import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// An automated follow-up step as supplied by the create-campaign wizard:
// "wait N days after the previous email, if no reply, send this body" (in-thread).
interface FollowupInput {
  waitDays?: number
  body?: string
}

// POST /api/campaigns — create a draft campaign with an explicit recipient list
// and an optional automated follow-up sequence.
// Body: { name, type: "bulk"|"single", subject, body, contactIds: string[],
//         followups?: { waitDays: number, body: string }[] }
// Sending happens later via POST /api/campaigns/[id]/send.
export async function POST(request: NextRequest) {
  let payload: {
    name?: string
    type?: string
    subject?: string
    body?: string
    contactIds?: string[]
    followups?: FollowupInput[]
  }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { name, type, subject, body, contactIds, followups } = payload
  if (!name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (type !== 'bulk' && type !== 'single') {
    return NextResponse.json({ error: "type must be 'bulk' or 'single'" }, { status: 400 })
  }
  if (!Array.isArray(contactIds) || contactIds.length === 0) {
    return NextResponse.json({ error: 'contactIds must be a non-empty array' }, { status: 400 })
  }
  if (type === 'single' && contactIds.length !== 1) {
    return NextResponse.json({ error: 'single campaigns must have exactly one recipient' }, { status: 400 })
  }

  // Validate the optional follow-up sequence (ordered as given). Each step needs
  // a body and a wait of at least 1 day.
  if (followups !== undefined && !Array.isArray(followups)) {
    return NextResponse.json({ error: 'followups must be an array' }, { status: 400 })
  }
  const steps = followups ?? []
  for (let i = 0; i < steps.length; i++) {
    const waitDays = Math.floor(Number(steps[i].waitDays))
    if (!Number.isFinite(waitDays) || waitDays < 1) {
      return NextResponse.json(
        { error: `followups[${i}].waitDays must be an integer >= 1` },
        { status: 400 }
      )
    }
    if (!steps[i].body?.trim()) {
      return NextResponse.json(
        { error: `followups[${i}].body is required` },
        { status: 400 }
      )
    }
  }

  // Verify the contacts exist (and dedupe ids).
  const uniqueIds = [...new Set(contactIds)]
  const { data: found } = await supabase.from('contacts').select('id').in('id', uniqueIds)
  const foundIds = (found ?? []).map((c) => c.id)
  if (foundIds.length !== uniqueIds.length) {
    const missing = uniqueIds.filter((id) => !foundIds.includes(id))
    return NextResponse.json({ error: 'some contacts not found', missing }, { status: 404 })
  }

  const { data: campaign, error: cErr } = await supabase
    .from('campaigns')
    .insert({ name: name.trim(), type, subject: subject ?? null, body: body ?? null, status: 'draft' })
    .select('id, name, type, status')
    .single()
  if (cErr || !campaign) {
    return NextResponse.json({ error: cErr?.message ?? 'Failed to create campaign' }, { status: 500 })
  }

  const { error: rErr } = await supabase
    .from('campaign_recipients')
    .insert(foundIds.map((contactId) => ({ campaign_id: campaign.id, contact_id: contactId })))
  if (rErr) {
    return NextResponse.json({ error: rErr.message }, { status: 500 })
  }

  // Persist the follow-up sequence, preserving wizard order as step_index.
  if (steps.length > 0) {
    const { error: fErr } = await supabase.from('campaign_followups').insert(
      steps.map((s, i) => ({
        campaign_id: campaign.id,
        step_index: i,
        wait_days: Math.floor(Number(s.waitDays)),
        body: s.body!.trim(),
      }))
    )
    if (fErr) {
      return NextResponse.json({ error: fErr.message }, { status: 500 })
    }
  }

  return NextResponse.json(
    { campaign, recipientCount: foundIds.length, followupCount: steps.length },
    { status: 201 }
  )
}
