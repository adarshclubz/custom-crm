import crypto from 'crypto'
import { supabase } from '@/lib/supabase'
import { sendMessage } from '@/lib/gmail'
import { applyAutoStatus } from '@/lib/status'

const STAGGER_MIN = Number(process.env.SEND_DELAY_MIN_SECONDS ?? 60)
const STAGGER_MAX = Number(process.env.SEND_DELAY_MAX_SECONDS ?? 180)
const MAX_ATTEMPTS = 5
const DRAIN_BATCH = 25

function randomStaggerSeconds(): number {
  return STAGGER_MIN + Math.random() * (STAGGER_MAX - STAGGER_MIN)
}

// One email's worth of send instructions, already rendered.
export interface PreparedSend {
  contactId: string
  to: string
  subject: string
  body: string
  campaignId?: string
  threadId?: string
  inReplyTo?: string
  references?: string
}

// Actually send one email and record it: writes a sent_emails row and advances
// the contact. Shared by immediate single sends and the background drainer.
export async function performSend(s: PreparedSend): Promise<string> {
  const result = await sendMessage({
    to: s.to,
    subject: s.subject,
    body: s.body,
    threadId: s.threadId,
    inReplyTo: s.inReplyTo,
    references: s.references,
  })

  const { data: sent, error } = await supabase
    .from('sent_emails')
    .insert({
      contact_id: s.contactId,
      subject: s.subject,
      body: s.body,
      sent_via: 'gmail',
      provider_message_id: result.messageId,
      thread_id: result.threadId,
      campaign_id: s.campaignId ?? null,
    })
    .select('id')
    .single()
  if (error || !sent) {
    throw new Error(`sent recorded with Gmail but DB insert failed: ${error?.message}`)
  }

  // Always refresh last_contacted_at; advance status via the precedence helper
  // (won't regress replied/meeting/converted/etc.).
  await supabase
    .from('contacts')
    .update({ last_contacted_at: new Date().toISOString() })
    .eq('id', s.contactId)
  await applyAutoStatus(s.contactId, 'sent')

  return sent.id
}

// Queue a bulk batch: one send_jobs row per recipient, each scheduled with a
// cumulative random stagger so they drip out over time.
export async function enqueueBulk(
  sends: PreparedSend[],
  opts?: { startAt?: Date; scheduled?: boolean }
): Promise<{ batchId: string; queued: number; firstAt: string; lastAt: string }> {
  const batchId = crypto.randomUUID()
  const earliest = Date.now() + 2_000 // never schedule in the past
  // First one fires at the chosen start time (or ~2s out); the stagger still
  // applies after that, so a scheduled bulk begins at startAt and drips from there.
  let cursorMs = Math.max(opts?.startAt?.getTime() ?? earliest, earliest)
  const scheduled = opts?.scheduled ?? false

  const rows = sends.map((s, i) => {
    if (i > 0) cursorMs += randomStaggerSeconds() * 1000
    return {
      contact_id: s.contactId,
      to_email: s.to,
      subject: s.subject,
      body: s.body,
      thread_id: s.threadId ?? null,
      in_reply_to: s.inReplyTo ?? null,
      references_header: s.references ?? null,
      scheduled_at: new Date(cursorMs).toISOString(),
      status: 'pending' as const,
      scheduled,
      batch_id: batchId,
      campaign_id: s.campaignId ?? null,
    }
  })

  const { error } = await supabase.from('send_jobs').insert(rows)
  if (error) throw new Error(`Failed to enqueue batch: ${error.message}`)

  return {
    batchId,
    queued: rows.length,
    firstAt: rows[0].scheduled_at,
    lastAt: rows[rows.length - 1].scheduled_at,
  }
}

// One upcoming user-scheduled send, grouped from its send_jobs batch.
export interface ScheduledItem {
  batchId: string
  campaignId: string | null
  campaignName: string | null
  kind: 'initial' | 'followup'
  recipientCount: number
  scheduledAt: string // earliest job in the batch
}

// List deliberate, still-pending schedules (scheduled = true), grouped by batch.
// Backs the "view the schedule" screen. A pending job is "upcoming" until the
// drainer actually sends it, so we don't filter on scheduled_at > now — a job
// that's a minute overdue but not yet drained should still appear.
export async function listScheduled(): Promise<ScheduledItem[]> {
  const { data } = await supabase
    .from('send_jobs')
    .select('batch_id, campaign_id, scheduled_at, thread_id, campaigns(name)')
    .eq('status', 'pending')
    .eq('scheduled', true)
    .order('scheduled_at', { ascending: true })

  type Row = {
    batch_id: string | null
    campaign_id: string | null
    scheduled_at: string
    thread_id: string | null
    campaigns: { name: string } | { name: string }[] | null
  }

  const byBatch = new Map<string, ScheduledItem>()
  for (const r of (data ?? []) as Row[]) {
    const key = r.batch_id ?? r.scheduled_at // batch_id should always be set
    const existing = byBatch.get(key)
    if (existing) {
      existing.recipientCount++
      continue
    }
    const campaign = Array.isArray(r.campaigns) ? r.campaigns[0] : r.campaigns
    byBatch.set(key, {
      batchId: key,
      campaignId: r.campaign_id,
      campaignName: campaign?.name ?? null,
      kind: r.thread_id ? 'followup' : 'initial',
      recipientCount: 1,
      scheduledAt: r.scheduled_at, // rows are time-ordered, so this is the earliest
    })
  }
  return [...byBatch.values()]
}

