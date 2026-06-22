# 03 · Tracking (Gmail Reply & Delivery) — Scope

Status: 📝 Updated — SendGrid webhook dropped; tracking is now Gmail thread polling only.

## Purpose
Know what happened to sent emails. Poll Gmail threads for inbound replies, record events,
and keep each contact's status current. Open/click tracking is not available for Gmail
sends — the contact status reflects delivery and reply state only.

## In scope
- Periodically poll Gmail threads (keyed by `thread_id` in `sent_emails`) for new inbound
  messages from the recipient (not our own sends).
- On reply detected: append `email_events` row (`event_type='replied'`, `occurred_at`,
  `raw_payload` with reply body + headers), update `contacts.status='replied'`.
- On delivery failure (bounce) surfaced via Gmail send error or NDR message in thread:
  append `email_events` row (`event_type='bounce'`), update `contacts.status='bounced'`.
- On spam report (recipient marks as spam, surfaced via NDR): append `email_events` row
  (`event_type='spam_report'`), update `contacts.status='spam_reported'`.
- Deduplicate: already-processed reply message IDs must not create duplicate events.
- Surface reply text in the dashboard so the user can read and respond without opening Gmail.

## Out of scope
- Open/click tracking (not technically available for plain-text Gmail sends).
- Real-time push to the UI (dashboard reads on load/refresh for v1).
- Full inbox sync / labeling.

## Status derivation
See [data-schema.md](../../shared/data-schema.md) for the full status priority table.
Summary: `sent` → `replied` on positive reply; `bounced` / `spam_reported` are terminal.

## Data touched
- Reads `sent_emails` (rows with `thread_id`, `sent_via='gmail'`).
- Writes `email_events` (owner). Updates `contacts.status`.
- See [data-schema.md](../../shared/data-schema.md).

## Dependencies
- `sent_emails` rows must carry `thread_id` (feature 02 sends).
- Gmail OAuth token must be valid (feature 04).
- A scheduler triggers `/api/poll/replies` (GCP Cloud Scheduler or equivalent).

## Acceptance criteria
- [ ] Poller finds new inbound messages in tracked Gmail threads.
- [ ] Own sent messages are not mistaken for replies.
- [ ] Each detected reply creates one `email_events` row and updates contact status to `replied`.
- [ ] Reply text is readable in the dashboard without opening Gmail.
- [ ] Already-processed message IDs are not recorded twice.
- [ ] Bounce/NDR detection creates `bounced` event and updates contact status.
- [ ] Unknown thread states are ignored gracefully.
