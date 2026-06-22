import Link from "next/link";
import { Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDate, pluralize } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { CampaignStatusBadge } from "@/components/status/campaign-status-badge";
import { TypeChip } from "@/components/status/type-chip";
import type { CampaignSummary } from "@/lib/campaigns";

function Metric({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className={cn("text-sm font-semibold tabular-nums", tone)}>
        {value.toLocaleString()}
      </span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

export function CampaignCard({ campaign }: { campaign: CampaignSummary }) {
  const { metrics } = campaign;
  return (
    <Card className="group hover:border-primary/40 relative gap-0 py-0 transition-colors">
      <Link
        href={`/campaigns/${campaign.id}`}
        className="flex flex-col gap-4 p-5 outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <TypeChip type={campaign.type} />
            <CampaignStatusBadge status={campaign.status} />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <h3 className="font-display group-hover:text-primary truncate text-lg leading-tight tracking-tight transition-colors">
            {campaign.name}
          </h3>
          <div className="text-muted-foreground flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1">
              <Users className="size-3.5" />
              {pluralize(campaign.recipientCount, "recipient")}
            </span>
            <span>{formatDate(campaign.createdAt)}</span>
          </div>
        </div>

        <div className="border-border/70 flex items-center gap-6 border-t pt-4">
          <Metric value={metrics.sent} label="Sent" tone="text-blue-600 dark:text-blue-400" />
          <Metric
            value={metrics.replied}
            label="Replied"
            tone="text-teal-600 dark:text-teal-400"
          />
          <Metric
            value={metrics.bounced}
            label="Bounced"
            tone="text-red-600 dark:text-red-400"
          />
          {metrics.meeting > 0 && (
            <Metric value={metrics.meeting} label="Meeting" tone="text-primary" />
          )}
          {metrics.converted > 0 && (
            <Metric
              value={metrics.converted}
              label="Converted"
              tone="text-emerald-600 dark:text-emerald-400"
            />
          )}
        </div>
      </Link>
    </Card>
  );
}
