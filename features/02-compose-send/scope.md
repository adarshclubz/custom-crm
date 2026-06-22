# 02 · Compose & Send — Scope

Status: 📝 Updated — Gmail-only; SendGrid dropped.

## Purpose
Send outreach email via Gmail in two modes: **1:1 personal** (single contact) and **bulk
personalized** (multiple contacts, each gets a rendered, individually-sent plain-text email
that looks and behaves like a personal email). Every send is threaded so follow-ups and
replies work. Every send is recorded so tracking and history work.

## In scope
- **Single send:** pick one contact, write/personalize subject + body, send via the
  OAuth-connected Gmail account. Appears in recipient's inbox as a normal, reply-able email.
- **Bulk send:** select multiple contacts + a plain-text template containing `{{name}}` /
  `{{company}}` merge tags. Validate all merge values are present before sending anything.
  Render each contact's body individually and send one Gmail `messages.send` call per
  contact with a random 60–180 s stagger between sends.
- **Follow-up (threaded):** send a new message into an existing Gmail thread using the
  stored `thread_id` + `In-Reply-To` / `References` headers, so it appears as a continued
  thread in the recipient's inbox.
- **Follow-up (new thread):** after the thread-based follow-ups are exhausted (user's
  choice), send a fresh email as a new thread.
- Persist **every** send to `sent_emails`: `contact_id`, `subject`, `body` (rendered),
  `sent_via='gmail'`, `provider_message_id`, `thread_id`, `sent_at`.
- Update `contacts.last_contacted_at` and set status to `sent` on first dispatch.
- **Daily send cap:** check and enforce `DAILY_SEND_CAP` before starting a bulk queue.
  Reject the request if it would exceed the cap.

## Out of scope
- Automated sequences / drip / scheduling (explicit non-goal).
- AI-generated personalization (explicit non-goal — body comes in pre-written).
- Rich WYSIWYG editor (plain text only for v1).
- Attachments (out for v1).
- Open/click tracking (Gmail does not support tracking pixels/link wrapping in this mode).

## Merge tag behavior
- Supported tags: `{{name}}`, `{{company}}` (extensible).
- If **any** contact in a bulk send is missing a value for a tag referenced in the template,
  the **entire send is blocked** before any email goes out. The API returns a list of
  offending contacts and the fields they are missing. The user fixes the data and retries.

## Data touched
- Writes `sent_emails` (owner). Reads `contacts`. Updates `contacts.status` + `last_contacted_at`.
- See [data-schema.md](../../shared/data-schema.md).

## Dependencies
- Contacts must exist (feature 01).
- Gmail OAuth connection must be active (feature 04 / integrations).
- Merge-tag rendering helper (`lib/templates.ts`).
- Staggered send queue (`lib/queue.ts`).

## Acceptance criteria
- [ ] Single send delivers via Gmail and the message threads correctly (reply-able).
- [ ] Bulk send validates all merge values before sending — blocked if any are missing.
- [ ] Bulk send renders `{{name}}`/`{{company}}` per contact and dispatches one Gmail call per contact.
- [ ] Sends are staggered with a random 60–180 s delay; daily cap is enforced.
- [ ] Each send writes one `sent_emails` row with `provider_message_id` and `thread_id`.
- [ ] Contact status flips to `sent` and `last_contacted_at` updates.
- [ ] Threaded follow-up sends arrive in the same thread in the recipient's inbox.
- [ ] New-thread follow-up sends create a fresh thread and store the new `thread_id`.
