---
name: ClickUp import week-ending convention
description: Why the ClickUp time-entry import uses a different week-ending weekday than the app's own timesheet UI.
---

The ClickUp -> Atlas time entry import computes `week_ending` via
`server/integrations/clickup/dateUtils.ts` using a **configurable**
`ATLAS_WEEK_ENDING_DAY` env var that **defaults to FRIDAY** (supports
FRIDAY/SATURDAY/SUNDAY), with UTC-safe date math.

**Why:** the import task spec explicitly required a configurable Friday-default
week ending. This intentionally differs from Atlas's own timesheet UI
(`client/src/features/projects/helpers.ts` / `client/src/pages/timesheets.tsx`),
which hardcodes a **Sunday** week ending in local time.

**How to apply:** do not "fix" the Friday default to match the Sunday UI — the
divergence is deliberate and env-driven. If the two ever need to agree, change it
via `ATLAS_WEEK_ENDING_DAY`, and be aware the UI helper is a separate, local-time
implementation that would also need updating.
