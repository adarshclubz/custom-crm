import { StatusBadge } from "./status-badge";
import { LEAD_STATUS_VISUALS, type LeadStatus } from "./status-config";

export function LeadStatusBadge({
  status,
  showDot = true,
  className,
}: {
  status: LeadStatus | string;
  showDot?: boolean;
  className?: string;
}) {
  const visual =
    LEAD_STATUS_VISUALS[status as LeadStatus] ??
    LEAD_STATUS_VISUALS.not_contacted;
  return <StatusBadge visual={visual} showDot={showDot} className={className} />;
}
