"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Megaphone, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { CampaignCard } from "@/components/campaigns/campaign-card";
import {
  CAMPAIGN_STATUS_ORDER,
  CAMPAIGN_STATUS_VISUALS,
  CAMPAIGN_TYPE_LABELS,
  type CampaignStatus,
  type CampaignType,
} from "@/components/status/status-config";
import type { CampaignSummary } from "@/lib/campaigns";

type StatusFilter = CampaignStatus | "all";
type TypeFilter = CampaignType | "all";

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary/30 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function CampaignsBrowser({
  campaigns,
}: {
  campaigns: CampaignSummary[];
}) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("all");
  const [type, setType] = React.useState<TypeFilter>("all");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (type !== "all" && c.type !== type) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [campaigns, query, status, type]);

  // First-run empty state (no campaigns at all) — friendly create CTA.
  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        title="No campaigns yet"
        description="Create your first campaign to start reaching out — bulk-templated to a list, or a single personalized email."
        action={
          <Button asChild className="mt-1">
            <Link href="/campaigns/new">
              <Plus className="size-4" />
              Create campaign
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search campaigns…"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <FilterChip active={status === "all"} onClick={() => setStatus("all")}>
              All
            </FilterChip>
            {CAMPAIGN_STATUS_ORDER.map((s) => (
              <FilterChip
                key={s}
                active={status === s}
                onClick={() => setStatus(s)}
              >
                {CAMPAIGN_STATUS_VISUALS[s].label}
              </FilterChip>
            ))}
          </div>
          <span className="bg-border h-5 w-px" aria-hidden />
          <div className="flex items-center gap-1.5">
            {(["all", "bulk", "single"] as TypeFilter[]).map((t) => (
              <FilterChip key={t} active={type === t} onClick={() => setType(t)}>
                {t === "all" ? "All types" : CAMPAIGN_TYPE_LABELS[t as CampaignType]}
              </FilterChip>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matching campaigns"
          description="Try a different search or clear the filters."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}
    </div>
  );
}
