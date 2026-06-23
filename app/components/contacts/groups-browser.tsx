"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FolderOpen,
  UploadCloud,
  Check,
  Users,
  Loader2,
  UserPlus,
} from "lucide-react";

import { formatDate, pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/empty-state";
import { CsvDropzone, type CsvParseResult } from "@/components/csv-dropzone";
import { ManualAddDialog } from "@/components/contacts/manual-add-dialog";
import type { GroupSummary } from "@/lib/groups";

function UploadDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [csv, setCsv] = React.useState<CsvParseResult | null>(null);
  const [groupName, setGroupName] = React.useState("");
  const [done, setDone] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ created: number; updated: number } | null>(null);

  React.useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setCsv(null);
        setGroupName("");
        setDone(false);
        setError(null);
        setResult(null);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  function handleParsed(result: CsvParseResult) {
    setCsv(result);
    const raw = result.file.name.replace(/\.csv$/i, "").replace(/[_-]/g, " ");
    setGroupName(raw.charAt(0).toUpperCase() + raw.slice(1));
  }

  async function handleUpload() {
    if (!csv) return;
    setPending(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", csv.file);
      fd.append("groupName", groupName.trim());
      const res = await fetch("/api/contacts/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setResult({ created: data.created ?? 0, updated: data.updated ?? 0 });
      setDone(true);
      router.refresh(); // surface the new group in the list behind the dialog
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl tracking-tight">
            Upload a CSV
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {done ? (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                <Check className="size-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">
                  &ldquo;{groupName}&rdquo; imported
                </p>
                <p className="text-muted-foreground text-xs">
                  {result
                    ? `${pluralize(result.created, "contact")} created${
                        result.updated > 0 ? `, ${result.updated} updated` : ""
                      }.`
                    : `${pluralize(csv!.rows.length, "contact")} imported.`}
                </p>
              </div>
            </div>
          ) : (
            <>
              <CsvDropzone
                result={csv}
                onParsed={handleParsed}
                onClear={() => {
                  setCsv(null);
                  setGroupName("");
                }}
              />

              {csv && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="group-name">Group name</Label>
                  <Input
                    id="group-name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="e.g. Q3 Prospects"
                    autoFocus
                  />
                </div>
              )}

              {error && (
                <p className="text-destructive text-sm">{error}</p>
              )}

              {csv && (
                <Button
                  onClick={handleUpload}
                  disabled={!groupName.trim() || pending}
                  className="gap-1.5"
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <UploadCloud className="size-4" />
                  )}
                  Create group
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function GroupsBrowser({ groups }: { groups: GroupSummary[] }) {
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [manualOpen, setManualOpen] = React.useState(false);

  return (
    <>
      {groups.length === 0 ? (
        <div className="flex flex-col items-center py-12">
          <EmptyState
            icon={Users}
            title="No groups yet"
            description="Add contacts manually or upload a CSV to create your first group."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  onClick={() => setManualOpen(true)}
                  className="gap-1.5"
                >
                  <UserPlus className="size-4" />
                  Add manually
                </Button>
                <Button
                  onClick={() => setUploadOpen(true)}
                  variant="outline"
                  className="gap-1.5"
                >
                  <UploadCloud className="size-4" />
                  Upload a CSV
                </Button>
              </div>
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">
              {pluralize(groups.length, "group")}
            </span>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setManualOpen(true)}
                className="gap-1.5"
              >
                <UserPlus className="size-4" />
                Add contacts
              </Button>
              <Button
                onClick={() => setUploadOpen(true)}
                variant="outline"
                className="gap-1.5"
              >
                <UploadCloud className="size-4" />
                Upload CSV
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map((g) => (
              <GroupCard key={g.id} group={g} />
            ))}
          </div>
        </div>
      )}

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      <ManualAddDialog
        open={manualOpen}
        onOpenChange={setManualOpen}
        target={{ mode: "create" }}
      />
    </>
  );
}

function GroupCard({ group }: { group: GroupSummary }) {
  const hasOutcomes =
    group.replied > 0 || group.meeting > 0 || group.converted > 0;

  return (
    <Link
      href={`/contacts/${group.id}`}
      className="border-border bg-card hover:border-primary/40 flex flex-col gap-3 rounded-xl border p-5 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="bg-accent text-primary flex size-10 shrink-0 items-center justify-center rounded-lg">
          <FolderOpen className="size-5" />
        </div>
        <span className="text-muted-foreground text-xs">
          {formatDate(group.createdAt)}
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        <h3 className="font-display text-lg tracking-tight leading-tight">
          {group.name}
        </h3>
        <p className="text-muted-foreground text-sm">
          {pluralize(group.contactCount, "contact")}
          {group.sourceFilename && (
            <span className="ml-1.5 opacity-60">· {group.sourceFilename}</span>
          )}
        </p>
      </div>

      {hasOutcomes && (
        <div className="flex flex-wrap gap-1.5">
          {group.replied > 0 && (
            <span className="bg-teal-500/10 text-teal-700 dark:text-teal-400 rounded-full px-2 py-0.5 text-xs font-medium">
              {group.replied} replied
            </span>
          )}
          {group.meeting > 0 && (
            <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-xs font-medium">
              {group.meeting} meeting
            </span>
          )}
          {group.converted > 0 && (
            <span className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-full px-2 py-0.5 text-xs font-medium">
              {group.converted} converted
            </span>
          )}
        </div>
      )}
    </Link>
  );
}
