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
  const s = dateStr.trim();
  const low = s.toLowerCase();

  const iso = low.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return parseInt(iso[1]) * 12 + (parseInt(iso[2]) - 1) + parseInt(iso[3]) / 31;
  }

  const slashDate = low.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDate) {
    const mm = parseInt(slashDate[1]) - 1;
    const dd = parseInt(slashDate[2]);
    const yyyy = parseInt(slashDate[3]);
    return yyyy * 12 + mm + dd / 31;
  }

  const yearOnly = low.match(/^(\d{4})$/);
  if (yearOnly) return parseInt(yearOnly[1]) * 12;

  let month = -1;
  let monthName = "";
  for (const [name, idx] of Object.entries(MONTHS)) {
    if (low.includes(name) && name.length > monthName.length) {
      month = idx;
      monthName = name;
    }
  }

  if (month === -1) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return d.getFullYear() * 12 + d.getMonth() + d.getDate() / 31;
    }
    return 999999;
  }

  const yearMatch = low.match(/(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1]) : 2000;

  const stripped = low.replace(monthName, "").replace(/(\d{4})/, "").replace(/[,\/\-\.]/g, " ").trim();
  const dayMatch = stripped.match(/(\d{1,2})/);
  const day = dayMatch ? parseInt(dayMatch[1]) : 15;

  return year * 12 + month + (day / 31);
}

export function TimelineView({ milestones, tasks, timelineColor, showTasks = true }: TimelineViewProps) {
  const sorted = [...milestones].sort((a, b) => parseDateToNum(a.date) - parseDateToNum(b.date));
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
    return Math.max(0, Math.min(100, ((num - minDate) / range) * 100));
  }

  const PAD = 5;

  const milestonePositions = sorted.map((m) => ({
    milestone: m,
    left: PAD + pct(m.date) * (100 - 2 * PAD) / 100,
  }));

  const LABEL_MIN_GAP_PCT = 10;
  const rows: { milestone: Milestone; left: number; row: number }[] = [];
  const rowEnds: number[] = [];
  milestonePositions.forEach(({ milestone, left }) => {
    let placed = false;
    for (let r = 0; r < rowEnds.length; r++) {
      if (left - rowEnds[r] >= LABEL_MIN_GAP_PCT) {
        rows.push({ milestone, left, row: r });
        rowEnds[r] = left;
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.push({ milestone, left, row: rowEnds.length });
      rowEnds.push(left);
    }
  });
  const totalRows = rowEnds.length || 1;
  const ROW_HEIGHT = 65;
  const LINE_Y = totalRows * ROW_HEIGHT;

  return (
    <div className="relative overflow-x-auto py-4 px-4">
      <div className="min-w-[600px]">
        <div className="relative mx-8">
          <div className="relative" style={{ height: `${LINE_Y + 20}px` }}>
            {rows.map(({ milestone, left, row }) => {
              const dotColor = milestone.color || timelineColor;
              const hasActual = !!milestone.actualDate;
              const topPx = row * ROW_HEIGHT;
              return (
                <div
                  key={`m-${milestone.id}`}
                  className="absolute flex flex-col items-center"
                  style={{ left: `${left}%`, top: `${topPx}px`, transform: "translateX(-50%)" }}
                  data-testid={`milestone-h-${milestone.id}`}
                >
                  <div className="text-center mb-1">
                    <p className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                      {milestone.date}
                    </p>
                    {hasActual && (
                      <p className="text-[10px] font-medium whitespace-nowrap" style={{ color: dotColor }}>
                        Actual: {milestone.actualDate}
                      </p>
                    )}
                    <h3 className="font-semibold text-xs whitespace-nowrap">{milestone.title}</h3>
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
                </div>
              );
            })}
            <div
              className="absolute left-0 right-0 h-0.5"
              style={{
                backgroundColor: `${timelineColor}30`,
                top: `${LINE_Y}px`,
              }}
            />
          </div>
        </div>

        {sortedTasks.length > 0 && (
          <div className="mt-2 border-t border-border pt-3 mx-8" data-testid="task-bars-section-h">
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
                    <div
                      key={`bar-${task.id}`}
                      className={cn("relative", isChild && "ml-6")}
                      data-testid={`task-bar-h-${task.id}`}
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
                        <div
                          className={cn("absolute top-0 bottom-0 rounded-md flex items-center overflow-hidden", isPhase ? "px-2" : "px-2.5")}
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

            {sortedTasks.some((t) => t.actualStartDate || t.actualEndDate) && (
              <div className="flex items-center gap-4 mt-3 px-1">
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

        {sorted.some((m) => m.actualDate) && sortedTasks.length === 0 && (
          <div className="flex items-center gap-4 mt-3 px-8">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: timelineColor, backgroundColor: "transparent" }} />
              <span className="text-[10px] text-muted-foreground">Planned</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: timelineColor }} />
              <span className="text-[10px] text-muted-foreground">Actual</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
