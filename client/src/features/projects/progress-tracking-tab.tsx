import { useCallback, useMemo, useState, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Task, ProgressEntry } from "@shared/schema";
import { getWeekEnding, getPreviousWeekEnding, safeParseDate } from "./helpers";

export function ProgressTrackingTab({ timelineId, tasks, approvedBudget }: { timelineId: string; tasks: Task[]; approvedBudget: string | null }) {
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
    onError: (err: Error) => {
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
    onError: (err: Error) => {
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
