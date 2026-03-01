# Project High Level Planning

## Overview
This project is a visual project planning tool designed to streamline project management. It supports manual and bulk (Excel/CSV) input for stages and milestones, enabling comprehensive management of projects, clients, team members, and resource allocations. Key features include tracking project health, financial aspects (budget, gross margin), RAID (Risks, Assumptions, Issues, Dependencies) management, and stage-gated governance with AI-powered coaching. The goal is to provide an intuitive platform for efficient project planning, execution, and monitoring, enhancing transparency and decision-making for project managers.

## User Preferences
I prefer iterative development with a focus on delivering core features first. Please ask for clarification if any requirements are unclear, especially regarding complex business logic or UI/UX interactions. I am open to suggestions for improvements but prefer to be consulted before major architectural changes or significant deviations from the outlined feature set.

## System Architecture
The application uses a modern web stack. The frontend is built with React, Vite, Tailwind CSS, and shadcn/ui for a responsive UI. TanStack React Query manages state and data fetching. The backend uses Express.js on Node.js, with PostgreSQL and Drizzle ORM for data storage.

**UI/UX Decisions:**
- A consistent left-hand sidebar navigates to Dashboard, FlightPath Coach, Opportunities (conditional), Clients, Contacts, Projects, Team Members, Allocations, Timesheets, and Settings.
- Supports dark/light mode.
- Project visualizations include horizontal timeline views and Gantt-like bars.
- Health indicators use colored dots.
- Data tables support inline editing and CRUD operations.
- Dynamic forms are used for project creation and detail management.
- A static "About" page provides a stakeholder-facing overview.

**Technical Implementations:**
- **Project Structure:** Clear separation of client-side and server-side code, with a `shared` directory for common schemas.
- **API Design:** RESTful endpoints for all entities.
- **Database Schema:** Detailed schemas for all project entities.
- **Financial Calculations:** Automated calculation of `Approved Budget`, `Total Running Cost`, and `Gross Margin`.
- **Project Health:** Four configurable health indicators (Overall, Scope, Budget, Team Composition).
- **Milestones & Tasks:** Milestones are point-in-time events; tasks are duration-based with progress tracking and planned vs. actual date visualization. Tasks have a hierarchical structure with phases and workstreams, and progress cascades upward. Task `startDate`/`endDate` are nullable (required for projects, optional for opportunity estimate items). Tasks include `durationWeeks` for estimation duration.
- **Resource-Based Estimation:** Workstreams use a `workstream_resources` table for multi-resource assignments. Each resource has `rateCardId`, `hoursPerWeek`, `taskType` (PM/Functional/Technical/QA), and optional `teamMemberId`. Estimated hours = Σ(hoursPerWeek × durationWeeks). Cost = Σ(hours × costRate). Revenue = Σ(hours × billRate). Legacy workstreams with flat `estimatedHours`/`assignedRoleId` still calculate correctly as fallback. Rate cards in the Estimate Tab are filtered by the opportunity's region.
- **Timesheet Management:** Global page for tracking daily effort by team members, project, and workstream.
- **Progress Tracking:** Project-level tab for weekly % complete per workstream, syncing with task progress.
- **EVM Dashboard:** Project-level tab displaying Earned Value Management metrics (BAC, PV, AC, EV, SV, CV, SPI, CPI, EAC, ETC, VAC) with color-coded indicators. Supports historical snapshot tracking.
- **EVM Historical Snapshots (Phase 3 — Complete):**
  - **`evm_snapshots` table:** Stores frozen weekly EVM metrics per project with revision versioning. Fields: `id`, `tenantId`, `timelineId`, `weekEnding`, `version` (int), `isCurrent` (bool), `mode` ("manual_freeze" | "gate_freeze"), all EVM numerics (bac, pv, ac, ev, sv, cv, spi, cpi, eac, etc, vac, weeklyPv/Ac/Ev), `workstreamBreakdown` (jsonb), `inputsHash`, `notes`, `generatedBy`, `generatedAt`.
  - **Revision versioning:** Re-freezing a week creates v2, v3, etc. Previous versions get `isCurrent = false`. Trend tables always show `isCurrent = true` rows.
  - **Server-side EVM engine:** `server/evm-engine.ts` — `calculateEVMForWeek(timelineId, weekEnding)` replicates client-side EVM logic on the server for snapshot persistence. Includes SHA-256 `inputsHash` of key inputs.
  - **Gate auto-freeze:** When a governance gate is approved and stage advances, an EVM snapshot is auto-generated with `mode = "gate_freeze"` and notes indicating which stage triggered it.
  - **VAC (Variance at Completion):** `BAC - EAC`, displayed in summary cards and history table.
  - **API endpoints:** `POST /api/timelines/:id/freeze-week`, `GET /api/timelines/:id/evm-snapshots`, `GET /api/timelines/:id/evm-snapshots/:weekEnding`, `GET /api/timelines/:id/evm-snapshots/:weekEnding/versions`, `DELETE /api/timelines/:id/evm-snapshots/:snapshotId`
  - **Frontend:** "Freeze Week" / "Re-freeze Week" button with confirmation dialog (shows metric preview and optional notes), "Frozen ✓ vN" badge on current week, EVM History trend table with color-coded SPI/CPI, direction arrows (↑↓→), gate freeze badges, and notes tooltips.
