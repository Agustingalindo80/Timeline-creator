import type { Milestone, Task } from "@shared/schema";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

interface TimelineViewProps {
  milestones: Milestone[];
  tasks: Task[];
  timelineColor: string;
  showTasks?: boolean;
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

function parseDateToNum(dateStr: string): number {
  const s = dateStr.trim().toLowerCase();
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) return parseInt(yearOnly[1]) * 100;

  for (const [name, idx] of Object.entries(MONTHS)) {
    if (s.includes(name)) {
      const yearMatch = s.match(/(\d{4})/);
      const year = yearMatch ? parseInt(yearMatch[1]) : 2000;
      const dayMatch = s.match(/(\d{1,2})/);
      const day = dayMatch && parseInt(dayMatch[1]) <= 31 ? parseInt(dayMatch[1]) : 1;
      return year * 100 + idx + day / 100;
    }
  }
  return 999999;
}

type TimelineItem =
  | { type: "milestone"; data: Milestone; dateNum: number }
  | { type: "task"; data: Task; dateNum: number };

function buildItems(milestones: Milestone[], tasks: Task[]): TimelineItem[] {
  const mItems: TimelineItem[] = milestones.map((m) => ({
    type: "milestone" as const,
    data: m,
    dateNum: parseDateToNum(m.date),
  }));
  const tItems: TimelineItem[] = tasks.map((t) => ({
    type: "task" as const,
    data: t,
    dateNum: parseDateToNum(t.startDate),
  }));
  return [...mItems, ...tItems].sort((a, b) => a.dateNum - b.dateNum);
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

  const items = buildItems(sorted, sortedTasks);

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
                  <div className="relative flex items-center justify-center shrink-0 w-4">
                    <div
                      className="w-3.5 h-3.5 rounded-full ring-4 ring-background z-10"
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
                <div className="flex items-center mb-10 relative z-10">
                  <div className={cn("flex-1", isLeft ? "text-right pr-4" : "text-left pl-4 order-3")}>
                    <div
                      className={cn(
                        "inline-block rounded-md p-3 max-w-md transition-all",
                        isLeft ? "mr-0 ml-auto" : "ml-0 mr-auto"
                      )}
                      style={{
                        backgroundColor: `${barColor}15`,
                        border: `1.5px solid ${barColor}40`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="rounded-sm px-2 py-0.5 flex items-center gap-1.5"
                          style={{ backgroundColor: barColor }}
                        >
                          <span className="text-[10px] font-bold text-white uppercase tracking-wide">Task</span>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          {task.startDate} <ArrowRight className="w-3 h-3 inline" /> {task.endDate}
                        </span>
                      </div>
                      <h3 className="font-semibold text-sm">{task.title}</h3>
                      {task.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className={cn("relative flex items-center justify-center shrink-0 w-4", isLeft ? "" : "order-2")}>
                    <div
                      className="w-4 h-4 rounded-sm ring-4 ring-background z-10 flex items-center justify-center"
                      style={{ backgroundColor: barColor }}
                    >
                      <div className="w-1.5 h-0.5 bg-white rounded-full" />
                    </div>
                  </div>
                  <div className={cn("flex-1", isLeft ? "order-3" : "")} />
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

  const items = buildItems(sorted, sortedTasks);

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
                      className="w-3.5 h-3.5 rounded-full ring-4 ring-background z-10 shrink-0"
                      style={{ backgroundColor: dotColor }}
                    />
                    <div className="h-16" />
                  </>
                ) : (
                  <>
                    <div className="h-16" />
                    <div
                      className="w-3.5 h-3.5 rounded-full ring-4 ring-background z-10 shrink-0"
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
                style={{ minWidth: "220px" }}
                data-testid={`task-h-${task.id}`}
              >
                {isAbove ? (
                  <>
                    <div className="mb-3 text-center max-w-[220px]">
                      <h3 className="font-semibold text-xs mb-0.5">{task.title}</h3>
                      {task.description && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {task.description}
                        </p>
                      )}
                    </div>
                    <div
                      className="rounded-md px-3 py-1 flex items-center gap-1.5 ring-2 ring-background z-10 shrink-0"
                      style={{ backgroundColor: barColor }}
                    >
                      <span className="text-[10px] font-semibold text-white whitespace-nowrap">
                        {task.startDate}
                      </span>
                      <ArrowRight className="w-3 h-3 text-white/70" />
                      <span className="text-[10px] font-semibold text-white whitespace-nowrap">
                        {task.endDate}
                      </span>
                    </div>
                    <div className="h-14" />
                  </>
                ) : (
                  <>
                    <div className="h-14" />
                    <div
                      className="rounded-md px-3 py-1 flex items-center gap-1.5 ring-2 ring-background z-10 shrink-0"
                      style={{ backgroundColor: barColor }}
                    >
                      <span className="text-[10px] font-semibold text-white whitespace-nowrap">
                        {task.startDate}
                      </span>
                      <ArrowRight className="w-3 h-3 text-white/70" />
                      <span className="text-[10px] font-semibold text-white whitespace-nowrap">
                        {task.endDate}
                      </span>
                    </div>
                    <div className="mt-3 text-center max-w-[220px]">
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
