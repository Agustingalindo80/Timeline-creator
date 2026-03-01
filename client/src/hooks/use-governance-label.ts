import { useQuery } from "@tanstack/react-query";
import type { AppSettings } from "@shared/schema";
import { getGovernanceLabel, getCoachLabel } from "@/config/terminology";

export function useGovernanceLabel() {
  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const label = getGovernanceLabel(settings?.governanceModelLabel);
  const coachLabel = getCoachLabel(settings?.governanceModelLabel);

  return { label, coachLabel, customLabel: settings?.governanceModelLabel };
}
