# 02 · Compose & Send — Open Questions

- [ ] **Saved templates:** persist templates in DB, or compose fresh each time? (no table for this yet)
- [ ] **Re-send guard:** warn before emailing a contact who already replied or bounced?
- [ ] **Stagger implementation:** in-process async loop (simpler, ties up the serverless function) vs Cloud Tasks (one task per send, more robust but more infrastructure)?
- [ ] **Bulk send UI:** select contacts individually, by tag/filter, or both?
- [ ] **Follow-up trigger:** does the user manually choose "send threaded follow-up" per contact, or is there a bulk "follow up with everyone who hasn't replied" action?
- [ ] **Max follow-up depth:** is there a cap on how many threaded replies before forcing a new thread, or is it always the user's choice?
- [ ] **Daily cap reset:** midnight UTC, or rolling 24-hour window?
- [ ] **Cap exceeded UX:** reject the whole bulk request, or send up to the cap and queue the rest?