- **RAID Log:** Supports Risks, Assumptions, Issues, and Dependencies with specific fields, linkable to governance stages.
- **Opportunities Module:** A pre-sales entity (`recordType = "opportunity"`) leveraging project infrastructure, with a dedicated API. Includes an Estimate tab for financial roll-ups and a "Convert to Project" feature. The Estimate Tab uses a **price-driven** financial model: Base Price (hours × billRate) → Risk-Adjusted Price → Buffered Price. Base Cost (hours × costRate) is shown for reference. Gross Margin = (Buffered Price - Base Cost) / Buffered Price. All resource/workstream/phase amounts display the bill rate (price), not cost. The Estimate section is labeled "Planned Effort / Scope".
- **Estimate Template Import/Export:** `GET /api/estimate-template` generates a downloadable Excel template with columns (Phase, Workstream, Duration, Confidence, Role/Rate Card, Hours Per Week, Task Type) plus a reference sheet of available rate cards. `POST /api/timelines/:id/import-estimate` parses the uploaded file, creates phases/workstreams/resources with duplicate detection (reuses existing phases/workstreams by name). Buttons on Estimate Tab: "Download Template" and "Import from Template".
- **Opportunity Tab order:** Estimate | Team | Governance (Stage 0 only) | RAID Log
- **Project Tab order:** Milestones | Phases | Workstreams | Team Members | Timesheets | Progress | EVM | Governance | RAID Log
- **Stage 0 Pre-Sales:** 6 deliverables (Deal Context, Scope Definition Pack, Solution Approach, Delivery Feasibility Review, SOW, Sales→Delivery Handoff Pack) with RACI matrices. Gate: "Commercial & Operational Authorization" (SOW signed + handoff completed).
- **Convert to Project:** `POST /api/opportunities/:id/convert` creates new project at Stage 1, copies tasks/team/allocations/RAID/workstream-resources. Gate must be passed/exception first.
- **FlightPath Governance Framework:** A 5-stage governance engine for projects, with deliverables, RACI matrices, and gate criteria. Stage advancement is enforced and evaluated by an AI. Optional deliverables are supported.
- **FlightPath AI Coach:** A conversational chatbot knowing the governance framework, powered by OpenAI.
- **Document Repository Integration:** Links to Google Drive for artifact management, with AI-powered artifact verification for checkpoints.
- **Multi-Tenancy Readiness:** Designed with `tenantId` for customizable governance frameworks per tenant.
- **Team Composition (Opportunity vs Project):** On opportunities, team entries are role-based — only a rate card (role) is required, and a real team member can be assigned later ("Assign later" option). On projects, a real team member is always required. This models the evolution from pre-sales planning to delivery staffing. The `teamMemberId` column on `project_team_members` is nullable; backend enforces the project requirement by checking `recordType`. Role-only entries display the rate card name with an "Unassigned" badge. Convert-to-project copies role-only entries as positions to fill. "Sync from Estimate" button auto-populates team roles from workstream resources, consolidating by rate card with FTE count based on date overlaps.
- **Resource Allocation:** Matrix view for team members' weekly hours across projects.
- **Configurable Fields:** User-configurable dropdown fields stored as JSONB.
- **Date Formatting:** Per-project date format setting.
- **Branding & Theming:** Database-driven system for customizing app name, logo, favicon, and color scheme, supporting multi-tenancy.
- **Authentication:** Replit Auth via OpenID Connect, with session storage in PostgreSQL.
- **RBAC (Phase 2 — Complete):**
  - **Three-layer model:** Org roles (Org Owner, Org Admin, PMO Lead, Finance, Delivery Ops, Member), Object roles (AE, SE, DL, PM, Contributor, Executive Viewer), and permission bundles controlling feature access.
  - **User↔Team Member linkage:** `team_members.userId` (nullable FK to users) links login accounts to team member profiles. "App Access" toggle on team member form = single entry point.
  - **Permission Engine:** `server/rbac.ts` resolves effective permissions (org + object), with in-memory cache (60s TTL). Middleware `server/middleware/permissions.ts` guards API routes.
  - **Gate Approval Policy:** `server/gate-policy.ts` enforces stage-specific quorum (Stage 0: Finance/PMO Lead + DL, Stage 1: DL + PMO Lead, Stage 2+: PM + DL). Overrides require Org Owner or PMO Lead.
  - **Audit Log:** Sensitive actions (gate.approve, gate.override, pricing.approve, settings changes) recorded in `audit_log` table.
  - **Schema files:** `shared/models/rbac.ts` (tables + constants), `server/seed-rbac.ts` (seeding + migration)
  - **Frontend:** `usePermissions()` hook, `<PermissionGuard>` component, Admin tabs (Users & Roles, Audit Log, Role Matrix), Team & Access sections on project/opportunity detail, timesheet scoping by assignment.
  - **API endpoints:** `/api/rbac/roles`, `/api/rbac/users`, `/api/rbac/my-permissions`, `/api/rbac/my-assignments`, `/api/rbac/objects/:type/:id/assignments`, `/api/team-members/:id/enable-access`, `/api/team-members/:id/disable-access`, `/api/audit-log`
  - **Bootstrap:** First login → Org Owner; existing users → Member; email-matched team members auto-linked.

