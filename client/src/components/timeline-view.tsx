import type { Milestone, Task } from "@shared/schema";
import { cn } from "@/lib/utils";
import { Clock } from "lucide-react";

interface TimelineViewProps {
  milestones: Milestone[];
  tasks: Task[];
  timelineColor: string;
  showTasks?: boolean;
}

export function TimelineView({ milestones, tasks, timelineColor, showTasks = true }: TimelineViewProps) {
  const sorted = [...milestones].sort((a, b) => a.sortOrder - b.sortOrder);
  const sortedTasks = showTasks ? [...tasks].sort((a, b) => a.sortOrder - b.sortOrder) : [];

  if (sorted.length === 0 && sortedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <div className="w-3 h-3 rounded-full bg-muted-foreground/40" />
        </div>
        <p className="text-sm text-muted-foreground">No milestones or tasks to display</p>
      </div>
    );
  }

  type TimelineItem =
    | { type: "milestone"; data: Milestone; sortKey: number }
    | { type: "task"; data: Task; sortKey: number };

  const items: TimelineItem[] = [
    ...sorted.map((m, i) => ({ type: "milestone" as const, data: m, sortKey: i })),
    ...sortedTasks.map((t, i) => ({ type: "task" as const, data: t, sortKey: sorted.length + i })),
  ];
  items.sort((a, b) => a.sortKey - b.sortKey);

  return (
    <div className="relative py-8">
      <div className="relative">
        {items.map((item, index) => {
          const isLeft = index % 2 === 0;

          if (item.type === "milestone") {
            const milestone = item.data;
            const dotColor = milestone.color || timelineColor;
            return (
              <div key={`m-${milestone.id}`} className="relative" data-testid={`milestone-${milestone.id}`}>
                {index < items.length - 1 && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 top-6 w-0.5 z-0"
                    style={{
                      backgroundColor: `${timelineColor}20`,
                      height: "calc(100% + 1rem)",
                    }}
                  />
                )}
                <div
                  className={cn(
                    "flex items-start gap-6 mb-10 relative z-10",
                    isLeft ? "flex-row" : "flex-row-reverse"
                  )}
                >
                  <div className={cn("flex-1", isLeft ? "text-right" : "text-left")}>
                    <div
                      className={cn(
                        "inline-block rounded-md border border-border bg-card p-4 max-w-sm transition-all",
                        isLeft ? "mr-0 ml-auto" : "ml-0 mr-auto"
                      )}
                    >
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {milestone.date}
                      </p>
                      <h3 className="font-semibold text-sm mb-1">{milestone.title}</h3>
                      {milestone.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {milestone.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="relative flex items-center justify-center shrink-0 w-3">
                    <div
                      className="w-3 h-3 rounded-full ring-4 ring-background z-10"
                      style={{ backgroundColor: dotColor }}
                    />
                  </div>
                  <div className="flex-1" />
                </div>
              </div>
            );
          } else {
            const task = item.data;
            const barColor = task.color || timelineColor;
            return (
              <div key={`t-${task.id}`} className="relative" data-testid={`task-${task.id}`}>
                {index < items.length - 1 && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 top-6 w-0.5 z-0"
                    style={{
                      backgroundColor: `${timelineColor}20`,
                      height: "calc(100% + 1rem)",
                    }}
                  />
                )}
                <div className="flex items-start gap-0 mb-10 relative z-10">
                  <div className={cn("flex-1", isLeft ? "text-right pr-3" : "text-left pl-3 order-3")}>
                    <div
                      className={cn(
                        "inline-block max-w-sm",
                        isLeft ? "mr-0 ml-auto" : "ml-0 mr-auto"
                      )}
                    >
                      <h3 className="font-semibold text-sm">{task.title}</h3>
                      {task.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className={cn("flex flex-col items-center shrink-0", isLeft ? "" : "order-2")}>
                    <div
                      className="rounded-md px-3 py-1.5 flex items-center gap-2 ring-2 ring-background z-10"
                      style={{ backgroundColor: barColor }}
                    >
                      <Clock className="w-3 h-3 text-white" />
                      <span className="text-[11px] font-semibold text-white whitespace-nowrap">
                        {task.startDate} — {task.endDate}
                      </span>
                    </div>
                  </div>
                  <div className={cn("flex-1", isLeft ? "order-3" : "pr-3")} />
                </div>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}

export function TimelineViewHorizontal({ milestones, tasks, timelineColor, showTasks = true }: TimelineViewProps) {
  const sorted = [...milestones].sort((a, b) => a.sortOrder - b.sortOrder);
  const sortedTasks = showTasks ? [...tasks].sort((a, b) => a.sortOrder - b.sortOrder) : [];

  if (sorted.length === 0 && sortedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <div className="w-3 h-3 rounded-full bg-muted-foreground/40" />
        </div>
        <p className="text-sm text-muted-foreground">No milestones or tasks to display</p>
      </div>
    );
  }

  type TimelineItem =
    | { type: "milestone"; data: Milestone; sortKey: number }
    | { type: "task"; data: Task; sortKey: number };

  const items: TimelineItem[] = [
    ...sorted.map((m, i) => ({ type: "milestone" as const, data: m, sortKey: i })),
    ...sortedTasks.map((t, i) => ({ type: "task" as const, data: t, sortKey: sorted.length + i })),
  ];
  items.sort((a, b) => a.sortKey - b.sortKey);

  return (
    <div className="relative overflow-x-auto py-12 px-4">
      <div className="relative flex items-center min-w-max">
        <div
          className="absolute top-1/2 left-4 right-4 h-0.5 -translate-y-1/2"
          style={{ backgroundColor: `${timelineColor}30` }}
        />

        {items.map((item, index) => {
          const isAbove = index % 2 === 0;

          if (item.type === "milestone") {
            const milestone = item.data;
            const dotColor = milestone.color || timelineColor;
            return (
              <div
                key={`m-${milestone.id}`}
                className="relative flex flex-col items-center px-6"
                style={{ minWidth: "180px" }}
                data-testid={`milestone-h-${milestone.id}`}
              >
                {isAbove ? (
                  <>
                    <div className="mb-4 text-center max-w-[180px]">
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">
                        {milestone.date}
                      </p>
                      <h3 className="font-semibold text-xs mb-0.5">{milestone.title}</h3>
                      {milestone.description && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {milestone.description}
                        </p>
                      )}
                    </div>
                    <div
                      className="w-3 h-3 rounded-full ring-4 ring-background z-10 shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                    <div className="h-16" />
                  </>
                ) : (
                  <>
                    <div className="h-16" />
                    <div
                      className="w-3 h-3 rounded-full ring-4 ring-background z-10 shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                    <div className="mt-4 text-center max-w-[180px]">
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">
                        {milestone.date}
                      </p>
                      <h3 className="font-semibold text-xs mb-0.5">{milestone.title}</h3>
                      {milestone.description && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {milestone.description}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          } else {
            const task = item.data;
            const barColor = task.color || timelineColor;
            return (
              <div
                key={`t-${task.id}`}
                className="relative flex flex-col items-center px-4"
                style={{ minWidth: "200px" }}
                data-testid={`task-h-${task.id}`}
              >
                {isAbove ? (
                  <>
                    <div className="mb-3 text-center max-w-[200px]">
                      <h3 className="font-semibold text-xs mb-0.5">{task.title}</h3>
                      {task.description && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {task.description}
                        </p>
                      )}
                    </div>
                    <div
                      className="rounded-md px-2.5 py-1 flex items-center gap-1.5 ring-2 ring-background z-10 shrink-0"
                      style={{ backgroundColor: barColor }}
                    >
                      <Clock className="w-2.5 h-2.5 text-white" />
                      <span className="text-[10px] font-semibold text-white whitespace-nowrap">
                        {task.startDate} — {task.endDate}
                      </span>
                    </div>
                    <div className="h-14" />
                  </>
                ) : (
                  <>
                    <div className="h-14" />
                    <div
                      className="rounded-md px-2.5 py-1 flex items-center gap-1.5 ring-2 ring-background z-10 shrink-0"
                      style={{ backgroundColor: barColor }}
                    >
                      <Clock className="w-2.5 h-2.5 text-white" />
                      <span className="text-[10px] font-semibold text-white whitespace-nowrap">
                        {task.startDate} — {task.endDate}
                      </span>
                    </div>
                    <div className="mt-3 text-center max-w-[200px]">
                      <h3 className="font-semibold text-xs mb-0.5">{task.title}</h3>
                      {task.description && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}
