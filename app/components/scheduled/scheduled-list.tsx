"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, X } from "lucide-react";

import { pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import type { ScheduledItem } from "@/lib/queue";

export function ScheduledList({ items }: { items: ScheduledItem[] }) {
  const router = useRouter();
  const [cancelingId, setCancelingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function cancel(batchId: string) {
    setError(null);
    setCancelingId(batchId);
    try {
      const res = await fetch(`/api/scheduled/${batchId}/cancel`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to cancel");
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel");
    } finally {
      setCancelingId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-16 text-center text-sm">
        <Clock className="size-6" />
        No scheduled sends.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="border-border rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Scheduled for</TableHead>
              <TableHead className="text-right">{""}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.batchId}>
                <TableCell className="font-medium">
                  {item.campaignName ?? "—"}
                </TableCell>
                <TableCell className="text-muted-foreground capitalize">
                  {item.kind === "followup" ? "Follow-up" : "Initial"}
                </TableCell>
                <TableCell className="tabular-nums">
                  {pluralize(item.recipientCount, "recipient")}
                </TableCell>
                <TableCell className="tabular-nums">
                  {new Date(item.scheduledAt).toLocaleString()}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={cancelingId === item.batchId}
                    onClick={() => cancel(item.batchId)}
                  >
                    {cancelingId === item.batchId ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <X className="size-3.5" />
                    )}
                    Cancel
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
