# Shared: Data Schema (Postgres)

Single source of truth for the database. Provider: **Supabase** (hosted Postgres).
Status: 📝 Updated — SendGrid dropped, Gmail-only; new statuses added.

## Tables

### `contacts`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | default `gen_random_uuid()` |
| `name` | `text` | nullable |
| `email` | `text` NOT NULL | unique; lowercased on insert |
| `company` | `text` | nullable |
| `tags` | `text[]` | array; filterable |
| `status` | `contact_status` enum | default `'not_contacted'` |
| `last_contacted_at` | `timestamptz` | updated on every send |
| `created_at` | `timestamptz` | default `now()` |

### `sent_emails`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `contact_id` | `uuid` NOT NULL | FK → `contacts.id` (ON DELETE CASCADE) |
| `subject` | `text` | |
| `body` | `text` | rendered plain-text body actually sent (post merge-tag) |
| `sent_via` | `send_channel` enum | always `'gmail'` for v1 |
| `provider_message_id` | `text` | Gmail `messageId` |
| `thread_id` | `text` | Gmail `threadId` — used for follow-ups and reply polling |
| `sent_at` | `timestamptz` | default `now()` |

### `email_events`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `sent_email_id` | `uuid` NOT NULL | FK → `sent_emails.id` (ON DELETE CASCADE) |
| `event_type` | `event_type` enum | see enum below |
| `occurred_at` | `timestamptz` | timestamp of the event |
| `raw_payload` | `jsonb` | full event data (reply body, headers, etc.) for debugging/audit |

### `gmail_tokens`
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `email` | `text` NOT NULL | the connected Gmail address |
| `refresh_token` | `text` NOT NULL | encrypted at rest |
| `access_token` | `text` | cached; refreshed automatically |
| `token_expiry` | `timestamptz` | |
| `connected_at` | `timestamptz` | default `now()` |

### `campaign_followups`
The automated follow-up sequence DEFINITION attached to a campaign (ordered steps).
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `campaign_id` | `uuid` NOT NULL | FK → `campaigns.id` (ON DELETE CASCADE) |
| `step_index` | `int` NOT NULL | 0-based order; unique per `(campaign_id, step_index)` |
| `wait_days` | `int` NOT NULL | days after the **previous** email; `>= 1` |
| `body` | `text` NOT NULL | template body (merge tags allowed); subject is `Re: <original>` |
| `created_at` | `timestamptz` | default `now()` |

### `followup_jobs`
Per-recipient SCHEDULING state. At most one `pending` row per `(campaign_id, contact_id)` at a
time (the next due step); when it sends, the following step's row is created relative to that
actual send. Enforced by a partial unique index on `(campaign_id, contact_id) where status='pending'`.
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` PK | |
| `campaign_id` | `uuid` NOT NULL | FK → `campaigns.id` (ON DELETE CASCADE) |
| `contact_id` | `uuid` NOT NULL | FK → `contacts.id` (ON DELETE CASCADE) |
| `step_index` | `int` NOT NULL | which `campaign_followups` step |
| `thread_id` | `text` NOT NULL | Gmail thread to reply into (from the initial send) |
| `due_at` | `timestamptz` NOT NULL | when this step is due |
| `status` | `followup_status` enum | `pending` default |
| `attempts` | `int` | retry counter (max 5) |
| `last_error` | `text` | last failure / stop reason |
| `sent_email_id` | `uuid` | FK → `sent_emails.id` (ON DELETE SET NULL) once sent |
| `created_at` | `timestamptz` | default `now()` |

## Enums

```sql
-- contact lifecycle status (drives dashboard filtering)
-- priority order: not_contacted < sent < delivered < opened < clicked < replied
-- terminal/error states: bounced, spam_reported
contact_status:
  not_contacted | sent | opened | clicked | replied | bounced | spam_reported

-- which provider sent the email (gmail only for v1; enum kept extensible)
send_channel: gmail

-- normalized inbound events
event_type: delivered | open | click | bounce | spam_report | replied

-- automated follow-up job lifecycle
-- pending -> sending -> sent ; canceled = stopped by a reply/terminal status ;
-- failed = exhausted retries
followup_status: pending | sending | sent | canceled | failed
```

## Status derivation rule

Contact `status` reflects the **furthest-progressed** event across all their sent emails.
Priority order (low → high): `not_contacted < sent < opened < clicked < replied`.
Terminal/error states (`bounced`, `spam_reported`) are set immediately and are not
overridden by later positive events.

| Gmail / poll event | `contacts.status` result |
|---|---|
| Email sent | `sent` |
| Reply detected by poller | `replied` |
| Bounce (delivery failure) | `bounced` |
| Spam report | `spam_reported` |

> Note: Gmail sends do not produce open/click tracking events (no tracking pixel or
> link wrapping). `opened` and `clicked` statuses are reserved for a future channel
> that supports them.

## Relationships

```
contacts (1) ──< (many) sent_emails (1) ──< (many) email_events
```

## Indexes (proposed)

- `contacts(status)`, `contacts USING gin(tags)`, `contacts(last_contacted_at)`
- `sent_emails(contact_id)`, `sent_emails(provider_message_id)`, `sent_emails(thread_id)`
- `email_events(sent_email_id)`, `email_events(event_type)`

## Open questions
- Per-workspace uniqueness vs global on `contacts.email`? (single-user for now → global)
- Soft-delete contacts vs hard delete (CASCADE) — current draft: hard delete.
- Reply text storage: snippet only vs full body in `raw_payload` vs dedicated column?
- Token storage: encrypted DB column (`gmail_tokens`) vs GCP Secret Manager?
