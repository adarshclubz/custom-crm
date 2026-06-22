# 01 · Contacts — Flows

Status: 📝 Draft (rough outline)

## User flow: manual add
1. User clicks "Add contact" on the dashboard.
2. Form: name, email (required), company, tags (comma-separated → array).
3. Submit → validate email format → check duplicate.
4. On success: row appears in table with status `not_contacted`.

## User flow: CSV import
1. User clicks "Import CSV".
2. Selects file. Expected headers: `name,email,company,tags` (tags pipe- or
   semicolon-separated within the cell — TBD).
3. Client/server parses → preview (count + first N rows + detected column mapping). *(preview optional for v1 — open Q)*
4. User confirms → server inserts rows.
5. Result summary: created / skipped (duplicates) / errored (invalid email) counts.

## System / data flow
- Manual add → `POST /api/contacts` → insert into `contacts`.
- CSV import → `POST /api/contacts/import` → parse → batch insert with per-row outcome.
- List/read → `GET /api/contacts` (also consumed by the dashboard, feature 05).

## Edge cases
- Invalid / missing email → row error, not a whole-import failure.
- Duplicate email (already in DB or repeated within file) → apply dedupe rule.
- Empty file / wrong headers → clear error, nothing inserted.
- Very large CSV → batching / size limit (TBD).
- Tags cell empty → empty array, not `[null]`.

## Error / empty states
- Empty contacts list → empty-state prompt to add or import.
- Import partial failure → show summary, allow download of errored rows (nice-to-have).
