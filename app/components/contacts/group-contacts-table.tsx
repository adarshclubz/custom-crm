"use client";

import * as React from "react";
import { Mail, Link2, Camera, Trash2, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDate, pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  LEAD_STATUS_VISUALS,
  LEAD_STATUS_ORDER,
  type LeadStatus,
} from "@/components/status/status-config";
import type { GroupContact } from "@/lib/groups";

// ----------------------------- Status picker --------------------------------

function StatusPickerDialog({
  contact,
  currentStatus,
  onSave,
  onClose,
}: {
  contact: GroupContact;
  currentStatus: LeadStatus;
  onSave: (status: LeadStatus) => void;
  onClose: () => void;
}) {
  const [pending, setPending] = React.useState<LeadStatus>(currentStatus);
  const showVia = pending === "meeting" || pending === "converted";

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-tight">
            Set status
          </DialogTitle>
          <DialogDescription>
            {contact.name ?? contact.email}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1">
          {LEAD_STATUS_ORDER.map((s) => {
            const v = LEAD_STATUS_VISUALS[s];
            const active = pending === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setPending(s)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                  active
                    ? "bg-accent"
                    : "hover:bg-accent/60"
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                    active ? "border-primary" : "border-muted-foreground/30"
                  )}
                >
                  {active && (
                    <span className="size-2 rounded-full bg-primary" />
                  )}
                </span>
                <span
                  className={cn(
                    "flex size-2.5 shrink-0 rounded-full",
                    v.dot
                  )}
                />
                <span className={active ? "font-medium" : ""}>{v.label}</span>
              </button>
            );
          })}
        </div>

        {/* Via channel — extensibility slot. Email only today; LinkedIn and
            Instagram channels are coming soon and shown greyed out so the
            picker layout already accommodates them. */}
        {showVia && (
          <div className="border-border rounded-lg border p-3">
            <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wide">
              Via
            </p>
            <div className="flex gap-2">
              <span className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary">
                <Mail className="size-3.5" />
                Email
              </span>
              <span className="text-muted-foreground/40 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs">
                <Link2 className="size-3.5" />
                LinkedIn
              </span>
              <span className="text-muted-foreground/40 flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs">
                <Camera className="size-3.5" />
                Instagram
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => { onSave(pending); onClose(); }}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------- Remove confirm --------------------------------

function RemoveDialog({
  contact,
  onConfirm,
  onClose,
}: {
  contact: GroupContact;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-tight">
            Remove contact?
          </DialogTitle>
          <DialogDescription>
            {contact.name ? (
              <>
                <strong>{contact.name}</strong> ({contact.email}) will be
                removed from this group. This can&apos;t be undone.
              </>
            ) : (
              <>
                <strong>{contact.email}</strong> will be removed from this
                group. This can&apos;t be undone.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => { onConfirm(); onClose(); }}
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------- Main table -----------------------------------

export function GroupContactsTable({
  contacts: initial,
}: {
  contacts: GroupContact[];
}) {
  // Optimistic local state — removals and status changes persist until page refresh.
  const [contacts, setContacts] = React.useState(initial);
  // Re-seed when the server sends a fresh list (e.g. after router.refresh() once
  // contacts are added to this group). Safe because removals/status changes are
  // already persisted server-side, so a fresh fetch stays consistent.
  React.useEffect(() => {
    setContacts(initial);
  }, [initial]);
  const [statusOverrides, setStatusOverrides] = React.useState<
    Record<string, LeadStatus>
  >({});
  const [pickerFor, setPickerFor] = React.useState<GroupContact | null>(null);
  const [removeFor, setRemoveFor] = React.useState<GroupContact | null>(null);

  async function handleStatusSave(contactId: string, status: LeadStatus) {
    // Optimistic: show the new badge immediately, revert if the write fails.
    const prevStatus = statusOverrides[contactId];
    setStatusOverrides((prev) => ({ ...prev, [contactId]: status }));
    try {
      const res = await fetch(`/api/contacts/${contactId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      setStatusOverrides((prev) => {
        const next = { ...prev };
        if (prevStatus === undefined) delete next[contactId];
        else next[contactId] = prevStatus;
        return next;
      });
    }
  }

  async function handleRemove(contactId: string) {
    // Optimistic removal; restore the row if the delete fails.
    const snapshot = contacts;
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
    setStatusOverrides((prev) => {
      const next = { ...prev };
      delete next[contactId];
      return next;
    });
    try {
      const res = await fetch(`/api/contacts/${contactId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
    } catch {
      setContacts(snapshot);
    }
  }

  if (contacts.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No contacts"
        description="This group has no contacts."
      />
    );
  }

  return (
    <>
      <div className="border-border bg-card overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last reach-out</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((c) => {
              const effectiveStatus = (statusOverrides[c.id] ??
                c.status) as LeadStatus;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {c.name || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.company || "—"}
                  </TableCell>
                  <TableCell>
                    {c.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {c.tags.map((t) => (
                          <span
                            key={t}
                            className="bg-accent text-muted-foreground rounded px-1.5 py-0.5 text-xs"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => setPickerFor(c)}
                      className="cursor-pointer transition-opacity hover:opacity-80"
                      aria-label="Change status"
                    >
                      <LeadStatusBadge status={effectiveStatus} />
                    </button>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(c.lastContactedAt)}
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => setRemoveFor(c)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Remove contact"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {pickerFor && (
        <StatusPickerDialog
          contact={pickerFor}
          currentStatus={
            (statusOverrides[pickerFor.id] ?? pickerFor.status) as LeadStatus
          }
          onSave={(status) => handleStatusSave(pickerFor.id, status)}
          onClose={() => setPickerFor(null)}
        />
      )}

      {removeFor && (
        <RemoveDialog
          contact={removeFor}
          onConfirm={() => handleRemove(removeFor.id)}
          onClose={() => setRemoveFor(null)}
        />
      )}
    </>
  );
}
