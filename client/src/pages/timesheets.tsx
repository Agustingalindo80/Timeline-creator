import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueries } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Loader2, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  Timeline,
  Task,
  TimesheetEntry,
  TeamMember,
} from "@shared/schema";

function getWeekEnding(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(weekEndingStr: string): { date: string; label: string; dayName: string }[] {
  const sun = new Date(weekEndingStr + "T00:00:00");
  const mon = new Date(sun);
  mon.setDate(sun.getDate() - 6);
  const days: { date: string; label: string; dayName: string }[] = [];
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    days.push({
      date: formatDate(d),
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      dayName: dayNames[i],
    });
  }
  return days;
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

type RowKey = string;
function rowKey(projectId: string, taskId: string): RowKey {
  return `${projectId}__${taskId}`;
}

type CellKey = string;
function cellKey(projectId: string, taskId: string, dayDate: string): CellKey {
  return `${projectId}__${taskId}__${dayDate}`;
}

interface TimesheetRow {
  projectId: string;
  taskId: string;
  key: RowKey;
}

export default function TimesheetsPage() {
  const { toast } = useToast();
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<string>("");
  const [weekEnding, setWeekEnding] = useState<string>(() => formatDate(getWeekEnding(new Date())));
  const [editingCells, setEditingCells] = useState<Record<CellKey, string>>({});
  const [addingRow, setAddingRow] = useState(false);
  const [newRowProjectId, setNewRowProjectId] = useState<string>("");
  const [newRowTaskId, setNewRowTaskId] = useState<string>("");
  const [pendingRows, setPendingRows] = useState<TimesheetRow[]>([]);

  const weekDays = useMemo(() => getWeekDays(weekEnding), [weekEnding]);

  const { data: allTeamMembers = [], isLoading: tmLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Timeline[]>({
    queryKey: ["/api/timelines"],
  });

  const { data: entriesRaw = [], isLoading: entriesLoading } = useQuery<TimesheetEntry[]>({
    queryKey: ["/api/timesheets", { teamMemberId: selectedTeamMemberId, weekEnding }],
    enabled: !!selectedTeamMemberId,
    queryFn: async () => {
      const res = await fetch(`/api/timesheets?teamMemberId=${selectedTeamMemberId}&weekEnding=${weekEnding}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch timesheets");
      return res.json();
    },
  });

  const serverRows = useMemo(() => {
    const seen = new Set<RowKey>();
    const rows: TimesheetRow[] = [];
    for (const e of entriesRaw) {
      if (!e.taskId) continue;
      const rk = rowKey(e.timelineId, e.taskId);
      if (!seen.has(rk)) {
        seen.add(rk);
        rows.push({ projectId: e.timelineId, taskId: e.taskId, key: rk });
      }
    }
    return rows;
  }, [entriesRaw]);

  const existingRows = useMemo(() => {
    const seen = new Set<RowKey>();
    const merged: TimesheetRow[] = [];
    for (const r of serverRows) {
      seen.add(r.key);
      merged.push(r);
    }
    for (const r of pendingRows) {
      if (!seen.has(r.key)) {
        seen.add(r.key);
        merged.push(r);
      }
    }
    return merged;
  }, [serverRows, pendingRows]);

  const legacyWeeklyEntries = useMemo(() => {
    const map = new Map<RowKey, TimesheetEntry>();
    for (const entry of entriesRaw) {
      if (entry.taskId && !entry.dayDate) {
        map.set(rowKey(entry.timelineId, entry.taskId), entry);
      }
    }
    return map;
  }, [entriesRaw]);

  const entryMap = useMemo(() => {
    const map = new Map<CellKey, TimesheetEntry>();
    for (const entry of entriesRaw) {
      if (entry.taskId && entry.dayDate) {
        map.set(cellKey(entry.timelineId, entry.taskId, entry.dayDate), entry);
      }
    }
    return map;
  }, [entriesRaw]);

  const projectIdsToFetch = useMemo(() => {
    const pids = new Set<string>();
    for (const r of existingRows) pids.add(r.projectId);
    if (newRowProjectId) pids.add(newRowProjectId);
    return [...pids].sort();
  }, [existingRows, newRowProjectId]);

  const taskQueryResults = useQueries({
    queries: projectIdsToFetch.map(pid => ({
      queryKey: ["/api/timelines", pid, "tasks"],
      enabled: !!pid,
    })),
  });

  const allTasksByProject = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (let i = 0; i < projectIdsToFetch.length; i++) {
      const pid = projectIdsToFetch[i];
      const data = taskQueryResults[i]?.data as Task[] | undefined;
      if (data) {
        map.set(pid, data.filter(t => t.itemType === "workstream"));
      }
    }
    return map;
  }, [projectIdsToFetch, taskQueryResults]);

  const getProjectName = useCallback((pid: string) => {
    return projects.find(p => p.id === pid)?.title || "Unknown Project";
  }, [projects]);

  const getTaskName = useCallback((pid: string, tid: string) => {
    const tasks = allTasksByProject.get(pid);
    return tasks?.find(t => t.id === tid)?.title || "Unknown Workstream";
  }, [allTasksByProject]);

  const createMutation = useMutation({
    mutationFn: async (data: { timelineId: string; taskId: string; hours: number; dayDate: string }) => {
      const res = await apiRequest("POST", "/api/timesheets", {
        timelineId: data.timelineId,
        teamMemberId: selectedTeamMemberId,
        taskId: data.taskId,
        weekEnding,
        dayDate: data.dayDate,
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
    (projectId: string, taskId: string, dayDate: string) => {
      const key = cellKey(projectId, taskId, dayDate);
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
        if (existing) deleteMutation.mutate(existing.id);
        return;
      }

      if (existing) {
        if (parseFloat(existing.hours) !== hours) {
          updateMutation.mutate({ entryId: existing.id, hours });
        }
      } else {
        createMutation.mutate({ timelineId: projectId, taskId, hours, dayDate });
      }
    },
    [editingCells, entryMap, createMutation, updateMutation, deleteMutation]
  );

  const getCellValue = (projectId: string, taskId: string, dayDate: string): string => {
    const key = cellKey(projectId, taskId, dayDate);
    if (key in editingCells) return editingCells[key];
    const entry = entryMap.get(key);
    if (entry) {
      const h = parseFloat(entry.hours);
      return h > 0 ? String(h) : "";
    }
    return "";
  };

  const getRowTotal = (projectId: string, taskId: string): number => {
    let total = 0;
    for (const day of weekDays) {
      const val = getCellValue(projectId, taskId, day.date);
      const h = parseFloat(val);
      if (!isNaN(h)) total += h;
    }
    const legacyEntry = legacyWeeklyEntries.get(rowKey(projectId, taskId));
    if (legacyEntry) {
      total += parseFloat(legacyEntry.hours) || 0;
    }
    return total;
  };

  const getDayTotal = (dayDate: string): number => {
    let total = 0;
    for (const row of existingRows) {
      const val = getCellValue(row.projectId, row.taskId, dayDate);
      const h = parseFloat(val);
      if (!isNaN(h)) total += h;
    }
    return total;
  };

  const grandTotal = useMemo(() => {
    let total = 0;
    for (const row of existingRows) {
      total += getRowTotal(row.projectId, row.taskId);
    }
    return total;
  }, [existingRows, weekDays, editingCells, entryMap]);

  const handleAddRow = () => {
    if (!newRowProjectId || !newRowTaskId) {
      toast({ title: "Select both a project and workstream", variant: "destructive" });
      return;
    }
    const rk = rowKey(newRowProjectId, newRowTaskId);
    if (existingRows.some(r => r.key === rk)) {
      toast({ title: "This project + workstream combination already exists", variant: "destructive" });
      return;
    }
    setPendingRows(prev => [...prev, { projectId: newRowProjectId, taskId: newRowTaskId, key: rk }]);
    setNewRowProjectId("");
    setNewRowTaskId("");
    setAddingRow(false);
  };

  const handleDeleteRow = (projectId: string, taskId: string) => {
    const rk = rowKey(projectId, taskId);
    setPendingRows(prev => prev.filter(r => r.key !== rk));
    const toDelete = entriesRaw.filter(e => e.timelineId === projectId && e.taskId === taskId);
    toDelete.forEach(e => deleteMutation.mutate(e.id));
  };

  const availableNewWorkstreams = useMemo(() => {
    if (!newRowProjectId) return [];
    return allTasksByProject.get(newRowProjectId) || [];
  }, [newRowProjectId, allTasksByProject]);

  const isLoading = tmLoading || projectsLoading;

  return (
    <>
      <Helmet>
        <title>Timesheets</title>
      </Helmet>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Timesheets</h1>
          <p className="text-sm text-muted-foreground mt-1" data-testid="text-page-description">
            Track daily effort hours by project and workstream
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-64">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Team Member</label>
            <Select value={selectedTeamMemberId} onValueChange={(v) => { setSelectedTeamMemberId(v); setEditingCells({}); setPendingRows([]); }} data-testid="select-team-member">
              <SelectTrigger data-testid="select-team-member-trigger">
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {allTeamMembers.map((tm) => (
                  <SelectItem key={tm.id} value={tm.id} data-testid={`select-tm-${tm.id}`}>
                    {tm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">&nbsp;</label>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => { setWeekEnding((w) => shiftWeek(w, -1)); setEditingCells({}); setPendingRows([]); }}
                data-testid="button-prev-week"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="text-sm font-medium min-w-[200px] text-center" data-testid="text-week-ending">
                Week ending: {formatDisplayDate(weekEnding)}
              </div>
              <Button
                size="icon"
                variant="outline"
                onClick={() => { setWeekEnding((w) => shiftWeek(w, 1)); setEditingCells({}); setPendingRows([]); }}
                data-testid="button-next-week"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {!selectedTeamMemberId && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground" data-testid="text-no-member">
              Select a team member to view and edit their timesheet
            </CardContent>
          </Card>
        )}

        {selectedTeamMemberId && entriesLoading && (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {selectedTeamMemberId && !entriesLoading && (
          <>
            <div className="flex items-center gap-4 flex-wrap">
              <Card className="flex-1 min-w-[140px]">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours This Week</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-hours">{grandTotal.toFixed(1)}</div>
                </CardContent>
              </Card>
              <Card className="flex-1 min-w-[140px]">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Entries</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-entry-count">{existingRows.length}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-timesheet">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium sticky left-0 bg-card z-10 min-w-[140px]">Project</th>
                        <th className="text-left p-3 font-medium min-w-[140px]">Workstream</th>
                        {weekDays.map((day) => (
                          <th key={day.date} className="text-center p-2 font-medium min-w-[72px]">
                            <div className="text-[10px] text-muted-foreground">{day.dayName}</div>
                            <div className="text-xs">{day.label}</div>
                          </th>
                        ))}
                        <th className="text-right p-3 font-medium min-w-[70px]">Total</th>
                        <th className="p-3 w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {existingRows.length === 0 && !addingRow && (
                        <tr>
                          <td colSpan={11} className="p-8 text-center text-muted-foreground" data-testid="text-no-entries">
                            No time entries for this week. Click "Add Row" below to start logging hours.
                          </td>
                        </tr>
                      )}
                      {existingRows.map((row) => {
                        const rt = getRowTotal(row.projectId, row.taskId);
                        return (
                          <tr key={row.key} className="border-b last:border-b-0" data-testid={`row-entry-${row.key}`}>
                            <td className="p-2 sticky left-0 bg-card z-10">
                              <div className="text-xs font-medium truncate max-w-[130px]" title={getProjectName(row.projectId)} data-testid={`text-project-${row.key}`}>
                                {getProjectName(row.projectId)}
                              </div>
                            </td>
                            <td className="p-2">
                              <div className="text-xs truncate max-w-[130px]" title={getTaskName(row.projectId, row.taskId)} data-testid={`text-workstream-${row.key}`}>
                                {getTaskName(row.projectId, row.taskId)}
                              </div>
                            </td>
                            {weekDays.map((day) => {
                              const ck = cellKey(row.projectId, row.taskId, day.date);
                              const val = getCellValue(row.projectId, row.taskId, day.date);
                              return (
                                <td key={day.date} className="p-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    className="w-full text-center text-sm h-8"
                                    value={val}
                                    onChange={(e) => setEditingCells((prev) => ({ ...prev, [ck]: e.target.value }))}
                                    onBlur={() => handleCellBlur(row.projectId, row.taskId, day.date)}
                                    onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                    placeholder="0"
                                    data-testid={`input-hours-${row.key}-${day.date}`}
                                  />
                                </td>
                              );
                            })}
                            <td className="p-2 text-right font-medium" data-testid={`text-row-total-${row.key}`}>
                              {rt > 0 ? rt.toFixed(1) : "-"}
                            </td>
                            <td className="p-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteRow(row.projectId, row.taskId)}
                                data-testid={`button-delete-row-${row.key}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2">
                        <td className="p-2 font-medium sticky left-0 bg-card z-10" colSpan={2}>Day Totals</td>
                        {weekDays.map((day) => {
                          const dt = getDayTotal(day.date);
                          return (
                            <td key={day.date} className="p-2 text-center font-medium text-xs" data-testid={`text-day-total-${day.date}`}>
                              {dt > 0 ? dt.toFixed(1) : "-"}
                            </td>
                          );
                        })}
                        <td className="p-2 text-right font-bold" data-testid="text-grand-total">
                          {grandTotal.toFixed(1)}
                        </td>
                        <td className="p-2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>

            {addingRow ? (
              <Card data-testid="card-add-row">
                <CardContent className="p-4">
                  <div className="flex items-end gap-3 flex-wrap">
                    <div className="flex-1 min-w-[180px]">
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Project</label>
                      <Select value={newRowProjectId} onValueChange={(v) => { setNewRowProjectId(v); setNewRowTaskId(""); }}>
                        <SelectTrigger data-testid="select-new-row-project">
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 min-w-[180px]">
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Workstream</label>
                      <Select value={newRowTaskId} onValueChange={setNewRowTaskId} disabled={!newRowProjectId}>
                        <SelectTrigger data-testid="select-new-row-workstream">
                          <SelectValue placeholder={newRowProjectId ? "Select workstream" : "Select project first"} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableNewWorkstreams.map((ws) => (
                            <SelectItem key={ws.id} value={ws.id}>{ws.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={handleAddRow} disabled={!newRowProjectId || !newRowTaskId} data-testid="button-confirm-add-row">
                      Add
                    </Button>
                    <Button variant="outline" onClick={() => { setAddingRow(false); setNewRowProjectId(""); setNewRowTaskId(""); }} data-testid="button-cancel-add-row">
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Button variant="outline" className="gap-2" onClick={() => setAddingRow(true)} data-testid="button-add-row">
                <Plus className="w-4 h-4" />
                Add Row
              </Button>
            )}
          </>
        )}
      </div>
    </>
  );
}
