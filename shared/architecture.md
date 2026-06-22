# Shared: Architecture

High-level technical shape. Status: 📝 Updated — SendGrid dropped, Gmail-only.

## Stack

| Concern | Choice | Why |
|---|---|---|
| App framework | **Next.js** (App Router) | One app for React dashboard + API routes. Serverless-friendly. |
| Frontend | React + Tailwind | Per spec. Single dashboard page. |
| Backend | Next.js API routes | Avoids a separate Express service. |
| Database | Supabase (Postgres) | Hosted, easy setup; see [data-schema.md](data-schema.md). |
| Email (all sends) | Gmail API (OAuth) | 1:1 and bulk personalized sends; real threading; reply detection. SendGrid dropped. |
| Deploy | Company GCP | Cloud Run container; Cloud Scheduler for reply polling + send queue. |

## App layout (Next.js)

```
app/
  page.tsx                         # single dashboard view (feature 05)
  api/
    contacts/route.ts              # list/create contacts (feature 01)
    contacts/import/route.ts       # CSV import (feature 01)
    send/route.ts                  # Gmail send — single or bulk (feature 02)
    send/followup/route.ts         # threaded follow-up to existing thread (feature 02)
    auth/google/route.ts           # OAuth start (feature 04)
    auth/google/callback/route.ts  # OAuth callback (feature 04)
    poll/replies/route.ts          # Gmail reply polling, called by scheduler (feature 04)
lib/
  db.ts                            # Supabase/Postgres client
  gmail.ts                         # Gmail client: send, thread, poll
  templates.ts                     # merge-tag rendering ({{name}}, {{company}})
  queue.ts                         # staggered send queue (rate-limits bulk sends)
components/                        # dashboard UI (feature 05)
```

## API surface

| Endpoint | Method | Feature | Notes |
|---|---|---|---|
| `/api/contacts` | GET, POST | 01 | |
| `/api/contacts/import` | POST | 01 | CSV |
| `/api/send` | POST | 02 | single or bulk; staggered |
| `/api/send/followup` | POST | 02 | reply in existing thread |
| `/api/auth/google` | GET | 04 | OAuth start |
| `/api/auth/google/callback` | GET | 04 | OAuth callback |
| `/api/poll/replies` | POST (scheduled) | 04 | called by Cloud Scheduler |
| `/api/followups/run` | POST (scheduled) | 06 | dispatch due automated follow-ups |

## Bulk send flow

1. Client POSTs contact IDs + subject + body template to `/api/send`.
2. API validates all contacts have values for every merge tag in the template — if any are missing, reject with a list of offending contacts. Nothing is sent.
3. Render each contact's personalized plain-text body via `lib/templates.ts`.
4. Enqueue sends in `lib/queue.ts` — fire one Gmail `messages.send` per contact with a random 60–180 s stagger.
5. Each send writes a `sent_emails` row immediately with `thread_id` from the Gmail response.
6. Daily send cap is checked before the queue starts; if it would be exceeded, the request is rejected.

## Automated follow-up flow

Campaigns can carry an ordered follow-up sequence (`campaign_followups`): *"wait N days after
the previous email, if no reply, send this body"*, in-thread.

1. When a recipient's **initial** email is sent (single send, or a bulk `send_jobs` drain),
   step 0 is **armed** as a `followup_jobs` row due `wait_days` later, pointing at that
   send's `thread_id`. At most one `pending` step per (campaign, contact) at a time.
2. A scheduled worker (`/api/followups/run`, ~every minute) processes **due** steps: it
   **stops** the chain (no send) if the contact replied/bounced on that thread or is
   `meeting`/`converted`; otherwise it sends the step in-thread via the shared `performSend`
   and arms the next step **relative to the send it just made** (lazy chaining).
3. The reply poller also proactively cancels pending follow-ups on a thread that just replied
   or bounced. Follow-up step bodies are merge-validated at campaign send time (block-if-missing).

## Cross-cutting concerns
- **Auth (app users):** single-user/internal for v1 — no login gate needed.
- **Threading:** all sends (single + bulk) store `thread_id`; follow-ups reply into the same
  `thread_id` (sufficient for Gmail threading). True `In-Reply-To`/`References` headering is a
  future improvement (needs the RFC `Message-ID` persisted on `sent_emails`).
- **Scheduler triggers:** GCP Cloud Scheduler → `/api/poll/replies` (reply polling),
  `/api/queue/drain` (bulk send queue), and `/api/followups/run` (automated follow-ups).
- **Stagger:** random delay between bulk sends to protect domain reputation.

## Open questions
- Cloud Run vs App Engine vs other GCP target.
- Dockerfile vs buildpack for containerization.
- Stagger implementation: in-process async loop vs Cloud Tasks queue per send.
