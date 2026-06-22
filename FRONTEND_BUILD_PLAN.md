# Frontend Build Plan — Custom CRM (Email Outreach Dashboard)

> Agreed build map. We build **one phase at a time**; each phase ends in a **verification gate**
> where the user reviews the screen in-browser (functional + design review) before we move on.
> Never approve-and-run the whole plan at once.

## Context

The backend is fully built (Next.js 16 App Router API routes on Supabase + Gmail API) but **no real
frontend exists** — only the `create-next-app` boilerplate in `app/app/page.tsx`. `designhandover.md`
specifies 8 screens, the clubz visual system, and a status badge system that is "the visual backbone."

### Stack realities we must honor
- **Next.js 16, React 19, Tailwind v4** (CSS-first `@theme`, not a JS config). shadcn/ui supports Tailwind v4.
- Backend enums are the source of truth (the brief is slightly richer):
  - **Campaign status:** `draft | sending | sent` only — no separate "completed". Render "completed" intent as `sent` (green-done).
  - **Contact/lead status:** `not_contacted | sent | replied | meeting | converted | bounced | spam_reported`.
    `opened`/`clicked` exist in the enum but the brief says **do not surface them**.
- API ready for every screen (see `API_REFERENCE.md`). Reuse read-models: `app/lib/campaigns.ts`,
  `app/lib/conversations.ts`, `app/lib/templates.ts`, `app/lib/status.ts`.

### Confirmed design decisions
- Campaigns home: **cards grid**.
- Recipients & contacts: **table-heavy** (dense, scannable, multi-select).
- Theme: **manual light/dark toggle** via `next-themes`, plus system default.

---

## Phase 0 — Design foundation (do first, reused everywhere)
1. **shadcn/ui setup** — `components.json` + base primitives (button, badge, card, table, dialog,
   sheet/drawer, input, textarea, select, dropdown-menu, tabs, skeleton, toast). Structural base per
   preset `b5cSEMslN`, **palette overridden** with clubz colors.
2. **Theme tokens** — clubz palette in `globals.css`: `--primary:#C919E4` (Pure Orchid); light
   `#FFFFFF`/`#1C0D0D`, dark `#1C0D0D`/`#F7F2F5`; orchid ring + low-opacity selection; warm-gray neutrals.
3. **Fonts** — `Protest Strike` (display) + `Radio Canada Big` (body) via `next/font/google`.
4. **Theme provider + toggle** — `next-themes`.
5. **Status system components (the backbone):** `StatusBadge` (lead), `CampaignStatusBadge`, `TypeChip`,
   central status→color/label map.
6. **App shell** — left nav (Campaigns / Contacts / Settings) + global **+ Create campaign** + content area
   as a route-group layout. Shared empty/loading/error + confirmation-dialog primitives.

**Gate:** preview route shows nav shell, all StatusBadge variants, TypeChips, theme toggle flips
light↔dark with correct clubz colors + fonts.

## Phase 1 — Screen 1: Campaigns list (home) — cards grid, `GET /api/campaigns`.
## Phase 2 — Screen 2: Campaign detail + conversation drawer — `GET /api/campaigns/[id]`, `GET /api/threads/[id]`, reply via `POST /api/send/followup`.
## Phase 3 — Screen 3: Create campaign wizard — `POST /api/contacts/import`, `POST /api/campaigns`, `POST /api/campaigns/[id]/send`; design the `422 send_blocked` merge-block error well.
## Phase 4 — Screen 4: Send follow-up (manual) — from detail multi-select; partial-failure summary.
## Phase 5 — Screen 6: Contacts — groups — `GET /api/groups`; inviting CSV upload.
## Phase 6 — Screen 7: Group detail — `GET /api/groups/[id]`; extensible lead-status picker (future channel choice) via `PATCH /api/contacts/[id]/status`; remove contact.
## Phase 7 — Screen 8: Settings — Gmail connection — `GET /api/auth/google` OAuth; connected/disconnected.
## Phase 8 — Screen 5: Automated follow-up sequences — "Coming soon" shell only.

Each phase ends with `npm run dev` + an in-browser walk of that screen's flow in **both themes**, then user review.
