# Cold Email Outreach Dashboard — Scoping Workspace

A documentation-first workspace for scoping the Cold Email Outreach Dashboard (SendGrid +
Gmail) **before** any code is written. Each feature is reasoned through in three phases —
**Scope → Flows → UX** — across multiple chats. Building starts only once a feature's three
phase-files are marked ✅ Ready.

> **No application code lives here yet.** This is product/flow/UX scoping only.

---

## How to use this workspace

Each feature folder contains four files:

| File | Purpose | When we touch it |
|---|---|---|
| `scope.md` | What the feature is/isn't, data touched, acceptance criteria | First |
| `flows.md` | User flows + system/data flows, edge cases, error states | Second |
| `ux.md` | Screens, components, states, interactions, wireframe notes | Third |
| `open-questions.md` | Running list of unresolved decisions | Throughout |

Workflow per chat: pick one feature, advance one phase file, log decisions in
`open-questions.md`, and update the status tracker below.

---

## Feature map & status

Numbering = build order (DB → bulk send + webhook → Gmail → UI).

| # | Feature | Scope | Flows | UX | Folder |
|---|---|---|---|---|---|
| 01 | Contacts | 📝 Draft | 📝 Draft | ⬜ Template | [features/01-contacts](features/01-contacts) |
| 02 | Compose & Send | 📝 Draft | 📝 Draft | ⬜ Template | [features/02-compose-send](features/02-compose-send) |
| 03 | Tracking (SendGrid webhook) | 📝 Draft | 📝 Draft | ⬜ Template | [features/03-tracking](features/03-tracking) |
| 04 | Reply Detection (Gmail) | 📝 Draft | 📝 Draft | ⬜ Template | [features/04-reply-detection](features/04-reply-detection) |
| 05 | Dashboard | 📝 Draft | 📝 Draft | ⬜ Template | [features/05-dashboard](features/05-dashboard) |

Legend: ⬜ Template · 📝 Draft · 🔁 In review · ✅ Ready

---

## Shared / cross-cutting docs

- [shared/data-schema.md](shared/data-schema.md) — Postgres schema (single source of truth)
- [shared/integrations.md](shared/integrations.md) — SendGrid + Gmail OAuth setup, env vars
- [shared/architecture.md](shared/architecture.md) — Stack, app layout, API surface, GCP deploy
- [shared/glossary.md](shared/glossary.md) — Status values, event types, terminology

---

## Product summary

Manage cold email outreach from a single sales dashboard: **send** (single via Gmail,
bulk via SendGrid), **track** (SendGrid Event Webhook), and **display** (contacts table +
per-contact history + stats). No marketing/sequence/AI logic.

### Explicit non-goals
- No automated sequences / drip logic
- No AI personalization generation (handled separately)
- No forward tracking (not technically possible on any provider)
- No CRM pipeline / deal stages beyond the `status` field

### Build order
1. DB schema + Supabase setup
2. SendGrid bulk send + webhook receiver (proves the core tracking loop)
3. Gmail OAuth + single send + reply polling
4. Dashboard UI wired to all of the above
