# 01 · Contacts — Scope

Status: 🔁 In review

## Purpose
Maintain the list of people we're emailing. Single entry point: a CSV upload button on the
dashboard. The app owns `status` and `last_contacted_at` — they are never in the import file.

## The upload format (locked)

**File type:** `.csv`

**Exact columns (in any order; headers case-insensitive on import):**

| Column | Required | Notes |
|---|---|---|
| `name` | no | Full name |
| `email` | **yes** | Unique key. Rows with no email are skipped. |
| `company` | no | |
| `tags` | no | Multiple tags semicolon-separated: `investor;nyc;warm` |

**What is NOT in the file (managed by the app):**
- `status` — always set to `not_contacted` on import.
- `last_contacted_at` — always null on import.

**Future columns (ignored on import now, will be wired later):**
- `linkedin` — silently ignored today; will not error.
- `instagram` — silently ignored today; will not error.

**Duplicates:** if an email already exists in the DB, that row is **skipped** (not updated).
The import summary reports: created / skipped (duplicates) / errored (invalid/missing email).

## In scope
- CSV upload button on the dashboard.
- Parse and validate CSV on the server.
- Insert valid rows into `contacts`.
- Return a per-import summary (created / skipped / errored counts).

## Out of scope (v1)
- Manual single-contact add (defer — upload is the primary path).
- Bulk editing / find-and-replace.
- Upsert / update on duplicate.
- Errored-row download.
- LinkedIn / Instagram fields (schema columns reserved, import wired later).

## Data touched
- `contacts` table. See [data-schema.md](../../shared/data-schema.md).

## Acceptance criteria
- [ ] Upload a CSV → contacts appear in DB with `status='not_contacted'`.
- [ ] Rows with missing/invalid email are skipped and counted as errored.
- [ ] Rows whose email already exists are skipped and counted as skipped.
- [ ] Unknown columns (linkedin, instagram, anything else) are ignored without error.
- [ ] Tags cell `investor;nyc;warm` → stored as `['investor','nyc','warm']`.
- [ ] Import returns a summary: `{ created: N, skipped: N, errored: N }`.
