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
