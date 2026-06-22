# Custom CRM — API Reference (Gmail Integration)

For wiring a dashboard UI to the backend. All endpoints are Next.js App Router route
handlers under `app/api/`. Base URL in dev: `http://localhost:3000`.

Channel is **Gmail-only**. All sends go through the connected Google account
(`adarsh@clubz.fm`). Bodies are plain text; merge tags (`{{name}}`, `{{company}}`) are
resolved server-side.

---

## Auth / connection

### `GET /api/auth/google`
Starts OAuth. Redirects (302) to Google's consent screen. Open in a browser; not an
XHR endpoint.

### `GET /api/auth/google/callback`
Google redirects here after consent. Exchanges the code, stores the encrypted refresh
token in `gmail_tokens`, then 302-redirects to `APP_BASE_URL/?gmail_connected=<email>`
on success, or `?gmail_error=<reason>` on failure. The dashboard can read those query
params to show connection status.

> Connection state: a row in `gmail_tokens` means an account is connected. (No dedicated
> status endpoint yet — add one if the dashboard needs it.)

---

## Sending

### `POST /api/send`
Send to one or many contacts. Validates merge tags first and **blocks the whole send**
if any contact is missing a referenced field.

**Body**
```json
{
  "contactIds": ["uuid", "uuid"],
  "subject": "Hi {{name}}",
  "body": "Hi {{name}}, a note for {{company}}."
}
```

**Responses**
- One contact → sent immediately:
  ```json
  { "mode": "single", "sent": 1, "sentEmailId": "uuid" }
  ```
- Many contacts → queued as a staggered batch (drains in the background):
  ```json
  { "mode": "bulk", "batchId": "uuid", "queued": 2,
    "firstAt": "ISO", "lastAt": "ISO" }
  ```
- Blocked (HTTP 422) — nothing is sent:
  ```json
  { "error": "send_blocked",
    "unknownTags": ["revenue"],
    "offenders": [{ "id": "uuid", "email": "x@y.com", "missing": ["company"] }] }
  ```
- Other errors: `400` (bad input), `404` (no matching contacts), `500`.

### `POST /api/send/followup`
Reply into an existing Gmail thread (stays threaded in the recipient's inbox). Synchronous.

**Body**
```json
{
  "contactId": "uuid",
  "subject": "Re: ...",
  "body": "Following up, {{name}}.",
  "threadId": "gmail-thread-id",
  "inReplyTo": "<optional RFC Message-ID>",
  "references": "<optional accumulated References>"
}
```
`threadId` is required and sufficient for threading. `inReplyTo`/`references` are optional.

**Response**: `{ "sent": 1, "sentEmailId": "uuid", "threadId": "..." }`
(422 block / 404 / 500 as above.)

---

## Background workers (scheduler-driven)

These are meant to be called on a schedule (GCP Cloud Scheduler in prod; a loop or manual
call in dev). Both accept an optional shared-secret header.

### `POST /api/queue/drain`
Sends all `send_jobs` whose `scheduled_at` is now due. Run **every ~1 minute**.
- Header (if `QUEUE_DRAIN_SECRET` is set): `x-drain-secret: <secret>`
- Response: `{ "ok": true, "claimed": N, "sent": N, "failed": N, "requeued": N }`

### `POST /api/poll/replies`
Scans tracked threads for new inbound replies **and bounces**. Replies → `replied` event +
contact `replied`. Non-delivery reports (from `mailer-daemon`/`postmaster` or a
delivery-status content type) → `bounce` event + contact `bounced` (terminal). Idempotent
(deduped by Gmail messageId). Run **every 1–15 minutes** (cadence TBD). Also proactively
**cancels** any pending automated follow-up on a thread that just got a reply/bounce.
- Header (if `POLL_SECRET` is set): `x-poll-secret: <secret>`
- Response: `{ "ok": true, "threadsChecked": N, "newReplies": N, "newBounces": N }`

### `POST /api/followups/run`
Dispatches all **due** automated follow-up steps (see "Automated follow-up sequences" below).
For each due step it stops the chain if the recipient has replied/bounced on that thread (or
was manually progressed to `meeting`/`converted`), otherwise sends the step in-thread and
schedules the next step relative to that send. Run **every ~1 minute**.
- Header (if `FOLLOWUP_SECRET` is set): `x-followup-secret: <secret>`
- Response: `{ "ok": true, "claimed": N, "sent": N, "canceled": N, "failed": N, "requeued": N }`

> `spam_reported` cannot be auto-detected: Gmail provides no spam-feedback signal to the
> sender (unlike a provider feedback loop). The status exists for manual marking only.

---

## Automated follow-up sequences

A campaign can carry an ordered, unlimited list of follow-up steps — *"wait N days after the
previous email, if no reply, send this body"* (in-thread, merge tags allowed). Steps are
attached at **create** time and dispatched by the `/api/followups/run` worker.

### Attaching a sequence — `POST /api/campaigns`
Add an optional `followups` array to the create body:
```json
{
  "name": "Q3 Outreach", "type": "bulk", "subject": "Hi {{name}}", "body": "…",
  "contactIds": ["uuid"],
  "followups": [
    { "waitDays": 3, "body": "Just bumping this, {{name}}." },
    { "waitDays": 5, "body": "Last nudge." }
  ]
}
```
Each step needs `waitDays >= 1` (integer) and a non-empty `body`; otherwise `400`. Order is
preserved as `step_index`. Response includes `followupCount`. The sequence reads back on
`GET /api/campaigns/[id]` as `followups: [{ stepIndex, waitDays, body }]`.

### How it runs
1. When a recipient's **initial** campaign email is sent (single send, or a bulk `send_jobs`
   row draining), step 0 is **armed**: a `followup_jobs` row due `waitDays` later, pointing at
   that send's `thread_id`.
