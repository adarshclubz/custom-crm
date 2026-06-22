import { supabase } from '@/lib/supabase'

// Read model for the inbox UI: conversations grouped by Gmail thread, each a
// merged timeline of our outbound sends (sent_emails) and inbound replies
// (email_events of type 'replied').

export interface ConversationMessage {
  direction: 'outbound' | 'inbound'
  at: string
  subject: string | null
  from: string | null
  body: string | null
  providerMessageId: string | null
}

export interface ThreadSummary {
  threadId: string
  contact: { id: string; name: string | null; email: string; company: string | null; status: string }
  subject: string | null
  messageCount: number
  replyCount: number
  lastActivityAt: string
  lastSnippet: string | null
}

interface SentRow {
  id: string
  contact_id: string
  thread_id: string
  subject: string | null
  body: string | null
  provider_message_id: string | null
  sent_at: string
}

interface ContactRow {
  id: string
  name: string | null
  email: string
  company: string | null
  status: string
}

interface ReplyRow {
  sent_email_id: string
  occurred_at: string
  raw_payload: { from?: string; subject?: string; body?: string; snippet?: string } | null
}

async function loadThreadData() {
  const { data: sent, error: sErr } = await supabase
    .from('sent_emails')
    .select('id, contact_id, thread_id, subject, body, provider_message_id, sent_at')
    .not('thread_id', 'is', null)
    .order('sent_at', { ascending: true })
  if (sErr) throw new Error(sErr.message)
  const sentRows = (sent ?? []) as SentRow[]

  const contactIds = [...new Set(sentRows.map((r) => r.contact_id))]
  const sentEmailIds = sentRows.map((r) => r.id)

  const { data: contacts } = contactIds.length
    ? await supabase.from('contacts').select('id, name, email, company, status').in('id', contactIds)
    : { data: [] }
  const contactById = new Map((contacts as ContactRow[] ?? []).map((c) => [c.id, c]))

  const { data: replies } = sentEmailIds.length
    ? await supabase
        .from('email_events')
        .select('sent_email_id, occurred_at, raw_payload')
        .eq('event_type', 'replied')
        .in('sent_email_id', sentEmailIds)
    : { data: [] }
  const replyRows = (replies as ReplyRow[]) ?? []

  // Map each sent_email -> its thread so replies can be attributed to a thread.
  const threadOfSentEmail = new Map(sentRows.map((r) => [r.id, r.thread_id]))

  return { sentRows, contactById, replyRows, threadOfSentEmail }
}

export async function listThreads(): Promise<ThreadSummary[]> {
  const { sentRows, contactById, replyRows, threadOfSentEmail } = await loadThreadData()

  const summaries = new Map<string, ThreadSummary>()

  for (const r of sentRows) {
    const existing = summaries.get(r.thread_id)
    const contact = contactById.get(r.contact_id)
    if (!existing) {
      summaries.set(r.thread_id, {
        threadId: r.thread_id,
        contact: contact
          ? { id: contact.id, name: contact.name, email: contact.email, company: contact.company, status: contact.status }
          : { id: r.contact_id, name: null, email: '', company: null, status: 'unknown' },
        subject: r.subject,
        messageCount: 1,
        replyCount: 0,
        lastActivityAt: r.sent_at,
        lastSnippet: (r.body ?? '').slice(0, 140),
      })
    } else {
      existing.messageCount++
      if (r.sent_at > existing.lastActivityAt) {
        existing.lastActivityAt = r.sent_at
        existing.lastSnippet = (r.body ?? '').slice(0, 140)
      }
    }
  }

  for (const reply of replyRows) {
    const threadId = threadOfSentEmail.get(reply.sent_email_id)
    if (!threadId) continue
    const s = summaries.get(threadId)
    if (!s) continue
    s.messageCount++
    s.replyCount++
    if (reply.occurred_at > s.lastActivityAt) {
      s.lastActivityAt = reply.occurred_at
      s.lastSnippet = (reply.raw_payload?.body ?? reply.raw_payload?.snippet ?? '').slice(0, 140)
    }
  }

  return [...summaries.values()].sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1))
}

export async function getThread(threadId: string): Promise<{
  threadId: string
  contact: ThreadSummary['contact'] | null
  messages: ConversationMessage[]
} | null> {
  const { sentRows, contactById, replyRows, threadOfSentEmail } = await loadThreadData()

  const threadSent = sentRows.filter((r) => r.thread_id === threadId)
  if (threadSent.length === 0) return null

  const contact = contactById.get(threadSent[0].contact_id) ?? null
  const messages: ConversationMessage[] = []

  for (const r of threadSent) {
    messages.push({
      direction: 'outbound',
      at: r.sent_at,
      subject: r.subject,
      from: null,
      body: r.body,
      providerMessageId: r.provider_message_id,
    })
  }

  for (const reply of replyRows) {
    if (threadOfSentEmail.get(reply.sent_email_id) !== threadId) continue
    messages.push({
      direction: 'inbound',
      at: reply.occurred_at,
      subject: reply.raw_payload?.subject ?? null,
      from: reply.raw_payload?.from ?? null,
      body: reply.raw_payload?.body ?? reply.raw_payload?.snippet ?? null,
      providerMessageId: null,
    })
  }

  messages.sort((a, b) => (a.at < b.at ? -1 : 1))

  return {
    threadId,
    contact: contact
      ? { id: contact.id, name: contact.name, email: contact.email, company: contact.company, status: contact.status }
      : null,
    messages,
  }
}
