import Link from "next/link";
import { Mail, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";

import { getGmailStatus } from "@/lib/gmail";
import { formatDate, formatDateTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DisconnectGmail } from "@/components/settings/disconnect-gmail";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail_connected?: string; gmail_error?: string }>;
}) {
  const status = await getGmailStatus();
  const { gmail_connected, gmail_error } = await searchParams;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm">
          Manage the Gmail account campaigns are sent from.
        </p>
      </div>

      {/* Post-connect feedback (from the OAuth callback redirect). */}
      {gmail_connected && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          <span>
            Connected <strong>{gmail_connected}</strong>.
          </span>
        </div>
      )}
      {gmail_error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm">
          <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
          <span>
            Couldn&apos;t connect Gmail: <strong>{gmail_error}</strong>. Try
            again.
          </span>
        </div>
      )}

      <section className="border-border bg-card flex flex-col gap-5 rounded-xl border p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl tracking-tight">
            Gmail connection
          </h2>
          {status.connected && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <span className="size-2 rounded-full bg-emerald-500" />
              Active
            </span>
          )}
        </div>

        {status.connected ? (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="bg-accent text-primary flex size-11 shrink-0 items-center justify-center rounded-lg">
                <Mail className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-medium">{status.email}</span>
                <span className="text-muted-foreground text-sm">
                  Connected {formatDate(status.connectedAt)}
                </span>
              </div>
            </div>

            <dl className="border-border grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
              <Field label="Status" value="Connected" />
              <Field
                label="Token refreshes"
                value={
                  status.tokenExpiry
                    ? formatDateTime(status.tokenExpiry)
                    : "Auto"
                }
              />
            </dl>

            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                Campaigns send from this account.
              </p>
              <DisconnectGmail email={status.email!} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="bg-accent text-primary flex size-14 items-center justify-center rounded-full">
              <Mail className="size-7" />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-medium">No Gmail connected</p>
              <p className="text-muted-foreground max-w-sm text-sm">
                Connect a Gmail account to send campaigns and follow-ups. We use
                it only to send and read your outreach threads.
              </p>
            </div>
            <Button asChild className="gap-1.5">
              <a href="/api/auth/google">
                Connect Gmail
                <ArrowRight className="size-4" />
              </a>
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card flex flex-col gap-0.5 p-4">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}
