import { supabase } from '@/lib/supabase'
import { performSend } from '@/lib/queue'
import { validateBulk, renderTemplate, type RenderableContact, type BulkValidation } from '@/lib/templates'

// Automated follow-up engine. A campaign can carry an ordered sequence of steps
// (campaign_followups). After a recipient's INITIAL email is sent we "arm" step 0
// (a followup_jobs row due `wait_days` later). A scheduler-driven worker then,
// for each due step: stops if the contact has replied/bounced on that thread (or
// was manually progressed), otherwise sends the step in-thread and arms the next
// step relative to THAT send. At most one pending row per (campaign, contact).

// Dev knob: in prod a "day" is 86400s; set this lower to watch a whole chain fire
// in seconds. Mirrors SEND_DELAY_* in lib/queue.ts.
const WAIT_UNIT_SECONDS = Number(process.env.FOLLOWUP_WAIT_UNIT_SECONDS ?? 86_400)
const MAX_ATTEMPTS = 5
const RUN_BATCH = 25
// Statuses that mean "stop auto-nudging this contact" regardless of thread. A
// reply/bounce is detected per-thread instead (see stopReason) so a reply on a
// different campaign's thread doesn't silently cancel this one.
const STOP_STATUSES = new Set(['meeting', 'converted', 'spam_reported'])

export interface FollowupStepRow {
  step_index: number
  wait_days: number
  body: string
}

// The campaign's sequence, in step order (empty if it has none).
export async function getCampaignFollowups(campaignId: string): Promise<FollowupStepRow[]> {
  const { data } = await supabase
    .from('campaign_followups')
    .select('step_index, wait_days, body')
    .eq('campaign_id', campaignId)
    .order('step_index', { ascending: true })
  return (data ?? []) as FollowupStepRow[]
}

function dueAt(fromMs: number, waitDays: number): string {
  return new Date(fromMs + waitDays * WAIT_UNIT_SECONDS * 1000).toISOString()
}

// "Re: <subject>" without doubling an existing Re:.
function replySubject(original: string | null): string {
  const s = (original ?? '').trim()
  return /^re:/i.test(s) ? s : `Re: ${s}`
}

// Validate a campaign's follow-up step bodies against its audience (same
// block-if-missing rule as the initial send). Subjects are derived from the
// original (already validated), so only bodies are checked.
export async function validateFollowups(
  campaignId: string,
  contacts: RenderableContact[]
): Promise<BulkValidation> {
  const steps = await getCampaignFollowups(campaignId)
  if (steps.length === 0) return { ok: true, unknownTags: [], offenders: [] }
  const combinedBody = steps.map((s) => s.body).join('\n')
  return validateBulk('', combinedBody, contacts)
}

// Arm the first follow-up step for a recipient right after their initial send.
// No-op if the campaign has no sequence or a pending step already exists.
export async function armFollowups(
  campaignId: string,
  contactId: string,
  sentEmailId: string
): Promise<void> {
  const steps = await getCampaignFollowups(campaignId)
  if (steps.length === 0) return

  // Already armed? (defensive — the partial unique index also guarantees this).
  const { data: existing } = await supabase
    .from('followup_jobs')
    .select('id')
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactId)
    .eq('status', 'pending')
    .limit(1)
  if (existing && existing.length > 0) return

  // Thread to reply into comes from the initial send.
  const { data: sent } = await supabase
    .from('sent_emails')
    .select('thread_id')
    .eq('id', sentEmailId)
    .single()
  const threadId = sent?.thread_id
  if (!threadId) return

  const step0 = steps[0]
  const { error } = await supabase.from('followup_jobs').insert({
    campaign_id: campaignId,
    contact_id: contactId,
    step_index: step0.step_index,
    thread_id: threadId,
    due_at: dueAt(Date.now(), step0.wait_days),
    status: 'pending',
  })
  // 23505 = a pending row already exists (raced) — fine, it's armed.
  if (error && error.code !== '23505') {
    throw new Error(`Failed to arm follow-up: ${error.message}`)
  }
}

// Why this contact's sequence should stop now, or null to proceed. Stops on a
// reply/bounce recorded on THIS thread, or a manual/terminal contact status.
async function stopReason(contactId: string, threadId: string): Promise<string | null> {
  const { data: contact } = await supabase
    .from('contacts')
    .select('status')
    .eq('id', contactId)
    .single()
  if (contact && STOP_STATUSES.has(contact.status)) return contact.status

  const { data: sentRows } = await supabase
    .from('sent_emails')
    .select('id')
    .eq('thread_id', threadId)
  const sentIds = (sentRows ?? []).map((r) => r.id)
  if (sentIds.length > 0) {
    const { data: events } = await supabase
      .from('email_events')
      .select('event_type')
      .in('sent_email_id', sentIds)
      .in('event_type', ['replied', 'bounce'])
      .limit(1)
    if (events && events.length > 0) return events[0].event_type
  }
  return null
}

