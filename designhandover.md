# Design Brief — Custom CRM (Email Outreach)

A brief for producing the product's UI. It defines the screens, layouts, content, states,
and visual system so a designer can deliver high-fidelity designs without further context.

## Product in one line
A campaign-centric **email outreach CRM**: upload contacts, run campaigns (bulk-templated
or single-personalized), watch replies land, follow up, and move leads down a pipeline to
conversion.

## Design intent (north star)
- **Modern, clean SaaS.** Calm, confident, data-forward but breathable — think Linear /
  Attio / Superhuman restraint, not dense enterprise gray.
- **Inbox-grade readability.** Conversations and recipient tables are read constantly;
  prioritize scannability, clear hierarchy, generous spacing.
- **Status is the visual backbone.** Lead and campaign states drive color and glanceability
  across every screen — design a coherent badge system first, reuse everywhere.
- **Light and dark themes.** App already supports both; design for both.
- Primary surfaces: a left nav, a content area, and contextual right-side panels/drawers for
  detail and compose actions.

---

## Visual system (clubz brand)

**Component foundation:** shadcn/ui. Use preset **`--preset b5cSEMslN`** for the structural
base (layout rhythm, spacing, radius, component set) — **but override its palette with the
clubz colors below.** Do not use the preset's colors.

**Core colors**

| Token | Hex | Use |
|---|---|---|
| **Pure Orchid** | `#C919E4` | Primary — brand, primary buttons, active nav, focus rings, key accents, the "milestone" moment |
| **Deep Maroon** | `#1C0D0D` | Near-black — text/foreground in light theme; base background in dark theme |

Derive orchid tints/shades for hover, active, subtle fills, and selected-row / focus states
(e.g. orchid at low opacity for selection + rings). Neutrals can be warm grays that sit well
against Deep Maroon.

**Typography**
- **Headings / display: `Protest Strike`** — page titles, section headers, campaign names,
  big numbers. Bold and expressive; use sparingly for impact.
- **Body / UI / secondary: `Radio Canada Big`** — tables, labels, inputs, paragraphs,
  everything functional.

**shadcn theme tokens (starting point)**
```
Light:  --background:#FFFFFF  --foreground:#1C0D0D
        --primary:#C919E4     --primary-foreground:#FFFFFF
        --ring:#C919E4        --radius: per preset
Dark:   --background:#1C0D0D  --foreground:#F7F2F5
        --primary:#C919E4     --primary-foreground:#FFFFFF
```

**Status colors** — keep semantic/functional colors so success vs. error stay unambiguous,
with **orchid reserved for brand, primary actions, and the Meeting-stage milestone**:
Not contacted = neutral gray · Sent = cool informational · Replied = teal · **Meeting stage =
Pure Orchid** · Converted = green · Bounced = red · Spam = amber.

---

## Navigation

Left nav, three primary destinations + settings:

```
◐ Campaigns      ← default / home
◐ Contacts
⚙ Settings (Gmail connection)

Global: [ + Create campaign ]  primary action, always reachable
```

---

## Screens

### 1 · Campaigns — list  (home)
The landing screen. A roster of every campaign, newest first, with a prominent
**+ Create campaign**.

- **Card or row per campaign**, showing: **name**, **type** chip (Bulk / Single),
  **status badge** (draft / sending / sent / completed), **audience size**, and outcome
  metrics: **sent · replied · bounced** (and meeting / converted counts if space allows).
  **Created date**.
- Sort/filter by status and type; search by name.
- Row/card click → Campaign detail.
- **States:** empty ("No campaigns yet" with a friendly CTA to create the first), loading
  skeletons, error.

### 2 · Campaign — detail
- **Header:** campaign name, type chip, status badge, created date, and a metrics strip
  (sent / replied / bounced / meeting / converted).
- **Recipients table** — one row per contact: name, email, company, **lead-status badge**,
  **# follow-ups sent**, **first reach-out**, **last reach-out**.
- **Multi-select rows → "Send follow-up"** (screen 4).
- **Row click → conversation drawer**: the full thread, outbound and inbound messages
  interleaved in time order (chat-like), with a reply box at the bottom (threaded).
- A "sending" state should feel alive — progress as a staggered batch goes out over time.
- **States:** empty recipients, loading, error, sending-in-progress.

### 3 · Create campaign — wizard
Stepped flow; branches on campaign type.

1. **Name + type** — Bulk (many contacts, one template) or Single personalized (one contact,
   bespoke email — e.g. a key client).
2. **Audience**
   - *Bulk:* choose an existing **group (a CSV upload)** or **upload a CSV right here**;
     optionally narrow to a subset.
   - *Single:* pick **one contact**.
