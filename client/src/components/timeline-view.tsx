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

  const shouldClampDescriptions = sorted.length >= 4;

  return (
    <div className="relative py-8">
      <div className="relative">
        {sorted.map((milestone, index) => {
          const isLeft = index % 2 === 0;
          const dotColor = milestone.color || timelineColor;
          const hasActual = !!milestone.actualDate;
          const clampDesc = shouldClampDescriptions;
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
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Planned: {milestone.date}
                      </p>
                      {hasActual && (
                        <p className="text-xs font-medium" style={{ color: dotColor }}>
                          Actual: {milestone.actualDate}
                        </p>
                      )}
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{milestone.title}</h3>
                    {milestone.description && (
                      <p
                        className={cn(
                          "text-xs text-muted-foreground leading-relaxed",
                          clampDesc && "line-clamp-2"
                        )}
                      >
                        {milestone.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="relative flex items-center justify-center shrink-0 w-4">
                  {hasActual ? (
                    <>
                      <div
                        className="w-3.5 h-3.5 rounded-full ring-4 ring-background z-10 border-2"
                        style={{ borderColor: dotColor, backgroundColor: "transparent" }}
                        title={`Planned: ${milestone.date}`}
                      />
                      <div
                        className="absolute w-2.5 h-2.5 rounded-full z-20"
                        style={{ backgroundColor: dotColor }}
                        title={`Actual: ${milestone.actualDate}`}
                      />
                    </>
                  ) : (
                    <div
                      className="w-3.5 h-3.5 rounded-full ring-4 ring-background z-10"
                      style={{ backgroundColor: dotColor }}
                    />
                  )}
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
  milestones.forEach((m) => {
    allDateNums.push(parseDateToNum(m.date));
    if (m.actualDate) allDateNums.push(parseDateToNum(m.actualDate));
  });
  tasks.forEach((t) => {
    allDateNums.push(parseDateToNum(t.startDate));
    allDateNums.push(parseDateToNum(t.endDate));
    if (t.actualStartDate) allDateNums.push(parseDateToNum(t.actualStartDate));
    if (t.actualEndDate) allDateNums.push(parseDateToNum(t.actualEndDate));
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

      <div className="space-y-1 mx-2">
        {(() => {
          const phases = tasks.filter((t) => t.itemType === "phase").sort((a, b) => a.sortOrder - b.sortOrder);
          const childWorkstreams = tasks.filter((t) => t.itemType === "workstream" && t.parentTaskId);
          const orphanWorkstreams = tasks.filter((t) => t.itemType === "workstream" && !t.parentTaskId).sort((a, b) => a.sortOrder - b.sortOrder);
          const orderedTasks: { task: Task; isChild: boolean }[] = [];
          phases.forEach((phase) => {
            orderedTasks.push({ task: phase, isChild: false });
            childWorkstreams
              .filter((ws) => ws.parentTaskId === phase.id)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .forEach((ws) => orderedTasks.push({ task: ws, isChild: true }));
          });
          orphanWorkstreams.forEach((ws) => orderedTasks.push({ task: ws, isChild: false }));

          return orderedTasks.map(({ task, isChild }) => {
            const barColor = task.color || timelineColor;
            const startPct = pct(task.startDate);
            const endPct = pct(task.endDate);
            const barWidth = Math.max(endPct - startPct, 2);
            const isPhase = task.itemType === "phase";

            const hasActual = !!(task.actualStartDate && task.actualEndDate);
            const actualStartPct = task.actualStartDate ? pct(task.actualStartDate) : 0;
            const actualEndPct = task.actualEndDate ? pct(task.actualEndDate) : 0;
            const actualBarWidth = hasActual ? Math.max(actualEndPct - actualStartPct, 2) : 0;

            return (
              <div
                key={`bar-${task.id}`}
                className={cn("relative", isChild && "ml-6")}
                data-testid={`task-bar-${task.id}`}
              >
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  {isChild && <span className="text-[10px] text-muted-foreground">↳</span>}
                  <span className={cn("text-xs truncate max-w-[200px]", isPhase ? "font-bold uppercase tracking-wide" : "font-semibold")}>{task.title}</span>
                  {isPhase && <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">Phase</span>}
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    Planned: {task.startDate} — {task.endDate}
                  </span>
                  {hasActual && (
                    <span className="text-[10px] whitespace-nowrap" style={{ color: barColor }}>
                      Actual: {task.actualStartDate} — {task.actualEndDate}
                    </span>
                  )}
                </div>
                <div className={cn("relative rounded-md bg-muted/40", isPhase ? "h-5" : "h-7")}>
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
                    className={cn("absolute top-0 bottom-0 rounded-md flex items-center overflow-hidden", isPhase ? "px-2" : "px-2.5")}
                    style={{
                      left: `${startPct}%`,
                      width: `${barWidth}%`,
                      backgroundColor: isPhase ? `${barColor}18` : `${barColor}10`,
                      border: isPhase ? `2px solid ${barColor}50` : `1.5px dashed ${barColor}40`,
                    }}
                    data-testid={`task-planned-bar-${task.id}`}
                  >
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
                      style={{ backgroundColor: isPhase ? barColor : `${barColor}60` }}
                    />
                    {!hasActual && (
                      <>
                        <div
                          className="absolute left-0 top-0 bottom-0 rounded-l-md transition-all"
                          style={{
                            backgroundColor: `${barColor}40`,
                            width: `${task.percentComplete}%`,
                          }}
                          data-testid={`task-fill-${task.id}`}
                        />
                        <span className="text-[10px] text-muted-foreground truncate pl-2 relative z-10">
                          {task.percentComplete > 0 ? `${task.percentComplete}%` : ""}
                          {task.percentComplete > 0 && task.description ? " \u00B7 " : ""}
                          {!isPhase && (task.description || "")}
                        </span>
                      </>
                    )}
                  </div>
                  {hasActual && (
                    <div
                      className={cn("absolute top-0 bottom-0 rounded-md flex items-center overflow-hidden", isPhase ? "px-2" : "px-2.5")}
                      style={{
                        left: `${actualStartPct}%`,
                        width: `${actualBarWidth}%`,
                        backgroundColor: `${barColor}25`,
                        border: `1.5px solid ${barColor}70`,
                      }}
                      data-testid={`task-actual-bar-${task.id}`}
                    >
                      <div
                        className="absolute left-0 top-0 bottom-0 rounded-l-md transition-all"
                        style={{
                          backgroundColor: `${barColor}40`,
                          width: `${task.percentComplete}%`,
                        }}
                        data-testid={`task-fill-${task.id}`}
                      />
                      <div
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
                        style={{ backgroundColor: barColor }}
                      />
                      <span className="text-[10px] text-muted-foreground truncate pl-2 relative z-10">
                        {task.percentComplete > 0 ? `${task.percentComplete}%` : ""}
                        {task.percentComplete > 0 && task.description ? " \u00B7 " : ""}
                        {!isPhase && (task.description || "")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          });
        })()}
      </div>

      {tasks.some((t) => t.actualStartDate || t.actualEndDate) && (
        <div className="flex items-center gap-4 mt-4 px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-2 rounded-sm border border-dashed" style={{ borderColor: `${timelineColor}60`, backgroundColor: `${timelineColor}10` }} />
            <span className="text-[10px] text-muted-foreground">Planned</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-2 rounded-sm" style={{ border: `1.5px solid ${timelineColor}70`, backgroundColor: `${timelineColor}25` }} />
            <span className="text-[10px] text-muted-foreground">Actual</span>
          </div>
        </div>
      )}
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
  sorted.forEach((m) => {
    allDateNums.push(parseDateToNum(m.date));
    if (m.actualDate) allDateNums.push(parseDateToNum(m.actualDate));
  });
  sortedTasks.forEach((t) => {
    allDateNums.push(parseDateToNum(t.startDate));
    allDateNums.push(parseDateToNum(t.endDate));
    if (t.actualStartDate) allDateNums.push(parseDateToNum(t.actualStartDate));
    if (t.actualEndDate) allDateNums.push(parseDateToNum(t.actualEndDate));
  });
  const minDate = Math.min(...allDateNums);
  const maxDate = Math.max(...allDateNums);
  const range = maxDate - minDate || 1;

  function pct(dateStr: string): number {
    const num = parseDateToNum(dateStr);
    return ((num - minDate) / range) * 100;
  }

  return (
    <div className="relative overflow-x-auto py-8 px-4">
      <div className="min-w-[600px]">
        <div className="relative mx-8">
          <div className="relative" style={{ minHeight: "120px" }}>
            {sorted.map((milestone, index) => {
              const left = pct(milestone.date);
              const isAbove = index % 2 === 0;
              const dotColor = milestone.color || timelineColor;
              const hasActual = !!milestone.actualDate;
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
                        {hasActual && (
                          <p className="text-[10px] font-medium" style={{ color: dotColor }}>
                            Actual: {milestone.actualDate}
                          </p>
                        )}
                        <h3 className="font-semibold text-xs">{milestone.title}</h3>
                      </div>
                      {hasActual ? (
                        <div className="relative">
                          <div
                            className="w-3 h-3 rounded-full ring-4 ring-background z-10 border-2"
                            style={{ borderColor: dotColor, backgroundColor: "transparent" }}
                          />
                          <div
                            className="absolute inset-0 m-auto w-2 h-2 rounded-full z-20"
                            style={{ backgroundColor: dotColor }}
                          />
                        </div>
                      ) : (
                        <div
                          className="w-3 h-3 rounded-full ring-4 ring-background z-10 shrink-0"
                          style={{ backgroundColor: dotColor }}
                        />
                      )}
                      <div className="flex-1" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center h-full justify-center">
                      <div className="flex-1" />
                      {hasActual ? (
                        <div className="relative">
                          <div
                            className="w-3 h-3 rounded-full ring-4 ring-background z-10 border-2"
                            style={{ borderColor: dotColor, backgroundColor: "transparent" }}
                          />
                          <div
                            className="absolute inset-0 m-auto w-2 h-2 rounded-full z-20"
                            style={{ backgroundColor: dotColor }}
                          />
                        </div>
                      ) : (
                        <div
                          className="w-3 h-3 rounded-full ring-4 ring-background z-10 shrink-0"
                          style={{ backgroundColor: dotColor }}
                        />
                      )}
                      <div className="text-center max-w-[140px] mt-2">
                        <p className="text-[10px] font-medium text-muted-foreground">
                          {milestone.date}
                        </p>
                        {hasActual && (
                          <p className="text-[10px] font-medium" style={{ color: dotColor }}>
                            Actual: {milestone.actualDate}
                          </p>
                        )}
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
            <div className="space-y-1">
              {(() => {
                const phases = sortedTasks.filter((t) => t.itemType === "phase").sort((a, b) => a.sortOrder - b.sortOrder);
                const childWorkstreams = sortedTasks.filter((t) => t.itemType === "workstream" && t.parentTaskId);
                const orphanWorkstreams = sortedTasks.filter((t) => t.itemType === "workstream" && !t.parentTaskId).sort((a, b) => a.sortOrder - b.sortOrder);
                const orderedTasks: { task: Task; isChild: boolean }[] = [];
                phases.forEach((phase) => {
                  orderedTasks.push({ task: phase, isChild: false });
                  childWorkstreams
                    .filter((ws) => ws.parentTaskId === phase.id)
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .forEach((ws) => orderedTasks.push({ task: ws, isChild: true }));
                });
                orphanWorkstreams.forEach((ws) => orderedTasks.push({ task: ws, isChild: false }));

                return orderedTasks.map(({ task, isChild }) => {
                  const barColor = task.color || timelineColor;
                  const startPct = pct(task.startDate);
                  const endPct = pct(task.endDate);
                  const barWidth = Math.max(endPct - startPct, 2);
                  const isPhase = task.itemType === "phase";

                  const hasActual = !!(task.actualStartDate && task.actualEndDate);
                  const actualStartPct = task.actualStartDate ? pct(task.actualStartDate) : 0;
                  const actualEndPct = task.actualEndDate ? pct(task.actualEndDate) : 0;
                  const actualBarWidth = hasActual ? Math.max(actualEndPct - actualStartPct, 2) : 0;

                  return (
                    <div key={`bar-${task.id}`} className={cn(isChild ? "ml-6" : "")} data-testid={`task-bar-h-${task.id}`}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {isChild && <span className="text-[10px] text-muted-foreground">↳</span>}
                        <span className={cn("text-xs truncate max-w-[200px]", isPhase ? "font-bold uppercase tracking-wide" : "font-semibold")}>{task.title}</span>
                        {isPhase && <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">Phase</span>}
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          Planned: {task.startDate} — {task.endDate}
                        </span>
                        {hasActual && (
                          <span className="text-[10px] whitespace-nowrap" style={{ color: barColor }}>
                            Actual: {task.actualStartDate} — {task.actualEndDate}
                          </span>
                        )}
                      </div>
                      <div className={cn("relative rounded-md bg-muted/40", isPhase ? "h-4" : "h-6")}>
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
                            backgroundColor: isPhase ? `${barColor}18` : `${barColor}10`,
                            border: isPhase ? `2px solid ${barColor}50` : `1.5px dashed ${barColor}40`,
                          }}
                          data-testid={`task-planned-bar-h-${task.id}`}
                        >
                          <div
                            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
                            style={{ backgroundColor: isPhase ? barColor : `${barColor}60` }}
                          />
                          {!hasActual && (
                            <>
                              <div
                                className="absolute left-0 top-0 bottom-0 rounded-l-md transition-all"
                                style={{
                                  backgroundColor: `${barColor}40`,
                                  width: `${task.percentComplete}%`,
                                }}
                                data-testid={`task-fill-h-${task.id}`}
                              />
                              <span className="text-[10px] text-muted-foreground truncate pl-2 relative z-10">
                                {task.percentComplete > 0 ? `${task.percentComplete}%` : ""}
                              </span>
                            </>
                          )}
                        </div>
                        {hasActual && (
                          <div
                            className="absolute top-0 bottom-0 rounded-md flex items-center px-2 overflow-hidden"
                            style={{
                              left: `${actualStartPct}%`,
                              width: `${actualBarWidth}%`,
                              backgroundColor: `${barColor}25`,
                              border: `1.5px solid ${barColor}70`,
                            }}
                            data-testid={`task-actual-bar-h-${task.id}`}
                          >
                            <div
                              className="absolute left-0 top-0 bottom-0 rounded-l-md transition-all"
                              style={{
                                backgroundColor: `${barColor}40`,
                                width: `${task.percentComplete}%`,
                              }}
                              data-testid={`task-fill-h-${task.id}`}
                            />
                            <div
                              className="absolute left-0 top-0 bottom-0 w-1 rounded-l-md"
                              style={{ backgroundColor: barColor }}
                            />
                            <span className="text-[10px] text-muted-foreground truncate pl-2 relative z-10">
                              {task.percentComplete > 0 ? `${task.percentComplete}%` : ""}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {sortedTasks.some((t) => t.actualStartDate || t.actualEndDate) && (
              <div className="flex items-center gap-4 mt-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-2 rounded-sm border border-dashed" style={{ borderColor: `${timelineColor}60`, backgroundColor: `${timelineColor}10` }} />
                  <span className="text-[10px] text-muted-foreground">Planned</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-2 rounded-sm" style={{ border: `1.5px solid ${timelineColor}70`, backgroundColor: `${timelineColor}25` }} />
                  <span className="text-[10px] text-muted-foreground">Actual</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
