import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import type { AllocationFull, Timeline } from "@shared/schema";

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function formatWeekLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateRange(start: Date, end: Date): string {
  const s = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const e = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${s} – ${e}`;
}

function isWithinWeek(weekStart: Date, allocStart: Date | null, allocEnd: Date | null): boolean {
  if (!allocStart) return false;
  const weekEnd = addWeeks(weekStart, 1);
  const aStart = new Date(allocStart);
  const aEnd = allocEnd ? new Date(allocEnd) : new Date("2099-12-31");
  return aStart < weekEnd && aEnd >= weekStart;
}

function getHoursForWeek(alloc: AllocationFull, weekStart: Date): number {
  const allocStart = alloc.startDate ? new Date(alloc.startDate) : null;
  const allocEnd = alloc.endDate ? new Date(alloc.endDate) : null;
  if (alloc.status === "active" && isWithinWeek(weekStart, allocStart, allocEnd)) {
    return parseFloat(alloc.weeklyHours ?? "0") || 0;
  }
  return 0;
}

const WEEKS_VISIBLE = 12;

type ProjectAllocation = {
  projectId: string;
  projectTitle: string;
  allocations: AllocationFull[];
};

type MemberGroup = {
  id: string;
  name: string;
  role: string;
  projects: ProjectAllocation[];
};

export default function AllocationsPage() {
  const { t } = useTranslation();
  const [rangeStart, setRangeStart] = useState(() => getWeekStart(new Date()));
  const [projectFilter, setProjectFilter] = useState("all");

  const { data: allocations = [], isLoading } = useQuery<AllocationFull[]>({
    queryKey: ["/api/allocations"],
  });

  const { data: projects = [] } = useQuery<Timeline[]>({
    queryKey: ["/api/timelines"],
    select: (data: any[]) => data.map((t: any) => ({ id: t.id, title: t.title } as Timeline)),
  });

  const weeks = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < WEEKS_VISIBLE; i++) {
      result.push(addWeeks(rangeStart, i));
    }
    return result;
  }, [rangeStart]);

  const rangeEnd = addWeeks(rangeStart, WEEKS_VISIBLE - 1);

  const filtered = useMemo(() => {
    if (projectFilter === "all") return allocations;
    return allocations.filter(a => a.timelineId === projectFilter);
  }, [allocations, projectFilter]);

  const memberGroups: MemberGroup[] = useMemo(() => {
    const map = new Map<string, MemberGroup>();
    for (const alloc of filtered) {
      let group = map.get(alloc.teamMemberId);
      if (!group) {
        group = {
          id: alloc.teamMemberId,
          name: alloc.teamMember.name,
          role: alloc.teamMember.role || "",
          projects: [],
        };
        map.set(alloc.teamMemberId, group);
      }
      let proj = group.projects.find(p => p.projectId === alloc.timelineId);
      if (!proj) {
        proj = {
          projectId: alloc.timelineId,
          projectTitle: alloc.project.title,
          allocations: [],
        };
        group.projects.push(proj);
      }
      proj.allocations.push(alloc);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const getTotalHoursForWeek = (projects: ProjectAllocation[], weekStart: Date): number => {
    let total = 0;
    for (const proj of projects) {
      for (const alloc of proj.allocations) {
        total += getHoursForWeek(alloc, weekStart);
      }
    }
    return total;
  };

  const getProjectHoursForWeek = (allocs: AllocationFull[], weekStart: Date): number => {
    let total = 0;
    for (const alloc of allocs) {
      total += getHoursForWeek(alloc, weekStart);
    }
    return total;
  };

  const getCellColor = (hours: number): string => {
    if (hours === 0) return "";
    if (hours > 40) return "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300";
    if (hours >= 32) return "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300";
    return "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300";
  };

  const getSubCellColor = (hours: number): string => {
    if (hours === 0) return "";
    return "bg-muted/50 text-foreground";
  };

  return (
    <div className="p-6 max-w-full">
      <Helmet>
        <title>{t("allocations.title")}</title>
      </Helmet>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" data-testid="heading-allocations">{t("allocations.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("allocations.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-44" data-testid="select-project-filter">
              <SelectValue placeholder={t("allocations.allProjects")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allocations.allProjects")}</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setRangeStart(addWeeks(rangeStart, -4))}
              data-testid="button-prev-weeks"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium px-2 min-w-[140px] text-center" data-testid="text-date-range">
              {formatDateRange(rangeStart, rangeEnd)}
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setRangeStart(addWeeks(rangeStart, 4))}
              data-testid="button-next-weeks"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
          {t("allocations.loadingAllocations")}
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm" data-testid="table-allocations">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground min-w-[200px] sticky left-0 bg-muted/30 z-10">
                  {t("allocations.resource")}
                </th>
                <th className="text-left px-3 py-3 font-medium text-muted-foreground min-w-[160px]">
                  {t("common.project")}
                </th>
                {weeks.map((w, i) => (
                  <th key={i} className="text-center px-2 py-3 font-medium text-muted-foreground min-w-[70px]">
                    {formatWeekLabel(w)}
                  </th>
                ))}
              </tr>
            </thead>

              {memberGroups.length === 0 ? (
                <tbody>
                <tr>
                  <td colSpan={weeks.length + 2} className="text-center py-12 text-muted-foreground">
                    {t("allocations.noAllocationsFound")}
                  </td>
                </tr>
                </tbody>
              ) : (
                memberGroups.map(member => {
                  const hasMultipleProjects = member.projects.length > 1;
                  return (
                    <tbody key={member.id} className="border-b last:border-b-0" data-testid={`group-member-${member.id}`}>
                      {hasMultipleProjects && (
                        <tr className="bg-muted/10">
                          <td className="px-4 py-2.5 sticky left-0 bg-muted/10 z-10">
                            <div>
                              <p className="font-semibold" data-testid={`text-member-name-${member.id}`}>{member.name}</p>
                              <p className="text-xs text-muted-foreground">{member.role}</p>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-muted-foreground italic">
                            {member.projects.length} projects
                          </td>
                          {weeks.map((w, i) => {
                            const totalHours = getTotalHoursForWeek(member.projects, w);
                            const colorClass = getCellColor(totalHours);
                            return (
                              <td key={i} className="text-center px-2 py-2.5">
                                {totalHours > 0 ? (
                                  <span className={`inline-block rounded px-2.5 py-1 text-xs font-bold ${colorClass}`} data-testid={`cell-total-${member.id}-${i}`}>
                                    {totalHours}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40">–</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      )}
                      {member.projects.map((proj, pIdx) => (
                        <tr
                          key={proj.projectId}
                          className={`${hasMultipleProjects ? "bg-background" : "hover:bg-muted/20"}`}
                          data-testid={`row-alloc-${member.id}-${proj.projectId}`}
                        >
                          {!hasMultipleProjects ? (
                            <td className="px-4 py-2.5 sticky left-0 bg-background z-10">
                              <div>
                                <p className="font-medium" data-testid={`text-member-name-${member.id}`}>{member.name}</p>
                                <p className="text-xs text-muted-foreground">{member.role}</p>
                              </div>
                            </td>
                          ) : (
                            <td className="sticky left-0 bg-background z-10" />
                          )}
                          <td className="px-3 py-2.5">
                            <p className={`text-xs ${hasMultipleProjects ? "pl-2 border-l-2 border-primary/30" : "font-medium"}`} data-testid={`text-project-${member.id}-${proj.projectId}`}>
                              {proj.projectTitle}
                            </p>
                          </td>
                          {weeks.map((w, i) => {
                            const hours = getProjectHoursForWeek(proj.allocations, w);
                            const colorClass = hasMultipleProjects ? getSubCellColor(hours) : getCellColor(hours);
                            return (
                              <td key={i} className="text-center px-2 py-2.5">
                                {hours > 0 ? (
                                  <span className={`inline-block rounded px-2.5 py-1 text-xs font-semibold ${colorClass}`} data-testid={`cell-hours-${member.id}-${proj.projectId}-${i}`}>
                                    {hours}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground/40">–</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  );
                })
              )}
          </table>
        </div>
      )}

      <div className="flex items-center justify-between mt-4 px-2">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-green-100 dark:bg-green-950 border border-green-300 dark:border-green-700" />
            {t("allocations.optimal")}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-blue-100 dark:bg-blue-950 border border-blue-300 dark:border-blue-700" />
            {t("allocations.underCapacity")}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-red-100 dark:bg-red-950 border border-red-300 dark:border-red-700" />
            {t("allocations.overCapacity")}
          </div>
        </div>
        <span className="text-xs text-muted-foreground italic">{t("allocations.clickToEdit")}</span>
      </div>
    </div>
  );
}