## UI/Design System (Phase 1 Overhaul — Complete)
- **Font:** Inter (previously Poppins) — tighter, more professional feel with condensed heading tracking
- **Color Palette:** Executive-grade dark-first design
  - Primary blue: `#3B82F6` (hsl 217 91% 60%)
  - Dark mode background: slate-900 (`hsl(222, 47%, 11%)`), cards: slate-800 (`hsl(217, 33%, 14%)`)
  - Light mode: Clean whites with subtle gray borders
  - Semantic colors: emerald for success, amber for warnings, red for destructive
- **Component Classes:** `card-elevated`, `card-interactive`, `metric-value`, `metric-label`, `table-row-hover`, `table-header-cell`, `table-financial`, `health-pulse`, `fade-in`, `slide-in-up`, `financial-positive`, `financial-negative`
- **Sidebar:** Linear-inspired minimal navigation with grouped sections (Core, Workspace, Resources, System), left accent bar on active items
- **Dashboard:** Mission Control layout with large metric cards, pipeline funnel bars, smart currency formatting ($1.2M, $450K)
- **Data Tables:** Stripe-style tight rows, uppercase tracking headers, tabular-nums financial columns, em-dash empty placeholders
- **Detail Pages:** Stripe-inspired precision layout with color-coded KPI cards, inline edit mode, clean tab indicators

## External Dependencies
- **React:** Frontend library.
- **Vite:** Frontend build tool.
- **Tailwind CSS:** CSS framework.
- **shadcn/ui:** UI component library.
- **TanStack React Query:** Data fetching and state management.
- **Express.js:** Backend web framework.
- **Node.js:** Backend runtime.
- **PostgreSQL:** Primary database.
- **Drizzle ORM:** TypeScript ORM.
- **xlsx:** For parsing Excel/CSV files.
- **wouter:** Client-side router.
- **html2canvas:** For taking screenshots.
- **jspdf:** For client-side PDF generation.
- **OpenAI (via Replit AI Integrations):** Powers FlightPath AI Coach and Gate Evaluator (model: gpt-5.2).
- **Google Drive (via Replit Connector):** For artifact management.