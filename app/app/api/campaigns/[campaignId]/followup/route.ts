import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { validateBulk, renderTemplate, type RenderableContact } from '@/lib/templates'
import { enqueueBulk, type PreparedSend } from '@/lib/queue'

// POST /api/campaigns/[campaignId]/followup
// Manual follow-up to selected recipients of a campaign. Sends in-thread (each
// recipient's existing Gmail thread) and staggered via the durable queue.
// Body: { recipientContactIds: string[], subject, body }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params

  let payload: {
    recipientContactIds?: string[]
    subject?: string
    body?: string
    scheduledAt?: string
  }
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { recipientContactIds, subject, body, scheduledAt } = payload
  if (!Array.isArray(recipientContactIds) || recipientContactIds.length === 0) {
    return NextResponse.json({ error: 'recipientContactIds is required' }, { status: 400 })
  }
  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: 'subject and body are required' }, { status: 400 })
  }

  // Optional schedule: a valid ISO timestamp in the future, else send now.
  let startAt: Date | undefined
  if (typeof scheduledAt === 'string') {
    const t = new Date(scheduledAt)
    if (isNaN(t.getTime())) {
      return NextResponse.json({ error: 'invalid scheduledAt' }, { status: 400 })
    }
    if (t.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'scheduledAt must be in the future' }, { status: 400 })
    }
    startAt = t
  }

  const ids = [...new Set(recipientContactIds)]

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name, company')
    .in('id', ids)
  const list = (contacts ?? []) as RenderableContact[]
  if (list.length === 0) {
    return NextResponse.json({ error: 'No matching contacts' }, { status: 404 })
  }

  // Block-if-missing gate over the follow-up template.
  const validation = validateBulk(subject, body, list)
  if (!validation.ok) {
    return NextResponse.json(
      { error: 'send_blocked', unknownTags: validation.unknownTags, offenders: validation.offenders },
      { status: 422 }
    )
  }

  // The thread to reply into for each recipient = earliest send in this campaign.
  const { data: sends } = await supabase
    .from('sent_emails')
    .select('contact_id, thread_id, sent_at')
    .eq('campaign_id', campaignId)
    .in('contact_id', ids)
    .order('sent_at', { ascending: true })
  const threadByContact = new Map<string, string>()
  for (const s of (sends ?? []) as { contact_id: string; thread_id: string | null }[]) {
    if (s.thread_id && !threadByContact.has(s.contact_id)) {
      threadByContact.set(s.contact_id, s.thread_id)
    }
  }

  // A recipient with no thread was never emailed in this campaign — can't follow up.
  const noThread = list.filter((c) => !threadByContact.has(c.id))
  if (noThread.length > 0) {
    return NextResponse.json(
      {
        error: 'no_thread',
        contacts: noThread.map((c) => ({ id: c.id, email: c.email })),
      },
      { status: 422 }
    )
  }

  const prepared: PreparedSend[] = list.map((c) => ({
    contactId: c.id,
    to: c.email,
    subject: renderTemplate(subject, c),
    body: renderTemplate(body, c),
    campaignId,
    threadId: threadByContact.get(c.id),
  }))

  try {
    const result = await enqueueBulk(prepared, startAt ? { startAt, scheduled: true } : undefined)
    return NextResponse.json({
      ok: true,
      ...(startAt ? { status: 'scheduled', scheduledAt: startAt.toISOString() } : {}),
      ...result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
