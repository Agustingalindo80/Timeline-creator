import { useState, useRef, useCallback, useMemo, Fragment } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
  Tooltip as RechartsTooltip,
} from "recharts";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { Helmet } from "react-helmet-async";
import {
  ArrowLeft,
  Edit3,
  Plus,
  Trash2,
  Save,
  X,
  Download,
  Image,
  FileText,
  Check,
  ListFilter,
  Calendar,
  ClipboardList,
  Users,
  TrendingUp,
  BarChart3,
  Clock,
  ShieldCheck,
  Snowflake,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppTitle } from "@/hooks/use-app-title";
import { TimelineView } from "@/components/timeline-view";
import { ThemePicker } from "@/components/theme-picker";
import { RaidLog } from "@/components/raid-log";
import { GovernanceTab } from "@/components/governance-tab";
import { formatDateForProject, parseDateToISO } from "@/lib/date-format";
import type { TimelineWithMilestones, AppSettings, FieldOption, Client, AllocationWithTeamMember, Task, ProgressEntry, TimesheetEntry, ProjectTeamMemberWithDetails, TeamMember, FlightpathStage, EvmSnapshot } from "@shared/schema";
import {
  DEFAULT_TASK_STATUSES,
  DEFAULT_TASK_HEALTH,
  DEFAULT_TASK_ITEM_TYPES,
  DEFAULT_PROJECT_TYPES,
  DEFAULT_ENGAGEMENT_MODELS,
  DEFAULT_PROJECT_STATUSES,
  DEFAULT_REGIONS,
  DEFAULT_DATE_FORMATS,
} from "@shared/schema";

type FilterMode = "all" | "milestones";

