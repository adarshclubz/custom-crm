import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validateBulk, renderTemplate, type RenderableContact } from '@/lib/templates'
import { performSend, enqueueBulk, type PreparedSend } from '@/lib/queue'
import { armFollowups, validateFollowups } from '@/lib/followups'

// POST /api/campaigns/[campaignId]/send
// Sends a draft campaign to its recipients. Validates merge tags first and
// blocks the whole send if any recipient is missing a referenced field.
// single -> sends immediately; bulk -> enqueues a staggered batch.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params

  // Optional schedule: an absent/empty body means send now. A scheduledAt must be
  // a valid ISO timestamp in the future.
  let startAt: Date | undefined
  try {
    const body = await request.json()
    if (body && typeof body.scheduledAt === 'string') {
      const t = new Date(body.scheduledAt)
      if (isNaN(t.getTime())) {
        return NextResponse.json({ error: 'invalid scheduledAt' }, { status: 400 })
      }
      if (t.getTime() <= Date.now()) {
        return NextResponse.json({ error: 'scheduledAt must be in the future' }, { status: 400 })
      }
      startAt = t
    }
  } catch {
    // no JSON body — immediate send
  }

  const { data: campaign, error: cErr } = await supabase
    .from('campaigns')
    .select('id, type, subject, body, status')
    .eq('id', campaignId)
    .single()
  if (cErr || !campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 })
  }
  if (campaign.status !== 'draft') {
    return NextResponse.json(
      { error: `campaign is '${campaign.status}', only 'draft' campaigns can be sent` },
      { status: 409 }
    )
  }
  if (!campaign.subject?.trim() || !campaign.body?.trim()) {
    return NextResponse.json({ error: 'campaign has no subject/body' }, { status: 400 })
  }

  const { data: recipRows } = await supabase
    .from('campaign_recipients')
    .select('contact_id')
    .eq('campaign_id', campaignId)
  const contactIds = (recipRows ?? []).map((r) => r.contact_id)
  if (contactIds.length === 0) {
    return NextResponse.json({ error: 'campaign has no recipients' }, { status: 400 })
  }

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name, company')
    .in('id', contactIds)
  const list = (contacts ?? []) as RenderableContact[]

  // Block-if-missing gate (same rule as /api/send).
  const validation = validateBulk(campaign.subject, campaign.body, list)
  if (!validation.ok) {
    return NextResponse.json(
      { error: 'send_blocked', unknownTags: validation.unknownTags, offenders: validation.offenders },
      { status: 422 }
    )
  }

  // Same gate over the automated follow-up bodies — don't arm a chain that can't
  // render for some recipient.
  const followupValidation = await validateFollowups(campaign.id, list)
  if (!followupValidation.ok) {
    return NextResponse.json(
      {
        error: 'send_blocked',
        scope: 'followups',
        unknownTags: followupValidation.unknownTags,
        offenders: followupValidation.offenders,
      },
      { status: 422 }
    )
  }

  const prepared: PreparedSend[] = list.map((c) => ({
    contactId: c.id,
    to: c.email,
    subject: renderTemplate(campaign.subject!, c),
    body: renderTemplate(campaign.body!, c),
    campaignId: campaign.id,
  }))

  // scheduled: unify single + bulk through the durable queue at the chosen time.
  // The drainer arms follow-ups and flips the campaign to sent when it fires.
  if (startAt) {
    try {
      await supabase.from('campaigns').update({ status: 'scheduled' }).eq('id', campaign.id)
      const result = await enqueueBulk(prepared, { startAt, scheduled: true })
      return NextResponse.json({
        mode: campaign.type,
        status: 'scheduled',
        scheduledAt: startAt.toISOString(),
        ...result,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  // single: send immediately, mark campaign sent.
  if (campaign.type === 'single') {
    try {
      const sentEmailId = await performSend(prepared[0])
      await supabase.from('campaigns').update({ status: 'sent' }).eq('id', campaign.id)
      // Arm the first follow-up step (no-op if the campaign has no sequence).
      await armFollowups(campaign.id, prepared[0].contactId, sentEmailId)
      return NextResponse.json({ mode: 'single', sent: 1, sentEmailId, status: 'sent' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error'
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  // bulk: mark sending, enqueue staggered. Drainer flips to 'sent' when done.
  try {
    await supabase.from('campaigns').update({ status: 'sending' }).eq('id', campaign.id)
    const result = await enqueueBulk(prepared)
    return NextResponse.json({ mode: 'bulk', status: 'sending', ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
