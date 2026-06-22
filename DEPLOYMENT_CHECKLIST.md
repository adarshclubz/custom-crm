# Deployment Checklist — Custom CRM

Last updated: 2026-06-22. Run top to bottom; each section gates the next.
See `API_REFERENCE.md` for endpoint details and `SUNSET_APIS.md` for routes removed in this cycle.

---

## 1. Environment variables (all 13 required in prod)

| Var | Purpose | Notes |
|---|---|---|
| `SUPABASE_URL` | DB connection | |
| `SUPABASE_SERVICE_ROLE_KEY` | DB connection (server-side only) | never expose to client |
| `GOOGLE_CLIENT_ID` | OAuth | |
| `GOOGLE_CLIENT_SECRET` | OAuth | |
| `GOOGLE_OAUTH_REDIRECT_URI` | OAuth callback | **must be the prod URL**, e.g. `https://<domain>/api/auth/google/callback` |
| `APP_BASE_URL` | post-OAuth redirect + worker self-refs | **must be the prod URL**, no trailing slash |
| `TOKEN_ENCRYPTION_KEY` | encrypts stored refresh tokens | rotating it invalidates all stored Gmail tokens |
| `QUEUE_DRAIN_SECRET` | auth for `/api/queue/drain` | ⚠️ missing from local `.env.local` — **must set in prod** |
| `POLL_SECRET` | auth for `/api/poll/replies` | ⚠️ **must set in prod** |
| `FOLLOWUP_SECRET` | auth for `/api/followups/run` | ⚠️ **must set in prod** |
| `SEND_DELAY_MIN_SECONDS` | bulk send stagger (min) | tune for rate limits |
| `SEND_DELAY_MAX_SECONDS` | bulk send stagger (max) | |
| `FOLLOWUP_WAIT_UNIT_SECONDS` | follow-up `waitDays` unit | set to `86400` for real days; smaller only for testing |

- [ ] All 13 set in the prod environment.
- [ ] `GOOGLE_OAUTH_REDIRECT_URI` and `APP_BASE_URL` point at the **prod domain** (not localhost).
- [ ] Worker secrets (`QUEUE_DRAIN_SECRET`, `POLL_SECRET`, `FOLLOWUP_SECRET`) set — without them the workers accept unauthenticated calls.

## 2. Google Cloud / OAuth config

- [ ] Prod `GOOGLE_OAUTH_REDIRECT_URI` added to the OAuth client's **Authorized redirect URIs** (exact match, including scheme + path). *Mismatch → `redirect_uri_mismatch`; wrong port/host → callback hits a dead endpoint (the failure we saw locally).*
- [ ] OAuth consent screen published / test users include the sender account.
- [ ] The connect flow requests `access_type=offline` + `prompt=consent` so a **refresh token** is returned (re-consenting accounts otherwise yield `gmail_error=no_refresh_token`).

## 3. Database (Supabase)

- [ ] All 8 migrations applied to the **prod** project, in dependency order:
  1. `migration_contact_groups.sql`
  2. `migration_status_stages.sql`
  3. `migration_campaigns.sql`
  4. `migration_gmail.sql`
  5. `migration_send_jobs.sql`
  6. `migration_schedule_send.sql`
  7. `migration_followups.sql`
  8. `migration_reply_dedupe.sql`
- [ ] Confirm prod points at the intended Supabase project (local `.env.local` currently targets a real DB with `adarsh@clubz.fm` connected — don't ship local creds).

## 4. Build & deploy

- [ ] `npx next build` passes clean. *(Verified 2026-06-22.)*
- [ ] App deployed; `/` redirects (307) to `/campaigns`.

## 5. Scheduler / cron — REQUIRED (no UI for these)

The three background workers have no CTA and must be invoked on a schedule, each with its secret header:

```
POST /api/queue/drain    header: x-drain-secret: $QUEUE_DRAIN_SECRET     every ~1 min
POST /api/poll/replies   header: x-poll-secret: $POLL_SECRET             every 1–15 min
POST /api/followups/run  header: x-followup-secret: $FOLLOWUP_SECRET      every ~1 min
```

- [ ] Cloud Scheduler (or equivalent) jobs created for all three at the cadences above.
- [ ] Each job passes the correct secret header.
- [ ] ⚠️ **Most likely failure mode:** endpoints respond 200 but no scheduler is wired → sends queue forever, replies never detected, follow-ups never fire — silently. Verify the schedule exists, not just that the endpoints answer.

## 6. Post-deploy smoke (do once, against prod)

**Structural (safe):**
- [ ] `/contacts`, `/campaigns`, `/scheduled`, `/settings`, `/campaigns/new` all load (200).
- [ ] Removed routes 404: `POST /api/send`, `GET /api/threads`, `GET /api/scheduled`.
- [ ] `GET /api/gmail/status` reflects connection state.

**Auth:**
- [ ] Settings → Connect Gmail → consent → returns with `?gmail_connected=<email>` on the prod domain.

**End-to-end (send only to your own addresses first):**
- [ ] Import a tiny CSV → group + contacts created.
- [ ] Create a campaign with a `{{merge}}` tag + one follow-up step → send to yourself → delivered, tags rendered, no `{{...}}` leakage.
- [ ] Merge-block guard: a contact missing the merged field → send blocked (422), not half-sent.
- [ ] Schedule a send, see it on `/scheduled`, then cancel it → never sends.
- [ ] Reply from another inbox → `poll/replies` flips contact to `replied` + logs event. Send to a bad address → `bounced`.
- [ ] Due follow-up fires in-thread via `followups/run`, and stops the chain when a reply already arrived.
- [ ] Open a thread (conversation drawer) → history loads; manual reply sends in-thread.

## 7. Go / No-Go

- [ ] No 500s / console errors during smoke.
- [ ] Sends reached **only** intended addresses (no accidental blast to an imported list).
- [ ] Worker endpoints reject unauthenticated calls in prod.
- [ ] Scheduler confirmed running (section 5).

---

### Known gotchas (learned this cycle)
- **Port / redirect mismatch:** the OAuth callback must be served at exactly the registered redirect URI. Locally, the dev server on `:3001` while the URI pointed at `:3000` caused "endpoint failed." In prod, this is the `GOOGLE_OAUTH_REDIRECT_URI` ↔ deployed-domain match.
- **Refresh token on re-consent:** an already-consented account returns no refresh token unless `prompt=consent` is sent.
- **Single connected account:** `gmail_tokens` is keyed for one account (v1 design).
- **Removed routes:** `POST /api/send`, `GET /api/threads`, `GET /api/scheduled`, and `GET /api/campaigns(/[id])` were sunset — see `SUNSET_APIS.md`. Pages render via `lib/` directly.
