"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, UserPlus, Plus, X } from "lucide-react";

import { pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Where the entered contacts should land:
//  - create: make a new group from the entered name (Contacts page).
//  - append: add them to an existing group (inside a group's detail page).
export type ManualAddTarget =
  | { mode: "create" }
  | { mode: "append"; groupId: string; groupName: string };

type ManualRow = {
  id: string;
  email: string;
  name: string;
  company: string;
  tags: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function newRow(): ManualRow {
  return {
    id: Math.random().toString(36).slice(2),
    email: "",
    name: "",
    company: "",
    tags: "",
  };
}

export function ManualAddDialog({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  target: ManualAddTarget;
}) {
  const router = useRouter();
  const isAppend = target.mode === "append";
  const [groupName, setGroupName] = React.useState("");
  const [rows, setRows] = React.useState<ManualRow[]>([newRow()]);
  const [done, setDone] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{
    created: number;
    updated: number;
    errored: number;
  } | null>(null);

  React.useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setGroupName("");
        setRows([newRow()]);
        setDone(false);
        setError(null);
        setResult(null);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  function updateRow(id: string, patch: Partial<ManualRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((rs) => [...rs, newRow()]);
  }

  function removeRow(id: string) {
    setRows((rs) => (rs.length === 1 ? rs : rs.filter((r) => r.id !== id)));
  }

  // At least one row carries a syntactically valid email — the server is the
  // authoritative check, this just gates the Save button. Create mode also
  // requires a group name; append mode targets an existing group.
  const hasValidEmail = rows.some((r) => EMAIL_RE.test(r.email.trim()));
  const canSave =
    (isAppend || groupName.trim().length > 0) && hasValidEmail && !pending;

  async function handleSave() {
    setPending(true);
    setError(null);
    try {
      const contacts = rows
        .filter((r) => r.email.trim())
        .map((r) => ({
          email: r.email.trim(),
          name: r.name.trim() || undefined,
          company: r.company.trim() || undefined,
          tags: r.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }));
      const body = isAppend
        ? { groupId: target.groupId, contacts }
        : { groupName: groupName.trim(), contacts };
      const res = await fetch("/api/contacts/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to add contacts");
      setResult({
        created: data.created ?? 0,
        updated: data.updated ?? 0,
        errored: data.errored ?? 0,
      });
      setDone(true);
      router.refresh(); // surface the new/updated contacts behind the dialog
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add contacts");
    } finally {
      setPending(false);
    }
  }

  const title = isAppend ? `Add to ${target.groupName}` : "Add contacts";
  const saveLabel = isAppend ? "Add contacts" : "Create group";
  const successHeading = isAppend
    ? `Added to ${target.groupName}`
    : `“${groupName}” created`;
  const successDetail = result
    ? `${pluralize(result.created, "contact")} added${
        result.updated > 0 ? `, ${result.updated} updated` : ""
      }${
        result.errored > 0
          ? `, ${result.errored} skipped (missing/invalid email)`
          : ""
      }.`
    : "Contacts added.";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-tight">
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {done ? (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                <Check className="size-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">{successHeading}</p>
                <p className="text-muted-foreground text-xs">{successDetail}</p>
              </div>
            </div>
          ) : (
            <>
              {!isAppend && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="manual-group-name">Group name</Label>
                  <Input
                    id="manual-group-name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Conference leads"
                    autoFocus
                  />
                </div>
              )}

              <div className="flex flex-col gap-3">
                {rows.map((row, i) => {
                  const emailInvalid =
                    row.email.trim().length > 0 &&
                    !EMAIL_RE.test(row.email.trim());
                  return (
                    <div
                      key={row.id}
                      className="border-border bg-muted/30 relative flex flex-col gap-2 rounded-xl border p-3"
                    >
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          aria-label="Remove contact"
                          className="text-muted-foreground hover:text-foreground absolute right-2 top-2 rounded-md p-1 transition-colors"
                        >
                          <X className="size-4" />
                        </button>
                      )}
                      <div className="flex flex-col gap-1">
                        <Label
                          htmlFor={`email-${row.id}`}
                          className="text-xs"
                        >
                          Email <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`email-${row.id}`}
                          type="email"
                          value={row.email}
                          onChange={(e) =>
                            updateRow(row.id, { email: e.target.value })
                          }
                          placeholder="name@company.com"
                          aria-invalid={emailInvalid}
                          autoFocus={i === 0 ? isAppend : true}
                        />
                        {emailInvalid && (
                          <p className="text-destructive text-xs">
                            Enter a valid email address.
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="flex flex-col gap-1">
                          <Label
                            htmlFor={`name-${row.id}`}
                            className="text-xs"
                          >
                            Name
                          </Label>
                          <Input
                            id={`name-${row.id}`}
                            value={row.name}
                            onChange={(e) =>
                              updateRow(row.id, { name: e.target.value })
                            }
                            placeholder="Jane Doe"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label
                            htmlFor={`company-${row.id}`}
                            className="text-xs"
                          >
                            Company
                          </Label>
                          <Input
                            id={`company-${row.id}`}
                            value={row.company}
                            onChange={(e) =>
                              updateRow(row.id, { company: e.target.value })
                            }
                            placeholder="Acme Inc."
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Label htmlFor={`tags-${row.id}`} className="text-xs">
                          Tags
                        </Label>
                        <Input
                          id={`tags-${row.id}`}
                          value={row.tags}
                          onChange={(e) =>
                            updateRow(row.id, { tags: e.target.value })
                          }
                          placeholder="comma, separated, tags"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={addRow}
                className="gap-1.5"
              >
                <Plus className="size-4" />
                Add another
              </Button>

              {error && <p className="text-destructive text-sm">{error}</p>}

              <Button
                onClick={handleSave}
                disabled={!canSave}
                className="gap-1.5"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                {saveLabel}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
