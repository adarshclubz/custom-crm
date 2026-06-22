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
