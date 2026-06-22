import { cn } from "@/lib/utils";
import type { StatusVisual } from "./status-config";

/**
 * Shared presentation for a status pill: subtle fill, a colored dot, and a label.
 * Lead and campaign badges both render through this so the look stays coherent.
 */
export function StatusBadge({
  visual,
  showDot = true,
  className,
}: {
  visual: StatusVisual;
  showDot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
        visual.badge,
        className
      )}
    >
      {showDot && (
        <span className="relative flex size-1.5">
          {visual.pulse && (
            <span
              className={cn(
                "absolute inline-flex size-full animate-ping rounded-full opacity-75",
                visual.dot
              )}
            />
          )}
          <span
            className={cn(
              "relative inline-flex size-1.5 rounded-full",
              visual.dot
            )}
          />
        </span>
      )}
      {visual.label}
    </span>
  );
}
