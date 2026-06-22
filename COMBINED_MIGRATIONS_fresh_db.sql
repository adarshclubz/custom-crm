-- Combined migrations for a FRESH Supabase project — dependency-ordered.
-- Generated 2026-06-22. Run top-to-bottom in the Supabase SQL editor.


-- ======================================================================
-- 01-contacts/migration_contacts.sql
-- ======================================================================
-- Run in Supabase SQL editor
-- Creates the contacts table (and its status enum)

create type contact_status as enum (
  'not_contacted',
  'sent',
  'opened',
  'clicked',
  'replied',
  'bounced'
);

create table contacts (
  id                uuid primary key default gen_random_uuid(),
  name              text,
  email             text not null,
  company           text,
  tags              text[] not null default '{}',
  status            contact_status not null default 'not_contacted',
  last_contacted_at timestamptz,
  linkedin          text,
  instagram         text,
  created_at        timestamptz not null default now(),

  constraint contacts_email_unique unique (email)
);

-- Indexes for the filters we know we'll use
create index on contacts (status);
create index on contacts (last_contacted_at);
create index on contacts using gin (tags);


-- ======================================================================
-- migration_contact_groups.sql
-- ======================================================================
-- Campaigns & Groups — Phase 1: contact groups (one per CSV upload)
-- Run in the Supabase SQL editor. Idempotent.

create table if not exists contact_groups (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  source_filename text,
  created_at      timestamptz not null default now()
);

-- A contact belongs to at most one group (the latest CSV it arrived in).
-- Existing rows stay null = "ungrouped".
alter table contacts
  add column if not exists group_id uuid references contact_groups (id) on delete set null;

create index if not exists contacts_group_id_idx on contacts (group_id);


-- ======================================================================
-- migration_status_stages.sql
-- ======================================================================
-- Campaigns & Groups — Phase 2: lead lifecycle stages
-- Run in the Supabase SQL editor. Idempotent.
-- meeting + converted are manual-only stages above 'replied'.
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block; the Supabase
-- SQL editor runs statements individually, so run these one at a time if needed.

alter type contact_status add value if not exists 'meeting';
alter type contact_status add value if not exists 'converted';


-- ======================================================================
-- migration_gmail.sql
-- ======================================================================
-- Gmail Integration — Phase 1: DB Foundation
-- Run in the Supabase SQL editor.
-- Idempotent: safe to run whether or not objects already exist.
-- Assumes `contacts` + `contact_status` enum already exist (feature 01).

-- ---------------------------------------------------------------------------
-- 1. Extend contact_status with the spam_reported terminal state.
--    (opened/clicked/bounced already exist from feature 01 and are left as-is.)
--    ALTER TYPE ... ADD VALUE cannot run inside a transaction block; the
--    Supabase SQL editor runs statements individually, so this is fine.
-- ---------------------------------------------------------------------------
alter type contact_status add value if not exists 'spam_reported';

-- ---------------------------------------------------------------------------
-- 2. New enums.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'send_channel') then
    create type send_channel as enum ('gmail');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'event_type') then
    create type event_type as enum (
      'delivered',
      'open',
      'click',
      'bounce',
      'spam_report',
      'replied'
    );
  end if;
end$$;

-- ---------------------------------------------------------------------------
-- 3. sent_emails — one row per email we dispatch.
-- ---------------------------------------------------------------------------
create table if not exists sent_emails (
  id                  uuid primary key default gen_random_uuid(),
  contact_id          uuid not null references contacts (id) on delete cascade,
  subject             text,
  body                text,                          -- rendered plain-text body actually sent
  sent_via            send_channel not null default 'gmail',
  provider_message_id text,                          -- Gmail messageId
  thread_id           text,                          -- Gmail threadId (follow-ups + reply polling)
  sent_at             timestamptz not null default now()
);

create index if not exists sent_emails_contact_id_idx          on sent_emails (contact_id);
create index if not exists sent_emails_provider_message_id_idx on sent_emails (provider_message_id);
create index if not exists sent_emails_thread_id_idx           on sent_emails (thread_id);

-- ---------------------------------------------------------------------------
-- 4. email_events — inbound events (replies, bounces, etc.) per sent email.
-- ---------------------------------------------------------------------------
create table if not exists email_events (
  id            uuid primary key default gen_random_uuid(),
  sent_email_id uuid not null references sent_emails (id) on delete cascade,
  event_type    event_type not null,
  occurred_at   timestamptz not null default now(),
  raw_payload   jsonb                                -- full event data (reply body, headers, etc.)
);

create index if not exists email_events_sent_email_id_idx on email_events (sent_email_id);
create index if not exists email_events_event_type_idx    on email_events (event_type);

