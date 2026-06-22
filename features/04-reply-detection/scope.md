# 04 · Gmail OAuth & Inbox — Scope

Status: 📝 Updated — scope expanded: now owns OAuth, reply detection, reply reading,
and responding from within the CRM. SendGrid references removed.

## Purpose
Own the Gmail connection that powers **all** sends (single, bulk, follow-up) and the
**inbox-in-CRM** experience: poll threads for inbound replies, surface reply content, and
allow the user to respond from the CRM without ever opening Gmail.

## In scope
- **Gmail OAuth2 connection flow** (connect/disconnect the sending account).
  - Scopes: `gmail.send` + `gmail.readonly`.
  - Store refresh token securely (see [integrations.md](../../shared/integrations.md)).
- **Reply polling:** periodically poll Gmail API for new messages in tracked threads
  (`sent_emails.thread_id`). Detect inbound messages (from recipient, not our own sends).
- **Reply storage:** persist reply body + metadata in `email_events.raw_payload`; update
  `contacts.status='replied'`.
- **Reply reading in CRM:** dashboard surfaces the reply text so the user can read it
  without opening Gmail.
- **Responding from CRM:** user composes a reply in the CRM; sent via Gmail API with correct
  `In-Reply-To` / `References` headers to stay in-thread. Persisted to `sent_emails`.
- Deduplication: already-processed message IDs are not re-recorded.

## Out of scope
- Full inbox sync / labeling / search (this is thread-scoped only).
- AI reply summarization or classification.
- Multi-account Gmail (single connected account for v1).

## Data touched
- Reads `sent_emails` (rows with `thread_id`).
- Writes `email_events` (reply events). Updates `contacts.status`.
- Writes `sent_emails` (when user sends a reply from the CRM).
- Owns `gmail_tokens` table.
- See [data-schema.md](../../shared/data-schema.md).

## Dependencies
- All sends (feature 02) depend on the OAuth token this feature manages.
- A scheduler triggers `/api/poll/replies` (GCP Cloud Scheduler or equivalent).

## Acceptance criteria
- [ ] User can connect a Gmail account via OAuth and the token is stored securely.
- [ ] Polling finds new inbound messages in tracked threads.
- [ ] Own sent messages are not mistaken for replies.
- [ ] Reply content is readable inside the CRM dashboard.
- [ ] User can compose and send a reply from the CRM; it arrives threaded in the recipient's inbox.
- [ ] Replied-from-CRM sends are persisted to `sent_emails` with correct `thread_id`.
- [ ] Contact status flips to `replied` on inbound reply.
- [ ] Already-processed replies are not recorded twice.
- [ ] User can disconnect the Gmail account; tokens are purged.
