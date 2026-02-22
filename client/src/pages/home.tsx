import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { Plus, FileSpreadsheet, Trash2, CheckCircle2, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { TimelineWithMilestones, Task, AppSettings } from "@shared/schema";
import { DEFAULT_TASK_HEALTH } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function dateToMonths(dateStr: string): number {
  const s = dateStr.trim().toLowerCase();
  const isoMatch = s.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (isoMatch) return parseInt(isoMatch[1]) * 12 + (parseInt(isoMatch[2]) - 1);
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) return parseInt(yearOnly[1]) * 12;
  for (const [name, idx] of Object.entries(MONTHS)) {
    if (s.includes(name)) {
      const yearMatch = s.match(/(\d{4})/);
      const year = yearMatch ? parseInt(yearMatch[1]) : 2000;
      return year * 12 + idx;
    }
  }
  return 0;
}

function getWeightedCompletion(tasks: Task[]): number | null {
  if (tasks.length === 0) return null;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const task of tasks) {
    const start = dateToMonths(task.startDate);
    const end = dateToMonths(task.endDate);
    const duration = Math.max(end - start, 1);
    totalWeight += duration;
    weightedSum += duration * (task.percentComplete ?? 0);
  }
  if (totalWeight === 0) return null;
  return Math.round(weightedSum / totalWeight);
}

const HEALTH_COLORS: Record<string, string> = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
};

function HealthDot({ value, label, options }: { value: string; label: string; options: { value: string; label: string }[] }) {
  const opt = options.find((o) => o.value === value);
  const displayLabel = opt?.label || value;
  const color = HEALTH_COLORS[value] || "#94a3b8";
  return (
    <div className="flex items-center gap-1.5" title={`${label}: ${displayLabel}`}>
      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export default function Home() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: timelines, isLoading } = useQuery<TimelineWithMilestones[]>({
    queryKey: ["/api/timelines"],
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const healthOptions = settings?.taskHealthOptions || DEFAULT_TASK_HEALTH;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/timelines/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
      toast({ title: "Project deleted" });
    },
  });

  return (
    <div className="p-6">
      <Helmet>
        <title>Projects | Project High Level Planning</title>
        <meta name="description" content="Manage your projects with milestones, tasks, and health tracking." />
      </Helmet>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold" data-testid="text-page-title">Projects</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate("/create?mode=upload")}
            data-testid="button-import-excel"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            Import Excel
          </Button>
          <Button onClick={() => navigate("/create")} data-testid="button-create-timeline">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4">
              <Skeleton className="h-5 w-1/3 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : !timelines || timelines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
            <FolderKanban className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No projects yet</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Create your first project by adding milestones manually or importing from an Excel spreadsheet.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate("/create?mode=upload")}
              data-testid="button-empty-import"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Import Excel
            </Button>
            <Button onClick={() => navigate("/create")} data-testid="button-empty-create">
              <Plus className="w-4 h-4 mr-2" />
              Create Manually
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {timelines.map((timeline) => {
            const pct = getWeightedCompletion(timeline.tasks);
            return (
              <div
                key={timeline.id}
                className="group relative border rounded-lg overflow-visible hover-elevate active-elevate-2 cursor-pointer"
                data-testid={`card-timeline-${timeline.id}`}
              >
                <Link href={`/timeline/${timeline.id}`} className="flex items-center gap-4 p-4">
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: timeline.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-sm truncate">{timeline.title}</h3>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-milestones-${timeline.id}`}>
                          {timeline.milestones.length} milestone{timeline.milestones.length !== 1 ? "s" : ""}
                        </Badge>
                        {timeline.tasks.length > 0 && (
                          <Badge variant="secondary" className="text-xs" data-testid={`badge-tasks-${timeline.id}`}>
                            {timeline.tasks.length} task{timeline.tasks.length !== 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                    </div>
                    {timeline.description && (
                      <p className="text-xs text-muted-foreground truncate">{timeline.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                      <HealthDot value={timeline.healthOverall} label="Overall" options={healthOptions} />
                      <HealthDot value={timeline.scopeHealth} label="Scope" options={healthOptions} />
                      <HealthDot value={timeline.budgetHealth} label="Budget" options={healthOptions} />
                      <HealthDot value={timeline.teamHealth} label="Team" options={healthOptions} />
                    </div>

                    {pct !== null && (
                      <div className="flex items-center gap-2 min-w-[80px]" data-testid={`completion-${timeline.id}`}>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                          <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-medium w-8 text-right">{pct}%</span>
                      </div>
                    )}
                  </div>
                </Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="absolute top-1/2 -translate-y-1/2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`button-delete-${timeline.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete project?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete "{timeline.title}" and all its milestones.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(timeline.id)}
                        data-testid="button-confirm-delete"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
