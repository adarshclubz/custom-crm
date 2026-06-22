import { listScheduled } from "@/lib/queue";
import { ScheduledList } from "@/components/scheduled/scheduled-list";

// Always read fresh — schedules change as they're created, canceled, or sent.
export const dynamic = "force-dynamic";

export default async function ScheduledPage() {
  const scheduled = await listScheduled();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl tracking-tight">Scheduled</h1>
        <p className="text-muted-foreground text-sm">
          Sends queued for a future time, soonest first.
        </p>
      </header>

      <ScheduledList items={scheduled} />
    </div>
  );
}
