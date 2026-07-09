import { useState, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useAppTitle } from "@/hooks/use-app-title";
import type { LucideIcon } from "lucide-react";
import {
  Search,
  BookOpen,
  LayoutDashboard,
  Target,
  FolderKanban,
  Building2,
  Users,
  UserCheck,
  CalendarRange,
  Clock,
  BarChart3,
  Shield,
  Bot,
  Settings,
  Loader2,
  ChevronRight,
  Sparkles,
  Crosshair,
  HeartPulse,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

type MyModulesResponse = {
  modules: string[];
  isGlobalAccess: boolean;
  teamMemberId: string | null;
};

interface GuideSection {
  id: string;
  titleKey: string;
  icon: LucideIcon;
  requiredModule?: string;
  contentKey: string;
  keyConceptsKey?: string;
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "getting-started",
    titleKey: "guide.gettingStarted",
    icon: BookOpen,
    contentKey: "guide.gettingStartedContent",
  },
  {
    id: "whats-new",
    titleKey: "guide.whatsNewTitle",
    icon: Sparkles,
    contentKey: "guide.whatsNewContent",
  },
  {
    id: "dashboard",
    titleKey: "guide.dashboardTitle",
    icon: LayoutDashboard,
    requiredModule: "module.dashboard",
    contentKey: "guide.dashboardContent",
    keyConceptsKey: "guide.dashboardConcepts",
  },
  {
    id: "opportunities",
    titleKey: "guide.opportunitiesTitle",
    icon: Target,
    requiredModule: "module.opportunities",
    contentKey: "guide.opportunitiesContent",
    keyConceptsKey: "guide.opportunitiesConcepts",
  },
  {
    id: "projects",
    titleKey: "guide.projectsTitle",
    icon: FolderKanban,
    requiredModule: "module.projects",
    contentKey: "guide.projectsContent",
    keyConceptsKey: "guide.projectsConcepts",
  },
  {
    id: "business-outcomes",
    titleKey: "guide.businessOutcomesTitle",
    icon: Crosshair,
    requiredModule: "module.business_outcomes",
    contentKey: "guide.businessOutcomesContent",
    keyConceptsKey: "guide.businessOutcomesConcepts",
  },
  {
    id: "clients",
    titleKey: "guide.clientsTitle",
    icon: Building2,
    requiredModule: "module.clients",
    contentKey: "guide.clientsContent",
  },
  {
    id: "contacts",
    titleKey: "guide.contactsTitle",
    icon: Users,
    requiredModule: "module.contacts",
    contentKey: "guide.contactsContent",
  },
  {
    id: "team-members",
    titleKey: "guide.teamMembersTitle",
    icon: UserCheck,
    requiredModule: "module.team_members",
    contentKey: "guide.teamMembersContent",
  },
  {
    id: "allocations",
    titleKey: "guide.allocationsTitle",
    icon: CalendarRange,
    requiredModule: "module.allocations",
    contentKey: "guide.allocationsContent",
  },
  {
    id: "timesheets",
    titleKey: "guide.timesheetsTitle",
    icon: Clock,
    requiredModule: "module.timesheets",
    contentKey: "guide.timesheetsContent",
  },
  {
    id: "portfolio-health",
    titleKey: "guide.portfolioHealthTitle",
    icon: HeartPulse,
    requiredModule: "module.reports",
    contentKey: "guide.portfolioHealthContent",
    keyConceptsKey: "guide.portfolioHealthConcepts",
  },
  {
    id: "reports",
    titleKey: "guide.reportsTitle",
    icon: BarChart3,
    requiredModule: "module.reports",
    contentKey: "guide.reportsContent",
    keyConceptsKey: "guide.reportsConcepts",
  },
  {
    id: "raid",
    titleKey: "guide.raidTitle",
    icon: Shield,
    requiredModule: "module.projects",
    contentKey: "guide.raidContent",
    keyConceptsKey: "guide.raidConcepts",
  },
  {
    id: "governance",
    titleKey: "guide.governanceTitle",
    icon: Bot,
    requiredModule: "module.coach",
    contentKey: "guide.governanceContent",
    keyConceptsKey: "guide.governanceConcepts",
  },
  {
    id: "admin",
    titleKey: "guide.adminTitle",
    icon: Settings,
    requiredModule: "module.admin",
    contentKey: "guide.adminContent",
  },
];

