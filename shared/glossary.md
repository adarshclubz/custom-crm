# Shared: Glossary

Shared terminology so all docs use the same words. Status: 📝 Draft.

## Contact status values (`contact_status`)
- **not_contacted** — no email ever sent.
- **sent** — at least one email dispatched, no further event yet.
- **opened** — recipient opened a tracked email (SendGrid open event).
- **clicked** — recipient clicked a tracked link.
- **replied** — recipient replied (detected via Gmail thread polling).
- **bounced** — delivery failed (hard/soft bounce).

Ordering for "furthest progress" derivation:
`not_contacted < sent < opened < clicked < replied`; `bounced` is a separate error state.

## SendGrid event types (`event_type`)
- **delivered** — accepted by recipient mail server.
- **open** — open pixel loaded.
- **click** — tracked link clicked.
- **bounce** — rejected/undeliverable.
- **spam_report** — recipient marked as spam.
- **unsubscribe** — recipient unsubscribed.
- **replied** — (Gmail-derived, not SendGrid) recipient replied in thread.

> Forwards are **not** a trackable event on any provider — explicitly out of scope.

## Identifiers
- **`sg_message_id`** — SendGrid's per-message id; stored in `provider_message_id`; used to
  match inbound webhook events to a `sent_emails` row.
- **Gmail `messageId`** — id of a sent Gmail message; stored in `provider_message_id`.
- **Gmail `threadId`** — conversation id; stored in `thread_id`; polled to detect replies.

## Send channels (`send_channel`)
- **gmail** — 1:1 personalized send via Gmail API (threaded, reply-able).
- **sendgrid** — bulk send via SendGrid API (merge tags, tracked).

## Merge tags
Placeholders rendered per-contact at bulk send time: `{{name}}`, `{{company}}`.

## Dashboard metrics
- **total sent** — count of `sent_emails`.
- **open rate** — distinct opened / delivered (or sent — TBD).
- **click rate** — distinct clicked / delivered (or sent — TBD).
- **reply rate** — distinct replied contacts / contacts emailed.
