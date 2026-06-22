# 02 · Compose & Send — Flows

Status: 📝 Draft (rough outline)

## User flow: single send (Gmail)
1. User selects one contact (from table or side panel) → "Send email".
2. Compose: subject + body, with the contact's fields available to personalize manually.
3. Send → `POST /api/send/single`.
4. Confirmation; the new send appears in the contact's history.

## User flow: bulk send (SendGrid)
1. User multi-selects contacts in the table.
2. Chooses/writes a template (subject + body with `{{name}}`, `{{company}}`).
3. Optional: preview rendered output for a sample contact.
4. Send → `POST /api/send/bulk`.
5. Result summary: queued / failed counts.

## System / data flow — single (Gmail)
- `POST /api/send/single` → build MIME message → Gmail API `users.messages.send` (via
  connected account, `gmail.send` scope).
- Capture returned `messageId` + `threadId`.
- Insert `sent_emails` (`sent_via='gmail'`, `provider_message_id=messageId`, `thread_id`).
- Update contact `status='sent'`, `last_contacted_at=now()`.

## System / data flow — bulk (SendGrid)
- `POST /api/send/bulk` → for each contact, render template via `lib/templates.ts`.
- Send via SendGrid (personalizations or per-recipient calls — TBD).
- Capture `sg_message_id` per message.
- Insert one `sent_emails` row per recipient (`sent_via='sendgrid'`, no `thread_id`).
- Update each contact `status='sent'`, `last_contacted_at=now()`.

## Edge cases
- Gmail not connected → block single send, prompt to connect (feature 04).
- Missing `{{company}}` for a contact → fallback rule (blank? skip? placeholder?).
- Partial bulk failure → record successes, report failures per-recipient.
- Contact already `replied`/`bounced` → warn before re-sending? (open Q)
- Send to invalid/bounced address → surfaced later via tracking, not at send time.

## Error / empty states
- No contacts selected for bulk → disabled send.
- Empty subject/body → validation.
- Provider API error → surface message, do not write a `sent_emails` row.
