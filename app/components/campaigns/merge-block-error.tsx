"use client";

import { AlertTriangle, PenLine, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BulkValidation } from "@/lib/templates";

// The frequent, must-handle-well state: a bulk send is blocked because the
// template references fields some recipients don't have (or an unknown tag).
// Lists exactly who's missing what and offers recoverable next steps.
export function MergeBlockError({
  validation,
  source,
  onEditTemplate,
  onReupload,
}: {
  validation: BulkValidation;
  source: "group" | "csv";
  onEditTemplate: () => void;
  onReupload?: () => void;
}) {
  const { unknownTags, offenders } = validation;

  return (
    <div className="border-destructive/30 bg-destructive/5 flex flex-col gap-4 rounded-xl border p-5">
      <div className="flex items-start gap-3">
        <div className="bg-destructive/10 text-destructive flex size-9 shrink-0 items-center justify-center rounded-lg">
          <AlertTriangle className="size-5" />
        </div>
        <div className="flex flex-col gap-0.5">
          <h3 className="font-display text-lg tracking-tight">Send blocked</h3>
          <p className="text-muted-foreground text-sm">
            Nothing will send until every recipient has the fields your template
            uses. Fix the data or the template, then retry.
          </p>
        </div>
      </div>

      {unknownTags.length > 0 && (
        <div className="border-border bg-card rounded-lg border p-4">
          <p className="text-sm font-medium">Unsupported merge tags</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Your template references{" "}
            {unknownTags.map((t, i) => (
              <span key={t}>
                <code className="text-destructive">{`{{${t}}}`}</code>
                {i < unknownTags.length - 1 ? ", " : ""}
              </span>
            ))}
            . Only <code>{`{{name}}`}</code> and <code>{`{{company}}`}</code> are
            supported — edit the template to continue.
          </p>
        </div>
      )}

      {offenders.length > 0 && (
        <div className="border-border bg-card overflow-hidden rounded-lg border">
          <div className="border-b px-4 py-2.5 text-sm font-medium">
            {offenders.length} recipient{offenders.length === 1 ? "" : "s"} missing
            data
          </div>
          <ul className="divide-border max-h-64 divide-y overflow-y-auto">
            {offenders.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <span className="truncate">{o.email}</span>
                <span className="flex shrink-0 gap-1.5">
                  {o.missing.map((m) => (
                    <span
                      key={m}
                      className="bg-destructive/10 text-destructive rounded-md border border-destructive/20 px-1.5 py-0.5 text-xs font-medium"
                    >
                      missing {m}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onEditTemplate} className="gap-1.5">
          <PenLine className="size-4" />
          Edit template
        </Button>
        {source === "csv" && onReupload && (
          <Button variant="outline" onClick={onReupload} className="gap-1.5">
            <UploadCloud className="size-4" />
            Re-upload CSV
          </Button>
        )}
      </div>
    </div>
  );
}
