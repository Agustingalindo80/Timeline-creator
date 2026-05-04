import { Card, CardContent } from "@/components/ui/card";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TimelineWithMilestones, FieldOption } from "@shared/schema";

interface ProjectKPIProps {
  timeline: TimelineWithMilestones;
  taskHealthOptions: FieldOption[];
  id: string;
  uniqueTeamMemberCount: number;
}

const healthColor = (val: string | null | undefined) => {
  if (val === "red") return "bg-red-500";
  if (val === "amber") return "bg-amber-500";
  return "bg-green-500";
};

const healthPulse = (val: string | null | undefined) => {
  if (val === "red" || val === "amber") return "animate-pulse";
  return "";
};

export function ProjectKPI({ timeline, taskHealthOptions, id, uniqueTeamMemberCount }: ProjectKPIProps) {
  const budget = parseFloat(timeline.approvedBudget ?? "0") || 0;
  const cost = parseFloat(timeline.totalRunningCost ?? "0") || 0;
  const gm = budget > 0 ? ((budget - cost) / budget) * 100 : null;

  return (
    <>
      {(budget > 0 || cost > 0) && (
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

      <div className="flex items-center gap-6 flex-wrap">
        {([
          { key: "healthOverall" as const, label: "Overall" },
          { key: "scopeHealth" as const, label: "Scope" },
          { key: "budgetHealth" as const, label: "Budget" },
          { key: "teamHealth" as const, label: "Team" },
        ]).map(({ key, label }) => {
          const val = timeline[key] || "green";
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
    </>
  );
}
