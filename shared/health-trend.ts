export interface HealthHistoryPoint {
  timelineId: string;
  healthOverall: string;
  recordedAt: string | Date;
}

export interface HealthTrendPoint {
  date: string;
  Green: number;
  Amber: number;
  Red: number;
}

/**
 * Merge the per-project baseline records (latest health at or before the window
 * start) with the in-window history, returning a single list sorted ascending by
 * recordedAt. This is the exact composition used by the portfolio-health endpoint
 * so the client can reconstruct correct RAG counts from the very first trend point.
 */
export function mergeHealthHistory<T extends { recordedAt: string | Date }>(
  baseline: T[],
  windowHistory: T[],
): T[] {
  return [...baseline, ...windowHistory].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  );
}

/**
 * Reconstruct the portfolio health trend as weekly points from `from` to `now`.
 * For each point, every project contributes its most recent health record at or
 * before that point — including a baseline record that predates the window — so
 * the earliest point reflects the true portfolio composition rather than only the
 * subset of projects that happened to change inside the window.
 *
 * Assumes `history` is sorted ascending by recordedAt (see mergeHealthHistory).
 */
export function buildHealthTrend(
  history: HealthHistoryPoint[],
  from: string | Date | null | undefined,
  now: number = Date.now(),
): HealthTrendPoint[] {
  if (history.length === 0 || !from) return [];

  const byTimeline = new Map<string, HealthHistoryPoint[]>();
  history.forEach((h) => {
    const list = byTimeline.get(h.timelineId);
    if (list) list.push(h);
    else byTimeline.set(h.timelineId, [h]);
  });

  const start = new Date(from).getTime();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const points: number[] = [];
  for (let t = start; t <= now; t += weekMs) points.push(t);
  if (points[points.length - 1] !== now) points.push(now);

  return points.map((pt) => {
    let green = 0;
    let amber = 0;
    let red = 0;
    byTimeline.forEach((records) => {
      let latest: HealthHistoryPoint | undefined;
      for (const r of records) {
        if (new Date(r.recordedAt).getTime() <= pt) latest = r;
        else break;
      }
      if (!latest) return;
      if (latest.healthOverall === "green") green++;
      else if (latest.healthOverall === "amber") amber++;
      else if (latest.healthOverall === "red") red++;
    });
    return {
      date: new Date(pt).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      Green: green,
      Amber: amber,
      Red: red,
    };
  });
}
