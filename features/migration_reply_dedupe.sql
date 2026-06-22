-- Gmail Integration — Phase 6: reply-event dedupe
-- Run in the Supabase SQL editor. Idempotent.
-- provider_event_id = the Gmail messageId of the inbound reply. A partial
-- unique index makes it impossible to record the same reply twice.

alter table email_events add column if not exists provider_event_id text;

create unique index if not exists email_events_provider_event_id_key
  on email_events (provider_event_id)
  where provider_event_id is not null;
