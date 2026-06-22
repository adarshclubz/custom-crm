"use client";

import * as React from "react";
import { Loader2, MessageSquareOff, Send } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LeadStatusBadge } from "@/components/status/lead-status-badge";

export interface DrawerRecipient {
  contactId: string;
  name: string | null;
  email: string;
  company: string | null;
  status: string;
  threadId: string | null;
}

interface ConversationMessage {
  direction: "outbound" | "inbound";
  at: string;
  subject: string | null;
  from: string | null;
  body: string | null;
  providerMessageId: string | null;
}

export function ConversationDrawer({
  recipient,
  open,
  onOpenChange,
}: {
  recipient: DrawerRecipient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<ConversationMessage[]>([]);
  const [reply, setReply] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [sendError, setSendError] = React.useState<string | null>(null);

  const threadId = recipient?.threadId ?? null;

  // Reply keeps the thread's subject, prefixed with "Re:" once.
  const baseSubject =
    messages.find((m) => m.subject)?.subject?.replace(/^re:\s*/i, "") ?? "";
  const replySubject = baseSubject ? `Re: ${baseSubject}` : "Re:";

  async function handleReply() {
    if (!recipient || !threadId || !reply.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/send/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: recipient.contactId,
          subject: replySubject,
          body: reply,
          threadId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send");
      // Optimistically append the just-sent message to the timeline.
      setMessages((prev) => [
        ...prev,
        {
          direction: "outbound",
          at: new Date().toISOString(),
          subject: replySubject,
          from: null,
          body: reply,
          providerMessageId: data.sentEmailId ?? null,
        },
      ]);
      setReply("");
    } catch (e) {
      setSendError(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  React.useEffect(() => {
    if (!open || !threadId) {
      setMessages([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/threads/${threadId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed to load conversation (${r.status})`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setMessages(data.messages ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, threadId]);

  // Reset the composer whenever we switch recipients.
  React.useEffect(() => {
    setReply("");
  }, [recipient?.contactId]);

  const displayName = recipient?.name || recipient?.email || "Conversation";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <div className="flex items-center gap-2 pr-8">
            <SheetTitle className="font-display truncate text-lg tracking-tight">
              {displayName}
            </SheetTitle>
            {recipient && <LeadStatusBadge status={recipient.status} />}
          </div>
          <p className="text-muted-foreground truncate text-sm">
            {recipient?.email}
            {recipient?.company ? ` · ${recipient.company}` : ""}
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!threadId ? (
            <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-center">
              <MessageSquareOff className="size-8 opacity-60" />
              <p className="text-sm">
                No messages yet — this recipient hasn&apos;t been emailed in this
                campaign.
              </p>
            </div>
          ) : loading ? (
            <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> Loading conversation…
            </div>
          ) : error ? (
            <div className="text-destructive flex h-full items-center justify-center text-sm">
              {error}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((m, i) => (
                <MessageBubble key={m.providerMessageId ?? i} message={m} />
              ))}
            </div>
          )}
        </div>

        <div className="bg-background/80 border-t p-4 backdrop-blur">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={
              threadId
                ? "Write a reply… (threads into this conversation)"
                : "No conversation to reply to yet"
            }
            disabled={!threadId}
            className="min-h-20 resize-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-muted-foreground text-xs">
              {sendError ? (
                <span className="text-destructive">{sendError}</span>
              ) : (
                "Threaded reply — sends in this conversation."
              )}
            </span>
            <Button
              size="sm"
              onClick={handleReply}
              disabled={!threadId || !reply.trim() || sending}
              className="gap-1.5"
            >
              {sending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Send
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  const outbound = message.direction === "outbound";
  return (
    <div className={cn("flex flex-col gap-1", outbound ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl border px-4 py-2.5 text-sm whitespace-pre-wrap",
          outbound
            ? "bg-primary/10 border-primary/20 rounded-br-sm"
            : "bg-muted border-border rounded-bl-sm"
        )}
      >
        {message.subject && (
          <p className="mb-1 text-xs font-semibold opacity-80">{message.subject}</p>
        )}
        {message.body || (
          <span className="text-muted-foreground italic">No content</span>
        )}
      </div>
      <span className="text-muted-foreground px-1 text-[11px]">
        {outbound ? "You" : message.from || "Them"} · {formatDateTime(message.at)}
      </span>
    </div>
  );
}
