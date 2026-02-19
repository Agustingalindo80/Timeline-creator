import type { Milestone, Task } from "@shared/schema";
import { cn } from "@/lib/utils";

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
                <div
                  className={cn(
                    "flex items-start gap-6 mb-10 relative z-10",
                    isLeft ? "flex-row" : "flex-row-reverse"
                  )}
                >
                  <div className={cn("flex-1", isLeft ? "text-right" : "text-left")}>
                    <div
                      className={cn(
                        "inline-block rounded-md p-4 max-w-sm transition-all",
                        isLeft ? "mr-0 ml-auto" : "ml-0 mr-auto"
                      )}
                      style={{
                        backgroundColor: `${barColor}12`,
                        borderLeft: `3px solid ${barColor}`,
                      }}
                    >
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        {task.startDate} — {task.endDate}
                      </p>
                      <h3 className="font-semibold text-sm mb-1">{task.title}</h3>
                      {task.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="relative flex items-center justify-center shrink-0 w-5">
                    <div
                      className="w-5 h-2 rounded-sm ring-2 ring-background z-10"
                      style={{ backgroundColor: barColor }}
                    />
                  </div>
                  <div className="flex-1" />
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
                className="relative flex flex-col items-center px-6"
                style={{ minWidth: "200px" }}
                data-testid={`task-h-${task.id}`}
              >
                {isAbove ? (
                  <>
                    <div className="mb-4 text-center max-w-[200px]">
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">
                        {task.startDate} — {task.endDate}
                      </p>
                      <h3 className="font-semibold text-xs mb-0.5">{task.title}</h3>
                      {task.description && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {task.description}
                        </p>
                      )}
                    </div>
                    <div
                      className="h-2 rounded-sm ring-2 ring-background z-10 shrink-0"
                      style={{ backgroundColor: barColor, width: "40px" }}
                    />
                    <div className="h-16" />
                  </>
                ) : (
                  <>
                    <div className="h-16" />
                    <div
                      className="h-2 rounded-sm ring-2 ring-background z-10 shrink-0"
                      style={{ backgroundColor: barColor, width: "40px" }}
                    />
                    <div className="mt-4 text-center max-w-[200px]">
                      <p className="text-xs font-medium text-muted-foreground mb-0.5">
                        {task.startDate} — {task.endDate}
                      </p>
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
