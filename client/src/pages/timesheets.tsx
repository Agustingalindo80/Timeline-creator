import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  Timeline,
  Task,
  TimesheetEntry,
  AllocationWithTeamMember,
  ProjectTeamMemberWithDetails,
} from "@shared/schema";

function getWeekEnding(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function shiftWeek(dateStr: string, weeks: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return formatDate(d);
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

type CellKey = string;
function cellKey(teamMemberId: string, taskId: string): CellKey {
  return `${teamMemberId}__${taskId}`;
}

export default function TimesheetsPage() {
  const { toast } = useToast();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [weekEnding, setWeekEnding] = useState<string>(() => formatDate(getWeekEnding(new Date())));
  const [editingCells, setEditingCells] = useState<Record<CellKey, string>>({});

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Timeline[]>({
    queryKey: ["/api/timelines"],
  });

  const { data: allocations = [], isLoading: allocsLoading } = useQuery<AllocationWithTeamMember[]>({
    queryKey: ["/api/timelines", selectedProjectId, "allocations"],
    enabled: !!selectedProjectId,
    queryFn: async () => {
      const res = await fetch(`/api/timelines/${selectedProjectId}/allocations`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch allocations");
      return res.json();
    },
  });

  const { data: projectTeamRaw = [] } = useQuery<ProjectTeamMemberWithDetails[]>({
    queryKey: ["/api/timelines", selectedProjectId, "team"],
    enabled: !!selectedProjectId,
  });

  const teamMembers = useMemo(() => {
    const seen = new Set<string>();
    const result: { teamMemberId: string; name: string; role: string | null; hourlyCost: string | null }[] = [];
    for (const alloc of allocations) {
      if (!seen.has(alloc.teamMemberId)) {
        seen.add(alloc.teamMemberId);
        result.push({
          teamMemberId: alloc.teamMemberId,
          name: alloc.teamMember.name,
          role: alloc.teamMember.role,
          hourlyCost: alloc.teamMember.hourlyCost,
        });
      }
    }
    for (const ptm of projectTeamRaw) {
      if (!seen.has(ptm.teamMemberId)) {
        seen.add(ptm.teamMemberId);
        result.push({
          teamMemberId: ptm.teamMemberId,
          name: ptm.teamMember.name,
          role: ptm.teamMember.role,
          hourlyCost: ptm.teamMember.hourlyCost,
        });
      }
    }
    return result;
  }, [allocations, projectTeamRaw]);

  const { data: allTasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/timelines", selectedProjectId, "tasks"],
    enabled: !!selectedProjectId,
  });

  const workstreams = useMemo(
    () => allTasks.filter((t) => t.itemType === "workstream"),
    [allTasks]
  );

  const { data: timesheetEntries = [], isLoading: entriesLoading } = useQuery<TimesheetEntry[]>({
    queryKey: ["/api/timesheets", { timelineId: selectedProjectId, weekEnding }],
    enabled: !!selectedProjectId,
    queryFn: async () => {
      const res = await fetch(`/api/timelines/${selectedProjectId}/timesheets?weekEnding=${weekEnding}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch timesheets");
      return res.json();
    },
  });

  const entryMap = useMemo(() => {
    const map = new Map<CellKey, TimesheetEntry>();
    for (const entry of timesheetEntries) {
      if (entry.taskId) {
        map.set(cellKey(entry.teamMemberId, entry.taskId), entry);
      }
    }
    return map;
  }, [timesheetEntries]);

  const createMutation = useMutation({
    mutationFn: async (data: { teamMemberId: string; taskId: string; hours: number }) => {
      const res = await apiRequest("POST", "/api/timesheets", {
        timelineId: selectedProjectId,
        teamMemberId: data.teamMemberId,
        taskId: data.taskId,
        weekEnding,
        hours: data.hours,
        billableType: "billable",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { entryId: string; hours: number }) => {
      const res = await apiRequest("PATCH", `/api/timesheets/${data.entryId}`, { hours: data.hours });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      await apiRequest("DELETE", `/api/timesheets/${entryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheets"] });
    },
  });

  const handleCellBlur = useCallback(
    (teamMemberId: string, taskId: string) => {
      const key = cellKey(teamMemberId, taskId);
      const rawValue = editingCells[key];
      if (rawValue === undefined) return;

      const hours = parseFloat(rawValue);
      const existing = entryMap.get(key);

      setEditingCells((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });

      if (isNaN(hours) || hours < 0) {
        if (existing && (rawValue === "" || rawValue === "0")) {
          deleteMutation.mutate(existing.id);
        }
        return;
      }

      if (hours === 0) {
        if (existing) {
          deleteMutation.mutate(existing.id);
        }
        return;
      }

      if (existing) {
        if (parseFloat(existing.hours) !== hours) {
          updateMutation.mutate({ entryId: existing.id, hours });
        }
      } else {
        createMutation.mutate({ teamMemberId, taskId, hours });
      }
    },
    [editingCells, entryMap, createMutation, updateMutation, deleteMutation]
  );

  const getCellValue = (teamMemberId: string, taskId: string): string => {
    const key = cellKey(teamMemberId, taskId);
    if (key in editingCells) return editingCells[key];
    const entry = entryMap.get(key);
    if (entry) {
      const h = parseFloat(entry.hours);
      return h > 0 ? String(h) : "";
    }
    return "";
  };

  const getRate = (teamMemberId: string): number => {
    const ptm = projectTeamRaw.find(p => p.teamMemberId === teamMemberId);
    if (ptm?.rateCard?.costRate) return parseFloat(ptm.rateCard.costRate);
    if (ptm?.hourlyCost) return parseFloat(ptm.hourlyCost);
    const tm = teamMembers.find(t => t.teamMemberId === teamMemberId);
    if (tm?.hourlyCost) return parseFloat(tm.hourlyCost);
    return 0;
  };

  const getRowTotal = (teamMemberId: string): number => {
    let total = 0;
    for (const ws of workstreams) {
      const val = getCellValue(teamMemberId, ws.id);
      const h = parseFloat(val);
      if (!isNaN(h)) total += h;
    }
    return total;
  };

  const getColTotal = (taskId: string): number => {
    let total = 0;
    for (const tm of teamMembers) {
      const val = getCellValue(tm.teamMemberId, taskId);
      const h = parseFloat(val);
      if (!isNaN(h)) total += h;
    }
    return total;
  };

  const grandTotalHours = useMemo(() => {
    let total = 0;
    for (const tm of teamMembers) {
      total += getRowTotal(tm.teamMemberId);
    }
    return total;
  }, [teamMembers, workstreams, editingCells, entryMap]);

  const grandTotalCost = useMemo(() => {
    let total = 0;
    for (const tm of teamMembers) {
      const hours = getRowTotal(tm.teamMemberId);
      total += hours * getRate(tm.teamMemberId);
    }
    return total;
  }, [teamMembers, workstreams, editingCells, entryMap]);

  const isLoading = projectsLoading || (selectedProjectId && (allocsLoading || tasksLoading || entriesLoading));

  return (
    <>
      <Helmet>
        <title>Timesheets</title>
      </Helmet>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Timesheets</h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-description">
            Track actual effort hours per team member and workstream
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-64">
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId} data-testid="select-project">
              <SelectTrigger data-testid="select-project-trigger">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id} data-testid={`select-project-${p.id}`}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={() => setWeekEnding((w) => shiftWeek(w, -1))}
              data-testid="button-prev-week"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="text-sm font-medium min-w-[180px] text-center" data-testid="text-week-ending">
              Week ending: {formatDisplayDate(weekEnding)}
            </div>
            <Button
              size="icon"
              variant="outline"
              onClick={() => setWeekEnding((w) => shiftWeek(w, 1))}
              data-testid="button-next-week"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {!selectedProjectId && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground" data-testid="text-no-project">
              Select a project to view and edit timesheets
            </CardContent>
          </Card>
        )}

        {selectedProjectId && isLoading && (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {selectedProjectId && !isLoading && teamMembers.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground" data-testid="text-no-team">
              No team members allocated to this project. Add allocations in the team member detail page.
            </CardContent>
          </Card>
        )}

        {selectedProjectId && !isLoading && teamMembers.length > 0 && (
          <>
            <div className="flex items-center gap-4 flex-wrap">
              <Card className="flex-1 min-w-[140px]">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-hours">{grandTotalHours.toFixed(1)}</div>
                </CardContent>
              </Card>
              <Card className="flex-1 min-w-[140px]">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-cost">
                    ${grandTotalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-timesheet">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium sticky left-0 bg-card z-10 min-w-[180px]">
                          Team Member
                        </th>
                        <th className="text-right p-3 font-medium min-w-[80px]">Rate/hr</th>
                        {workstreams.map((ws) => (
                          <th
                            key={ws.id}
                            className="text-center p-3 font-medium min-w-[100px] max-w-[140px] truncate"
                            title={ws.title}
                          >
                            {ws.title}
                          </th>
                        ))}
                        <th className="text-right p-3 font-medium min-w-[80px]">Total Hrs</th>
                        <th className="text-right p-3 font-medium min-w-[100px]">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.map((tm) => {
                        const rate = getRate(tm.teamMemberId);
                        const rowHours = getRowTotal(tm.teamMemberId);
                        const rowCost = rowHours * rate;
                        return (
                          <tr key={tm.teamMemberId} className="border-b last:border-b-0" data-testid={`row-member-${tm.teamMemberId}`}>
                            <td className="p-3 sticky left-0 bg-card z-10">
                              <div className="font-medium" data-testid={`text-member-name-${tm.teamMemberId}`}>
                                {tm.name}
                              </div>
                              {tm.role && (
                                <div className="text-xs text-muted-foreground">{tm.role}</div>
                              )}
                            </td>
                            <td className="p-3 text-right text-muted-foreground" data-testid={`text-rate-${tm.teamMemberId}`}>
                              ${rate.toFixed(2)}
                            </td>
                            {workstreams.map((ws) => {
                              const key = cellKey(tm.teamMemberId, ws.id);
                              const val = getCellValue(tm.teamMemberId, ws.id);
                              return (
                                <td key={ws.id} className="p-1.5 text-center">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    className="w-full text-center text-sm"
                                    value={val}
                                    onChange={(e) =>
                                      setEditingCells((prev) => ({ ...prev, [key]: e.target.value }))
                                    }
                                    onBlur={() => handleCellBlur(tm.teamMemberId, ws.id)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        (e.target as HTMLInputElement).blur();
                                      }
                                    }}
                                    placeholder="0"
                                    data-testid={`input-hours-${tm.teamMemberId}-${ws.id}`}
                                  />
                                </td>
                              );
                            })}
                            <td className="p-3 text-right font-medium" data-testid={`text-row-total-${tm.teamMemberId}`}>
                              {rowHours > 0 ? rowHours.toFixed(1) : "-"}
                            </td>
                            <td className="p-3 text-right font-medium" data-testid={`text-row-cost-${tm.teamMemberId}`}>
                              {rowCost > 0
                                ? `$${rowCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 font-medium">
                        <td className="p-3 sticky left-0 bg-card z-10">Column Totals</td>
                        <td className="p-3"></td>
                        {workstreams.map((ws) => {
                          const colTotal = getColTotal(ws.id);
                          return (
                            <td key={ws.id} className="p-3 text-center" data-testid={`text-col-total-${ws.id}`}>
                              {colTotal > 0 ? colTotal.toFixed(1) : "-"}
                            </td>
                          );
                        })}
                        <td className="p-3 text-right font-bold" data-testid="text-grand-total-hours">
                          {grandTotalHours.toFixed(1)}
                        </td>
                        <td className="p-3 text-right font-bold" data-testid="text-grand-total-cost">
                          ${grandTotalCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>

            {workstreams.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground" data-testid="text-no-workstreams">
                  No workstreams found for this project. Add workstreams in the project detail page.
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}