// Cancel a still-pending scheduled batch. In-flight (sending) or already-sent
// jobs are left alone. If the batch was a campaign's initial send (no thread_id)
// and the campaign is still 'scheduled', it reverts to 'draft' so it can be
// edited and re-sent.
export async function cancelScheduledBatch(
  batchId: string
): Promise<{ canceled: number }> {
  const { data: canceledRows } = await supabase
    .from('send_jobs')
    .update({ status: 'canceled' })
    .eq('batch_id', batchId)
    .eq('status', 'pending')
    .select('campaign_id, thread_id')

  const rows = (canceledRows ?? []) as { campaign_id: string | null; thread_id: string | null }[]

  // Revert campaigns whose initial scheduled send was just canceled back to draft.
  const initialCampaignIds = new Set(
    rows.filter((r) => r.campaign_id && !r.thread_id).map((r) => r.campaign_id as string)
  )
  for (const campaignId of initialCampaignIds) {
    await supabase
      .from('campaigns')
      .update({ status: 'draft' })
      .eq('id', campaignId)
      .eq('status', 'scheduled')
  }

  return { canceled: rows.length }
}

interface SendJobRow {
  id: string
  contact_id: string
  to_email: string
  subject: string
  body: string
  thread_id: string | null
  in_reply_to: string | null
  references_header: string | null
  campaign_id: string | null
  attempts: number
}

// Flip a campaign to 'sent' once it has no more pending/sending jobs. Called
// after each drain tick for the campaigns whose jobs were just processed.
async function maybeCompleteCampaigns(campaignIds: string[]): Promise<void> {
  for (const campaignId of campaignIds) {
    const { count } = await supabase
      .from('send_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .in('status', ['pending', 'sending'])
    if ((count ?? 0) === 0) {
      await supabase
        .from('campaigns')
        .update({ status: 'sent' })
        .eq('id', campaignId)
        .in('status', ['sending', 'scheduled'])
    }
  }
}

// Process all due jobs (up to DRAIN_BATCH). Called every minute by the
// scheduler (Cloud Scheduler in prod, a local loop in dev).
export async function drainDueJobs(): Promise<{
  claimed: number
  sent: number
  failed: number
  requeued: number
}> {
  const nowIso = new Date().toISOString()
  const { data: due } = await supabase
    .from('send_jobs')
    .select('id, contact_id, to_email, subject, body, thread_id, in_reply_to, references_header, campaign_id, attempts')
    .eq('status', 'pending')
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(DRAIN_BATCH)

  const jobs = (due ?? []) as SendJobRow[]
  let claimed = 0
  let sent = 0
  let failed = 0
  let requeued = 0
  const touchedCampaigns = new Set<string>()

  for (const job of jobs) {
    // Atomic claim: only one drainer can flip pending -> sending.
    const { data: claimedRows } = await supabase
      .from('send_jobs')
      .update({ status: 'sending' })
      .eq('id', job.id)
      .eq('status', 'pending')
      .select('id')
    if (!claimedRows || claimedRows.length === 0) continue // someone else got it
    claimed++
    if (job.campaign_id) touchedCampaigns.add(job.campaign_id)

    try {
      const sentEmailId = await performSend({
        contactId: job.contact_id,
        to: job.to_email,
        subject: job.subject,
        body: job.body,
        campaignId: job.campaign_id ?? undefined,
        threadId: job.thread_id ?? undefined,
        inReplyTo: job.in_reply_to ?? undefined,
        references: job.references_header ?? undefined,
      })
      await supabase
        .from('send_jobs')
        .update({ status: 'sent', sent_email_id: sentEmailId, attempts: job.attempts + 1 })
        .eq('id', job.id)
      sent++

      // Arm the first automated follow-up for this campaign recipient. Every
      // send_jobs row is an initial campaign send (follow-ups never enter this
      // queue), so a campaign_id here always means "just did the first touch".
      // Dynamic import breaks the queue<->followups module cycle (followups
      // imports performSend from here).
      if (job.campaign_id) {
        const { armFollowups } = await import('@/lib/followups')
        await armFollowups(job.campaign_id, job.contact_id, sentEmailId)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error'
      const attempts = job.attempts + 1
      if (attempts >= MAX_ATTEMPTS) {
        await supabase
          .from('send_jobs')
          .update({ status: 'failed', attempts, last_error: message })
          .eq('id', job.id)
        failed++
      } else {
        // Back off ~2 min and retry on a later tick.
        await supabase
          .from('send_jobs')
          .update({
            status: 'pending',
            attempts,
            last_error: message,
            scheduled_at: new Date(Date.now() + 120_000).toISOString(),
          })
          .eq('id', job.id)
        requeued++
      }
    }
  }

  // A scheduled campaign whose batch just started draining moves to 'sending';
  // maybeCompleteCampaigns then flips it (or a single-job one) to 'sent' when done.
  for (const campaignId of touchedCampaigns) {
    await supabase
      .from('campaigns')
      .update({ status: 'sending' })
      .eq('id', campaignId)
      .eq('status', 'scheduled')
  }

  // Flip any campaigns that now have no outstanding jobs to 'sent'.
  await maybeCompleteCampaigns([...touchedCampaigns])

  return { claimed, sent, failed, requeued }
}
