import { StatusBadge } from "./status-badge";
import {
  CAMPAIGN_STATUS_VISUALS,
  type CampaignStatus,
} from "./status-config";

export function CampaignStatusBadge({
  status,
  showDot = true,
  className,
}: {
  status: CampaignStatus | string;
  showDot?: boolean;
  className?: string;
}) {
  const visual =
    CAMPAIGN_STATUS_VISUALS[status as CampaignStatus] ??
    CAMPAIGN_STATUS_VISUALS.draft;
  return <StatusBadge visual={visual} showDot={showDot} className={className} />;
}
