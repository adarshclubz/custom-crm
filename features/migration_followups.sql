-- Automated follow-up sequences — Phase A: schema
-- Run in the Supabase SQL editor. Idempotent.
--
-- Two tables:
--   campaign_followups — the sequence DEFINITION attached to a campaign
--                        (ordered steps: "wait N days, if no reply, send this").
--   followup_jobs      — per-recipient SCHEDULING state. At most one 'pending'
--                        row per (campaign, contact) at a time: the next due
--                        step. When it sends, the following step's row is created
--                        relative to that actual send time.

-- ---------------------------------------------------------------------------
-- Sequence definition
-- ---------------------------------------------------------------------------
create table if not exists campaign_followups (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  step_index  int  not null,                       -- 0-based order within the campaign
  wait_days   int  not null check (wait_days >= 1), -- days after the PREVIOUS email
  body        text not null,                        -- template body (merge tags allowed)
  created_at  timestamptz not null default now(),
  constraint campaign_followups_step_unique unique (campaign_id, step_index)
);

create index if not exists campaign_followups_campaign_idx
  on campaign_followups (campaign_id);

-- ---------------------------------------------------------------------------
-- Per-recipient scheduling state
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'followup_status') then
    -- pending -> sending -> sent ; canceled = stopped by a reply/terminal status ;
    -- failed = exhausted retries.
    create type followup_status as enum ('pending', 'sending', 'sent', 'canceled', 'failed');
  end if;
end$$;

create table if not exists followup_jobs (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid not null references campaigns (id) on delete cascade,
  contact_id    uuid not null references contacts (id) on delete cascade,
  step_index    int  not null,                  -- which campaign_followups step this is
  thread_id     text not null,                  -- the Gmail thread to reply into
  due_at        timestamptz not null,           -- when this step is due to send
  status        followup_status not null default 'pending',
  attempts      int  not null default 0,
  last_error    text,
  sent_email_id uuid references sent_emails (id) on delete set null,
  created_at    timestamptz not null default now()
);

-- The worker's hot query: due, still-pending follow-ups in time order.
create index if not exists followup_jobs_due_idx
  on followup_jobs (due_at)
  where status = 'pending';

create index if not exists followup_jobs_contact_idx on followup_jobs (contact_id);
create index if not exists followup_jobs_campaign_idx on followup_jobs (campaign_id);

-- Enforce "at most one pending step per recipient per campaign" so the lazy
-- chaining can never double-schedule a contact.
create unique index if not exists followup_jobs_one_pending
  on followup_jobs (campaign_id, contact_id)
  where status = 'pending';
