"use client";

import * as React from "react";
import { Send, Users, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDate, pluralize } from "@/lib/format";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { LeadStatusBadge } from "@/components/status/lead-status-badge";
import {
  ConversationDrawer,
  type DrawerRecipient,
} from "@/components/campaigns/conversation-drawer";
import { FollowUpSheet } from "@/components/campaigns/followup-sheet";
import type { RecipientStat } from "@/lib/campaigns";

export function RecipientsTable({
  campaignId,
  recipients,
}: {
  campaignId: string;
  recipients: RecipientStat[];
}) {
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [active, setActive] = React.useState<DrawerRecipient | null>(null);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [followupOpen, setFollowupOpen] = React.useState(false);
  // Optimistic +1 per contact after a follow-up is queued (cleared on unmount only).
  const [followupOverrides, setFollowupOverrides] = React.useState<
    Map<string, number>
  >(new Map());

  const allSelected =
    recipients.length > 0 && selected.size === recipients.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(
      allSelected ? new Set() : new Set(recipients.map((r) => r.contactId))
    );
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedRecipients = recipients.filter((r) => selected.has(r.contactId));

  function handleFollowUpSent(contactIds: string[]) {
    setFollowupOverrides((prev) => {
      const next = new Map(prev);
      for (const id of contactIds) next.set(id, (next.get(id) ?? 0) + 1);
      return next;
    });
    setSelected(new Set());
  }

  function openConversation(r: RecipientStat) {
    setActive({
      contactId: r.contactId,
      name: r.name,
      email: r.email,
      company: r.company,
      status: r.status,
      threadId: r.threadId,
    });
    setDrawerOpen(true);
  }

  if (recipients.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No recipients"
        description="This campaign doesn't have any recipients yet."
      />
    );
  }

  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      {/* Selection action bar */}
      {selected.size > 0 && (
        <div className="bg-primary/5 border-primary/20 flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <span className="text-sm font-medium">
            {pluralize(selected.size, "recipient")} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => setFollowupOpen(true)}
            >
              <Send className="size-3.5" />
              Send follow-up
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              className="gap-1.5"
            >
              <X className="size-3.5" />
              Clear
            </Button>
          </div>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10 pl-4">
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={toggleAll}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-center">Follow-ups</TableHead>
            <TableHead>First reach-out</TableHead>
            <TableHead>Last reach-out</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recipients.map((r) => {
            const isSelected = selected.has(r.contactId);
            return (
              <TableRow
                key={r.contactId}
                data-state={isSelected ? "selected" : undefined}
                onClick={() => openConversation(r)}
                className="cursor-pointer"
              >
                <TableCell
                  className="pl-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleOne(r.contactId)}
                    aria-label={`Select ${r.email}`}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {r.name || <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="text-muted-foreground">{r.email}</TableCell>
                <TableCell className="text-muted-foreground">
                  {r.company || "—"}
                </TableCell>
                <TableCell>
                  <LeadStatusBadge status={r.status} />
                </TableCell>
                <TableCell className="text-center tabular-nums">
                  {(() => {
                    const count =
                      r.followupCount + (followupOverrides.get(r.contactId) ?? 0);
                    return count > 0 ? (
                      count
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    );
                  })()}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(r.firstReachOutAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(r.lastReachOutAt)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <ConversationDrawer
        recipient={active}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />

      <FollowUpSheet
        campaignId={campaignId}
        open={followupOpen}
        onOpenChange={setFollowupOpen}
        recipients={selectedRecipients}
        onSent={handleFollowUpSent}
      />
    </div>
  );
}
