# 05 · Dashboard — Scope

Status: 📝 Draft

## Purpose
The single view that ties everything together: see all contacts and their current status,
filter/segment them, drill into one contact's full email history, and read top-line stats.

## In scope
- **Contacts table:** all contacts with current `status`, last action, `last_contacted_at`.
- **Filters:** by status, by tag, by date range.
- **Contact side panel:** click a contact → full email history (sent emails + tracked
  events + replies), in chronological order.
- **Stats bar:** total sent, open rate, click rate, reply rate.
- Entry points for actions owned by other features (add/import contact, compose/send).

## Out of scope
- Multiple pages / routing (single view by design).
- CRM pipeline / kanban / deal stages (explicit non-goal).
- Editing tracked events.
- Bulk editing contacts (TBD later).

## Data touched
- Reads `contacts`, `sent_emails`, `email_events` (read-only aggregation/joins).
- See [data-schema.md](../../shared/data-schema.md).

## Dependencies
- All prior features produce the data shown here (01 contacts, 02 sends, 03 tracking, 04 replies).

## Acceptance criteria
- [ ] Table lists all contacts with status, last action, and last_contacted_at.
- [ ] Filters (status, tag, date range) work and combine.
- [ ] Clicking a contact opens a side panel with a unified, chronological history.
- [ ] Side panel shows sent emails, their tracked events, and any reply text.
- [ ] Stats bar computes total sent + open/click/reply rates correctly.
- [ ] Empty/zero states render sensibly.
