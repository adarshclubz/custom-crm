"use client";

export default function GroupDetailError({ error }: { error: Error }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <h1 className="font-display text-3xl tracking-tight">Group</h1>
      <div className="border-destructive/30 bg-destructive/5 rounded-xl border p-6 text-sm">
        <p className="font-medium">Failed to load group</p>
        <p className="text-muted-foreground mt-1">{error.message}</p>
      </div>
    </div>
  );
}