interface FollowupJobRow {
  id: string
  campaign_id: string
  contact_id: string
  step_index: number
  thread_id: string
  attempts: number
}

// Process all due follow-up steps (up to RUN_BATCH). Called every ~minute by the
// scheduler (Cloud Scheduler in prod; a loop/manual call in dev).
export async function runDueFollowups(): Promise<{
  claimed: number
  sent: number
  canceled: number
  failed: number
  requeued: number
}> {
  const nowIso = new Date().toISOString()
  const { data: due } = await supabase
    .from('followup_jobs')
    .select('id, campaign_id, contact_id, step_index, thread_id, attempts')
    .eq('status', 'pending')
    .lte('due_at', nowIso)
    .order('due_at', { ascending: true })
    .limit(RUN_BATCH)

  const jobs = (due ?? []) as FollowupJobRow[]
  let claimed = 0
  let sent = 0
  let canceled = 0
  let failed = 0
  let requeued = 0

  for (const job of jobs) {
    // Atomic claim: only one worker can flip pending -> sending.
    const { data: claimedRows } = await supabase
      .from('followup_jobs')
      .update({ status: 'sending' })
      .eq('id', job.id)
      .eq('status', 'pending')
      .select('id')
    if (!claimedRows || claimedRows.length === 0) continue // someone else got it
    claimed++

    // Stop the chain if they've replied/bounced on this thread or been progressed.
    const reason = await stopReason(job.contact_id, job.thread_id)
    if (reason) {
      await supabase
        .from('followup_jobs')
        .update({ status: 'canceled', last_error: `stopped: ${reason}` })
        .eq('id', job.id)
      canceled++
      continue
    }

    // Load the step body, the recipient, and the campaign subject for "Re:".
    const [{ data: step }, { data: contact }, { data: campaign }] = await Promise.all([
      supabase
        .from('campaign_followups')
        .select('wait_days, body')
        .eq('campaign_id', job.campaign_id)
        .eq('step_index', job.step_index)
        .single(),
      supabase.from('contacts').select('id, email, name, company').eq('id', job.contact_id).single(),
      supabase.from('campaigns').select('subject').eq('id', job.campaign_id).single(),
    ])

    if (!step || !contact) {
      await supabase
        .from('followup_jobs')
        .update({ status: 'failed', last_error: 'step or contact missing' })
        .eq('id', job.id)
      failed++
      continue
    }

    // Deterministic merge-tag failure: mark failed (retrying won't help).
    const validation = validateBulk('', step.body, [contact as RenderableContact])
    if (!validation.ok) {
      await supabase
        .from('followup_jobs')
        .update({ status: 'failed', last_error: 'send_blocked: missing/unknown merge tags' })
        .eq('id', job.id)
      failed++
      continue
    }

    try {
      const sentEmailId = await performSend({
        contactId: contact.id,
        to: (contact as RenderableContact).email,
        subject: replySubject(renderTemplate(campaign?.subject ?? '', contact as RenderableContact)),
        body: renderTemplate(step.body, contact as RenderableContact),
        campaignId: job.campaign_id,
        threadId: job.thread_id,
      })
      await supabase
        .from('followup_jobs')
        .update({ status: 'sent', sent_email_id: sentEmailId, attempts: job.attempts + 1 })
        .eq('id', job.id)
      sent++

      // Arm the next step relative to THIS send (lazy chaining).
      const steps = await getCampaignFollowups(job.campaign_id)
      const next = steps.find((s) => s.step_index === job.step_index + 1)
      if (next) {
        await supabase.from('followup_jobs').insert({
          campaign_id: job.campaign_id,
          contact_id: job.contact_id,
          step_index: next.step_index,
          thread_id: job.thread_id,
          due_at: dueAt(Date.now(), next.wait_days),
          status: 'pending',
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown_error'
      const attempts = job.attempts + 1
      if (attempts >= MAX_ATTEMPTS) {
        await supabase
          .from('followup_jobs')
          .update({ status: 'failed', attempts, last_error: message })
          .eq('id', job.id)
        failed++
      } else {
        // Back off ~2 min and retry on a later tick.
        await supabase
          .from('followup_jobs')
          .update({
            status: 'pending',
            attempts,
            last_error: message,
            due_at: new Date(Date.now() + 120_000).toISOString(),
          })
          .eq('id', job.id)
        requeued++
      }
    }
  }

  return { claimed, sent, canceled, failed, requeued }
}
