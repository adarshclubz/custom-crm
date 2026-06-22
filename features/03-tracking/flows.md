# 03 · Tracking — Flows

Status: 📝 Draft (rough outline)

## System / data flow (no direct user flow)
1. SendGrid POSTs a **batch** of events to `/api/webhooks/sendgrid`.
2. Verify signature header against `SENDGRID_WEBHOOK_PUBLIC_KEY`. Reject if invalid.
3. For each event in the batch:
   a. Extract `sg_message_id`, `event` type, `timestamp`, and raw payload.
   b. Find the `sent_emails` row where `provider_message_id = sg_message_id`.
      - No match → log/skip (still ack the batch).
   c. Insert `email_events` (`sent_email_id`, normalized `event_type`, `occurred_at`, `raw_payload`).
   d. Recompute and update `contacts.status` via the derivation rule.
4. Return 2xx promptly (process batch idempotently).

## Status mapping (draft)
| SendGrid event | email_events.event_type | Contact status effect |
|---|---|---|
| delivered | delivered | (no status change, or `sent`) — see open Q |
| open | open | → `opened` (if not already further along) |
| click | click | → `clicked` |
| bounce | bounce | → `bounced` (error state) |
| spam_report | spam_report | record; status effect TBD |
| unsubscribe | unsubscribe | record; status effect TBD |

## Edge cases
- **Out-of-order events** (open arrives after click) → never downgrade status; keep furthest.
- **Duplicate events** (SendGrid retries) → idempotent insert (dedupe key TBD) so we don't double-count.
- **Multiple recipients share a `sg_message_id`?** Confirm SendGrid id granularity (per-message).
- **Event for unknown message** (e.g. test sends) → skip, still 2xx.
- **Bounce after open** → status semantics? (open Q)

## Error / empty states
- Signature invalid → 401, no writes.
- DB error mid-batch → return non-2xx so SendGrid retries (idempotency must hold).
