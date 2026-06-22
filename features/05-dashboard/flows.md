# 05 · Dashboard — Flows

Status: 📝 Draft (rough outline)

## User flow: browse & filter
1. User lands on the dashboard → contacts table + stats bar load.
2. Applies filters (status / tag / date range) → table updates.
3. Sorts/scrolls the list.

## User flow: inspect a contact
1. User clicks a contact row.
2. Side panel opens with that contact's details + unified history:
   - each `sent_emails` row (subject, channel, sent_at)
   - nested/interleaved `email_events` (delivered/open/click/bounce…)
   - any reply text (feature 04)
3. From the panel, user can trigger a send (feature 02).

## System / data flow
- Table → `GET /api/contacts` with filter params (status, tag, date range).
- Stats bar → aggregate query (counts + rates) — endpoint TBD (`/api/stats`?).
- Side panel → fetch one contact's `sent_emails` + joined `email_events` (+ replies).

## Stats definitions (draft — confirm in tracking/glossary)
- **total sent** = count of `sent_emails`.
- **open rate** = distinct opened / delivered (or sent) — denominator TBD.
- **click rate** = distinct clicked / denominator TBD.
- **reply rate** = contacts replied / contacts emailed.

## Edge cases
- Contact with no sends → panel shows "no activity yet".
- Filters yielding zero rows → empty state, stats reflect filtered or global? (open Q)
- Large contact lists → pagination / virtualized table (TBD).
- Open-rate inflation caveat (Apple MPP) — surface a note? (open Q)

## Error / empty states
- No contacts at all → prompt to add/import (ties to feature 01).
- Stats with zero sends → show 0 / n/a, not divide-by-zero.
