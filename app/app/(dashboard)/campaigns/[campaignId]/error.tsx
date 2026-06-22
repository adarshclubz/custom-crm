"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function CampaignDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
      <div className="bg-destructive/10 text-destructive flex size-12 items-center justify-center rounded-full">
        <AlertTriangle className="size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-lg tracking-tight">
          Couldn&apos;t load this campaign
        </h3>
        <p className="text-muted-foreground max-w-sm text-sm">
          {error.message || "Something went wrong."}
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset} variant="outline">
          Try again
        </Button>
        <Button asChild variant="ghost">
          <Link href="/campaigns">Back to campaigns</Link>
        </Button>
      </div>
    </div>
  );
}
