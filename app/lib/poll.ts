import type { gmail_v1 } from 'googleapis'
import { getGmailClient } from '@/lib/gmail'
import { supabase } from '@/lib/supabase'
import { applyAutoStatus } from '@/lib/status'

function decodeBody(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

// Pull the first text/plain part out of a Gmail message payload.
function extractPlainText(payload?: gmail_v1.Schema$MessagePart): string {
  if (!payload) return ''
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeBody(payload.body.data)
  }
  for (const part of payload.parts ?? []) {
    const text = extractPlainText(part)
    if (text) return text
  }
  return ''
}

function header(msg: gmail_v1.Schema$Message, name: string): string | null {
  const h = msg.payload?.headers?.find((x) => x.name?.toLowerCase() === name.toLowerCase())
  return h?.value ?? null
}

// A non-delivery report (bounce) arrives in the thread from the mail system.
// Identify it by sender (mailer-daemon/postmaster) or a delivery-status report
// content type — distinct from a genuine recipient reply.
export function isBounce(msg: gmail_v1.Schema$Message): boolean {
  const from = (header(msg, 'from') ?? '').toLowerCase()
  if (from.includes('mailer-daemon@') || from.includes('postmaster@')) return true
  const contentType = (header(msg, 'content-type') ?? '').toLowerCase()
  if (contentType.includes('report-type=delivery-status')) return true
  return false
}

// Poll every thread we've sent on for inbound replies, record new ones as
// email_events, and advance the contact to 'replied'. Safe to run repeatedly:
// the unique provider_event_id index makes reply inserts idempotent.
export async function pollReplies(): Promise<{
  threadsChecked: number
  newReplies: number
  newBounces: number
}> {
  const { gmail, fromEmail } = await getGmailClient()

  const { data: rows, error } = await supabase
    .from('sent_emails')
    .select('id, contact_id, thread_id, sent_at')
    .not('thread_id', 'is', null)
    .order('sent_at', { ascending: true })
  if (error) throw new Error(error.message)

  // One reference sent_email per thread (the earliest = the original).
  const threadRef = new Map<string, { sentEmailId: string; contactId: string }>()
  for (const r of rows ?? []) {
    if (!threadRef.has(r.thread_id)) {
      threadRef.set(r.thread_id, { sentEmailId: r.id, contactId: r.contact_id })
    }
  }

  let threadsChecked = 0
  let newReplies = 0
  let newBounces = 0

  for (const [threadId, ref] of threadRef) {
    threadsChecked++
    const { data: thread } = await gmail.users.threads.get({
      userId: 'me',
      id: threadId,
      format: 'full',
    })

    for (const msg of thread.messages ?? []) {
      const labels = msg.labelIds ?? []
      if (labels.includes('SENT') || labels.includes('DRAFT')) continue // our own message
      const from = header(msg, 'from')

      const bounce = isBounce(msg)
      // A genuine reply is inbound mail that isn't a bounce and isn't from us.
      if (!bounce && from && from.includes(fromEmail)) continue // belt-and-suspenders

      const occurredAt = msg.internalDate
        ? new Date(Number(msg.internalDate)).toISOString()
        : new Date().toISOString()

      const { error: insErr } = await supabase.from('email_events').insert({
        sent_email_id: ref.sentEmailId,
        event_type: bounce ? 'bounce' : 'replied',
        occurred_at: occurredAt,
        provider_event_id: msg.id,
        raw_payload: {
          from,
          subject: header(msg, 'subject'),
          snippet: msg.snippet,
          body: extractPlainText(msg.payload),
          messageId: header(msg, 'message-id'),
        },
      })

      if (insErr) {
        if (insErr.code === '23505') continue // already recorded (dedupe)
        throw new Error(insErr.message)
      }

      if (bounce) {
        newBounces++
        // Bounce via precedence helper (won't clobber a human meeting/converted).
        await applyAutoStatus(ref.contactId, 'bounced')
      } else {
        newReplies++
        // Advance to replied; helper guards against regression.
        await applyAutoStatus(ref.contactId, 'replied')
      }

      // A reply or bounce ends any pending automated follow-up for this thread.
      // The follow-up worker also checks this lazily at dispatch (stopReason),
      // so this is a proactive cleanup that avoids a wasted tick.
      await supabase
        .from('followup_jobs')
        .update({ status: 'canceled', last_error: `stopped: ${bounce ? 'bounce' : 'replied'}` })
        .eq('thread_id', threadId)
        .eq('status', 'pending')
    }
  }

  return { threadsChecked, newReplies, newBounces }
}
