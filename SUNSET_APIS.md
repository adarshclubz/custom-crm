# Sunset APIs

These HTTP routes were **removed on 2026-06-22** because nothing in the frontend
called them. They are archived here in case an external API consumer (or a future
feature) needs them again — the implementations are short and can be restored from
this doc plus the still-present `lib/` helpers.

Context: the dashboard pages are server components that call `lib/` functions
directly (e.g. `listCampaigns()`, `getCampaignDetail()`, `listScheduled()`), so the
equivalent `GET` HTTP routes were never fetched. All user-facing CTAs remain fully
wired (see `API_REFERENCE.md`), and the scheduler-driven background workers
(`/api/queue/drain`, `/api/poll/replies`, `/api/followups/run`) are untouched — they
are required even though they have no CTA.

---

## `POST /api/send`  *(removed)*

Standalone send endpoint, superseded by the campaign flow
(`POST /api/campaigns` → `POST /api/campaigns/[id]/send`). The wizard never used it.

- Body: `{ contactIds: string[], subject: string, body: string }`
- One contact → `performSend()` synchronously, returns `{ mode: 'single', sent, sentEmailId }`.
- Many → `validateBulk()` gatekeeper, then `enqueueBulk()`, returns `{ mode: 'bulk', ... }`.
- 422 `send_blocked` with `unknownTags` / `offenders` when merge validation fails.
- Depends on: `lib/templates` (`validateBulk`, `renderTemplate`), `lib/queue`
  (`performSend`, `enqueueBulk`), `lib/supabase`.

## `GET /api/threads`  *(removed)*

Conversation list for an inbox view that was never built. Per-thread
`GET /api/threads/[threadId]` (used by the conversation drawer) is **kept**.

- Returns `{ threads }` via `listThreads()` (newest first).
- Depends on: `lib/conversations` → `listThreads()`. That helper is now unused; leave
  it in place or prune separately if desired.

## `GET /api/campaigns`  *(removed; POST on the same route kept)*

Redundant with the campaigns page, which calls `listCampaigns()` directly.

- Returned `{ campaigns: await listCampaigns() }`.
- `POST /api/campaigns` (create campaign + optional follow-up sequence) is **kept** —
  it backs the create-campaign wizard.

## `GET /api/campaigns/[campaignId]`  *(removed)*

Redundant with the campaign detail page, which calls `getCampaignDetail()` directly.

- Returned the campaign detail object, or 404 when not found.
- Depends on: `lib/campaigns` → `getCampaignDetail()` (still used by the page).

## `GET /api/scheduled`  *(removed)*

Redundant with the scheduled page, which calls `listScheduled()` directly.

- Returned `{ scheduled }` grouped by batch.
- Depends on: `lib/queue` → `listScheduled()` (still used by the page).
- `POST /api/scheduled/[batchId]/cancel` (cancel a batch) is **kept**.
