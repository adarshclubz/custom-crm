import { supabase } from '@/lib/supabase'

// Single source of truth for lead status precedence. Every place that mutates
// contacts.status (send queue, reply poller, manual endpoint) routes through
// here so a human-set stage is never silently downgraded by an automated event.

export type ContactStatus =
  | 'not_contacted'
  | 'sent'
  | 'opened'
  | 'clicked'
  | 'replied'
  | 'meeting'
  | 'converted'
  | 'bounced'
  | 'spam_reported'

// Progression ranks (advance-only). opened/clicked are reserved/unused for
// Gmail but ranked for completeness.
const RANK: Record<string, number> = {
  not_contacted: 0,
  sent: 1,
  opened: 2,
  clicked: 3,
  replied: 4,
  meeting: 5,
  converted: 6,
}

const ERROR_STATES = new Set<string>(['bounced', 'spam_reported'])
const HUMAN_TERMINAL = new Set<string>(['meeting', 'converted'])

// Statuses a human may set manually.
export const MANUAL_STATUSES: ContactStatus[] = ['meeting', 'converted']

// Given the current status and an incoming automated event, return the status
// to set, or null if it would be a no-op / a regression.
export function nextStatus(current: string, incoming: ContactStatus): ContactStatus | null {
  if (current === incoming) return null
  // Error states are sticky: only a manual override can move off them.
  if (ERROR_STATES.has(current)) return null
  if (ERROR_STATES.has(incoming)) {
    // Don't let an automated bounce clobber a human-judged meeting/converted.
    if (HUMAN_TERMINAL.has(current)) return null
    return incoming
  }
  const c = RANK[current] ?? 0
  const n = RANK[incoming] ?? 0
  return n > c ? incoming : null
}

// Read-modify-write a contact's status from an automated event. No-op unless it
// is a genuine advance. The conditional update guards against lost updates.
export async function applyAutoStatus(contactId: string, incoming: ContactStatus): Promise<void> {
  const { data } = await supabase.from('contacts').select('status').eq('id', contactId).single()
  if (!data) return
  const next = nextStatus(data.status, incoming)
  if (!next) return
  await supabase
    .from('contacts')
    .update({ status: next })
    .eq('id', contactId)
    .eq('status', data.status)
}
