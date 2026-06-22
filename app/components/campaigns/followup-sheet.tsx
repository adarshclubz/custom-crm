"use client";

import * as React from "react";
import { Check, Loader2 } from "lucide-react";

import { pluralize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { MERGE_FIELDS } from "@/lib/templates";
import { ScheduleSendButton } from "@/components/campaigns/schedule-send-button";
import type { RecipientStat } from "@/lib/campaigns";

type Phase = "compose" | "sending" | "done";

export function FollowUpSheet({
  campaignId,
  open,
  onOpenChange,
  recipients,
  onSent,
}: {
  campaignId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  recipients: RecipientStat[];
  onSent: (contactIds: string[]) => void;
}) {
  const [phase, setPhase] = React.useState<Phase>("compose");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  // Snapshot taken at send-click so the done state always shows the original list
  // even after onSent clears the parent selection (which zeroes out the prop).
  const [sentRecipients, setSentRecipients] = React.useState<RecipientStat[]>([]);
  // Set when the follow-up was scheduled (vs. sent now), to vary the done copy.
  const [scheduledFor, setScheduledFor] = React.useState<string | null>(null);
  const subjectRef = React.useRef<HTMLInputElement>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);
  const lastFocused = React.useRef<"subject" | "body">("body");

  React.useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setPhase("compose");
        setSubject("");
        setBody("");
        setError(null);
        setScheduledFor(null);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [open]);

  function insertTag(tag: string) {
    const field = lastFocused.current;
    const el = field === "subject" ? subjectRef.current : bodyRef.current;
    const value = field === "subject" ? subject : body;
    const setter = field === "subject" ? setSubject : setBody;
    const token = `{{${tag}}}`;
    if (!el) {
      setter(value + token);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    setter(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  async function handleSend(scheduledAt?: string) {
    const snapshot = [...recipients];
    setSentRecipients(snapshot);
    setError(null);
    setPhase("sending");
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientContactIds: snapshot.map((r) => r.contactId),
          subject,
          body,
          ...(scheduledAt ? { scheduledAt } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error === "send_blocked"
            ? "Some recipients are missing a value used in the message."
            : data.error === "no_thread"
              ? "Some recipients haven't been emailed in this campaign yet."
              : (data.error ?? "Follow-up failed")
        );
      }
      if (scheduledAt) setScheduledFor(scheduledAt);
      onSent(snapshot.map((r) => r.contactId));
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Follow-up failed");
      setPhase("compose");
    }
  }

  const canSend = subject.trim().length > 0 && body.trim().length > 0;
  const peek = recipients.slice(0, 3);
  const overflow = recipients.length - 3;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader className="pb-0">
          <SheetTitle className="font-display text-xl tracking-tight">
            {phase === "done"
              ? scheduledFor
                ? "Follow-up scheduled"
                : "Follow-up sent"
              : "Send follow-up"}
          </SheetTitle>
          <SheetDescription>
            {phase === "done"
              ? scheduledFor
                ? `Scheduled for ${pluralize(
                    sentRecipients.length,
                    "recipient"
                  )} on ${new Date(scheduledFor).toLocaleString()}.`
                : `Queued for ${pluralize(sentRecipients.length, "recipient")}.`
              : `Composing for ${pluralize(recipients.length, "recipient")}`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 px-6">
          {/* Recipient peek chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {peek.map((r) => (
              <span
                key={r.contactId}
                className="bg-muted text-foreground flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-xs font-medium"
              >
                <span className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold">
                  {(r.name ?? r.email)[0].toUpperCase()}
                </span>
                {r.name ?? r.email}
              </span>
            ))}
            {overflow > 0 && (
              <span className="text-muted-foreground text-xs">
                +{overflow} more
              </span>
            )}
          </div>

          {phase === "compose" && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  Insert tag:
                </span>
                {MERGE_FIELDS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => insertTag(f)}
                    className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15 rounded-md border px-2 py-0.5 font-mono text-xs"
                  >
                    {`{{${f}}}`}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="followup-subject">Subject</Label>
                <Input
                  id="followup-subject"
                  ref={subjectRef}
                  value={subject}
                  onFocus={() => (lastFocused.current = "subject")}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Re: Following up"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="followup-body">Body</Label>
                <Textarea
                  id="followup-body"
                  ref={bodyRef}
                  value={body}
                  onFocus={() => (lastFocused.current = "body")}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={`Hi {{name}},\n\nJust wanted to follow up on my previous email…`}
                  className="min-h-52"
                />
                <p className="text-muted-foreground text-xs">
                  Plain text. Sends in-thread, replying to the original email.
                </p>
              </div>
            </>
          )}

          {phase === "sending" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16">
              <div className="bg-primary/10 flex size-14 items-center justify-center rounded-full">
                <Loader2 className="text-primary size-7 animate-spin" />
              </div>
              <p className="text-muted-foreground text-sm">
                Sending to {pluralize(sentRecipients.length, "recipient")}…
              </p>
            </div>
          )}

          {phase === "done" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                  <Check className="size-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {scheduledFor ? "Scheduled for " : "Queued for "}
                    {pluralize(sentRecipients.length, "recipient")}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {scheduledFor
                      ? `Will send on ${new Date(scheduledFor).toLocaleString()}, paced out for deliverability.`
                      : "Queued and sending shortly, paced out for deliverability."}
                  </span>
                </div>
              </div>

              <div className="border-border overflow-hidden rounded-lg border">
                <div className="border-b px-4 py-2.5 text-sm font-medium">
                  {pluralize(sentRecipients.length, "recipient")}
                </div>
                <ul className="divide-border max-h-64 divide-y overflow-y-auto">
                  {sentRecipients.map((r) => (
                    <li
                      key={r.contactId}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                    >
                      <span className="truncate">{r.name ?? r.email}</span>
                      <span className="flex shrink-0 items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <Check className="size-3.5" />
                        <span className="text-xs">
                          {scheduledFor ? "Scheduled" : "Queued"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <SheetFooter>
          {phase === "compose" && error && (
            <p className="text-destructive w-full text-sm">{error}</p>
          )}
          {phase === "compose" && (
            <ScheduleSendButton
              label="Send follow-up"
              disabled={!canSend}
              onSend={() => handleSend()}
              onSchedule={(iso) => handleSend(iso)}
            />
          )}
          {phase === "done" && (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full"
            >
              Done
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
