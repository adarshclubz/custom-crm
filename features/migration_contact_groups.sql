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
