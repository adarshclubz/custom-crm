"use client";

import * as React from "react";
import { Send, ChevronDown, Clock, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Local Date -> value for <input type="datetime-local"> (YYYY-MM-DDTHH:mm).
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

// Split button: primary "Send now" action + an arrow that opens a panel to pick a
// date/time and schedule instead. onSchedule receives an ISO (UTC) timestamp.
export function ScheduleSendButton({
  label,
  loadingLabel = "Working…",
  disabled = false,
  loading = false,
  onSend,
  onSchedule,
}: {
  label: string;
  loadingLabel?: string;
  disabled?: boolean;
  loading?: boolean;
  onSend: () => void;
  onSchedule: (scheduledAtIso: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  // Earliest selectable time (~1 min out); computed when the panel opens so we
  // don't read the clock during render.
  const [min, setMin] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  function togglePanel() {
    setOpen((o) => {
      const next = !o;
      if (next) setMin(toLocalInput(new Date(Date.now() + 60_000)));
      return next;
    });
  }

  // Close the panel on an outside click.
  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function handleSchedule() {
    if (!value) return;
    const when = new Date(value);
    if (isNaN(when.getTime()) || when.getTime() <= Date.now()) {
      setError("Pick a time in the future.");
      return;
    }
    setError(null);
    setOpen(false);
    onSchedule(when.toISOString());
  }

  return (
    <div className="relative w-full" ref={ref}>
      <div className="flex w-full">
        <Button
          onClick={onSend}
          disabled={disabled || loading}
          className="flex-1 gap-1.5 rounded-r-none"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          {loading ? loadingLabel : label}
        </Button>
        <Button
          type="button"
          aria-label="Schedule send"
          onClick={togglePanel}
          disabled={disabled || loading}
          className="rounded-l-none border-l border-l-black/15 px-2.5 dark:border-l-white/20"
        >
          <ChevronDown className="size-4" />
        </Button>
      </div>

      {open && (
        <div className="border-border bg-card absolute bottom-full right-0 z-50 mb-2 w-72 rounded-xl border p-4 shadow-lg">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
            <Clock className="size-4" /> Schedule send
          </div>
          <Input
            type="datetime-local"
            value={value}
            min={min}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
          />
          {error && <p className="text-destructive mt-1.5 text-xs">{error}</p>}
          <Button
            onClick={handleSchedule}
            disabled={!value}
            className="mt-3 w-full gap-1.5"
          >
            <Send className="size-4" />
            Schedule
          </Button>
        </div>
      )}
    </div>
  );
}
