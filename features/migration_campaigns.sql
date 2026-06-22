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