2. `POST /api/campaigns/[id]/send` validates every step body against the audience under the
   same **block-if-missing** gate (`422 send_blocked`, `scope: "followups"`) — a chain that
   can't render for some recipient is never armed.
3. `/api/followups/run` (scheduled) processes due steps: it **stops** the chain (no send) if
   the contact replied/bounced *on that thread* or is `meeting`/`converted`; otherwise it
   sends the step in-thread (`Re: <original subject>`) and arms the next step relative to the
   send it just made. At most one pending step per (campaign, contact) at a time.

> **Dev knob:** `FOLLOWUP_WAIT_UNIT_SECONDS` (default `86400`) is the seconds-per-"day". Set
> it to `1` locally to watch a whole chain fire in seconds.

---

## Reading conversations (for the inbox UI)

### `GET /api/threads`
Conversation list, newest activity first.
```json
{ "threads": [
  { "threadId": "...",
    "contact": { "id": "uuid", "name": "Adarsh", "email": "...", "company": "Clubz", "status": "replied" },
    "subject": "Hi Adarsh",
    "messageCount": 2,
    "replyCount": 1,
    "lastActivityAt": "ISO",
    "lastSnippet": "first 140 chars of the latest message" }
] }
```

### `GET /api/threads/[threadId]`
Full conversation: outbound sends + inbound replies merged in time order.
```json
{ "threadId": "...",
  "contact": { "id": "uuid", "name": "...", "email": "...", "company": "...", "status": "replied" },
  "messages": [
    { "direction": "inbound|outbound", "at": "ISO", "subject": "...",
      "from": "Name <email>", "body": "...", "providerMessageId": "..." }
  ] }
```
`404` if the thread is unknown.

**Reply from the inbox:** to respond, POST to `/api/send/followup` with the thread's
`threadId` and the `contactId` from this payload.

---

## Contacts

### `POST /api/contacts/import`
Multipart form upload (`file` = CSV). Columns: `name`, `email` (required), `company`,
`tags` (semicolon-separated). Returns `{ created, skipped, errored }`. (Feature 01 — see
`features/01-contacts/`.)

> There is no JSON create-contact or list-contacts endpoint yet. Add one when the dashboard
> needs to render/select contacts (the send endpoints take contact UUIDs).

---

## Reference data

**Contact status** (`contacts.status`): `not_contacted → sent → opened → clicked → replied`,
terminal: `bounced`, `spam_reported`. Gmail sends never produce `opened`/`clicked` (no
tracking); those are reserved. Status never regresses from a terminal state.

**Tables:** `contacts`, `sent_emails`, `email_events`, `gmail_tokens`, `send_jobs`,
`campaigns`, `campaign_recipients`, `campaign_followups`, `followup_jobs`.
See `shared/data-schema.md` and the `features/migration_*.sql` files.

**Env vars:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_OAUTH_REDIRECT_URI`,
`APP_BASE_URL`, `TOKEN_ENCRYPTION_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
Optional: `SEND_DELAY_MIN_SECONDS`/`SEND_DELAY_MAX_SECONDS` (stagger, default 60/180),
`FOLLOWUP_WAIT_UNIT_SECONDS` (seconds-per-"day" for follow-up waits, default 86400),
`QUEUE_DRAIN_SECRET`, `POLL_SECRET`, `FOLLOWUP_SECRET`.

## Not yet built (for the dashboard layer)
- Inbox UI itself (deferred — owner will integrate dashboards against the above APIs).
- `GET /api/contacts` (list/filter) + JSON create endpoint.
- Connection-status endpoint (currently inferred from `gmail_tokens`).
- A `send_jobs` status/inspection endpoint for showing queued/failed sends in the UI.
