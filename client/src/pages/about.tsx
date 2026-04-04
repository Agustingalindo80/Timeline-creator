import { Helmet } from "react-helmet-async";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useBranding } from "@/components/branding-provider";
import { useAppTitle } from "@/hooks/use-app-title";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  Building2,
  FolderKanban,
  Users,
  Clock,
  TrendingUp,
  BarChart3,
  Shield,
  Palette,
  SlidersHorizontal,
  Layers,
  DollarSign,
  Heart,
  FileSpreadsheet,
  Moon,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Bot,
  Target,
  Calculator,
  ArrowRightLeft,
  Upload,
  UserCheck,
  Milestone,
  CalendarRange,
  Globe,
  ShieldCheck,
  Database,
  ServerCog,
  Key,
} from "lucide-react";

const coreModuleIcons = [
  LayoutDashboard, Building2, FolderKanban, Target, Calculator, Users,
  CalendarRange, Clock, TrendingUp, BarChart3, AlertTriangle, Compass,
  Bot, ShieldCheck, Globe, Palette, SlidersHorizontal,
];

const capabilityIcons = [
  Layers, DollarSign, Heart, BarChart3, Shield, Compass, Bot, FolderKanban,
  ArrowRightLeft, Milestone, Upload, UserCheck, Lock, Database, ServerCog,
  FileSpreadsheet, Moon, SlidersHorizontal, Key,
];

export default function AboutPage() {
  const { t } = useTranslation();
  const { branding } = useBranding();
  const appTitle = useAppTitle();
  const appName = branding?.appName || "Project High Level Planning";
  const logoUrl = branding?.logoUrl;

  const coreModules = coreModuleIcons.map((icon, i) => ({
    icon,
    title: t(`about.mod${i + 1}Title`),
    description: t(`about.mod${i + 1}Desc`),
  }));

  const keyCapabilities = capabilityIcons.map((icon, i) => ({
    icon,
    title: t(`about.cap${i + 1}Title`),
    description: t(`about.cap${i + 1}Desc`),
  }));

  return (
    <>
      <Helmet>
        <title>{t("nav.about")} - {appTitle}</title>
        <meta name="description" content={`${appName} — ${t("about.tagline")}`} />
        <meta property="og:title" content={`${t("nav.about")} - ${appName}`} />
        <meta property="og:description" content={t("about.tagline")} />
        <meta property="og:type" content="website" />
      </Helmet>
      <div className="p-6 max-w-6xl mx-auto space-y-12" data-testid="about-page">

        <div className="text-center space-y-4 py-8" data-testid="about-hero">
          {logoUrl && (
            <img
              src={logoUrl}
              alt={appName}
              className="h-16 mx-auto object-contain"
              data-testid="img-about-logo"
            />
          )}
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-about-title">
            {appName}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto" data-testid="text-about-tagline">
            {t("about.tagline")}
          </p>
        </div>

        <div className="text-center max-w-3xl mx-auto" data-testid="about-overview">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("about.overview")}
          </p>
        </div>

        <div data-testid="about-modules">
          <div className="text-center mb-6">
            <Badge variant="outline" className="text-xs uppercase tracking-wider mb-2">{t("about.platformModulesBadge")}</Badge>
            <h2 className="text-xl font-semibold">{t("about.coreModulesHeading")}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coreModules.map((mod, idx) => (
              <Card
                key={idx}
                className="p-5 flex gap-4 items-start"
                data-testid={`card-module-${idx}`}
              >
                <div className="shrink-0 mt-0.5 rounded-lg bg-primary/10 p-2.5">
                  <mod.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">{mod.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{mod.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div data-testid="about-capabilities">
          <div className="text-center mb-6">
            <Badge variant="outline" className="text-xs uppercase tracking-wider mb-2">{t("about.highlightsBadge")}</Badge>
            <h2 className="text-xl font-semibold">{t("about.keyCapabilitiesHeading")}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {keyCapabilities.map((cap, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-4 rounded-lg border bg-card"
                data-testid={`capability-${idx}`}
              >
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-medium mb-0.5">{cap.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{cap.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center py-6 border-t" data-testid="about-tech-summary">
          <Badge variant="outline" className="text-xs uppercase tracking-wider mb-3">{t("about.architectureBadge")}</Badge>
          <h2 className="text-xl font-semibold mb-3">{t("about.technicalSummaryHeading")}</h2>
          <p className="text-xs text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t("about.technicalSummaryText")}
          </p>
        </div>
      </div>
    </>
  );
}
