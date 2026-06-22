# Gmail Integration — Build Plan

Status: 🚧 In progress. Owner reference document. Deployment is explicitly **out of scope**
for now.

## Decisions locked during scoping

- **Gmail-only.** SendGrid dropped entirely.
- **Send modes:** single (1:1), bulk personalized, threaded follow-up, new-thread follow-up.
- **Body:** plain text only. Merge tags (`{{name}}`, `{{company}}`) resolved on our side in
  `lib/templates.ts`.
- **Missing merge value:** if any contact in a bulk send is missing a referenced tag value,
  the **entire send is blocked** before anything goes out; API returns the offending contacts.
- **Deliverability guardrails:** random 60–180 s stagger between sends; configurable daily
  send cap (`DAILY_SEND_CAP`, default 100). SPF/DKIM/DMARC handled outside the codebase.
- **Contact statuses:** `not_contacted → sent → replied`, with `bounced` and `spam_reported`
  as terminal/error states. (`opened`/`clicked` reserved — Gmail sends are not trackable.)
- **Token storage:** encrypted column in Supabase (`gmail_tokens` table). Option A, not GCP
  Secret Manager.
- **Deployment target (later):** GCP (Cloud Run + Cloud Scheduler for reply polling).
- **Inbox-in-CRM:** read replies and respond without ever opening Gmail.

## Environment / prerequisites