3. **Compose** — subject + body, **plain text**.
   - *Bulk:* merge tags `{{name}}`, `{{company}}` with a visible token helper. **Critical
     state:** if any selected contact is missing a field the template uses, the send is
     **blocked** — design a clear, recoverable error that lists who's missing what and lets
     the user fix data / re-upload and retry. Nothing sends until clean.
   - *Single:* free-form personalized email.
4. **Review + send** — recipient count, sender (connected Gmail), and a reassuring note that
   sends are **paced out for deliverability** (not instant). Send → campaign goes `sending`.
- **States:** the merge-block error (design it well — it's frequent), "no Gmail connected"
  warning that routes to Settings, empty-audience guard, send confirmation.

### 4 · Send follow-up  (manual)
Opened from a campaign with recipients selected.
- Shows the selected recipients (count + a peek at who).
- Compose subject + body; merge tags allowed for multi-recipient. Replies thread into each
  contact's existing conversation automatically.
- Send → success / partial-failure summary; each recipient's follow-up count ticks up.
- **States:** confirm, sending, success, partial failure.

### 5 · Automated follow-up sequences  *(future — design now, badge as "Coming soon")*
Per-campaign sequence builder for "no reply → follow up automatically."
- Ordered **steps**, **unlimited**: each = "wait **N days**, if no reply send **this
  message**." Per-step delay, body (merge tags), enable toggle.
- Sequence controls: start / pause; replies auto-stop a contact's sequence.
- A per-recipient view of which step they're on.
- **States:** no sequence yet, draft, active, paused.

### 6 · Contacts — groups
Contacts are organized as **groups, where each CSV upload is one group.**
- List of groups: **group name**, **# contacts**, **upload date**, and a small outcome
  summary (e.g. replied / converted counts).
- **Upload CSV** is the way contacts enter (creates a new group). Make this inviting.
- Group click → Group detail.
- **States:** empty ("Upload a CSV to get started" with format hint), loading, error.

### 7 · Group — detail
- **Header:** group name, # contacts, upload date.
- **Contacts table:** name, email, company, tags, **lead-status badge**, last reach-out.
- **Per-contact actions:**
  - **Set lead status** — manually move to **Meeting stage** or **Converted** (and back).
    Design the status control as an extensible picker: today it's email-only, but it should
    visually accommodate a **conversion-channel** choice (email / LinkedIn / Instagram)
    added later without redesign.
  - **Remove contact** (removes the row from the group; confirm).
- **States:** empty, loading, error.

### 8 · Settings — Gmail connection
- Connected state: show the account (e.g. `adarsh@clubz.fm`), connection health, disconnect.
- Disconnected state: a clear **Connect Gmail** CTA (OAuth).
- Reflect post-connect success and error feedback.

---

## Status system (design this first — it's reused everywhere)

**Lead status** (lives on the contact, channel-agnostic — one status per lead):

| Status | Meaning | How set | Visual intent |
|---|---|---|---|
| Not contacted | No email sent yet | auto | neutral / gray |
| Sent | Email dispatched | auto | informational / blue |
| Replied | Contact wrote back | auto | positive / teal |
| Meeting stage | In conversation toward a meeting | **manual** | milestone / **Pure Orchid** |
| Converted | Won | **manual** | success / green |
| Bounced | Delivery failed | auto | error / red |
| Spam reported | Flagged as spam | manual | error / amber |

> Do **not** design open/click indicators for email — those signals aren't available and
> would be misleading. The pipeline reads: Not contacted → Sent → Replied → Meeting →
> Converted, with Bounced / Spam as off-ramps.

**Campaign status:** Draft → Sending → Sent → Completed (draft=gray, sending=animated/blue,
sent=neutral-done, completed=green).

---

## Reusable components to define
Status badge (lead + campaign variants), type chip (Bulk / Single), data table with
multi-select, the create-campaign **wizard** shell, **conversation drawer** (threaded
chat + reply box), **compose** surface with merge-tag tokens + the block-error pattern,
CSV **upload** dropzone, empty / loading / error states, confirmation dialogs.

## Verification (design phase)
Walk these flows against the designs to confirm completeness:
1. Bulk campaign from a CSV → hit the merge-block error → fix → send.
2. Single personalized campaign to one contact.
3. Campaign detail → read recipients → select two → manual follow-up.
4. Open a conversation drawer and reply in-thread.
5. Contacts → group → mark a lead Meeting then Converted → remove a contact.
6. Connect Gmail from Settings; see the not-connected warning during create.
7. Skim the P2 automated-sequence screens.

## Open visual choices (decide during design)
- Campaign list: cards vs. table; which metrics earn a spot on the card (defaulted to
  sent / replied / bounced).
- Exact color tokens for the status system (intents given above).
- Table-heavy vs. card-heavy treatment for recipients and contacts.