export default function GuidePage() {
  const { t } = useTranslation();
  const appTitle = useAppTitle();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState("getting-started");

  const { data: myModules, isLoading } = useQuery<MyModulesResponse>({
    queryKey: ["/api/rbac/my-modules"],
  });

  const modules = new Set(myModules?.modules ?? []);

  const visibleSections = useMemo(() => {
    return GUIDE_SECTIONS.filter((section) => {
      if (!section.requiredModule) return true;
      return modules.has(section.requiredModule);
    });
  }, [myModules]);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return visibleSections;
    const query = searchQuery.toLowerCase();
    return visibleSections.filter((section) => {
      const title = t(section.titleKey).toLowerCase();
      const content = t(section.contentKey).toLowerCase();
      const concepts = section.keyConceptsKey
        ? t(section.keyConceptsKey).toLowerCase()
        : "";
      return (
        title.includes(query) ||
        content.includes(query) ||
        concepts.includes(query)
      );
    });
  }, [searchQuery, visibleSections, t]);

  const currentSection = useMemo(() => {
    return (
      filteredSections.find((s) => s.id === activeSection) ||
      filteredSections[0]
    );
  }, [activeSection, filteredSections]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Helmet>
        <title>
          {t("guide.title")} | {appTitle}
        </title>
      </Helmet>

      <div className="border-b px-6 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1
              className="text-lg font-semibold"
              data-testid="text-guide-title"
            >
              {t("guide.title")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t("guide.subtitle")}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="w-72 border-r shrink-0 flex flex-col">
          <div className="p-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("guide.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
                data-testid="input-guide-search"
              />
            </div>
          </div>
          <Separator />
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {filteredSections.map((section) => {
                const Icon = section.icon;
                const isActive = currentSection?.id === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-left text-[13px] font-medium transition-colors ${
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    data-testid={`guide-nav-${section.id}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{t(section.titleKey)}</span>
                    {isActive && (
                      <ChevronRight className="w-3.5 h-3.5 ml-auto shrink-0" />
                    )}
                  </button>
                );
              })}
              {filteredSections.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <p
                    className="text-sm text-muted-foreground"
                    data-testid="text-guide-no-results"
                  >
                    {t("guide.noResults")}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex-1 min-w-0">
          <ScrollArea className="h-full">
            {currentSection ? (
              <div className="max-w-3xl mx-auto px-8 py-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <currentSection.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2
                      className="text-xl font-semibold"
                      data-testid="text-guide-section-title"
                    >
                      {t(currentSection.titleKey)}
                    </h2>
                    {currentSection.requiredModule && (
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        {currentSection.requiredModule
                          .replace("module.", "")
                          .replace("_", " ")}
                      </Badge>
                    )}
                  </div>
                </div>

                <Card>
                  <CardContent className="pt-6">
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none"
                      data-testid="text-guide-section-content"
                    >
                      {t(currentSection.contentKey)
                        .split("\n\n")
                        .map((paragraph: string, i: number) => {
                          if (paragraph.startsWith("## ")) {
                            return (
                              <h3
                                key={i}
                                className="text-base font-semibold mt-6 mb-3"
                              >
                                {paragraph.replace("## ", "")}
                              </h3>
                            );
                          }
                          if (paragraph.startsWith("- ")) {
                            return (
                              <ul key={i} className="list-disc pl-5 space-y-1">
                                {paragraph.split("\n").map((line, j) => (
                                  <li
                                    key={j}
                                    className="text-sm text-muted-foreground"
                                  >
                                    {line.replace(/^- /, "")}
                                  </li>
                                ))}
                              </ul>
                            );
                          }
                          return (
                            <p
                              key={i}
                              className="text-sm text-muted-foreground leading-relaxed mb-4"
                            >
                              {paragraph}
                            </p>
                          );
                        })}
                    </div>

                    {currentSection.keyConceptsKey && (
                      <>
                        <Separator className="my-6" />
                        <div>
                          <h3 className="text-sm font-semibold mb-3">
                            {t("guide.keyConcepts")}
                          </h3>
                          <div
                            className="space-y-2"
                            data-testid="text-guide-key-concepts"
                          >
                            {t(currentSection.keyConceptsKey)
                              .split("\n")
                              .filter((line: string) => line.trim())
                              .map((concept: string, i: number) => {
                                const parts = concept.split(": ");
                                const term = parts[0]?.replace(/^- /, "");
                                const definition = parts.slice(1).join(": ");
                                return (
                                  <div
                                    key={i}
                                    className="flex gap-2 text-sm"
                                  >
                                    <span className="font-medium text-foreground whitespace-nowrap">
                                      {term}
                                      {definition ? ":" : ""}
                                    </span>
                                    {definition && (
                                      <span className="text-muted-foreground">
                                        {definition}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-muted-foreground">
                  {t("guide.selectTopic")}
                </p>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
