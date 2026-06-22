"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Unplug, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DisconnectGmail({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function handleDisconnect() {
    setPending(true);
    try {
      const res = await fetch("/api/gmail", { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setDone(true);
      router.refresh();
    } catch {
      // Leave the dialog open so the user can retry.
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="text-destructive hover:text-destructive gap-1.5"
      >
        <Unplug className="size-4" />
        Disconnect
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl tracking-tight">
              Disconnect Gmail?
            </DialogTitle>
            <DialogDescription>
              {done ? (
                <><strong>{email}</strong> has been disconnected.</>
              ) : (
                <>
                  <strong>{email}</strong>
                  {" will be disconnected. You won't be able to send campaigns until you reconnect an account."}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {done ? "Close" : "Cancel"}
            </Button>
            {!done && (
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={pending}
                className="gap-1.5"
              >
                {pending && <Loader2 className="size-4 animate-spin" />}
                Disconnect
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
