/**
 * Central status → label/color map. The status system is the visual backbone of the
 * app (design brief), so every screen reads its colors and labels from here.
 *
 * Lead status mirrors the backend `contact_status` enum (app/lib/status.ts). Per the
 * brief, `opened` / `clicked` exist in the enum but are NOT surfaced in the UI — Gmail
 * doesn't produce those signals, so showing them would be misleading. They get a
 * neutral fallback so a stray value never breaks rendering, but they're absent from the
 * visible pipeline.
 *
 * Orchid (the `primary` token) is reserved for brand, primary actions, and the
 * Meeting-stage milestone — no other status uses it.
 */

export type LeadStatus =
  | "not_contacted"
  | "sent"
  | "opened"
  | "clicked"
  | "replied"
  | "meeting"
  | "converted"
  | "bounced"
  | "spam_reported";

export type CampaignStatus = "draft" | "scheduled" | "sending" | "sent";

export type CampaignType = "bulk" | "single";

export interface StatusVisual {
  label: string;
  /** classes for the badge container (subtle fill + text + border) */
  badge: string;
  /** classes for the leading status dot */
  dot: string;
  /** animate the dot (in-progress states) */
  pulse?: boolean;
}

export const LEAD_STATUS_VISUALS: Record<LeadStatus, StatusVisual> = {
  not_contacted: {
    label: "Not contacted",
    badge:
      "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground/60",
  },
  sent: {
    label: "Sent",
    badge:
      "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  replied: {
    label: "Replied",
    badge:
      "bg-teal-500/10 text-teal-700 border-teal-500/20 dark:text-teal-300",
    dot: "bg-teal-500",
  },
  meeting: {
    label: "Meeting stage",
    // The milestone — Pure Orchid via the primary token.
    badge: "bg-primary/10 text-primary border-primary/25",
    dot: "bg-primary",
  },
  converted: {
    label: "Converted",
    badge:
      "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
  bounced: {
    label: "Bounced",
    badge: "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-300",
    dot: "bg-red-500",
  },
  spam_reported: {
    label: "Spam reported",
    badge:
      "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  // Reserved enum values — not part of the visible pipeline (see note above).
  opened: {
    label: "Opened",
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground/60",
  },
  clicked: {
    label: "Clicked",
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground/60",
  },
};

/** Statuses surfaced in the pipeline, in reading order. Use for legends/filters. */
export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "not_contacted",
  "sent",
  "replied",
  "meeting",
  "converted",
  "bounced",
  "spam_reported",
];

export const CAMPAIGN_STATUS_VISUALS: Record<CampaignStatus, StatusVisual> = {
  draft: {
    label: "Draft",
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground/60",
  },
  scheduled: {
    label: "Scheduled",
    badge:
      "bg-violet-500/10 text-violet-700 border-violet-500/20 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  sending: {
    label: "Sending",
    badge: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-300",
    dot: "bg-blue-500",
    pulse: true,
  },
  sent: {
    label: "Sent",
    badge:
      "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-300",
    dot: "bg-emerald-500",
  },
};

export const CAMPAIGN_STATUS_ORDER: CampaignStatus[] = [
  "draft",
  "scheduled",
  "sending",
  "sent",
];

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  bulk: "Bulk",
  single: "Single",
};
