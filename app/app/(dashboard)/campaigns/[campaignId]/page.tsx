import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { getCampaignDetail } from "@/lib/campaigns";
import { formatDate, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CampaignStatusBadge } from "@/components/status/campaign-status-badge";
import { TypeChip } from "@/components/status/type-chip";
import { RecipientsTable } from "@/components/campaigns/recipients-table";

export const dynamic = "force-dynamic";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const detail = await getCampaignDetail(campaignId);
  if (!detail) notFound();

  const { campaign, recipients } = detail;

  const sent = recipients.filter((r) => r.sentCount > 0).length;
  const replied = recipients.filter((r) => r.status === "replied").length;
  const bounced = recipients.filter((r) => r.status === "bounced").length;
  const meeting = recipients.filter((r) => r.status === "meeting").length;
  const converted = recipients.filter((r) => r.status === "converted").length;

  const isSending = campaign.status === "sending";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div className="flex flex-col gap-4">
        <Link
          href="/campaigns"
          className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" />
          Campaigns
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-3xl tracking-tight">
              {campaign.name}
            </h1>
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <TypeChip type={campaign.type} />
              <CampaignStatusBadge status={campaign.status} />
              <span>·</span>
              <span>Created {formatDate(campaign.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sending-in-progress: a live progress read. */}
      {isSending && (
        <div className="border-border bg-card flex flex-col gap-2 rounded-xl border p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-blue-600 dark:text-blue-400">
              Sending in progress — paced out for deliverability
            </span>
            <span className="text-muted-foreground tabular-nums">
              {sent} of {recipients.length} sent
            </span>
          </div>
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{
                width: `${recipients.length ? (sent / recipients.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Metrics strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Recipients" value={recipients.length} />
        <MetricTile label="Sent" value={sent} tone="text-blue-600 dark:text-blue-400" />
        <MetricTile
          label="Replied"
          value={replied}
          tone="text-teal-600 dark:text-teal-400"
        />
        <MetricTile
          label="Bounced"
          value={bounced}
          tone="text-red-600 dark:text-red-400"
        />
        <MetricTile label="Meeting" value={meeting} tone="text-primary" />
        <MetricTile
          label="Converted"
          value={converted}
          tone="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl tracking-tight">Recipients</h2>
          <span className="text-muted-foreground text-sm">
            {pluralize(recipients.length, "recipient")}
          </span>
        </div>
        <RecipientsTable campaignId={campaign.id} recipients={recipients} />
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="border-border bg-card flex flex-col gap-1 rounded-xl border p-4">
      <span className={cn("text-2xl font-semibold tabular-nums", tone)}>
        {value.toLocaleString()}
      </span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}
