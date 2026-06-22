# 04 · Reply Detection — Flows

Status: 📝 Draft (rough outline)

## User flow: connect Gmail (OAuth)
1. User clicks "Connect Gmail" in settings/dashboard.
2. Redirect to Google consent (`gmail.send`, `gmail.readonly`).
3. Callback `/api/auth/google/callback` exchanges code → stores refresh token (encrypted).
4. UI shows "Connected as <email>". Single send (feature 02) now enabled.

## System / data flow: reply polling
1. Scheduler hits `POST /api/poll/replies` on an interval.
2. Load tracked threads: `sent_emails` where `sent_via='gmail'` and `thread_id` not null.
   - Optimization: only threads not yet marked `replied`, within a recency window.
3. For each thread, call Gmail `users.threads.get(threadId)`.
4. Identify inbound messages (From = recipient, not the connected account; received after our send).
5. If a new reply exists:
   a. Update contact `status='replied'`.
   b. Insert `email_events` (`event_type='replied'`, `occurred_at`, reply snippet/body).
   c. Mark thread processed (cursor / last-seen message id) to avoid re-processing.

## Edge cases
- **Our own follow-up** in the thread → must not count as a reply (filter by sender).
- **Auto-replies / OOO** → still a "reply"? (open Q — maybe flag separately)
- **Token expired/revoked** → polling fails gracefully; prompt to reconnect.
- **Multiple replies** in one thread → first reply flips status; subsequent ones still logged?
- **Rate limits / quota** on Gmail API with many threads → batch / backoff.

## Error / empty states
- Gmail not connected → polling no-ops; UI shows disconnected state.
- No tracked threads → nothing to do.
