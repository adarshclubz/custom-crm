import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LeadStatusBadge } from "@/components/status/lead-status-badge";
import { CampaignStatusBadge } from "@/components/status/campaign-status-badge";
import { TypeChip } from "@/components/status/type-chip";
import {
  LEAD_STATUS_ORDER,
  CAMPAIGN_STATUS_ORDER,
} from "@/components/status/status-config";

/**
 * Phase 0 design-system preview. Temporary — replaced by the Campaigns home in Phase 1.
 * Exists so the foundation (theme, fonts, status backbone, shell) can be reviewed in-browser.
 */
export default function DesignSystemPreview() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-muted-foreground text-sm">Phase 0 · Design foundation</p>
        <h1 className="font-display text-3xl tracking-tight">
          clubz design system
        </h1>
        <p className="text-muted-foreground max-w-prose text-sm">
          The visual backbone every screen reuses — status badges, type chips, buttons,
          cards, color and type. Toggle the theme (top-right) to check light and dark.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Lead status</CardTitle>
          <CardDescription>
            Lives on the contact, channel-agnostic. Orchid is reserved for the Meeting
            milestone. (opened / clicked are intentionally not surfaced.)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {LEAD_STATUS_ORDER.map((s) => (
            <LeadStatusBadge key={s} status={s} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Campaign status &amp; type</CardTitle>
          <CardDescription>
            Draft → Sending (animated) → Sent. Type chip classifies Bulk vs Single.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          {CAMPAIGN_STATUS_ORDER.map((s) => (
            <CampaignStatusBadge key={s} status={s} />
          ))}
          <span className="bg-border mx-2 h-5 w-px" aria-hidden />
          <TypeChip type="bulk" />
          <TypeChip type="single" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
          <CardDescription>Primary actions use Pure Orchid.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Color &amp; type</CardTitle>
          <CardDescription>
            Pure Orchid #C919E4 · Deep Maroon #1C0D0D. Headings in Protest Strike, body in
            Radio Canada Big.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            {[
              ["Primary", "bg-primary text-primary-foreground"],
              ["Foreground", "bg-foreground text-background"],
              ["Muted", "bg-muted text-muted-foreground"],
              ["Accent", "bg-accent text-accent-foreground"],
              ["Card", "bg-card text-card-foreground border"],
            ].map(([label, cls]) => (
              <div
                key={label}
                className={`flex h-16 w-32 items-end rounded-lg p-2 text-xs font-medium ${cls}`}
              >
                {label}
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-display text-2xl">Protest Strike — display</span>
            <span className="text-base">
              Radio Canada Big — body text used across tables, labels, and inputs.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
