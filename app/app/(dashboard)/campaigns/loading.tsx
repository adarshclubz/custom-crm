import { Skeleton } from "@/components/ui/skeleton";

export default function CampaignsLoading() {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-40 rounded-lg" />
      </header>

      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-72 rounded-lg" />
        <Skeleton className="h-7 w-80 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="border-border bg-card flex flex-col gap-4 rounded-xl border p-5"
          >
            <div className="flex gap-2">
              <Skeleton className="h-5 w-14" />
              <Skeleton className="h-5 w-16" />
            </div>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <div className="border-border/70 flex gap-6 border-t pt-4">
              <Skeleton className="h-8 w-10" />
              <Skeleton className="h-8 w-10" />
              <Skeleton className="h-8 w-10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
