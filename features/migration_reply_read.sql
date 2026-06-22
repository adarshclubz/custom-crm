-- migration_reply_read.sql
-- ---------------------------------------------------------------------------
-- Unread reply tracking.
--
-- A reply (email_events row with event_type = 'replied') is considered UNREAD
-- until it has been opened in the conversation drawer. We track this with a
-- nullable read_at timestamp: NULL = unread, a timestamp = when it was read.
--
-- Existing replies are left unread (read_at stays NULL) so the dot surfaces
-- conversations that arrived before this feature shipped.
-- ---------------------------------------------------------------------------

alter table email_events add column if not exists read_at timestamptz;

-- Fast lookup of unread replies (partial index: only the rows we ever query as
-- "unread"). Used by the per-recipient unread count.
create index if not exists email_events_unread_replies_idx
  on email_events (sent_email_id)
  where event_type = 'replied' and read_at is null;
