# 01 · Contacts — Open Questions

## Closed / decided
- [x] **Import file format:** CSV.
- [x] **Exact columns:** `name`, `email`, `company`, `tags`. Status + last_contacted_at NOT in file.
- [x] **Tags encoding:** semicolon-separated within the cell (`investor;nyc;warm`).
- [x] **Duplicate rule:** skip on matching email (no upsert in v1).
- [x] **Future fields:** `linkedin`, `instagram` — silently ignored on import today.
- [x] **Manual add:** deferred — upload is the only entry point for v1.

## Still open
- [ ] **CSV size limit:** is there a max file size / row count to enforce?
- [ ] **Empty tags cell:** stored as `[]` (empty array) — confirm.
- [ ] **Name column missing entirely** (column not in file at all): allowed? Store as null.
- [ ] **Errored-row download:** not in v1, but confirm explicitly.
