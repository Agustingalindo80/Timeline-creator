---
name: Portfolio Health cockpit
description: Architecture & conventions for the Vogara Atlas executive Portfolio Health dashboard (multi-task build).
---

# Portfolio Health (Vogara Atlas) cockpit

Executive governance dashboard built incrementally on the Portfolio Health page.

## Where things live
- The cockpit lives on the **portfolio-health page, NOT the dashboard page** — task plans sometimes hint at dashboard.tsx, but the executive cockpit is on portfolio-health. Feature components sit under the portfolio-health feature folder.
- Pure per-project dimension scoring is a standalone server service; aggregation/API assembly is in `getPortfolioOverview()` which returns the SAME shape for both empty and populated portfolios (always update both return branches when adding fields). Client types must mirror the server overview shape.
- Dimensions: schedule, financial, scope, quality, risk, governance, outcome. `score: number|null`; **null score => gray/insufficient-data and is EXCLUDED from weighted avg (never counted as zero)**. scoreToRag bands: >=85 green, >=70 amber, else red, null gray.

## Conventions that survived code review
- RAG colors in UI: green `#16a34a`, amber `#f59e0b`, red `#ef4444`, gray `#9ca3af`. RAG colors are reserved EXCLUSIVELY for status; navy is the brand surface.
- **Timezone-safe date compares**: never use `new Date(a) < new Date(b)` for due/overdue — use YYYY-MM-DD string helpers. Boundary: due==today is NOT overdue.
  - **Why:** raw Date compares cross UTC/local midnight and flip overdue state at timezone boundaries.
- **Financial EVM ratios** (CPI/SPI/CV): denominator is EVM-only actual cost, NOT a fallback to running cost. Portfolio-level actualCost *display* may still use the running-cost fallback.
- **Gate-status semantics must be identical everywhere.** Blocked gates = rejected/failed/exception/exception_requested (note: an approved `exception` still counts as blocked). Executive-decision-needed = exception_requested only. Duplicating these sets in a new module silently drifts counts — keep them in lockstep with the reports-layer gate summary.
- `project_gates` is unique per (timelineId, stageId), so one gate per stage per project — `.find()` by stage is deterministic. No gate-specific date column exists; stage-entry / "days in stage" must be INFERRED from gate approvedAt/createdAt timestamps (max approvedAt of prior-sortOrder stages, else current gate createdAt). A dedicated stage-entry field is a future data-model change; until then aging uses a constant threshold placeholder.
- Tests: pure service modules have co-located `*.test.ts` run via `npx tsx --test <file>`. The validation workflow only runs the tenant-provisioning test; other test files are run manually. App runs via tsx (no typecheck gate); some pre-existing unrelated TS errors exist elsewhere — leave them alone.
