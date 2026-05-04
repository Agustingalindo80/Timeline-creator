import { useMemo, useState, Fragment } from "react";
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
import {
  BarChart3,
  ShieldCheck,
  Snowflake,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
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
import type { AllocationWithTeamMember, Task, ProgressEntry, TimesheetEntry, ProjectTeamMemberWithDetails, EvmSnapshot } from "@shared/schema";
import { getWeekEnding, safeParseDate } from "./helpers";

export function EVMTab({ timelineId, tasks, approvedBudget }: { timelineId: string; tasks: Task[]; approvedBudget: string | null }) {
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