-- ---------------------------------------------------------------------------
-- 5. gmail_tokens — the connected sending account's OAuth tokens.
--    refresh_token is stored encrypted at the application layer (Option A).
--    Single connected account for v1.
-- ---------------------------------------------------------------------------
create table if not exists gmail_tokens (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  refresh_token text not null,                       -- encrypted at rest (app layer)
  access_token  text,                                -- cached; refreshed automatically
  token_expiry  timestamptz,
  connected_at  timestamptz not null default now(),

  constraint gmail_tokens_email_unique unique (email)
);


-- ======================================================================
-- migration_send_jobs.sql
-- ======================================================================
-- Gmail Integration — Phase 5: durable send outbox (Option A)
-- Run in the Supabase SQL editor. Idempotent.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'send_job_status') then
    create type send_job_status as enum ('pending', 'sending', 'sent', 'failed');
  end if;
end$$;

create table if not exists send_jobs (
  id            uuid primary key default gen_random_uuid(),
  contact_id    uuid not null references contacts (id) on delete cascade,
  to_email      text not null,
  subject       text not null,
  body          text not null,                 -- already rendered (post merge-tag)
  thread_id     text,                          -- set for threaded follow-ups
  in_reply_to   text,                          -- RFC Message-ID being replied to
  references_header text,                       -- accumulated References header
  scheduled_at  timestamptz not null,          -- when this one is due to send (stagger)
  status        send_job_status not null default 'pending',
  attempts      int not null default 0,
  last_error    text,
  sent_email_id uuid references sent_emails (id) on delete set null,
  batch_id      uuid,                          -- groups one bulk request
  created_at    timestamptz not null default now()
);

-- The drainer's hot query: due, still-pending jobs in time order.
create index if not exists send_jobs_due_idx
  on send_jobs (scheduled_at)
  where status = 'pending';

create index if not exists send_jobs_batch_idx on send_jobs (batch_id);
create index if not exists send_jobs_contact_idx on send_jobs (contact_id);


-- ======================================================================
-- migration_campaigns.sql
-- ======================================================================
-- Campaigns & Groups — Phase 3: campaigns core
-- Run in the Supabase SQL editor. Idempotent.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'campaign_type') then
    create type campaign_type as enum ('bulk', 'single');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'campaign_status') then
    -- draft -> sending -> sent (sent is the end state; no separate "completed")
    create type campaign_status as enum ('draft', 'sending', 'sent');
  end if;
end$$;

create table if not exists campaigns (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  type       campaign_type not null,
  subject    text,
  body       text,
  status     campaign_status not null default 'draft',
  created_at timestamptz not null default now()
);

-- The explicit recipient list selected for a campaign.
create table if not exists campaign_recipients (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id) on delete cascade,
  contact_id  uuid not null references contacts (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint campaign_recipients_unique unique (campaign_id, contact_id)
);

create index if not exists campaign_recipients_campaign_idx on campaign_recipients (campaign_id);

-- Tie each send to its campaign (nullable: existing rows + non-campaign sends).
alter table sent_emails add column if not exists campaign_id uuid references campaigns (id) on delete set null;
alter table send_jobs  add column if not exists campaign_id uuid references campaigns (id) on delete set null;

create index if not exists sent_emails_campaign_idx on sent_emails (campaign_id);
create index if not exists send_jobs_campaign_idx on send_jobs (campaign_id);


-- ======================================================================
-- migration_schedule_send.sql
-- ======================================================================
-- Schedule Send — Phase 1: scheduling support for the send outbox
-- Run in the Supabase SQL editor. Idempotent.
--
-- Lets a campaign send (single or bulk) and a manual follow-up be queued for a
-- user-chosen future time instead of going out immediately. Timing lives on the
-- existing send_jobs.scheduled_at column; this migration only adds the status
-- values and the flag needed to model and surface a deliberate schedule.

-- 'scheduled' campaign status: queued for a future send, not yet draining.
-- (existing: draft -> sending -> sent)
alter type campaign_status add value if not exists 'scheduled';

-- 'canceled' send-job status: a pending scheduled job the user called off
-- before it fired. (existing: pending -> sending -> sent -> failed)
alter type send_job_status add value if not exists 'canceled';

-- Marks a batch as intentionally user-scheduled (vs. an ordinary paced bulk),
-- so the "view the schedule" list shows only deliberate schedules.
alter table send_jobs
  add column if not exists scheduled boolean not null default false;


-- ======================================================================
-- migration_followups.sql
-- ======================================================================
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


-- ======================================================================
-- migration_reply_dedupe.sql
-- ======================================================================
-- Gmail Integration — Phase 6: reply-event dedupe
-- Run in the Supabase SQL editor. Idempotent.
-- provider_event_id = the Gmail messageId of the inbound reply. A partial
-- unique index makes it impossible to record the same reply twice.

alter table email_events add column if not exists provider_event_id text;

create unique index if not exists email_events_provider_event_id_key
  on email_events (provider_event_id)
  where provider_event_id is not null;
