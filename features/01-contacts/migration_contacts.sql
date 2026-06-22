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
