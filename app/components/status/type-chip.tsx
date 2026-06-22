import { cn } from "@/lib/utils";
import { CAMPAIGN_TYPE_LABELS, type CampaignType } from "./status-config";

/**
 * Bulk / Single campaign type chip. Outline treatment so it reads as a quiet
 * classifier next to the louder status badge.
 */
export function TypeChip({
  type,
  className,
}: {
  type: CampaignType | string;
  className?: string;
}) {
  const label = CAMPAIGN_TYPE_LABELS[type as CampaignType] ?? type;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-md border border-border bg-transparent px-2 py-0.5 text-xs font-medium text-muted-foreground",
        className
      )}
    >
      {label}
    </span>
  );
}
