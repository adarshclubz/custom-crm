# 03 · Tracking — Open Questions

- [ ] **Poll cadence:** every 1 / 5 / 15 min? Tradeoff between Gmail API quota and reply freshness.
- [ ] **Poll vs push:** Cloud Scheduler polling vs Gmail push notifications (Pub/Sub `watch`)? Polling is simpler for v1.
- [ ] **Reply text storage:** snippet only, full body, or full body in `raw_payload` with a dedicated `body` column on `email_events`?
- [ ] **Auto-reply / OOO handling:** count as `replied`, ignore, or flag with a separate status?
- [ ] **Bounce detection:** parse NDR messages in thread vs rely on Gmail send error codes? Both?
- [ ] **Dedup cursor:** track last-seen `messageId` per thread vs timestamp window?
- [ ] **Live UI updates:** polling/refresh vs Supabase realtime for the reply inbox view?
- [ ] **"Check now" button:** manual poll trigger in the UI for v1?
