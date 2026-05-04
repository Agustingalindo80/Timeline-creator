import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Task, TimesheetEntry, TeamMember } from "@shared/schema";

export function ProjectTimesheetsTab({ timelineId, tasks }: { timelineId: string; tasks: Task[] }) {
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
