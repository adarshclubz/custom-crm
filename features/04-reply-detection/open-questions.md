# 04 · Gmail OAuth & Inbox — Open Questions

- [ ] **Poll cadence:** every 1 / 5 / 15 min? Tradeoff with Gmail API quota and reply freshness.
- [ ] **Poll vs push:** Cloud Scheduler polling vs Gmail push notifications (Pub/Sub `watch`)?
- [ ] **Reply text storage:** snippet only vs full body; dedicated column vs `raw_payload`?
- [ ] **Auto-reply / OOO handling:** count as `replied`, ignore, or flag separately?
- [ ] **Token storage:** encrypted DB column in `gmail_tokens` vs GCP Secret Manager?
- [ ] **Dedup cursor:** last-seen `messageId` per thread vs timestamp window?
- [ ] **"Check now" button:** manual poll trigger in the UI for v1?
- [ ] **Disconnect flow:** what happens to stored tokens + in-flight threads on disconnect?
- [ ] **Reply composer UI:** inline reply box per thread, or a modal?
