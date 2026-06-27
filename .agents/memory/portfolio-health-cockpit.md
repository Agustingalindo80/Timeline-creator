---
name: Portfolio Health cockpit
description: How the /portfolio-health executive dashboard's server-driven filtering and client data fetching are wired, and the non-obvious constraints behind them.
---

# Portfolio Health (Vogara Atlas) executive cockpit

## Server-driven filtering is the core contract
`getPortfolioOverview(tenantId, ctx, filters)` in `server/reports.ts` builds the full scored
project list, applies `filters` to produce a single `filtered` set (+ `filteredIds`), and EVERY
downstream aggregate (header counts, KPIs, executive panels, stage distribution, dimension
heatmap, and the returned `projects`) must derive from `filtered`/`filteredIds`.

**Why:** the dashboard's whole point is that the filter bar updates every section consistently.
If any aggregate is computed from the unfiltered list, the executive numbers silently disagree
with the table — a misleading-data bug, not a crash.

**How to apply:** when adding a new section/aggregate, source it from `filtered`/`filteredIds`,
never from the full project list. Keep access-control scoping (the `accessible` set) upstream of
filtering so filters never widen visibility.

## Two endpoints, two roles
- `/api/dashboard/portfolio-overview` is FILTERED — parses query params and drives the dashboard.
- `/api/dashboard/portfolio-health` stays UNFILTERED — provides stable filter option lists
  (client dropdown) and the full 90-day history for the trend. Don't make it honor filters, or
  the option lists/trend baseline collapse as the user filters.

## Client data-fetching gotchas (TanStack Query v5)
- The default queryFn joins the queryKey array by `/` to form the URL. To pass a querystring,
  embed the ENTIRE `?...` as a SINGLE key element:
  `queryKey: ["/api/dashboard/portfolio-overview?clientId=..."]`. Do NOT split it into segments.
- Use `placeholderData: keepPreviousData` so the dashboard doesn't flash empty while refetching
  on filter changes.
- Debounce the free-text search before it enters the querystring (≈300ms) to avoid a refetch per
  keystroke.
- When filters can remove the currently-selected drawer project, close the drawer in an effect
  (watch the filtered projects list) or you get an open/empty Sheet.

## Downstream/blocked filters
Subsidiary, Project Manager, and Strategic Account filters are intentionally rendered as DISABLED
placeholders — their data models are a separate downstream task. Don't wire them until those
models exist.
