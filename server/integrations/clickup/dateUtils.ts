// UTC-safe date utilities for the ClickUp -> Atlas time entry import.
//
// Atlas timesheet entries are bucketed into a week identified by its
// "week ending" date. The week-ending weekday is configurable via the
// ATLAS_WEEK_ENDING_DAY environment variable and defaults to FRIDAY.

export type WeekEndingDay = "FRIDAY" | "SATURDAY" | "SUNDAY";

// JS getUTCDay(): Sunday = 0 ... Saturday = 6.
const WEEK_ENDING_DAY_TO_DOW: Record<WeekEndingDay, number> = {
  SUNDAY: 0,
  FRIDAY: 5,
  SATURDAY: 6,
};

export const DEFAULT_WEEK_ENDING_DAY: WeekEndingDay = "FRIDAY";

// Resolve a raw string (e.g. from process.env.ATLAS_WEEK_ENDING_DAY) to a
// supported WeekEndingDay, falling back to the default when unset/invalid.
export function resolveWeekEndingDay(value: string | undefined | null): WeekEndingDay {
  if (!value) return DEFAULT_WEEK_ENDING_DAY;
  const upper = value.trim().toUpperCase();
  if (upper === "FRIDAY" || upper === "SATURDAY" || upper === "SUNDAY") {
    return upper;
  }
  return DEFAULT_WEEK_ENDING_DAY;
}

// Format a Date as an ISO date string (YYYY-MM-DD) using its UTC components.
export function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Given any date, return the YYYY-MM-DD (UTC) of the next occurrence of the
// configured week-ending weekday, inclusive of the date itself. All arithmetic
// is done on UTC components so results are independent of the server timezone.
export function getWeekEnding(
  date: Date,
  weekEndingDay: WeekEndingDay = DEFAULT_WEEK_ENDING_DAY,
): string {
  const target = WEEK_ENDING_DAY_TO_DOW[weekEndingDay];
  const current = date.getUTCDay();
  const diff = (target - current + 7) % 7;
  const result = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ));
  result.setUTCDate(result.getUTCDate() + diff);
  return formatUtcDate(result);
}
