import Link from "next/link";
import { Plus } from "lucide-react";

import { listCampaigns } from "@/lib/campaigns";
import { Button } from "@/components/ui/button";
import { CampaignsBrowser } from "@/components/campaigns/campaigns-browser";

// Always read fresh — campaign status and metrics change as sends/replies land.
export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await listCampaigns();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground text-sm">
            Every outreach campaign, newest first.
          </p>
        </div>
        <Button asChild>
          <Link href="/campaigns/new">
            <Plus className="size-4" />
            Create campaign
          </Link>
        </Button>
      </header>

      <CampaignsBrowser campaigns={campaigns} />
    </div>
  );
}
