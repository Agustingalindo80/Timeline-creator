// Normalize a raw ClickUp time entry into the shape Atlas needs to stage and
// import a timesheet entry. This module is pure (no I/O) so it can be unit
// tested in isolation from the ClickUp API client.

import {
  getWeekEnding,
  formatUtcDate,
  resolveWeekEndingDay,
  type WeekEndingDay,
} from "./dateUtils";

// Milliseconds in one hour.
const MS_PER_HOUR = 3_600_000;
// Guard against obviously bad durations (a single entry longer than a day).
const MAX_DURATION_MS = 24 * MS_PER_HOUR;

// The subset of a ClickUp time entry payload we depend on. ClickUp returns the
// numeric fields (start/end/duration) as strings, so we accept string | number
// and coerce. Everything else is passed through via rawPayload.
export interface ClickUpTimeEntry {
  id: string;
  task?: { id?: string; name?: string } | null;
  user?: { id?: string | number } | null;
  wid?: string | number;
  billable?: boolean;
  start?: string | number;
  end?: string | number;
  duration?: string | number;
  description?: string | null;
  [key: string]: unknown;
}

// The normalized, Atlas-ready representation of a ClickUp time entry.
export interface NormalizedTimeEntry {
  tenantId: string;
  clickupEntryId: string;
  clickupTaskId: string | null;
  clickupUserId: string | null;
  dayDate: string; // YYYY-MM-DD (UTC)
  weekEnding: string; // YYYY-MM-DD (UTC)
  hours: string; // two-decimal string, matches timesheet_entries insert validation
  billableType: "billable" | "non_billable";
  notes: string;
  rawPayload: ClickUpTimeEntry;
  durationMs: number;
  startMs: number;
  endMs: number | null;
}

// Result of attempting to normalize an entry. A negative ClickUp duration means
// the timer is still running; that is a legitimate skip rather than an error.
export type NormalizeResult =
  | { status: "ok"; entry: NormalizedTimeEntry }
  | { status: "skipped"; reason: "running_timer"; clickupEntryId: string; rawPayload: ClickUpTimeEntry };

// Thrown when an entry cannot be normalized. `issueType` aligns with
// TIMESHEET_IMPORT_ISSUE_TYPES so callers can record it in
// timesheet_import_exceptions without re-mapping.
export class TimeEntryNormalizationError extends Error {
  issueType: string;
  clickupEntryId: string;
  constructor(issueType: string, clickupEntryId: string, message: string) {
    super(message);
    this.name = "TimeEntryNormalizationError";
    this.issueType = issueType;
    this.clickupEntryId = clickupEntryId;
  }
}

export interface NormalizeOptions {
  tenantId: string;
  // Defaults to resolveWeekEndingDay(process.env.ATLAS_WEEK_ENDING_DAY).
  weekEndingDay?: WeekEndingDay;
}

function toNumber(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function normalizeTimeEntry(
  entry: ClickUpTimeEntry,
  options: NormalizeOptions,
): NormalizeResult {
  const clickupEntryId = String(entry.id);
  const weekEndingDay =
    options.weekEndingDay ?? resolveWeekEndingDay(process.env.ATLAS_WEEK_ENDING_DAY);

  const durationMs = toNumber(entry.duration);
  if (durationMs === null) {
    throw new TimeEntryNormalizationError(
      "invalid_duration",
      clickupEntryId,
      `ClickUp entry ${clickupEntryId} has a non-numeric duration`,
    );
  }

  // Running timer: ClickUp reports negative durations for timers still ticking.
  if (durationMs < 0) {
    return { status: "skipped", reason: "running_timer", clickupEntryId, rawPayload: entry };
  }

  if (durationMs === 0) {
    throw new TimeEntryNormalizationError(
      "invalid_duration",
      clickupEntryId,
      `ClickUp entry ${clickupEntryId} has a zero duration`,
    );
  }

  if (durationMs > MAX_DURATION_MS) {
    throw new TimeEntryNormalizationError(
      "invalid_duration",
      clickupEntryId,
      `ClickUp entry ${clickupEntryId} duration exceeds 24 hours (${durationMs} ms)`,
    );
  }

  const startMs = toNumber(entry.start);
  if (startMs === null) {
    throw new TimeEntryNormalizationError(
      "invalid_duration",
      clickupEntryId,
      `ClickUp entry ${clickupEntryId} is missing a start timestamp`,
    );
  }
  const endMs = toNumber(entry.end);

  const startDate = new Date(startMs);
  const dayDate = formatUtcDate(startDate);
  const weekEnding = getWeekEnding(startDate, weekEndingDay);

  const hours = (durationMs / MS_PER_HOUR).toFixed(2);

  const billableType: "billable" | "non_billable" =
    entry.billable === false ? "non_billable" : "billable";

  const clickupTaskId = entry.task?.id != null ? String(entry.task.id) : null;
  const clickupUserId = entry.user?.id != null ? String(entry.user.id) : null;

  const taskName = entry.task?.name?.trim() || "(no task)";
  const description = typeof entry.description === "string" ? entry.description.trim() : "";
  const firstLine = description ? `${taskName} - ${description}` : taskName;
  const secondLine = `Source: ClickUp | Entry: ${clickupEntryId} | Task: ${clickupTaskId ?? "none"}`;
  const notes = `${firstLine}\n${secondLine}`;

  return {
    status: "ok",
    entry: {
      tenantId: options.tenantId,
      clickupEntryId,
      clickupTaskId,
      clickupUserId,
      dayDate,
      weekEnding,
      hours,
      billableType,
      notes,
      rawPayload: entry,
      durationMs,
      startMs,
      endMs,
    },
  };
}
