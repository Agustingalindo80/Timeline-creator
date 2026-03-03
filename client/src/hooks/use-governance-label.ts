import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { AppSettings } from "@shared/schema";

export function useGovernanceLabel() {
  const { t } = useTranslation();
  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const label = settings?.governanceModelLabel || t("governance.operatingModel");
  const coachLabel = settings?.governanceModelLabel
    ? `${settings.governanceModelLabel} Coach`
    : t("governance.governanceCoach");

  return { label, coachLabel, customLabel: settings?.governanceModelLabel };
}