function getWeekEnding(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function getPreviousWeekEnding(weekEnding: string): string {
  const d = new Date(weekEnding + "T00:00:00");
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

function ProjectTimesheetsTab({ timelineId, tasks }: { timelineId: string; tasks: Task[] }) {
  const workstreams = useMemo(() => tasks.filter(t => t.itemType === "workstream"), [tasks]);
  const phases = useMemo(() => tasks.filter(t => t.itemType === "phase"), [tasks]);

  const { data: entries = [], isLoading } = useQuery<TimesheetEntry[]>({
    queryKey: ["/api/timelines", timelineId, "timesheets"],
    queryFn: async () => {
      const res = await fetch(`/api/timelines/${timelineId}/timesheets`);
      if (!res.ok) throw new Error("Failed to fetch timesheets");
      return res.json();
    },
  });

  const { data: allTeamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });

  const teamMemberMap = useMemo(() => {
    const map: Record<string, TeamMember> = {};
    allTeamMembers.forEach(tm => { map[tm.id] = tm; });
    return map;
  }, [allTeamMembers]);

  const taskMap = useMemo(() => {
    const map: Record<string, Task> = {};
    tasks.forEach(t => { map[t.id] = t; });
    return map;
  }, [tasks]);

  const groupedByWeek = useMemo(() => {
    const weeks: Record<string, TimesheetEntry[]> = {};
    entries.forEach(e => {
      if (!weeks[e.weekEnding]) weeks[e.weekEnding] = [];
      weeks[e.weekEnding].push(e);
    });
    return Object.entries(weeks).sort(([a], [b]) => b.localeCompare(a));
  }, [entries]);

  const totalHours = useMemo(() => entries.reduce((s, e) => s + parseFloat(e.hours), 0), [entries]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8" data-testid="timesheets-empty-state">
        <Clock className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No timesheet entries recorded yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Time entries logged on the Timesheets page will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="project-timesheets-tab">
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="metric-label">Total Hours</div>
            <div className="metric-value tabular-nums" data-testid="text-project-ts-total-hours">{totalHours.toFixed(1)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="metric-label">Entries</div>
            <div className="metric-value tabular-nums" data-testid="text-project-ts-entry-count">{entries.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="metric-label">Weeks</div>
            <div className="metric-value tabular-nums" data-testid="text-project-ts-week-count">{groupedByWeek.length}</div>
          </CardContent>
        </Card>
      </div>

      {groupedByWeek.map(([week, weekEntries]) => {
        const weekTotal = weekEntries.reduce((s, e) => s + parseFloat(e.hours), 0);
        const byMember: Record<string, TimesheetEntry[]> = {};
        weekEntries.forEach(e => {
          if (!byMember[e.teamMemberId]) byMember[e.teamMemberId] = [];
          byMember[e.teamMemberId].push(e);
        });

        return (
          <div key={week} className="border rounded-lg overflow-hidden" data-testid={`ts-week-${week}`}>
            <div className="bg-muted/50 px-4 py-2 flex items-center justify-between">
              <span className="text-sm font-medium">Week ending: {week}</span>
              <span className="text-sm font-mono text-muted-foreground">{weekTotal.toFixed(1)} hrs</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Team Member</th>
                  <th className="text-left p-3 font-medium">Workstream</th>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-right p-3 font-medium">Hours</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(byMember).map(([tmId, memberEntries]) => {
                  const tm = teamMemberMap[tmId];
                  return memberEntries
                    .sort((a, b) => (a.dayDate || "").localeCompare(b.dayDate || ""))
                    .map((entry, idx) => {
                      const task = entry.taskId ? taskMap[entry.taskId] : null;
                      const parentPhase = task?.parentTaskId ? taskMap[task.parentTaskId] : null;
                      return (
                        <tr key={entry.id} className="border-b last:border-b-0 hover:bg-muted/20" data-testid={`ts-entry-${entry.id}`}>
                          <td className="p-3 text-xs">
                            {idx === 0 ? (tm?.name || "Unknown") : ""}
                          </td>
                          <td className="p-3 text-xs">
                            {parentPhase ? <span className="text-muted-foreground">{parentPhase.title} / </span> : null}
                            {task?.title || "—"}
                          </td>
                          <td className="p-3 text-xs font-mono text-muted-foreground">
                            {entry.dayDate || "—"}
                          </td>
                          <td className="p-3 text-right font-mono text-xs">
                            {parseFloat(entry.hours).toFixed(1)}
                          </td>
                        </tr>
                      );
                    });
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function safeParseDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  let d = new Date(dateStr + "T00:00:00");
  if (!isNaN(d.getTime())) return d;
  d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  const parts = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (parts) {
    d = new Date(`${parts[3]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}T00:00:00`);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function ProgressTrackingTab({ timelineId, tasks, approvedBudget }: { timelineId: string; tasks: Task[]; approvedBudget: string | null }) {
  const { toast } = useToast();
  const [weekEnding, setWeekEnding] = useState(() => getWeekEnding(new Date()));

  const previousWeekEnding = useMemo(() => getPreviousWeekEnding(weekEnding), [weekEnding]);

  const { data: currentEntries = [], isLoading: loadingCurrent } = useQuery<ProgressEntry[]>({
    queryKey: ["/api/timelines", timelineId, "progress", { weekEnding }],
    queryFn: async () => {
      const res = await fetch(`/api/timelines/${timelineId}/progress?weekEnding=${weekEnding}`);
      if (!res.ok) throw new Error("Failed to fetch progress entries");
      return res.json();
    },
  });

  const { data: previousEntries = [] } = useQuery<ProgressEntry[]>({
    queryKey: ["/api/timelines", timelineId, "progress", { weekEnding: previousWeekEnding }],
    queryFn: async () => {
      const res = await fetch(`/api/timelines/${timelineId}/progress?weekEnding=${previousWeekEnding}`);
      if (!res.ok) throw new Error("Failed to fetch previous progress entries");
      return res.json();
    },
  });

  const currentEntryMap = useMemo(() => {
    const map: Record<string, ProgressEntry> = {};
    for (const e of currentEntries) map[e.taskId] = e;
    return map;
  }, [currentEntries]);

  const previousEntryMap = useMemo(() => {
    const map: Record<string, ProgressEntry> = {};
    for (const e of previousEntries) map[e.taskId] = e;
    return map;
  }, [previousEntries]);

  const phases = useMemo(() => tasks.filter(t => t.itemType === "phase"), [tasks]);
  const workstreams = useMemo(() => tasks.filter(t => t.itemType === "workstream"), [tasks]);

  const totalBudget = parseFloat(approvedBudget || "0") || 0;
  const totalWorkstreamDuration = useMemo(() => {
    return workstreams.reduce((sum, ws) => {
      const start = safeParseDate(ws.startDate);
      const end = safeParseDate(ws.endDate);
      const dur = start && end ? Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) : 1;
      return sum + dur;
    }, 0);
  }, [workstreams]);

  const getWorkstreamBudget = useCallback((ws: Task) => {
    if (totalBudget === 0 || totalWorkstreamDuration === 0) return 0;
    const start = safeParseDate(ws.startDate);
    const end = safeParseDate(ws.endDate);
    const dur = start && end ? Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) : 1;
    return (dur / totalWorkstreamDuration) * totalBudget;
  }, [totalBudget, totalWorkstreamDuration]);

  const groupedData = useMemo(() => {
    const groups: { phase: Task | null; workstreams: Task[] }[] = [];
    const phaseMap: Record<string, Task[]> = {};
    const orphanWorkstreams: Task[] = [];

    for (const ws of workstreams) {
      if (ws.parentTaskId) {
        if (!phaseMap[ws.parentTaskId]) phaseMap[ws.parentTaskId] = [];
        phaseMap[ws.parentTaskId].push(ws);
      } else {
        orphanWorkstreams.push(ws);
      }
    }

    for (const phase of phases) {
      groups.push({ phase, workstreams: phaseMap[phase.id] || [] });
    }

    if (orphanWorkstreams.length > 0) {
      groups.push({ phase: null, workstreams: orphanWorkstreams });
    }

    return groups;
  }, [phases, workstreams]);

  const getPhasePercent = useCallback((phaseChildren: Task[]) => {
    if (phaseChildren.length === 0) return 0;
    let totalWeight = 0;
    let weightedSum = 0;
    for (const ws of phaseChildren) {
      const start = safeParseDate(ws.startDate);
      const end = safeParseDate(ws.endDate);
      const dur = start && end ? Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) : 1;
      const pct = currentEntryMap[ws.id]?.percentComplete ?? ws.percentComplete;
      weightedSum += pct * dur;
      totalWeight += dur;
    }
    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  }, [currentEntryMap]);

  const getPhasePrevPercent = useCallback((phaseChildren: Task[]) => {
    if (phaseChildren.length === 0) return 0;
    let totalWeight = 0;
    let weightedSum = 0;
    for (const ws of phaseChildren) {
      const start = safeParseDate(ws.startDate);
      const end = safeParseDate(ws.endDate);
      const dur = start && end ? Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) : 1;
      const pct = previousEntryMap[ws.id]?.percentComplete ?? 0;
      weightedSum += pct * dur;
      totalWeight += dur;
    }
    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  }, [previousEntryMap]);

  const createProgressMutation = useMutation({
    mutationFn: async (data: { taskId: string; percentComplete: number }) => {
      await apiRequest("POST", `/api/timelines/${timelineId}/progress`, {
        taskId: data.taskId,
        weekEnding,
        percentComplete: data.percentComplete,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: async (data: { entryId: string; percentComplete: number }) => {
      await apiRequest("PATCH", `/api/progress/${data.entryId}`, {
        percentComplete: data.percentComplete,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "progress"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handlePercentChange = useCallback((taskId: string, value: number) => {
    const pct = Math.max(0, Math.min(100, value));
    const existing = currentEntryMap[taskId];
    if (existing) {
      updateProgressMutation.mutate({ entryId: existing.id, percentComplete: pct });
    } else {
      createProgressMutation.mutate({ taskId, percentComplete: pct });
    }
  }, [currentEntryMap, updateProgressMutation, createProgressMutation]);

  const summaryTotals = useMemo(() => {
    let totalBudgetSum = 0;
    let totalEV = 0;
    for (const ws of workstreams) {
      const budget = getWorkstreamBudget(ws);
      const pct = currentEntryMap[ws.id]?.percentComplete ?? ws.percentComplete;
      totalBudgetSum += budget;
      totalEV += (pct / 100) * budget;
    }
    return { totalBudget: totalBudgetSum, totalEV };
  }, [workstreams, getWorkstreamBudget, currentEntryMap]);

  const formatCurrency = (val: number) => {
    return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (loadingCurrent) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (workstreams.length === 0) {
    return (
      <div className="text-center py-8" data-testid="progress-empty-state">
        <TrendingUp className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No workstreams defined yet.</p>
        <p className="text-xs text-muted-foreground mt-1">Add workstreams to start tracking progress.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="progress-tracking-tab">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Week Ending</label>
        <Input
          type="date"
          value={weekEnding}
          onChange={(e) => {
            if (e.target.value) {
              setWeekEnding(getWeekEnding(new Date(e.target.value + "T00:00:00")));
            }
          }}
          className="w-44"
          data-testid="input-progress-week-ending"
        />
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const d = new Date(weekEnding + "T00:00:00");
              d.setDate(d.getDate() - 7);
              setWeekEnding(d.toISOString().slice(0, 10));
            }}
            data-testid="button-progress-prev-week"
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekEnding(getWeekEnding(new Date()))}
            data-testid="button-progress-current-week"
          >
            Current
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const d = new Date(weekEnding + "T00:00:00");
              d.setDate(d.getDate() + 7);
              setWeekEnding(d.toISOString().slice(0, 10));
            }}
            data-testid="button-progress-next-week"
          >
            Next
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Phase / Workstream</th>
              <th className="text-right p-3 font-medium">Budget</th>
              <th className="text-right p-3 font-medium">Prev Week %</th>
              <th className="text-right p-3 font-medium">Current %</th>
              <th className="text-right p-3 font-medium">EV</th>
            </tr>
          </thead>
          <tbody>
            {groupedData.map((group) => {
              const phaseBudget = group.workstreams.reduce((s, ws) => s + getWorkstreamBudget(ws), 0);
              const phaseCurrentPct = group.phase ? getPhasePercent(group.workstreams) : 0;
              const phasePrevPct = group.phase ? getPhasePrevPercent(group.workstreams) : 0;
              const phaseEV = (phaseCurrentPct / 100) * phaseBudget;

              return (
                <Fragment key={group.phase?.id || "ungrouped"}>
                  {group.phase && (
                    <tr className="border-b bg-muted/30" data-testid={`progress-phase-row-${group.phase.id}`}>
                      <td className="p-3 font-medium">
                        {group.phase.title}
                      </td>
                      <td className="p-3 text-right font-mono text-muted-foreground">
                        {totalBudget > 0 ? formatCurrency(phaseBudget) : "\u2014"}
                      </td>
                      <td className="p-3 text-right font-mono text-muted-foreground">
                        {phasePrevPct}%
                      </td>
                      <td className="p-3 text-right font-mono text-muted-foreground">
                        {phaseCurrentPct}%
                      </td>
                      <td className="p-3 text-right font-mono text-muted-foreground">
                        {totalBudget > 0 ? formatCurrency(phaseEV) : "\u2014"}
                      </td>
                    </tr>
                  )}
                  {group.workstreams.map((ws) => {
                    const wsBudget = getWorkstreamBudget(ws);
                    const currentPct = currentEntryMap[ws.id]?.percentComplete ?? ws.percentComplete;
                    const prevPct = previousEntryMap[ws.id]?.percentComplete ?? 0;
                    const wsEV = (currentPct / 100) * wsBudget;

                    return (
                      <tr
                        key={ws.id}
                        className="border-b last:border-b-0 hover:bg-muted/20"
                        data-testid={`progress-workstream-row-${ws.id}`}
                      >
                        <td className={`p-3 ${group.phase ? "pl-8" : ""}`}>
                          {ws.title}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {totalBudget > 0 ? formatCurrency(wsBudget) : "\u2014"}
                        </td>
                        <td className="p-3 text-right font-mono text-muted-foreground">
                          {prevPct}%
                        </td>
                        <td className="p-3 text-right">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            defaultValue={currentPct}
                            key={`${ws.id}-${weekEnding}-${currentPct}`}
                            onBlur={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              if (val !== currentPct) {
                                handlePercentChange(ws.id, val);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                (e.target as HTMLInputElement).blur();
                              }
                            }}
                            className="w-20 text-right ml-auto font-mono"
                            data-testid={`input-progress-percent-${ws.id}`}
                          />
                        </td>
                        <td className="p-3 text-right font-mono">
                          {totalBudget > 0 ? formatCurrency(wsEV) : "\u2014"}
                        </td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
            <tr className="border-t-2 bg-muted/50 font-semibold">
              <td className="p-3">Total</td>
              <td className="p-3 text-right font-mono" data-testid="text-progress-total-budget">
                {totalBudget > 0 ? formatCurrency(summaryTotals.totalBudget) : "\u2014"}
              </td>
              <td className="p-3"></td>
              <td className="p-3"></td>
              <td className="p-3 text-right font-mono" data-testid="text-progress-total-ev">
                {totalBudget > 0 ? formatCurrency(summaryTotals.totalEV) : "\u2014"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EVMTab({ timelineId, tasks, approvedBudget }: { timelineId: string; tasks: Task[]; approvedBudget: string | null }) {
  const bac = parseFloat(approvedBudget || "0");
  const workstreams = useMemo(() => tasks.filter(t => t.itemType === "workstream"), [tasks]);
  const phases = useMemo(() => tasks.filter(t => t.itemType === "phase"), [tasks]);

  const { data: progressEntries = [] } = useQuery<ProgressEntry[]>({
    queryKey: ["/api/timelines", timelineId, "progress-all"],
    queryFn: async () => {
      const res = await fetch(`/api/timelines/${timelineId}/progress`);
      if (!res.ok) throw new Error("Failed to fetch progress entries");
      return res.json();
    },
  });

  const { data: timesheetEntries = [] } = useQuery<TimesheetEntry[]>({
    queryKey: ["/api/timelines", timelineId, "timesheets"],
    queryFn: async () => {
      const res = await fetch(`/api/timelines/${timelineId}/timesheets`);
      if (!res.ok) throw new Error("Failed to fetch timesheet entries");
      return res.json();
    },
  });

  const { data: projectTeam = [] } = useQuery<ProjectTeamMemberWithDetails[]>({
    queryKey: ["/api/timelines", timelineId, "team"],
    queryFn: async () => {
      const res = await fetch(`/api/timelines/${timelineId}/team`);
      if (!res.ok) throw new Error("Failed to fetch team");
      return res.json();
    },
  });

  const { data: allocations = [] } = useQuery<AllocationWithTeamMember[]>({
    queryKey: ["/api/timelines", timelineId, "allocations"],
    queryFn: async () => {
      const res = await fetch(`/api/timelines/${timelineId}/allocations`);
      if (!res.ok) throw new Error("Failed to fetch allocations");
      return res.json();
    },
  });

  const workstreamBudgets = useMemo(() => {
    const durations: Record<string, number> = {};
    let totalDuration = 0;
    workstreams.forEach(ws => {
      const start = safeParseDate(ws.startDate);
      const end = safeParseDate(ws.endDate);
      const duration = start && end ? Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))) : 1;
      durations[ws.id] = duration;
      totalDuration += duration;
    });
    const budgets: Record<string, number> = {};
    workstreams.forEach(ws => {
      budgets[ws.id] = totalDuration > 0 ? (durations[ws.id] / totalDuration) * bac : 0;
    });
    return budgets;
  }, [workstreams, bac]);

  const { data: allTeamMembers = [] } = useQuery<{ id: string; hourlyCost: string | null }[]>({
    queryKey: ["/api/team-members"],
  });

  const rateByTeamMember = useMemo(() => {
    const rates: Record<string, number> = {};
    allTeamMembers.forEach(tm => {
      const cost = parseFloat(tm.hourlyCost || "0");
      if (cost > 0) rates[tm.id] = cost;
    });
    projectTeam.forEach(ptm => {
      const rate = ptm.rateCard ? parseFloat(ptm.rateCard.costRate || "0") : (ptm.hourlyCost ? parseFloat(ptm.hourlyCost) : parseFloat(ptm.teamMember.hourlyCost || "0"));
      if (rate > 0) rates[ptm.teamMemberId] = rate;
    });
    return rates;
  }, [projectTeam, allTeamMembers]);

  const weeklyData = useMemo(() => {
    const allWeeks = new Set<string>();
    timesheetEntries.forEach(e => allWeeks.add(e.weekEnding));
    progressEntries.forEach(e => allWeeks.add(e.weekEnding));
    allocations.forEach(a => {
      if (a.startDate && a.endDate) {
        const start = new Date(a.startDate + "T00:00:00");
        const end = new Date(a.endDate + "T00:00:00");
        const current = new Date(start);
        while (current <= end) {
          allWeeks.add(getWeekEnding(current));
          current.setDate(current.getDate() + 7);
        }
      }
    });
    const sorted = [...allWeeks].sort();

    let cumulativePV = 0;
    let cumulativeAC = 0;
    const latestProgress: Record<string, number> = {};

    return sorted.map(week => {
      let weekPV = 0;
      allocations.forEach(a => {
        if (a.startDate && a.endDate) {
          const wEnd = new Date(week + "T00:00:00");
          const aStart = new Date(a.startDate + "T00:00:00");
          const aEnd = new Date(a.endDate + "T00:00:00");
          if (wEnd >= aStart && wEnd <= aEnd) {
            const rate = rateByTeamMember[a.teamMemberId] || 0;
            weekPV += parseFloat(a.weeklyHours || "0") * rate;
          }
        }
      });

      let weekAC = 0;
      timesheetEntries.filter(e => e.weekEnding === week).forEach(e => {
        const rate = rateByTeamMember[e.teamMemberId] || 0;
        weekAC += parseFloat(e.hours) * rate;
      });

      progressEntries.filter(e => e.weekEnding === week).forEach(e => {
        latestProgress[e.taskId] = e.percentComplete;
      });

      let ev = 0;
      workstreams.forEach(ws => {
        const pct = latestProgress[ws.id] ?? 0;
        ev += (pct / 100) * (workstreamBudgets[ws.id] || 0);
      });

      cumulativePV += weekPV;
      cumulativeAC += weekAC;

      return { week, pv: cumulativePV, ac: cumulativeAC, ev };
    });
  }, [timesheetEntries, progressEntries, allocations, workstreams, workstreamBudgets, rateByTeamMember]);

  const latest = weeklyData.length > 0 ? weeklyData[weeklyData.length - 1] : { pv: 0, ac: 0, ev: 0 };
  const pv = latest.pv;
  const ac = latest.ac;
  const ev = latest.ev;
  const sv = ev - pv;
  const cv = ev - ac;
  const spi = pv > 0 ? ev / pv : 0;
  const cpi = ac > 0 ? ev / ac : 0;
  const eac = cpi > 0 ? bac / cpi : 0;
  const etc = eac - ac;
  const vac = bac - eac;

  const { data: evmSnapshots = [], isLoading: snapshotsLoading } = useQuery<EvmSnapshot[]>({
    queryKey: ["/api/timelines", timelineId, "evm-snapshots"],
    queryFn: async () => {
      const res = await fetch(`/api/timelines/${timelineId}/evm-snapshots`);
      if (!res.ok) throw new Error("Failed to fetch EVM snapshots");
      return res.json();
    },
  });

  const currentWeekEnding = weeklyData.length > 0 ? weeklyData[weeklyData.length - 1].week : getWeekEnding(new Date());
  const currentWeekSnapshot = evmSnapshots.find(s => s.weekEnding === currentWeekEnding);

  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false);
  const [freezeNotes, setFreezeNotes] = useState("");
  const { toast } = useToast();

  const freezeWeekMutation = useMutation({
    mutationFn: async ({ weekEnding, notes }: { weekEnding: string; notes?: string }) => {
      const res = await apiRequest("POST", `/api/timelines/${timelineId}/freeze-week`, { weekEnding, notes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "evm-snapshots"] });
      toast({ title: "Week frozen", description: `EVM snapshot saved for ${currentWeekEnding}` });
      setFreezeDialogOpen(false);
      setFreezeNotes("");
    },
    onError: (err: any) => {
      toast({ title: "Failed to freeze week", description: err.message, variant: "destructive" });
    },
  });

  const getIndicatorColor = (value: number) => {
    if (value >= 1.0) return "text-green-600 dark:text-green-400";
    if (value >= 0.9) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getIndicatorBg = (value: number) => {
    if (value >= 1.0) return "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800";
    if (value >= 0.9) return "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800";
    return "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800";
  };

  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const workstreamBreakdown = useMemo(() => {
    const latestPct: Record<string, number> = {};
    const latestWeek: Record<string, string> = {};
    progressEntries.forEach(e => {
      if (!latestWeek[e.taskId] || e.weekEnding > latestWeek[e.taskId]) {
        latestWeek[e.taskId] = e.weekEnding;
        latestPct[e.taskId] = e.percentComplete;
      }
    });

    return workstreams.map(ws => {
      const budget = workstreamBudgets[ws.id] || 0;
      const pct = latestPct[ws.id] ?? (ws.percentComplete || 0);
      const wsEv = (pct / 100) * budget;
      const parentPhase = phases.find(p => p.id === ws.parentTaskId);
      return { ws, budget, pct, ev: wsEv, phaseName: parentPhase?.title || "Unassigned" };
    });
  }, [workstreams, workstreamBudgets, progressEntries, phases]);

  if (workstreams.length === 0) {
    return (
      <div className="text-center py-8" data-testid="evm-empty-state">
        <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No workstreams available for EVM calculations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="evm-tab">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4" data-testid="evm-summary-cards">
        <Card data-testid="evm-card-bac">
          <CardContent className="pt-3 pb-3">
            <div className="metric-label">BAC</div>
            <div className="metric-value tabular-nums">${fmt(bac)}</div>
            <div className="text-[10px] text-muted-foreground">Budget at Completion</div>
          </CardContent>
        </Card>
        <Card data-testid="evm-card-pv">
          <CardContent className="pt-3 pb-3">
            <div className="metric-label">PV</div>
            <div className="metric-value tabular-nums">${fmt(pv)}</div>
            <div className="text-[10px] text-muted-foreground">Planned Value</div>
          </CardContent>
        </Card>
        <Card data-testid="evm-card-ac">
          <CardContent className="pt-3 pb-3">
            <div className="metric-label">AC</div>
            <div className="metric-value tabular-nums">${fmt(ac)}</div>
            <div className="text-[10px] text-muted-foreground">Actual Cost</div>
          </CardContent>
        </Card>
        <Card data-testid="evm-card-ev">
          <CardContent className="pt-3 pb-3">
            <div className="metric-label">EV</div>
            <div className="metric-value tabular-nums">${fmt(ev)}</div>
            <div className="text-[10px] text-muted-foreground">Earned Value</div>
          </CardContent>
        </Card>
        <Card className={`${getIndicatorBg(spi)}`} data-testid="evm-card-spi">
          <CardContent className="pt-3 pb-3">
            <div className="metric-label">SPI</div>
            <div className={`metric-value tabular-nums ${getIndicatorColor(spi)}`}>{spi.toFixed(2)}</div>
            <div className="text-[10px] text-muted-foreground">Schedule Performance</div>
          </CardContent>
        </Card>
        <Card className={`${getIndicatorBg(cpi)}`} data-testid="evm-card-cpi">
          <CardContent className="pt-3 pb-3">
            <div className="metric-label">CPI</div>
            <div className={`metric-value tabular-nums ${getIndicatorColor(cpi)}`}>{cpi.toFixed(2)}</div>
            <div className="text-[10px] text-muted-foreground">Cost Performance</div>
          </CardContent>
        </Card>
        <Card data-testid="evm-card-sv">
          <CardContent className="pt-3 pb-3">
            <div className="metric-label">SV</div>
            <div className={`metric-value tabular-nums ${sv >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>${fmt(sv)}</div>
            <div className="text-[10px] text-muted-foreground">Schedule Variance</div>
          </CardContent>
        </Card>
        <Card data-testid="evm-card-cv">
          <CardContent className="pt-3 pb-3">
            <div className="metric-label">CV</div>
            <div className={`metric-value tabular-nums ${cv >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>${fmt(cv)}</div>
            <div className="text-[10px] text-muted-foreground">Cost Variance</div>
          </CardContent>
        </Card>
        <Card data-testid="evm-card-eac">
          <CardContent className="pt-3 pb-3">
            <div className="metric-label">EAC</div>
            <div className="metric-value tabular-nums">${fmt(eac)}</div>
            <div className="text-[10px] text-muted-foreground">Estimate at Completion</div>
          </CardContent>
        </Card>
        <Card data-testid="evm-card-etc">
          <CardContent className="pt-3 pb-3">
            <div className="metric-label">ETC</div>
            <div className="metric-value tabular-nums">${fmt(etc)}</div>
            <div className="text-[10px] text-muted-foreground">Estimate to Complete</div>
          </CardContent>
        </Card>
        <Card data-testid="evm-card-vac">
          <CardContent className="pt-3 pb-3">
            <div className="metric-label">VAC</div>
            <div className={`metric-value tabular-nums ${vac >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>${fmt(vac)}</div>
            <div className="text-[10px] text-muted-foreground">Variance at Completion</div>
          </CardContent>
        </Card>
      </div>

      {weeklyData.length > 1 && (
        <Card data-testid="chart-evm-scurve">
          <CardContent className="pt-4 pb-4">
            <h3 className="text-sm font-semibold mb-3">S-Curve (PV / AC / EV)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="week"
                  tickFormatter={(val: string) => {
                    const d = new Date(val + "T00:00:00");
                    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  }}
                />
                <YAxis
                  width={80}
                  tickFormatter={(val: number) => `$${val.toLocaleString()}`}
                />
                <RechartsTooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const d = new Date(label + "T00:00:00");
                    const weekLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-md text-xs">
                        <div className="font-medium mb-1">{weekLabel}</div>
                        {payload.map((entry: any) => (
                          <div key={entry.dataKey} className="flex items-center gap-2">
                            <span style={{ color: entry.color }}>{entry.name}:</span>
                            <span className="font-mono">${fmt(entry.value)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  }}
                />
                <Legend />
                <ReferenceLine y={bac} stroke="#9CA3AF" strokeDasharray="5 5" label={{ value: "BAC", position: "right", fontSize: 11 }} />
                <Line type="monotone" dataKey="pv" name="PV" stroke="#3B82F6" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="ac" name="AC" stroke="#EF4444" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="ev" name="EV" stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {(() => {
        const snapshotMap = new Map<string, { spi: number; cpi: number }>();
        evmSnapshots.forEach(snap => {
          snapshotMap.set(snap.weekEnding, {
            spi: parseFloat(snap.spiValue || "0"),
            cpi: parseFloat(snap.cpiValue || "0"),
          });
        });
        const trendData: { week: string; spi: number; cpi: number }[] = [];
        weeklyData.forEach(row => {
          const frozen = snapshotMap.get(row.week);
          if (frozen) {
            trendData.push({ week: row.week, spi: frozen.spi, cpi: frozen.cpi });
          } else if (row.pv > 0 || row.ac > 0) {
            const weekSpi = row.pv > 0 ? row.ev / row.pv : 0;
            const weekCpi = row.ac > 0 ? row.ev / row.ac : 0;
            trendData.push({ week: row.week, spi: weekSpi, cpi: weekCpi });
          }
        });
        if (trendData.length < 1) return null;
        return (
          <Card data-testid="chart-evm-performance">
            <CardContent className="pt-4 pb-4">
              <h3 className="text-sm font-semibold mb-3">Performance Trends (CPI / SPI)</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="week"
                    tickFormatter={(val: string) => {
                      const d = new Date(val + "T00:00:00");
                      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                    }}
                  />
                  <YAxis domain={[0, 'auto']} />
                  <RechartsTooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const d = new Date(label + "T00:00:00");
                      const weekLabel = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                      return (
                        <div className="rounded-lg border bg-background p-2 shadow-md text-xs">
                          <div className="font-medium mb-1">{weekLabel}</div>
                          {payload.map((entry: any) => (
                            <div key={entry.dataKey} className="flex items-center gap-2">
                              <span style={{ color: entry.color }}>{entry.name}:</span>
                              <span className="font-mono">{parseFloat(entry.value).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend />
                  <ReferenceLine y={1.0} stroke="#9CA3AF" strokeDasharray="5 5" label={{ value: "Target", position: "right", fontSize: 11 }} />
                  <Line type="monotone" dataKey="spi" name="SPI" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="cpi" name="CPI" stroke="#22C55E" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        );
      })()}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Current Period: {currentWeekEnding}</h3>
          {currentWeekSnapshot && (
            <Badge variant="outline" className="text-xs gap-1" data-testid="badge-week-frozen">
              <Snowflake className="w-3 h-3" />
              Frozen v{currentWeekSnapshot.version}
            </Badge>
          )}
        </div>
        <AlertDialog open={freezeDialogOpen} onOpenChange={setFreezeDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              data-testid={currentWeekSnapshot ? "button-refreeze-week" : "button-freeze-week"}
            >
              <Snowflake className="w-3.5 h-3.5" />
              {currentWeekSnapshot ? "Re-freeze Week" : "Freeze Week"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {currentWeekSnapshot ? `Re-freeze Week (v${currentWeekSnapshot.version + 1})` : "Freeze Week"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {currentWeekSnapshot
                  ? `This will create revision v${currentWeekSnapshot.version + 1}, superseding v${currentWeekSnapshot.version}.`
                  : `Freeze the EVM snapshot for week ending ${currentWeekEnding}. This captures current metrics as a permanent record.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div><span className="text-muted-foreground">BAC:</span> ${fmt(bac)}</div>
                <div><span className="text-muted-foreground">PV:</span> ${fmt(pv)}</div>
                <div><span className="text-muted-foreground">AC:</span> ${fmt(ac)}</div>
                <div><span className="text-muted-foreground">EV:</span> ${fmt(ev)}</div>
                <div><span className="text-muted-foreground">SPI:</span> {spi.toFixed(2)}</div>
                <div><span className="text-muted-foreground">CPI:</span> {cpi.toFixed(2)}</div>
                <div><span className="text-muted-foreground">VAC:</span> ${fmt(vac)}</div>
              </div>
              <Textarea
                placeholder="Optional notes (e.g., 'Re-frozen after late timesheets')"
                value={freezeNotes}
                onChange={e => setFreezeNotes(e.target.value)}
                className="text-sm"
                rows={2}
                data-testid="input-freeze-notes"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                onClick={(e) => {
                  e.preventDefault();
                  freezeWeekMutation.mutate({ weekEnding: currentWeekEnding, notes: freezeNotes || undefined });
                }}
                disabled={freezeWeekMutation.isPending}
                data-testid="button-confirm-freeze"
              >
                {freezeWeekMutation.isPending ? "Freezing..." : "Confirm Freeze"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {weeklyData.length > 0 && (
        <div data-testid="evm-weekly-breakdown">
          <h3 className="text-sm font-semibold mb-3">Weekly Cumulative Breakdown</h3>
          <div className="border rounded-lg overflow-auto max-h-[300px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="p-2 text-left font-medium">Week Ending</th>
                  <th className="p-2 text-right font-medium">PV (Cumulative)</th>
                  <th className="p-2 text-right font-medium">AC (Cumulative)</th>
                  <th className="p-2 text-right font-medium">EV (Cumulative)</th>
                  <th className="p-2 text-right font-medium">SV</th>
                  <th className="p-2 text-right font-medium">CV</th>
                </tr>
              </thead>
              <tbody>
                {weeklyData.map(row => {
                  const rowSV = row.ev - row.pv;
                  const rowCV = row.ev - row.ac;
                  return (
                    <tr key={row.week} className="border-t" data-testid={`evm-week-row-${row.week}`}>
                      <td className="p-2 font-mono text-xs">{row.week}</td>
                      <td className="p-2 text-right font-mono text-xs">${fmt(row.pv)}</td>
                      <td className="p-2 text-right font-mono text-xs">${fmt(row.ac)}</td>
                      <td className="p-2 text-right font-mono text-xs">${fmt(row.ev)}</td>
                      <td className={`p-2 text-right font-mono text-xs ${rowSV >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>${fmt(rowSV)}</td>
                      <td className={`p-2 text-right font-mono text-xs ${rowCV >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>${fmt(rowCV)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {evmSnapshots.length > 0 && (
        <div data-testid="table-evm-history">
          <h3 className="text-sm font-semibold mb-3">EVM History (Frozen Snapshots)</h3>
          <div className="border rounded-lg overflow-auto max-h-[400px]">
            <TooltipProvider>
              <table className="w-full text-sm">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="p-2 text-left font-medium">Week Ending</th>
                    <th className="p-2 text-center font-medium">Ver</th>
                    <th className="p-2 text-center font-medium">Mode</th>
                    <th className="p-2 text-right font-medium">BAC</th>
                    <th className="p-2 text-right font-medium">PV</th>
                    <th className="p-2 text-right font-medium">AC</th>
                    <th className="p-2 text-right font-medium">EV</th>
                    <th className="p-2 text-right font-medium">SPI</th>
                    <th className="p-2 text-right font-medium">CPI</th>
                    <th className="p-2 text-right font-medium">SV</th>
                    <th className="p-2 text-right font-medium">CV</th>
                    <th className="p-2 text-right font-medium">EAC</th>
                    <th className="p-2 text-right font-medium">VAC</th>
                    <th className="p-2 text-center font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {[...evmSnapshots].reverse().map((snap, idx) => {
                    const prevSnap = [...evmSnapshots].reverse()[idx + 1];
                    const snapSpi = parseFloat(snap.spiValue || "0");
                    const snapCpi = parseFloat(snap.cpiValue || "0");
                    const prevSpi = prevSnap ? parseFloat(prevSnap.spiValue || "0") : null;
                    const prevCpi = prevSnap ? parseFloat(prevSnap.cpiValue || "0") : null;

                    const spiArrow = prevSpi !== null ? (snapSpi > prevSpi ? <ArrowUp className="w-3 h-3 text-green-500 inline" /> : snapSpi < prevSpi ? <ArrowDown className="w-3 h-3 text-red-500 inline" /> : <ArrowRight className="w-3 h-3 text-muted-foreground inline" />) : null;
                    const cpiArrow = prevCpi !== null ? (snapCpi > prevCpi ? <ArrowUp className="w-3 h-3 text-green-500 inline" /> : snapCpi < prevCpi ? <ArrowDown className="w-3 h-3 text-red-500 inline" /> : <ArrowRight className="w-3 h-3 text-muted-foreground inline" />) : null;

                    const snapSv = parseFloat(snap.scheduleVariance || "0");
                    const snapCv = parseFloat(snap.costVariance || "0");
                    const snapVac = parseFloat(snap.vacValue || "0");

                    return (
                      <tr key={snap.id} className="border-t" data-testid={`evm-snapshot-row-${snap.weekEnding}`}>
                        <td className="p-2 font-mono text-xs">{snap.weekEnding}</td>
                        <td className="p-2 text-center text-xs">v{snap.version}</td>
                        <td className="p-2 text-center">
                          {snap.mode === "gate_freeze" ? (
                            <Badge variant="outline" className="text-[10px] gap-0.5 px-1 py-0" data-testid="badge-gate-freeze">
                              <ShieldCheck className="w-2.5 h-2.5" /> Gate
                            </Badge>
                          ) : (
                            <Snowflake className="w-3 h-3 text-blue-400 mx-auto" />
                          )}
                        </td>
                        <td className="p-2 text-right font-mono text-xs">${fmt(parseFloat(snap.bac || "0"))}</td>
                        <td className="p-2 text-right font-mono text-xs">${fmt(parseFloat(snap.plannedValue || "0"))}</td>
                        <td className="p-2 text-right font-mono text-xs">${fmt(parseFloat(snap.actualCost || "0"))}</td>
                        <td className="p-2 text-right font-mono text-xs">${fmt(parseFloat(snap.earnedValue || "0"))}</td>
                        <td className={`p-2 text-right font-mono text-xs ${getIndicatorColor(snapSpi)}`}>
                          {snapSpi.toFixed(2)} {spiArrow}
                        </td>
                        <td className={`p-2 text-right font-mono text-xs ${getIndicatorColor(snapCpi)}`}>
                          {snapCpi.toFixed(2)} {cpiArrow}
                        </td>
                        <td className={`p-2 text-right font-mono text-xs ${snapSv >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>${fmt(snapSv)}</td>
                        <td className={`p-2 text-right font-mono text-xs ${snapCv >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>${fmt(snapCv)}</td>
                        <td className="p-2 text-right font-mono text-xs">${fmt(parseFloat(snap.eacValue || "0"))}</td>
                        <td className={`p-2 text-right font-mono text-xs ${snapVac >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>${fmt(snapVac)}</td>
                        <td className="p-2 text-center">
                          {snap.notes && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="w-3 h-3 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent side="left" className="max-w-xs">
                                <p className="text-xs">{snap.notes}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TooltipProvider>
          </div>
        </div>
      )}

      <div data-testid="evm-workstream-breakdown">
        <h3 className="text-sm font-semibold mb-3">Per-Workstream Breakdown</h3>
        <div className="border rounded-lg overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left font-medium">Phase / Workstream</th>
                <th className="p-2 text-right font-medium">Budget</th>
                <th className="p-2 text-right font-medium">% Complete</th>
                <th className="p-2 text-right font-medium">Earned Value</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const grouped: Record<string, typeof workstreamBreakdown> = {};
                workstreamBreakdown.forEach(row => {
                  if (!grouped[row.phaseName]) grouped[row.phaseName] = [];
                  grouped[row.phaseName].push(row);
                });
                return Object.entries(grouped).map(([phaseName, rows]) => {
                  const phaseBudget = rows.reduce((s, r) => s + r.budget, 0);
                  const phaseEV = rows.reduce((s, r) => s + r.ev, 0);
                  const phasePct = phaseBudget > 0 ? (phaseEV / phaseBudget) * 100 : 0;
                  return (
                    <Fragment key={phaseName}>
                      <tr className="border-t bg-muted/30" data-testid={`evm-phase-${phaseName}`}>
                        <td className="p-2 font-medium">{phaseName}</td>
                        <td className="p-2 text-right font-mono">${fmt(phaseBudget)}</td>
                        <td className="p-2 text-right font-mono">{phasePct.toFixed(0)}%</td>
                        <td className="p-2 text-right font-mono">${fmt(phaseEV)}</td>
                      </tr>
                      {rows.map(row => (
                        <tr key={row.ws.id} className="border-t" data-testid={`evm-workstream-${row.ws.id}`}>
                          <td className="p-2 pl-6 text-muted-foreground">{row.ws.title}</td>
                          <td className="p-2 text-right font-mono">${fmt(row.budget)}</td>
                          <td className="p-2 text-right font-mono">{row.pct}%</td>
                          <td className="p-2 text-right font-mono">${fmt(row.ev)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                });
              })()}
              <tr className="border-t bg-muted/50 font-semibold">
                <td className="p-2">Total</td>
                <td className="p-2 text-right font-mono" data-testid="evm-total-budget">${fmt(workstreamBreakdown.reduce((s, r) => s + r.budget, 0))}</td>
                <td className="p-2 text-right font-mono"></td>
                <td className="p-2 text-right font-mono" data-testid="evm-total-ev">${fmt(workstreamBreakdown.reduce((s, r) => s + r.ev, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProjectTeamMembersTab({ timelineId }: { timelineId: string }) {
  const { data: allocs = [], isLoading } = useQuery<AllocationWithTeamMember[]>({
    queryKey: ["/api/timelines", timelineId, "allocations"],
    queryFn: async () => {
      const res = await fetch(`/api/timelines/${timelineId}/allocations`);
      if (!res.ok) throw new Error("Failed to fetch allocations");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (allocs.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">No team members allocated to this project.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add allocations from the{" "}
          <Link href="/team-members" className="underline text-primary" data-testid="link-team-members-page">
            Team Members
          </Link>{" "}
          page or individual team member profiles.
        </p>
      </div>
    );
  }

  const totalWeeklyHours = allocs.reduce((sum, a) => sum + Number(a.weeklyHours || 0), 0);

  return (
    <div className="space-y-4" data-testid="project-team-members-tab">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {allocs.length} team member{allocs.length !== 1 ? "s" : ""} allocated &middot; {totalWeeklyHours} hrs/week total
        </p>
      </div>
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Role</th>
              <th className="text-left p-3 font-medium">Department</th>
              <th className="text-right p-3 font-medium">Hours/Week</th>
              <th className="text-left p-3 font-medium">Start</th>
              <th className="text-left p-3 font-medium">End</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {allocs.map((a) => (
              <tr key={a.id} className="border-b last:border-b-0 hover:bg-muted/30" data-testid={`team-member-row-${a.id}`}>
                <td className="p-3">
                  <Link
                    href={`/team-members/${a.teamMember.id}`}
                    className="text-primary hover:underline font-medium"
                    data-testid={`link-team-member-${a.teamMember.id}`}
                  >
                    {a.teamMember.name}
                  </Link>
                </td>
                <td className="p-3">
                  {a.teamMember.role ? (
                    <Badge variant="secondary" data-testid={`badge-role-${a.id}`}>
                      {a.teamMember.role.replace(/_/g, " ")}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-3 text-muted-foreground">{a.teamMember.department || "—"}</td>
                <td className="p-3 text-right font-mono">{a.weeklyHours}</td>
                <td className="p-3 text-muted-foreground">{a.startDate || "—"}</td>
                <td className="p-3 text-muted-foreground">{a.endDate || "—"}</td>
                <td className="p-3">
                  <Badge variant={a.status === "active" ? "default" : "secondary"} className={a.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"} data-testid={`badge-alloc-status-${a.id}`}>
                    {a.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="p-3 text-muted-foreground text-xs">{a.notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function TimelineDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const appTitleOnly = useAppTitle();
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState("");
  const timelineRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const { data: timeline, isLoading } = useQuery<TimelineWithMilestones>({
    queryKey: ["/api/timelines", id],
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const taskStatuses = settings?.taskStatuses || DEFAULT_TASK_STATUSES;
  const taskHealthOptions = settings?.taskHealthOptions || DEFAULT_TASK_HEALTH;
  const taskItemTypes = settings?.taskItemTypes || DEFAULT_TASK_ITEM_TYPES;
  const projectTypes = settings?.projectTypes || DEFAULT_PROJECT_TYPES;
  const engagementModels = settings?.engagementModels || DEFAULT_ENGAGEMENT_MODELS;
  const projectStatuses = settings?.projectStatuses || DEFAULT_PROJECT_STATUSES;
  const regionOptions = settings?.regions || DEFAULT_REGIONS;
  const { data: clientsList } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: governanceStages = [] } = useQuery<FlightpathStage[]>({
    queryKey: ["/api/flightpath-stages"],
  });

  const { data: projectAllocs = [] } = useQuery<AllocationWithTeamMember[]>({
    queryKey: ["/api/timelines", id, "allocations"],
    queryFn: async () => {
      const res = await fetch(`/api/timelines/${id}/allocations`);
      if (!res.ok) throw new Error("Failed to fetch allocations");
      return res.json();
    },
    enabled: !!id,
  });
  const uniqueTeamMemberCount = new Set(projectAllocs.map(a => a.teamMemberId)).size;

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/timelines/${id}`, {
        title: editTitle,
        description: editDescription || null,
        color: editColor,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
      setEditing(false);
      toast({ title: "Project updated" });
    },
  });

  const addMilestoneMutation = useMutation({
    mutationFn: async (data: { title: string; date: string; actualDate?: string; description?: string }) => {
      await apiRequest("POST", `/api/timelines/${id}/milestones`, {
        ...data,
        sortOrder: (timeline?.milestones.length || 0),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
      toast({ title: "Milestone added" });
    },
  });

  const updateMilestoneMutation = useMutation({
    mutationFn: async ({ milestoneId, data }: { milestoneId: string; data: { title?: string; date?: string; actualDate?: string | null; description?: string | null } }) => {
      await apiRequest("PATCH", `/api/milestones/${milestoneId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
      toast({ title: "Milestone updated" });
    },
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      await apiRequest("DELETE", `/api/milestones/${milestoneId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
      toast({ title: "Milestone deleted" });
    },
  });

  const addTaskMutation = useMutation({
    mutationFn: async (data: { title: string; startDate: string; endDate: string; actualStartDate?: string; actualEndDate?: string; description?: string; percentComplete?: number; status?: string; health?: string; itemType?: string; parentTaskId?: string }) => {
      await apiRequest("POST", `/api/timelines/${id}/tasks`, {
        ...data,
        sortOrder: (timeline?.tasks.length || 0),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
      toast({ title: "Task added" });
    },
    onError: (error: any) => {
      let msg = error.message || "Failed to add task";
      try { const parsed = JSON.parse(msg.replace(/^\d+:\s*/, "")); msg = parsed.message || msg; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: { title?: string; startDate?: string; endDate?: string; actualStartDate?: string | null; actualEndDate?: string | null; description?: string | null; percentComplete?: number; status?: string; health?: string; itemType?: string; parentTaskId?: string | null } }) => {
      await apiRequest("PATCH", `/api/tasks/${taskId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
      toast({ title: "Task updated" });
    },
    onError: (error: any) => {
      let msg = error.message || "Failed to update task";
      try { const parsed = JSON.parse(msg.replace(/^\d+:\s*/, "")); msg = parsed.message || msg; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest("DELETE", `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
      toast({ title: "Task deleted" });
    },
  });

  const startEditing = () => {
    if (timeline) {
      setEditTitle(timeline.title);
      setEditDescription(timeline.description || "");
      setEditColor(timeline.color);
      setEditing(true);
    }
  };

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newActualDate, setNewActualDate] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskStart, setNewTaskStart] = useState("");
  const [newTaskEnd, setNewTaskEnd] = useState("");
  const [newTaskActualStart, setNewTaskActualStart] = useState("");
  const [newTaskActualEnd, setNewTaskActualEnd] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPercent, setNewTaskPercent] = useState(0);

  const [newIsFinancialObligation, setNewIsFinancialObligation] = useState(false);
  const [newAmount, setNewAmount] = useState("");

  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [editMTitle, setEditMTitle] = useState("");
  const [editMDate, setEditMDate] = useState("");
  const [editMActualDate, setEditMActualDate] = useState("");
  const [editMDesc, setEditMDesc] = useState("");
  const [editMIsFinancialObligation, setEditMIsFinancialObligation] = useState(false);
  const [editMAmount, setEditMAmount] = useState("");

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTTitle, setEditTTitle] = useState("");
  const [editTStart, setEditTStart] = useState("");
  const [editTEnd, setEditTEnd] = useState("");
  const [editTActualStart, setEditTActualStart] = useState("");
  const [editTActualEnd, setEditTActualEnd] = useState("");
  const [editTDesc, setEditTDesc] = useState("");
  const [editTPercent, setEditTPercent] = useState(0);

  const [newTaskStatus, setNewTaskStatus] = useState("not_started");
  const [newTaskHealth, setNewTaskHealth] = useState("green");
  const [newTaskItemType, setNewTaskItemType] = useState("workstream");
  const [newTaskParentId, setNewTaskParentId] = useState("");

  const [editTStatus, setEditTStatus] = useState("not_started");
  const [editTHealth, setEditTHealth] = useState("green");
  const [editTItemType, setEditTItemType] = useState("workstream");
  const [editTParentId, setEditTParentId] = useState("");

  const startEditingMilestone = (m: { id: string; title: string; date: string; actualDate: string | null; description: string | null; isFinancialObligation: boolean; amount: string | null }) => {
    setEditingMilestoneId(m.id);
    setEditMTitle(m.title);
    setEditMDate(m.date);
    setEditMActualDate(m.actualDate || "");
    setEditMDesc(m.description || "");
    setEditMIsFinancialObligation(m.isFinancialObligation);
    setEditMAmount(m.amount || "");
  };

  const saveMilestoneEdit = () => {
    if (!editingMilestoneId || !editMTitle.trim() || !editMDate.trim()) return;
    updateMilestoneMutation.mutate(
      {
        milestoneId: editingMilestoneId,
        data: {
          title: editMTitle.trim(),
          date: fmtDate(editMDate.trim()),
          actualDate: editMActualDate.trim() ? fmtDate(editMActualDate.trim()) : null,
          description: editMDesc.trim() || null,
          isFinancialObligation: editMIsFinancialObligation,
          amount: editMIsFinancialObligation ? (editMAmount || null) : null,
        },
      },
      {
        onSuccess: () => {
          setEditingMilestoneId(null);
        },
      }
    );
  };

  const cancelMilestoneEdit = () => {
    setEditingMilestoneId(null);
  };

  const startEditingTask = (t: { id: string; title: string; startDate: string | null; endDate: string | null; actualStartDate: string | null; actualEndDate: string | null; description: string | null; percentComplete: number; status: string; health: string; itemType: string; parentTaskId: string | null }) => {
    setEditingTaskId(t.id);
    setEditTTitle(t.title);
    setEditTStart(t.startDate || "");
    setEditTEnd(t.endDate || "");
    setEditTActualStart(t.actualStartDate || "");
    setEditTActualEnd(t.actualEndDate || "");
    setEditTDesc(t.description || "");
    setEditTPercent(t.percentComplete ?? 0);
    setEditTStatus(t.status || "not_started");
    setEditTHealth(t.health || "green");
    setEditTItemType(t.itemType || "workstream");
    setEditTParentId(t.parentTaskId || "");
  };

  const saveTaskEdit = () => {
    if (!editingTaskId || !editTTitle.trim() || !editTStart.trim() || !editTEnd.trim()) return;
    updateTaskMutation.mutate(
      {
        taskId: editingTaskId,
        data: {
          title: editTTitle.trim(),
          startDate: fmtDate(editTStart.trim()),
          endDate: fmtDate(editTEnd.trim()),
          actualStartDate: editTActualStart.trim() ? fmtDate(editTActualStart.trim()) : null,
          actualEndDate: editTActualEnd.trim() ? fmtDate(editTActualEnd.trim()) : null,
          description: editTDesc.trim() || null,
          percentComplete: editTPercent,
          status: editTStatus,
          health: editTHealth,
          itemType: editTItemType,
          parentTaskId: editTParentId || null,
        },
      },
      {
        onSuccess: () => {
          setEditingTaskId(null);
        },
      }
    );
  };

  const cancelTaskEdit = () => {
    setEditingTaskId(null);
  };

  const projectDateFormat = timeline?.dateFormat || "";

  const fmtDate = (isoDate: string) => {
    if (!isoDate || !projectDateFormat) return isoDate;
    return formatDateForProject(isoDate, projectDateFormat);
  };

  const handleAddMilestone = () => {
    if (!newTitle.trim() || !newDate.trim()) return;
    addMilestoneMutation.mutate(
      {
        title: newTitle,
        date: fmtDate(newDate),
        actualDate: newActualDate ? fmtDate(newActualDate) : undefined,
        description: newDesc || undefined,
        isFinancialObligation: newIsFinancialObligation,
        amount: newIsFinancialObligation ? (newAmount || undefined) : undefined,
      },
      {
        onSuccess: () => {
          setNewTitle("");
          setNewDate("");
          setNewActualDate("");
          setNewDesc("");
          setNewIsFinancialObligation(false);
          setNewAmount("");
          setShowAddForm(false);
        },
      }
    );
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim() || !newTaskStart.trim() || !newTaskEnd.trim()) return;
    addTaskMutation.mutate(
      {
        title: newTaskTitle,
        startDate: fmtDate(newTaskStart),
        endDate: fmtDate(newTaskEnd),
        actualStartDate: newTaskActualStart ? fmtDate(newTaskActualStart) : undefined,
        actualEndDate: newTaskActualEnd ? fmtDate(newTaskActualEnd) : undefined,
        description: newTaskDesc || undefined,
        percentComplete: newTaskPercent,
        status: newTaskStatus,
        health: newTaskHealth,
        itemType: newTaskItemType,
        parentTaskId: newTaskParentId || undefined,
      },
      {
        onSuccess: () => {
          setNewTaskTitle("");
          setNewTaskStart("");
          setNewTaskEnd("");
          setNewTaskActualStart("");
          setNewTaskActualEnd("");
          setNewTaskDesc("");
          setNewTaskPercent(0);
          setNewTaskStatus("not_started");
          setNewTaskHealth("green");
          setNewTaskItemType("workstream");
          setNewTaskParentId("");
          setShowAddTaskForm(false);
        },
      }
    );
  };

  const handleExport = useCallback(
    async (format: "png" | "pdf") => {
      if (!timelineRef.current || !timeline) return;
      setExporting(true);

      try {
        const html2canvas = (await import("html2canvas")).default;

        const source = timelineRef.current;

        const extraPadding = 48;
        const canvas = await html2canvas(source, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false,
          scrollX: 0,
          scrollY: -window.scrollY,
          width: source.scrollWidth,
          height: source.scrollHeight + extraPadding,
          windowWidth: Math.max(source.scrollWidth + 200, 1400),
          windowHeight: source.scrollHeight + extraPadding + 200,
          onclone: (clonedDoc: Document) => {
            clonedDoc.documentElement.classList.remove("dark");
            clonedDoc.documentElement.setAttribute("style", "color-scheme: light !important;");

            const style = clonedDoc.createElement("style");
            style.textContent = `
              :root, html, *, *::before, *::after {
                --background: 0 0% 100% !important;
                --foreground: 222 15% 12% !important;
                --card: 0 0% 98% !important;
                --card-foreground: 222 15% 12% !important;
                --card-border: 220 13% 94% !important;
                --muted: 220 14% 94% !important;
                --muted-foreground: 222 13% 38% !important;
                --border: 220 13% 91% !important;
                --ring: 217 91% 48% !important;
                --popover: 0 0% 96% !important;
                --popover-foreground: 222 15% 12% !important;
                --primary: 217 91% 48% !important;
                --primary-foreground: 210 40% 98% !important;
                --secondary: 220 14% 93% !important;
                --secondary-foreground: 222 15% 12% !important;
                --accent: 220 15% 95% !important;
                --accent-foreground: 222 15% 12% !important;
                --input: 220 13% 85% !important;
                color-scheme: light !important;
              }
              .dark {
                --background: 0 0% 100% !important;
                --foreground: 222 15% 12% !important;
                --card: 0 0% 98% !important;
                --card-foreground: 222 15% 12% !important;
                --card-border: 220 13% 94% !important;
                --muted: 220 14% 94% !important;
                --muted-foreground: 222 13% 38% !important;
                --border: 220 13% 91% !important;
                --ring: 217 91% 48% !important;
                --popover: 0 0% 96% !important;
                --popover-foreground: 222 15% 12% !important;
                --primary: 217 91% 48% !important;
                --primary-foreground: 210 40% 98% !important;
                --secondary: 220 14% 93% !important;
                --secondary-foreground: 222 15% 12% !important;
                --accent: 220 15% 95% !important;
                --accent-foreground: 222 15% 12% !important;
                --input: 220 13% 85% !important;
                color-scheme: light !important;
              }
            `;
            clonedDoc.head.appendChild(style);

            const targetEl = clonedDoc.querySelector("[data-export-timeline]") as HTMLElement;
            if (targetEl) {
              targetEl.style.padding = "32px";
              targetEl.style.paddingBottom = "48px";
              targetEl.style.backgroundColor = "hsl(0 0% 100%)";
              const allEls = targetEl.querySelectorAll<HTMLElement>("*");
              allEls.forEach((el) => {
                el.style.overflow = "visible";
              });
            }
          },
        });

        if (format === "png") {
          const link = document.createElement("a");
          link.download = `${timeline.title.replace(/[^a-zA-Z0-9]/g, "_")}_project.png`;
          link.href = canvas.toDataURL("image/png");
          link.click();
          toast({ title: "PNG downloaded" });
        } else {
          const { jsPDF } = await import("jspdf");
          const imgData = canvas.toDataURL("image/png");
          const imgWidth = canvas.width;
          const imgHeight = canvas.height;
          const isLandscape = imgWidth > imgHeight;
          const pdf = new jsPDF({
            orientation: isLandscape ? "landscape" : "portrait",
            unit: "px",
            format: [imgWidth, imgHeight],
          });
          pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
          pdf.save(`${timeline.title.replace(/[^a-zA-Z0-9]/g, "_")}_project.pdf`);
          toast({ title: "PDF downloaded" });
        }
      } catch (err: any) {
        toast({
          title: "Export failed",
          description: err.message || "Something went wrong during export.",
          variant: "destructive",
        });
      } finally {
        setExporting(false);
      }
    },
    [timeline, toast]
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-md" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-20 rounded-md" />
          <Skeleton className="h-20 rounded-md" />
          <Skeleton className="h-20 rounded-md" />
          <Skeleton className="h-20 rounded-md" />
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  if (!timeline) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Project not found.</p>
        <Button variant="ghost" className="mt-2" onClick={() => navigate("/projects")}>
          Back to Projects
        </Button>
      </div>
    );
  }

  const showTasks = filterMode === "all";

  const renderTaskCard = (t: typeof timeline.tasks[number], tl: typeof timeline) => (
    <Card
      key={t.id}
      className="p-3"
      data-testid={`manage-task-${t.id}`}
    >
      {editingTaskId === t.id ? (
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <Input
                value={editTTitle}
                onChange={(e) => setEditTTitle(e.target.value)}
                placeholder="Title"
                data-testid={`input-edit-task-title-${t.id}`}
              />
            </div>
            <div className="w-40">
              <Input
                type={projectDateFormat ? "date" : "text"}
                value={projectDateFormat ? parseDateToISO(editTStart, projectDateFormat) : editTStart}
                onChange={(e) => setEditTStart(e.target.value)}
                placeholder="Planned start"
                data-testid={`input-edit-task-start-${t.id}`}
              />
            </div>
            <div className="w-40">
              <Input
                type={projectDateFormat ? "date" : "text"}
                value={projectDateFormat ? parseDateToISO(editTEnd, projectDateFormat) : editTEnd}
                onChange={(e) => setEditTEnd(e.target.value)}
                placeholder="Planned end"
                data-testid={`input-edit-task-end-${t.id}`}
              />
            </div>
            <div className="w-40">
              <Input
                type={projectDateFormat ? "date" : "text"}
                value={projectDateFormat ? parseDateToISO(editTActualStart, projectDateFormat) : editTActualStart}
                onChange={(e) => setEditTActualStart(e.target.value)}
                placeholder="Actual start"
                data-testid={`input-edit-task-actual-start-${t.id}`}
              />
            </div>
            <div className="w-40">
              <Input
                type={projectDateFormat ? "date" : "text"}
                value={projectDateFormat ? parseDateToISO(editTActualEnd, projectDateFormat) : editTActualEnd}
                onChange={(e) => setEditTActualEnd(e.target.value)}
                placeholder="Actual end"
                data-testid={`input-edit-task-actual-end-${t.id}`}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <Input
                value={editTDesc}
                onChange={(e) => setEditTDesc(e.target.value)}
                placeholder="Description (optional)"
                data-testid={`input-edit-task-desc-${t.id}`}
              />
            </div>
            <div className="flex items-center gap-2 w-56">
              <span className="text-xs text-muted-foreground whitespace-nowrap">% Done</span>
              {t.itemType === "phase" && tl.tasks.some((ct) => ct.parentTaskId === t.id) ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={editTPercent}
                    className="w-20 opacity-60"
                    disabled
                    data-testid={`input-edit-task-percent-${t.id}`}
                  />
                  <span className="text-[10px] text-muted-foreground italic whitespace-nowrap">Auto-calculated</span>
                </div>
              ) : (
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editTPercent}
                  onChange={(e) => setEditTPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-20"
                  data-testid={`input-edit-task-percent-${t.id}`}
                />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-36">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <select
                value={editTStatus}
                onChange={(e) => setEditTStatus(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid={`select-edit-task-status-${t.id}`}
              >
                {taskStatuses.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Health</label>
              <select
                value={editTHealth}
                onChange={(e) => setEditTHealth(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid={`select-edit-task-health-${t.id}`}
              >
                {taskHealthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="w-36">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
              <select
                value={editTItemType}
                onChange={(e) => {
                  setEditTItemType(e.target.value);
                  if (e.target.value === "phase") setEditTParentId("");
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid={`select-edit-task-type-${t.id}`}
              >
                {taskItemTypes.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            {editTItemType === "workstream" && tl.tasks.filter((pt) => pt.itemType === "phase" && pt.id !== t.id).length > 0 && (
              <div className="w-44">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Parent Phase</label>
                <select
                  value={editTParentId}
                  onChange={(e) => setEditTParentId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  data-testid={`select-edit-task-parent-phase-${t.id}`}
                >
                  <option value="">None</option>
                  {tl.tasks
                    .filter((pt) => pt.itemType === "phase" && pt.id !== t.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={cancelTaskEdit}
              data-testid={`button-cancel-edit-task-${t.id}`}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={saveTaskEdit}
              disabled={!editTTitle.trim() || !editTStart.trim() || !editTEnd.trim() || updateTaskMutation.isPending}
              data-testid={`button-save-edit-task-${t.id}`}
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              {updateTaskMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-4 h-1.5 rounded-sm shrink-0"
              style={{ backgroundColor: t.color || tl.color }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium truncate" data-testid={`text-task-title-${t.id}`}>{t.title}</p>
                <span className="text-xs text-muted-foreground" data-testid={`text-task-percent-${t.id}`}>{t.percentComplete}%</span>
                <Badge variant="secondary" className={`text-xs ${
                  t.status === "in_progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                  t.status === "complete" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : ""
                }`}>{taskStatuses.find((s) => s.value === t.status)?.label || t.status}</Badge>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  t.health === "amber" ? "bg-amber-500 animate-pulse" : t.health === "red" ? "bg-red-500 animate-pulse" : "bg-green-500"
                }`} title={taskHealthOptions.find((h) => h.value === t.health)?.label || t.health} />
                {t.itemType === "phase" && <Badge variant="outline" className="text-xs">{taskItemTypes.find((it) => it.value === "phase")?.label || "Phase"}</Badge>}
                {t.itemType === "phase" && tl.tasks.some((ct) => ct.parentTaskId === t.id) && (
                  <span className="text-[10px] text-muted-foreground italic" data-testid={`text-phase-auto-${t.id}`}>Auto-calculated</span>
                )}
                {t.parentTaskId && (() => {
                  const parent = tl.tasks.find((pt) => pt.id === t.parentTaskId);
                  return parent ? <Badge variant="outline" className="text-xs text-muted-foreground">↳ {parent.title}</Badge> : null;
                })()}
              </div>
              {(t.startDate || t.endDate) && (
              <p className="text-xs text-muted-foreground">
                Planned: {t.startDate || "—"} — {t.endDate || "—"}
              </p>
              )}
              {(t.actualStartDate || t.actualEndDate) && (
                <p className="text-xs text-muted-foreground">
                  Actual: {t.actualStartDate || "—"} — {t.actualEndDate || "—"}
                </p>
              )}
              {t.description && (
                <p className="text-xs text-muted-foreground truncate max-w-md">{t.description}</p>
              )}
              <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden w-full max-w-xs">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${t.percentComplete}%`,
                    backgroundColor: t.color || tl.color,
                  }}
                  data-testid={`bar-task-progress-${t.id}`}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => startEditingTask(t)}
              data-testid={`button-edit-task-${t.id}`}
            >
              <Edit3 className="w-3.5 h-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  data-testid={`button-delete-task-${t.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove "{t.title}" from this project.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteTaskMutation.mutate(t.id)}
                    data-testid={`button-confirm-delete-task-${t.id}`}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </Card>
  );

  const healthColor = (val: string | null | undefined) => {
    if (val === "red") return "bg-red-500";
    if (val === "amber") return "bg-amber-500";
    return "bg-green-500";
  };

  const healthPulse = (val: string | null | undefined) => {
    if (val === "red" || val === "amber") return "animate-pulse";
    return "";
  };

  const projectStatus = projectStatuses.find(s => s.value === (timeline.projectStatus || "not_started"));
  const statusColor = timeline.projectStatus === "in_progress" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" :
    timeline.projectStatus === "complete" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
    timeline.projectStatus === "on_hold" ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" :
    "";

  const budget = parseFloat(timeline.approvedBudget ?? "0") || 0;
  const cost = parseFloat(timeline.totalRunningCost ?? "0") || 0;
  const gm = budget > 0 ? ((budget - cost) / budget) * 100 : null;

  return (
    <>
      <Helmet>
        <title>{`${timeline.title} | ${appTitleOnly}`}</title>
        <meta name="description" content={timeline.description || `View the ${timeline.title} project with ${timeline.milestones.length} milestones.`} />
        <meta property="og:title" content={`${timeline.title} | ${appTitleOnly}`} />
      </Helmet>
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/projects")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            {!editing && (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: timeline.color }}
                  />
                  <h1 className="text-2xl font-bold truncate" data-testid="text-timeline-title">
                    {timeline.title}
                  </h1>
                  <Badge className={`${statusColor} border-0`} data-testid="badge-project-status">
                    {projectStatus?.label || "Not Started"}
                  </Badge>
                  {timeline.sourceOpportunityId && (
                    <Link href={`/opportunities/${timeline.sourceOpportunityId}`}>
                      <Badge variant="outline" className="gap-1 text-xs cursor-pointer hover:bg-muted" data-testid="badge-source-opportunity">
                        From Opportunity
                      </Badge>
                    </Link>
                  )}
                  {(() => {
                    const sorted = [...governanceStages].sort((a, b) => a.stageNumber - b.stageNumber);
                    const current = sorted.find(s => s.id === timeline.flightpathStageId);
                    if (current) {
                      return (
                        <Badge variant="outline" className="gap-1 text-xs" data-testid="badge-governance-stage">
                          <ShieldCheck className="w-3 h-3" />
                          Stage {current.stageNumber}: {current.name}
                        </Badge>
                      );
                    }
                    return null;
                  })()}
                </div>
                {timeline.description && <p className="text-sm text-muted-foreground mt-1" data-testid="text-project-description">{timeline.description}</p>}
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                  {(() => {
                    const client = (clientsList || []).find(c => c.id === timeline.clientId);
                    return client ? <span data-testid="text-project-client">{client.name}</span> : null;
                  })()}
                  {timeline.region && <span data-testid="text-project-region">{timeline.region}</span>}
                  {timeline.projectType && <span>{projectTypes.find(p => p.value === timeline.projectType)?.label || timeline.projectType}</span>}
                  {timeline.engagementModel && <span>{engagementModels.find(e => e.value === timeline.engagementModel)?.label || timeline.engagementModel}</span>}
                  {timeline.dateFormat && <span data-testid="badge-date-format">{timeline.dateFormat}</span>}
                  {timeline.startDate && <span>Start: {timeline.startDate}</span>}
                  {timeline.endDate && <span>End: {timeline.endDate}</span>}
                </div>
              </>
            )}
          </div>
          {!editing && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Button variant="outline" size="sm" onClick={startEditing} data-testid="button-edit-title">
                <Edit3 className="w-4 h-4 mr-1" /> Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={filterMode === "milestones" ? "secondary" : "outline"}
                    size="sm"
                    data-testid="button-filter"
                  >
                    <ListFilter className="w-4 h-4 mr-1" />
                    {filterMode === "all" ? "All" : "Milestones"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setFilterMode("all")} data-testid="filter-all">
                    <Calendar className="w-4 h-4 mr-2" />
                    All (Milestones + Tasks)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterMode("milestones")} data-testid="filter-milestones">
                    <ClipboardList className="w-4 h-4 mr-2" />
                    Milestones Only
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={exporting} data-testid="button-export">
                    <Download className="w-4 h-4 mr-1" />
                    {exporting ? "..." : "Export"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("png")} data-testid="button-export-png">
                    <Image className="w-4 h-4 mr-2" />
                    Download as PNG
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("pdf")} data-testid="button-export-pdf">
                    <FileText className="w-4 h-4 mr-2" />
                    Download as PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-add-item">
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => { setShowAddForm(!showAddForm); setShowAddTaskForm(false); }}
                    data-testid="button-add-milestone"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Add Milestone
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => { setShowAddTaskForm(!showAddTaskForm); setShowAddForm(false); }}
                    data-testid="button-add-task"
                  >
                    <ClipboardList className="w-4 h-4 mr-2" />
                    Add Task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        {(budget > 0 || cost > 0) && !editing && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-3 pb-3">
                <div className="metric-label">Approved Budget</div>
                <div className="metric-value" data-testid="text-approved-budget">
                  ${budget.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3">
                <div className="metric-label">Running Cost</div>
                <div className="metric-value" data-testid="text-total-running-cost">
                  ${cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3">
                <div className="metric-label">Gross Margin</div>
                <div className={`metric-value ${
                  gm === null ? "text-muted-foreground" :
                  gm >= 30 ? "text-green-600 dark:text-green-400" :
                  gm >= 15 ? "text-amber-600 dark:text-amber-400" :
                  "text-red-600 dark:text-red-400"
                }`} data-testid="text-gross-margin">
                  {gm !== null ? `${gm.toFixed(1)}%` : "\u2014"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3">
                <div className="metric-label">Team</div>
                <div className="metric-value" data-testid="text-team-count">
                  {uniqueTeamMemberCount}
                </div>
                <div className="text-xs text-muted-foreground">{uniqueTeamMemberCount === 1 ? "member" : "members"} allocated</div>
              </CardContent>
            </Card>
          </div>
        )}

        {!editing && (
          <div className="flex items-center gap-6 flex-wrap">
            {([
              { key: "healthOverall", label: "Overall" },
              { key: "scopeHealth", label: "Scope" },
              { key: "budgetHealth", label: "Budget" },
              { key: "teamHealth", label: "Team" },
            ] as const).map(({ key, label }) => {
              const val = (timeline as any)[key] || "green";
              return (
                <div key={key} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${healthColor(val)} ${healthPulse(val)}`} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <select
                    className="text-xs border rounded-md px-2 py-1 bg-background transition-smooth"
                    value={val}
                    onChange={async (e) => {
                      await apiRequest("PATCH", `/api/timelines/${id}`, { [key]: e.target.value });
                      queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
                      queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
                    }}
                    data-testid={`select-health-${key}`}
                  >
                    {taskHealthOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-6">
        {editing && (
          <Card className="p-5 space-y-4">
            <div className="space-y-3">
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px] space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Title</label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-xl font-bold"
                    data-testid="input-edit-title"
                  />
                </div>
                <div className="flex-1 min-w-[200px] space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Optional description"
                    data-testid="input-edit-description"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Project Type</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={timeline.projectType || ""}
                    onChange={async (e) => {
                      await apiRequest("PATCH", `/api/timelines/${id}`, { projectType: e.target.value || null });
                      queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
                      queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
                    }}
                    data-testid="select-project-type"
                  >
                    <option value="">Not set</option>
                    {projectTypes.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Engagement</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={timeline.engagementModel || ""}
                    onChange={async (e) => {
                      await apiRequest("PATCH", `/api/timelines/${id}`, { engagementModel: e.target.value || null });
                      queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
                      queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
                    }}
                    data-testid="select-engagement-model"
                  >
                    <option value="">Not set</option>
                    {engagementModels.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Client</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={timeline.clientId || ""}
                    onChange={async (e) => {
                      await apiRequest("PATCH", `/api/timelines/${id}`, { clientId: e.target.value || null });
                      queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
                      queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
                    }}
                    data-testid="select-client"
                  >
                    <option value="">Not set</option>
                    {(clientsList || []).map((cl) => (
                      <option key={cl.id} value={cl.id}>{cl.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={timeline.projectStatus || "not_started"}
                    onChange={async (e) => {
                      await apiRequest("PATCH", `/api/timelines/${id}`, { projectStatus: e.target.value });
                      queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
                      queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
                    }}
                    data-testid="select-project-status"
                  >
                    {projectStatuses.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Region</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    value={timeline.region || ""}
                    onChange={async (e) => {
                      await apiRequest("PATCH", `/api/timelines/${id}`, { region: e.target.value || null });
                      queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
                      queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
                    }}
                    data-testid="select-region"
                  >
                    <option value="">Not set</option>
                    {regionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Start Date</label>
                  <input
                    type="date"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    defaultValue={timeline.startDate ?? ""}
                    key={`start-${timeline.startDate}`}
                    onBlur={async (e) => {
                      const val = e.target.value || null;
                      if (val !== (timeline.startDate ?? null)) {
                        await apiRequest("PATCH", `/api/timelines/${id}`, { startDate: val });
                        queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
                        queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
                      }
                    }}
                    data-testid="input-project-start-date"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">End Date</label>
                  <input
                    type="date"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                    defaultValue={timeline.endDate ?? ""}
                    key={`end-${timeline.endDate}`}
                    onBlur={async (e) => {
                      const val = e.target.value || null;
                      if (val !== (timeline.endDate ?? null)) {
                        await apiRequest("PATCH", `/api/timelines/${id}`, { endDate: val });
                        queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
                        queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
                      }
                    }}
                    data-testid="input-project-end-date"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Theme</label>
                  <ThemePicker value={editColor} onChange={setEditColor} compact />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => setEditing(false)}
                data-testid="button-cancel-edit"
              >
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={!editTitle.trim() || updateMutation.isPending}
                data-testid="button-save-edit"
              >
                <Save className="w-4 h-4 mr-1" />
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </Card>
        )}

        {showAddForm && (
          <Card className="p-4">
            <h4 className="text-xs font-medium text-muted-foreground mb-3">New Milestone</h4>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Milestone title"
                  data-testid="input-new-milestone-title"
                />
              </div>
              <div className="w-40">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Planned Date</label>
                <Input
                  type={projectDateFormat ? "date" : "text"}
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  placeholder={projectDateFormat || "e.g. Mar 2025"}
                  data-testid="input-new-milestone-date"
                />
              </div>
              <div className="w-40">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Actual Date</label>
                <Input
                  type={projectDateFormat ? "date" : "text"}
                  value={newActualDate}
                  onChange={(e) => setNewActualDate(e.target.value)}
                  placeholder="Optional"
                  data-testid="input-new-milestone-actual-date"
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                <Input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Optional"
                  data-testid="input-new-milestone-desc"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="new-fin-obligation"
                  checked={newIsFinancialObligation}
                  onCheckedChange={(checked) => setNewIsFinancialObligation(checked === true)}
                  data-testid="checkbox-new-milestone-financial"
                />
                <label htmlFor="new-fin-obligation" className="text-xs font-medium text-muted-foreground cursor-pointer">Financial Obligation</label>
              </div>
              {newIsFinancialObligation && (
                <div className="w-36">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="0.00"
                    data-testid="input-new-milestone-amount"
                  />
                </div>
              )}
              <Button
                onClick={handleAddMilestone}
                disabled={!newTitle.trim() || !newDate.trim() || addMilestoneMutation.isPending}
                data-testid="button-submit-new-milestone"
              >
                {addMilestoneMutation.isPending ? "Adding..." : "Add"}
              </Button>
            </div>
          </Card>
        )}

        {showAddTaskForm && (
          <Card className="p-4">
            <h4 className="text-xs font-medium text-muted-foreground mb-3">New Task</h4>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
                <Input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Task title"
                  data-testid="input-new-task-title"
                />
              </div>
              <div className="w-40">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Planned Start</label>
                <Input
                  type={projectDateFormat ? "date" : "text"}
                  value={newTaskStart}
                  onChange={(e) => setNewTaskStart(e.target.value)}
                  placeholder={projectDateFormat || "e.g. Jan 2025"}
                  data-testid="input-new-task-start"
                />
              </div>
              <div className="w-40">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Planned End</label>
                <Input
                  type={projectDateFormat ? "date" : "text"}
                  value={newTaskEnd}
                  onChange={(e) => setNewTaskEnd(e.target.value)}
                  placeholder={projectDateFormat || "e.g. Mar 2025"}
                  data-testid="input-new-task-end"
                />
              </div>
              <div className="w-40">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Actual Start</label>
                <Input
                  type={projectDateFormat ? "date" : "text"}
                  value={newTaskActualStart}
                  onChange={(e) => setNewTaskActualStart(e.target.value)}
                  placeholder="Optional"
                  data-testid="input-new-task-actual-start"
                />
              </div>
              <div className="w-40">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Actual End</label>
                <Input
                  type={projectDateFormat ? "date" : "text"}
                  value={newTaskActualEnd}
                  onChange={(e) => setNewTaskActualEnd(e.target.value)}
                  placeholder="Optional"
                  data-testid="input-new-task-actual-end"
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                <Input
                  value={newTaskDesc}
                  onChange={(e) => setNewTaskDesc(e.target.value)}
                  placeholder="Optional"
                  data-testid="input-new-task-desc"
                />
              </div>
              <div className="w-24">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">% Done</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={newTaskPercent}
                  onChange={(e) => setNewTaskPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  data-testid="input-new-task-percent"
                />
              </div>
              <div className="w-36">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                <select
                  value={newTaskStatus}
                  onChange={(e) => setNewTaskStatus(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  data-testid="select-new-task-status"
                >
                  {taskStatuses.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="w-32">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Health</label>
                <select
                  value={newTaskHealth}
                  onChange={(e) => setNewTaskHealth(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  data-testid="select-new-task-health"
                >
                  {taskHealthOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="w-36">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
                <select
                  value={newTaskItemType}
                  onChange={(e) => {
                    setNewTaskItemType(e.target.value);
                    if (e.target.value === "phase") setNewTaskParentId("");
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  data-testid="select-new-task-type"
                >
                  {taskItemTypes.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              {newTaskItemType === "workstream" && timeline.tasks.filter((t) => t.itemType === "phase").length > 0 && (
                <div className="w-44">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Parent Phase</label>
                  <select
                    value={newTaskParentId}
                    onChange={(e) => setNewTaskParentId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    data-testid="select-new-task-parent-phase"
                  >
                    <option value="">None</option>
                    {timeline.tasks
                      .filter((t) => t.itemType === "phase")
                      .map((p) => (
                        <option key={p.id} value={p.id}>{p.title}</option>
                      ))}
                  </select>
                </div>
              )}
              <Button
                onClick={handleAddTask}
                disabled={!newTaskTitle.trim() || !newTaskStart.trim() || !newTaskEnd.trim() || addTaskMutation.isPending}
                data-testid="button-submit-new-task"
              >
                {addTaskMutation.isPending ? "Adding..." : "Add"}
              </Button>
            </div>
          </Card>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">
            {timeline.milestones.length} milestone{timeline.milestones.length !== 1 ? "s" : ""}
          </Badge>
          <Badge variant="secondary">
            {timeline.tasks.length} task{timeline.tasks.length !== 1 ? "s" : ""}
          </Badge>
          {filterMode === "milestones" && (
            <Badge variant="outline">
              Showing milestones only
            </Badge>
          )}
        </div>

        <div ref={timelineRef} data-export-timeline className="bg-background rounded-md">
          <TimelineView
            milestones={timeline.milestones}
            tasks={timeline.tasks}
            timelineColor={timeline.color}
            showTasks={showTasks}
          />
        </div>

        <Tabs defaultValue="milestones" data-testid="manage-tabs">
          <TabsList className="mb-4">
            <TabsTrigger value="milestones" data-testid="tab-milestones">
              Milestones ({timeline.milestones.length})
            </TabsTrigger>
            <TabsTrigger value="phases" data-testid="tab-phases">
              Phases ({timeline.tasks.filter((t) => t.itemType === "phase").length})
            </TabsTrigger>
            <TabsTrigger value="workstreams" data-testid="tab-workstreams">
              Workstreams ({timeline.tasks.filter((t) => t.itemType === "workstream").length})
            </TabsTrigger>
            <TabsTrigger value="team-members" data-testid="tab-team-members">
              Team Members ({uniqueTeamMemberCount})
            </TabsTrigger>
            <TabsTrigger value="timesheets" data-testid="tab-timesheets">
              Timesheets
            </TabsTrigger>
            <TabsTrigger value="progress" data-testid="tab-progress">
              Progress
            </TabsTrigger>
            <TabsTrigger value="evm" data-testid="tab-evm">
              EVM
            </TabsTrigger>
            <TabsTrigger value="governance" data-testid="tab-governance">
              Governance
            </TabsTrigger>
            <TabsTrigger value="raid-log" data-testid="tab-raid-log">
              RAID Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="milestones">
            <div className="space-y-2">
              {timeline.milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No milestones yet. Click "Add" to create one.</p>
              ) : (
                [...timeline.milestones]
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((m) => (
                    <Card
                      key={m.id}
                      className="p-3"
                      data-testid={`manage-milestone-${m.id}`}
                    >
                      {editingMilestoneId === m.id ? (
                        <div className="space-y-2">
                          <div className="flex gap-2 flex-wrap">
                            <div className="flex-1 min-w-[140px]">
                              <Input
                                value={editMTitle}
                                onChange={(e) => setEditMTitle(e.target.value)}
                                placeholder="Title"
                                data-testid={`input-edit-milestone-title-${m.id}`}
                              />
                            </div>
                            <div className="w-40">
                              <Input
                                type={projectDateFormat ? "date" : "text"}
                                value={projectDateFormat ? parseDateToISO(editMDate, projectDateFormat) : editMDate}
                                onChange={(e) => setEditMDate(e.target.value)}
                                placeholder="Planned date"
                                data-testid={`input-edit-milestone-date-${m.id}`}
                              />
                            </div>
                            <div className="w-40">
                              <Input
                                type={projectDateFormat ? "date" : "text"}
                                value={projectDateFormat ? parseDateToISO(editMActualDate, projectDateFormat) : editMActualDate}
                                onChange={(e) => setEditMActualDate(e.target.value)}
                                placeholder="Actual date"
                                data-testid={`input-edit-milestone-actual-date-${m.id}`}
                              />
                            </div>
                          </div>
                          <Input
                            value={editMDesc}
                            onChange={(e) => setEditMDesc(e.target.value)}
                            placeholder="Description (optional)"
                            data-testid={`input-edit-milestone-desc-${m.id}`}
                          />
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                id={`edit-fin-obligation-${m.id}`}
                                checked={editMIsFinancialObligation}
                                onCheckedChange={(checked) => setEditMIsFinancialObligation(checked === true)}
                                data-testid={`checkbox-edit-milestone-financial-${m.id}`}
                              />
                              <label htmlFor={`edit-fin-obligation-${m.id}`} className="text-xs font-medium text-muted-foreground cursor-pointer">Financial Obligation</label>
                            </div>
                            {editMIsFinancialObligation && (
                              <div className="w-36">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editMAmount}
                                  onChange={(e) => setEditMAmount(e.target.value)}
                                  placeholder="Amount ($)"
                                  data-testid={`input-edit-milestone-amount-${m.id}`}
                                />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelMilestoneEdit}
                              data-testid={`button-cancel-edit-milestone-${m.id}`}
                            >
                              <X className="w-3.5 h-3.5 mr-1" />
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={saveMilestoneEdit}
                              disabled={!editMTitle.trim() || !editMDate.trim() || updateMilestoneMutation.isPending}
                              data-testid={`button-save-edit-milestone-${m.id}`}
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              {updateMilestoneMutation.isPending ? "Saving..." : "Save"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: m.color || timeline.color }}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate" data-testid={`text-milestone-title-${m.id}`}>{m.title}</p>
                                {m.isFinancialObligation && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-600 dark:text-amber-400" data-testid={`badge-financial-${m.id}`}>
                                    ${m.amount ? parseFloat(m.amount).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Planned: {m.date}
                                {m.actualDate && <span className="ml-2">Actual: {m.actualDate}</span>}
                              </p>
                              {m.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-md">{m.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => startEditingMilestone(m)}
                              data-testid={`button-edit-milestone-${m.id}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  data-testid={`button-delete-milestone-${m.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete milestone?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently remove "{m.title}" from this timeline.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMilestoneMutation.mutate(m.id)}
                                    data-testid={`button-confirm-delete-milestone-${m.id}`}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="phases">
            <div className="space-y-2">
              {timeline.tasks.filter((t) => t.itemType === "phase").length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No phases yet. Click "Add" &rarr; "Add Task" and set type to Phase.</p>
              ) : (
                [...timeline.tasks]
                  .filter((t) => t.itemType === "phase")
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((t) => renderTaskCard(t, timeline))
              )}
            </div>
          </TabsContent>

          <TabsContent value="workstreams">
            <div className="space-y-2">
              {timeline.tasks.filter((t) => t.itemType === "workstream").length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No workstreams yet. Click "Add" &rarr; "Add Task" to create one.</p>
              ) : (
                [...timeline.tasks]
                  .filter((t) => t.itemType === "workstream")
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((t) => renderTaskCard(t, timeline))
              )}
            </div>
          </TabsContent>

          <TabsContent value="team-members">
            <ProjectTeamMembersTab timelineId={timeline.id} />
          </TabsContent>

          <TabsContent value="timesheets">
            <ProjectTimesheetsTab
              timelineId={timeline.id}
              tasks={timeline.tasks}
            />
          </TabsContent>

          <TabsContent value="progress">
            <ProgressTrackingTab
              timelineId={timeline.id}
              tasks={timeline.tasks}
              approvedBudget={timeline.approvedBudget}
            />
          </TabsContent>

          <TabsContent value="evm">
            <EVMTab
              timelineId={timeline.id}
              tasks={timeline.tasks}
              approvedBudget={timeline.approvedBudget}
            />
          </TabsContent>

          <TabsContent value="governance">
            <GovernanceTab
              timelineId={timeline.id}
              currentStageId={timeline.flightpathStageId || null}
              onStageChange={(stageId) => {
                queryClient.invalidateQueries({ queryKey: ["/api/timelines", timeline.id] });
              }}
            />
          </TabsContent>

          <TabsContent value="raid-log">
            <RaidLog timelineId={timeline.id} />
          </TabsContent>

        </Tabs>
        </div>
      </div>
    </>
  );
}
