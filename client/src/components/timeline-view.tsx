import type { Milestone, Task } from "@shared/schema";
import { cn } from "@/lib/utils";

interface TimelineViewProps {
  milestones: Milestone[];
  tasks: Task[];
  timelineColor: string;
  showTasks?: boolean;
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2,
  apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6,
  aug: 7, august: 7, sep: 8, september: 8, oct: 9, october: 9,
  nov: 10, november: 10, dec: 11, december: 11,
};

function parseDateToNum(dateStr: string): number {
  const s = dateStr.trim().toLowerCase();
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) return parseInt(yearOnly[1]) * 12;

  for (const [name, idx] of Object.entries(MONTHS)) {
    if (s.includes(name)) {
      const yearMatch = s.match(/(\d{4})/);
      const year = yearMatch ? parseInt(yearMatch[1]) : 2000;
      return year * 12 + idx;
    }
  }
  return 999999;
}

function shortLabel(dateStr: string): string {
  const s = dateStr.trim();
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) return s;
  for (const [name] of Object.entries(MONTHS)) {
    if (s.toLowerCase().includes(name)) {
      const monthAbbr = name.charAt(0).toUpperCase() + name.slice(1, 3);
      const yearMatch = s.match(/(\d{4})/);
      return yearMatch ? `${monthAbbr} ${yearMatch[1].slice(2)}` : monthAbbr;
    }
  }
  return s.length > 10 ? s.slice(0, 10) : s;
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

  return (
    <div className="relative py-8">
      <div className="relative">
        {sorted.map((milestone, index) => {
          const isLeft = index % 2 === 0;
          const dotColor = milestone.color || timelineColor;
          return (
            <div key={`m-${milestone.id}`} className="relative" data-testid={`milestone-${milestone.id}`}>
              {index < sorted.length - 1 && (
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
        })}
      </div>

      {sortedTasks.length > 0 && (
        <TaskBarsSection
          milestones={sorted}
          tasks={sortedTasks}
          timelineColor={timelineColor}
        />
      )}
    </div>
  );
}

function TaskBarsSection({
  milestones,
  tasks,
  timelineColor,
}: {
  milestones: Milestone[];
  tasks: Task[];
  timelineColor: string;
}) {
  const allDateNums: number[] = [];
  milestones.forEach((m) => allDateNums.push(parseDateToNum(m.date)));
  tasks.forEach((t) => {
    allDateNums.push(parseDateToNum(t.startDate));
    allDateNums.push(parseDateToNum(t.endDate));
  });
  const minDate = Math.min(...allDateNums);
  const maxDate = Math.max(...allDateNums);
  const range = maxDate - minDate || 1;

  function pct(dateStr: string): number {
    const num = parseDateToNum(dateStr);
    return ((num - minDate) / range) * 100;
  }

  return (
    <div className="mt-6 border-t border-border pt-6" data-testid="task-bars-section">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4 px-1">
        Tasks
      </p>

      <div className="relative mb-4">
        <div className="relative h-10 mx-2">
          <div
            className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2"
            style={{ backgroundColor: `${timelineColor}25` }}
          />
          {milestones.map((m) => {
            const left = pct(m.date);
            const dotColor = m.color || timelineColor;
            return (
              <div
                key={`dot-${m.id}`}
                className="absolute -translate-x-1/2 top-1/2 -translate-y-1/2 flex flex-col items-center"
                style={{ left: `${left}%` }}
                data-testid={`task-section-dot-${m.id}`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full ring-2 ring-background z-10"
                  style={{ backgroundColor: dotColor }}
                />
              </div>
            );
          })}
        </div>
        <div className="relative h-4 mx-2 mb-1">
          {milestones.map((m) => {
            const left = pct(m.date);
            return (
              <span
                key={`lbl-${m.id}`}
                className="absolute -translate-x-1/2 text-[9px] text-muted-foreground whitespace-nowrap"
                style={{ left: `${left}%` }}
              >
                {shortLabel(m.date)}
              </span>
            );
          })}
        </div>
      </div>

      <div className="space-y-2.5 mx-2">
        {tasks.map((task) => {
          const barColor = task.color || timelineColor;
          const startPct = pct(task.startDate);
          const endPct = pct(task.endDate);
          const barWidth = Math.max(endPct - startPct, 2);

          return (
            <div key={`bar-${task.id}`} className="relative" data-testid={`task-bar-${task.id}`}>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs font-semibold truncate max-w-[200px]">{task.title}</span>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {task.startDate} — {task.endDate}
                </span>
              </div>
              <div className="relative h-7 rounded-md bg-muted/40">
                {milestones.map((m) => {
                  const mPct = pct(m.date);
                  if (mPct >= startPct && mPct <= startPct + barWidth) {
                    return (
                      <div
                        key={`guide-${m.id}`}
                        className="absolute top-0 bottom-0 w-px z-10"
                        style={{
                          left: `${mPct}%`,
                          backgroundColor: `${m.color || timelineColor}50`,
                        }}
                      />
                    );
                  }
                  return null;
                })}
                <div
                  className="absolute top-0 bottom-0 rounded-md flex items-center px-2.5 overflow-hidden"
                  style={{
                    left: `${startPct}%`,
                    width: `${barWidth}%`,
                    backgroundColor: `${barColor}20`,
                    border: `1.5px solid ${barColor}60`,
                  }}
                >
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
                    style={{ backgroundColor: barColor }}
                  />
                  {task.description && (
                    <span className="text-[10px] text-muted-foreground truncate pl-2">
                      {task.description}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
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

  const allDateNums: number[] = [];
  sorted.forEach((m) => allDateNums.push(parseDateToNum(m.date)));
  sortedTasks.forEach((t) => {
    allDateNums.push(parseDateToNum(t.startDate));
    allDateNums.push(parseDateToNum(t.endDate));
  });
  const minDate = Math.min(...allDateNums);
  const maxDate = Math.max(...allDateNums);
  const range = maxDate - minDate || 1;

  function pct(dateStr: string): number {
    const num = parseDateToNum(dateStr);
    return ((num - minDate) / range) * 100;
  }

  const PAD = 4;

  return (
    <div className="relative overflow-x-auto py-8 px-4">
      <div className="min-w-[600px]">
        <div className="relative mx-8">
          <div className="relative" style={{ minHeight: "120px" }}>
            {sorted.map((milestone, index) => {
              const left = pct(milestone.date);
              const isAbove = index % 2 === 0;
              const dotColor = milestone.color || timelineColor;
              return (
                <div
                  key={`m-${milestone.id}`}
                  className="absolute -translate-x-1/2 flex flex-col items-center"
                  style={{ left: `${left}%`, top: 0, bottom: 0 }}
                  data-testid={`milestone-h-${milestone.id}`}
                >
                  {isAbove ? (
                    <div className="flex flex-col items-center h-full justify-center">
                      <div className="text-center max-w-[140px] mb-2">
                        <p className="text-[10px] font-medium text-muted-foreground">
                          {milestone.date}
                        </p>
                        <h3 className="font-semibold text-xs">{milestone.title}</h3>
                      </div>
                      <div
                        className="w-3 h-3 rounded-full ring-4 ring-background z-10 shrink-0"
                        style={{ backgroundColor: dotColor }}
                      />
                      <div className="flex-1" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center h-full justify-center">
                      <div className="flex-1" />
                      <div
                        className="w-3 h-3 rounded-full ring-4 ring-background z-10 shrink-0"
                        style={{ backgroundColor: dotColor }}
                      />
                      <div className="text-center max-w-[140px] mt-2">
                        <p className="text-[10px] font-medium text-muted-foreground">
                          {milestone.date}
                        </p>
                        <h3 className="font-semibold text-xs">{milestone.title}</h3>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div
              className="absolute left-0 right-0 h-0.5 top-1/2 -translate-y-1/2"
              style={{ backgroundColor: `${timelineColor}30` }}
            />
          </div>
        </div>

        {sortedTasks.length > 0 && (
          <div className="mt-6 border-t border-border pt-4 mx-8" data-testid="task-bars-section-h">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Tasks
            </p>
            <div className="space-y-2.5">
              {sortedTasks.map((task) => {
                const barColor = task.color || timelineColor;
                const startPct = pct(task.startDate);
                const endPct = pct(task.endDate);
                const barWidth = Math.max(endPct - startPct, 2);

                return (
                  <div key={`bar-${task.id}`} data-testid={`task-bar-h-${task.id}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold truncate max-w-[200px]">{task.title}</span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {task.startDate} — {task.endDate}
                      </span>
                    </div>
                    <div className="relative h-6 rounded-md bg-muted/40">
                      {sorted.map((m) => {
                        const mPct = pct(m.date);
                        return (
                          <div
                            key={`guide-h-${m.id}`}
                            className="absolute top-0 bottom-0 w-px z-10"
                            style={{
                              left: `${mPct}%`,
                              backgroundColor: `${m.color || timelineColor}30`,
                            }}
                          />
                        );
                      })}
                      <div
                        className="absolute top-0 bottom-0 rounded-md flex items-center px-2 overflow-hidden"
                        style={{
                          left: `${startPct}%`,
                          width: `${barWidth}%`,
                          backgroundColor: `${barColor}20`,
                          border: `1.5px solid ${barColor}60`,
                        }}
                      >
                        <div
                          className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
                          style={{ backgroundColor: barColor }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