- Step 1 (Google Cloud project, Gmail API enabled, OAuth Web client, redirect URI) — **done.**
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env.local` — **done.**
- Repo note (`app/AGENTS.md`): Next.js 16.2.9 with breaking changes — read
  `node_modules/next/dist/docs/` before writing any route code.

## Current state of the codebase (baseline)

- Nothing built yet. Only `lib/supabase.ts` (Supabase client) and `papaparse` dep exist.
- Contacts feature (01) also still on paper — no migration applied, no API routes.
- `googleapis` not yet a dependency.

---

## Build order & evaluation gates

We do these **one at a time**. Do not advance past a piece until its evaluation passes.

### Phase 1 — DB foundation  ✅ DONE
- **Build:** SQL migration (`features/migration_gmail.sql`): `gmail_tokens` table;
  `contact_status` enum (added `spam_reported`); `send_channel` enum (gmail only);
  `event_type` enum; `sent_emails`, `email_events` tables.
- **Evaluate:** ran against Supabase — `sent_emails`, `email_events`, `gmail_tokens` all
  confirmed present.

### Phase 2 — Gmail OAuth flow  ✅ DONE
- **Build:** installed `googleapis@173`. `lib/crypto.ts` (AES-256-GCM, key from
  `TOKEN_ENCRYPTION_KEY`), `lib/google.ts` (OAuth client + scopes),
  `/api/auth/google` (consent redirect, `access_type=offline` + `prompt=consent`),
  `/api/auth/google/callback` (code→tokens, getProfile for email, encrypt refresh token,
  upsert into `gmail_tokens`). Added env: `GOOGLE_OAUTH_REDIRECT_URI`, `APP_BASE_URL`,
  `TOKEN_ENCRYPTION_KEY`.
- **Evaluate:** completed Google consent → `gmail_tokens` row for `adarsh@clubz.fm` with an
  encrypted refresh token. ✅
- **Connected account:** `adarsh@clubz.fm`.

### Phase 3 — Gmail client lib (`lib/gmail.ts`)  ✅ DONE
- **Build:** `getGmailClient` (decrypt token, auto-refresh + persist), `sendMessage`
  (RFC 2822 plain text, own Message-ID, threading headers). Throwaway
  `/api/dev/test-send` route for evaluation — **DELETE before Phase 5.**
- **Evaluate:** sent to `adarshpankajsahu@gmail.com`; arrived as plain text from
  `adarsh@clubz.fm`; user replied. ✅
- **Test thread for Phase 6 reply poller:** `threadId=19ed658000a19670` now has an inbound
  reply waiting.

### Phase 4 — Merge renderer (`lib/templates.ts`)  ✅ DONE
- **Build:** `extractTags`, `missingFieldsFor`, `validateBulk` (block-if-missing gatekeeper;
  null/empty/whitespace all count as missing; unknown tags flagged separately),
  `renderTemplate`. Throwaway `/api/dev/test-merge` route — **DELETE before Phase 5.**
- **Evaluate:** offenders correctly flagged (null/whitespace company, empty name), valid
  contact renders cleanly, unknown tag `{{revenue}}` caught. ✅

### Phase 5 — Send API  ✅ DONE
- **Decisions:** durable outbox (Option A) over in-memory/Cloud Tasks — survives restarts,
  no extra infra, testable locally. Daily cap dropped (rely on stagger; revisit only if spam
  rate climbs).
- **Build:** `migration_send_jobs.sql` (`send_jobs` outbox table; note: `references` is a
  reserved word → column is `references_header`). `lib/queue.ts`: `performSend` (send +
  record + advance status without regressing), `enqueueBulk` (cumulative random 60–180s
  stagger), `drainDueJobs` (atomic pending→sending claim, retry w/ backoff, max 5 attempts).
  Routes: `/api/send` (single=sync, bulk=queued, validate-then-block gate),
  `/api/send/followup` (threaded, sync), `/api/queue/drain` (scheduler-driven; optional
  `QUEUE_DRAIN_SECRET` header).
- **Evaluate:** single send ✅, block returns 422 + offenders & sends nothing ✅, bulk queues
  staggered jobs ✅, drain sends both + flips jobs to `sent` + writes `sent_emails` w/
  `thread_id` + advances contact status ✅. (Tested with stagger shrunk to 1–3s.)
- **Prod note:** the drainer needs a scheduler hitting `/api/queue/drain` every minute
  (Cloud Scheduler). In dev, trigger it manually or via a loop.
- **Test contacts left in DB:** adarshpankajsahu@gmail.com, adarsh@clubz.fm,
  nocompany@example.com.

### Phase 6 — Reply poller (`/api/poll/replies`)  ✅ DONE
- **Build:** `migration_reply_dedupe.sql` (`email_events.provider_event_id` + partial unique
  index). `lib/poll.ts`: `pollReplies` — group sent_emails by thread, `threads.get`, skip
  messages with `SENT`/`DRAFT` label (our own), extract text/plain body, insert `replied`
  event keyed by Gmail messageId, advance contact to `replied` (never over a terminal state).
  Route `/api/poll/replies` (optional `POLL_SECRET` header).
- **Evaluate:** poll #1 found 1 reply + captured body + flipped contact to `replied`; poll #2
  `newReplies:0` (dedupe via 23505 unique violation). ✅
- **Prod note:** needs a scheduler hitting `/api/poll/replies` (cadence TBD — 1/5/15 min).
- **Bounce detection (added):** `isBounce` classifies NDRs (mailer-daemon/postmaster sender
  or delivery-status content type) → writes `bounce` event + sets contact `bounced`
  (terminal). Classifier unit-tested 5/5. `spam_reported` is NOT auto-detectable via Gmail
  (no sender-side spam signal) — manual status only.

### Phase 7 — Inbox read API + docs  ✅ DONE (UI deferred by owner)
- **Decision:** owner will build the dashboard UI later. Backend provides the read API +
  full documentation to integrate against. `threadId`-based threading deemed sufficient
  (no extra In-Reply-To/References wiring).
- **Build:** `lib/conversations.ts` (`listThreads`, `getThread` — merge outbound
  `sent_emails` + inbound `replied` events into a time-ordered timeline). Routes
  `GET /api/threads` and `GET /api/threads/[threadId]`. `API_REFERENCE.md` documents every
  endpoint for dashboard integration.
- **Evaluate:** `/api/threads` lists all conversations with counts + last snippet;
  `/api/threads/[id]` returns the merged timeline with the captured inbound reply body. ✅
- **Respond-from-CRM:** done via existing `POST /api/send/followup` (Phase 5).
