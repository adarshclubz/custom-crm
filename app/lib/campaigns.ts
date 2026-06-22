import { supabase } from '@/lib/supabase'

// Read model for campaigns. Per-recipient stats are DERIVED from sent_emails
// (no stats table): follow-up count = sends - 1, first/last reach-out = min/max
// sent_at, status = the lead's current (global) status.

// Glanceable outcome counts for a campaign card. `sent` = distinct contacts actually
// emailed in this campaign (from sent_emails). replied/bounced/meeting/converted are
// tallied from each recipient's current (global) lead status, matching how the
// recipient table reads status elsewhere.
export interface CampaignMetrics {
  sent: number
  replied: number
  bounced: number
  meeting: number
  converted: number
}

export interface CampaignSummary {
  id: string
  name: string
  type: 'bulk' | 'single'
  status: 'draft' | 'scheduled' | 'sending' | 'sent'
  subject: string | null
  createdAt: string
  recipientCount: number
  metrics: CampaignMetrics
}

export async function listCampaigns(): Promise<CampaignSummary[]> {
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id, name, type, status, subject, created_at')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)

  // Recipient lists per campaign (also collect contact ids for status lookup).
  const { data: recips } = await supabase
    .from('campaign_recipients')
    .select('campaign_id, contact_id')
  const recipRows = (recips ?? []) as { campaign_id: string; contact_id: string }[]

  const recipientsByCampaign = new Map<string, string[]>()
  const allContactIds = new Set<string>()
  for (const r of recipRows) {
    const arr = recipientsByCampaign.get(r.campaign_id) ?? []
    arr.push(r.contact_id)
    recipientsByCampaign.set(r.campaign_id, arr)
    allContactIds.add(r.contact_id)
  }

  // Current lead status for every recipient contact.
  const statusByContact = new Map<string, string>()
  if (allContactIds.size) {
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, status')
      .in('id', [...allContactIds])
    for (const c of (contacts ?? []) as { id: string; status: string }[]) {
      statusByContact.set(c.id, c.status)
    }
  }

  // Distinct contacts actually emailed, per campaign — the truthful "sent" count.
  const { data: sends } = await supabase
    .from('sent_emails')
    .select('campaign_id, contact_id')
    .not('campaign_id', 'is', null)
  const sentByCampaign = new Map<string, Set<string>>()
  for (const s of (sends ?? []) as { campaign_id: string | null; contact_id: string }[]) {
    if (!s.campaign_id) continue
    const set = sentByCampaign.get(s.campaign_id) ?? new Set<string>()
    set.add(s.contact_id)
    sentByCampaign.set(s.campaign_id, set)
  }

  return (campaigns ?? []).map((c) => {
    const contactIds = recipientsByCampaign.get(c.id) ?? []
    let replied = 0,
      bounced = 0,
      meeting = 0,
      converted = 0
    for (const id of contactIds) {
      switch (statusByContact.get(id)) {
        case 'replied':
          replied++
          break
        case 'bounced':
          bounced++
          break
        case 'meeting':
          meeting++
          break
        case 'converted':
          converted++
          break
      }
    }
    return {
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      subject: c.subject,
      createdAt: c.created_at,
      recipientCount: contactIds.length,
      metrics: {
        sent: sentByCampaign.get(c.id)?.size ?? 0,
        replied,
        bounced,
        meeting,
        converted,
      },
    }
  })
}

export interface RecipientStat {
  contactId: string
  name: string | null
  email: string
  company: string | null
  status: string
  sentCount: number
  followupCount: number
  firstReachOutAt: string | null
  lastReachOutAt: string | null
  // Gmail thread for this contact within the campaign, if any send has gone out.
  // null until the recipient has been emailed (drafts have no thread yet).
  threadId: string | null
}

// One step of a campaign's automated follow-up sequence, as stored.
export interface FollowupStep {
  stepIndex: number
  waitDays: number
  body: string
}

export async function getCampaignDetail(campaignId: string): Promise<{
  campaign: { id: string; name: string; type: string; status: string; subject: string | null; body: string | null; createdAt: string }
  recipients: RecipientStat[]
  followups: FollowupStep[]
} | null> {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, name, type, status, subject, body, created_at')
    .eq('id', campaignId)
    .single()
  if (!campaign) return null

  // The automated follow-up sequence, in step order.
  const { data: followupRows } = await supabase
    .from('campaign_followups')
    .select('step_index, wait_days, body')
    .eq('campaign_id', campaignId)
    .order('step_index', { ascending: true })
  const followups: FollowupStep[] = (
    (followupRows ?? []) as { step_index: number; wait_days: number; body: string }[]
  ).map((f) => ({ stepIndex: f.step_index, waitDays: f.wait_days, body: f.body }))

  const { data: recipRows } = await supabase
    .from('campaign_recipients')
    .select('contact_id')
    .eq('campaign_id', campaignId)
  const contactIds = (recipRows ?? []).map((r) => r.contact_id)

  const { data: contacts } = contactIds.length
    ? await supabase.from('contacts').select('id, name, email, company, status').in('id', contactIds)
    : { data: [] }

  // Sends within this campaign, for the derived stats (and the contact's thread).
  const { data: sends } = contactIds.length
    ? await supabase
        .from('sent_emails')
        .select('contact_id, sent_at, thread_id')
        .eq('campaign_id', campaignId)
        .in('contact_id', contactIds)
    : { data: [] }

  const byContact = new Map<
    string,
    { count: number; first: string; last: string; threadId: string | null }
  >()
  for (const s of (sends ?? []) as {
    contact_id: string
    sent_at: string
    thread_id: string | null
  }[]) {
    const cur = byContact.get(s.contact_id)
    if (!cur)
      byContact.set(s.contact_id, {
        count: 1,
        first: s.sent_at,
        last: s.sent_at,
        threadId: s.thread_id ?? null,
      })
    else {
      cur.count++
      if (s.sent_at < cur.first) cur.first = s.sent_at
      if (s.sent_at > cur.last) cur.last = s.sent_at
      if (!cur.threadId && s.thread_id) cur.threadId = s.thread_id
    }
  }

  const recipients: RecipientStat[] = (contacts as { id: string; name: string | null; email: string; company: string | null; status: string }[] ?? []).map((c) => {
    const agg = byContact.get(c.id)
    return {
      contactId: c.id,
      name: c.name,
      email: c.email,
      company: c.company,
      status: c.status,
      sentCount: agg?.count ?? 0,
      followupCount: agg ? Math.max(0, agg.count - 1) : 0,
      firstReachOutAt: agg?.first ?? null,
      lastReachOutAt: agg?.last ?? null,
      threadId: agg?.threadId ?? null,
    }
  })

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      type: campaign.type,
      status: campaign.status,
      subject: campaign.subject,
      body: campaign.body,
      createdAt: campaign.created_at,
    },
    recipients,
    followups,
  }
}
