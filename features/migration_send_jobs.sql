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
