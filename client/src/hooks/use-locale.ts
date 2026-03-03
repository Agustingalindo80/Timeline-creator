import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { AppSettings } from "@shared/schema";

export function useLocale() {
  const { i18n } = useTranslation();
  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const locale = settings?.locale || "en";

  useEffect(() => {
    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale, i18n]);

  return locale;
}
