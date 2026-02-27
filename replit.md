# Project High Level Planning

## Overview
This project aims to develop a visual project planning tool offering two input methods: manual creation of stages/milestones and bulk import via Excel/CSV files. The tool will enable users to manage projects, clients, team members, and resource allocations effectively. It includes features for tracking project health, financial aspects like budget and gross margin, managing risks/assumptions/issues/dependencies (RAID), and stage-gated governance with AI-powered coaching. The overarching vision is to provide a comprehensive, intuitive platform for project managers to plan, execute, and monitor projects efficiently, enhancing transparency and decision-making.

## User Preferences
I prefer iterative development with a focus on delivering core features first. Please ask for clarification if any requirements are unclear, especially regarding complex business logic or UI/UX interactions. I am open to suggestions for improvements but prefer to be consulted before major architectural changes or significant deviations from the outlined feature set.

## System Architecture
The application is built with a modern web stack, utilizing React with Vite, Tailwind CSS, and shadcn/ui for the frontend, ensuring a responsive and aesthetically pleasing user interface. State management and data fetching are handled by TanStack React Query. The backend is powered by Express.js on Node.js, providing robust API services. PostgreSQL, accessed via Drizzle ORM, serves as the primary data store.

**UI/UX Decisions:**
- A consistent left-hand sidebar navigation (shadcn Sidebar) provides access to key sections: Dashboard, FlightPath Coach, Clients, Contacts, Projects, Team Members, Allocations, Timesheets, and Settings.
- Dark/light mode theme toggling is available.
- Project visualisations include horizontal timeline views for milestones and Gantt-like bars for tasks.
- Health indicators are visually represented by colored dots.
- Data tables (e.g., Contacts, Team Members, Rate Cards) feature inline editing and CRUD operations.
- Dynamic forms and components are used for project creation and detail management.
- A static "About" page (`/about`) provides a stakeholder-facing overview of platform modules, key capabilities, and technical summary. Uses app branding (logo, name).

**Technical Implementations:**
- **Project Structure:** Clear separation of client-side (React components, pages, utilities) and server-side (API routes, database interactions) code. A `shared` directory holds common schema definitions (Drizzle + Zod).
- **Routing:** Handled client-side.
- **API Design:** RESTful API endpoints for managing all entities (clients, projects, milestones, tasks, risks, team members, allocations, rate cards, settings, timesheet entries, progress entries, flightpath stages, deliverables, checkpoints, gates, chat).
- **Database Schema:** Detailed schemas for clients, contacts, timelines (projects), milestones, tasks, risks, team members, rate_cards, project_team_members, allocations, app_settings, timesheet_entries, progress_entries, flightpath_stages, flightpath_deliverables, project_checkpoints, project_gates, conversations, and messages.
- **Financial Calculations:** Automated calculation of `Approved Budget` (sum of financial obligation milestones), `Total Running Cost` (based on team allocations and elapsed time), and `Gross Margin`.
- **Project Health:** Four independent health indicators (Overall, Scope, Budget, Team Composition) with configurable options.
- **Milestones & Tasks:** Milestones are point-in-time events; tasks are duration-based with progress tracking (`percentComplete`) and planned vs. actual date visualization. Tasks have a hierarchical structure with `itemType` ("phase" or "workstream") and `parentTaskId`. Phase `percentComplete` is auto-calculated from child workstreams using duration-weighted average when children exist (read-only in UI). Status cascades upward: if any child is "in_progress" or "complete", the parent phase auto-upgrades to "in_progress". Workstream dates are validated against parent phase date range. Helper function `recalcPhaseProgress(phaseId)` in routes.ts handles all recalculations on create/update/delete. Storage method `getTasksByParent(parentTaskId)` fetches children.
- **Timesheet Management:** Global-level page (`/timesheets`) for tracking actual daily effort (hours). Flow: select team member → select week → add rows by choosing Project + Workstream combinations → enter hours per day (Mon–Sun). Multiple rows per week supported (different projects, or same project with different workstreams). Data stored in `timesheet_entries` table (timelineId, teamMemberId, taskId, weekEnding, dayDate, hours, billableType, notes). Each daily cell is a separate entry with `dayDate` set. Tasks fetched per project using `useQueries`. EVM groups by `weekEnding` regardless of entry type. Future: team members will log in to submit their own timesheets.
- **Progress Tracking:** Project-level tab (inside project detail, before EVM/Risks) for weekly % complete per workstream. Phases auto-calculate from child workstreams. Progress entries stored in `progress_entries` table (timelineId, taskId, weekEnding, percentComplete, notes). On save, syncs `tasks.percentComplete` and triggers `recalcPhaseProgress` on parent phase.
- **EVM Dashboard:** Read-only project-level tab showing Earned Value Management metrics. Calculates BAC, PV, AC, EV, SV, CV, SPI, CPI, EAC, ETC. Color-coded indicators (green ≥1.0, amber 0.9-1.0, red <0.9). Weekly cumulative breakdown table and per-workstream breakdown. PV from allocations×rates, AC from timesheets×rates, EV from progress×workstream budgets.
- **Project Detail Tab Order:** Milestones | Phases | Workstreams | Team Members | Timesheets | Progress | EVM | Governance | RAID Log
- **RAID Log:** Expanded from the original Risk Register. Supports four item types: Risk, Assumption, Issue, Dependency. Each type has appropriate fields (e.g., probability/impact for risks, validationCriteria for assumptions, dependencySource/requiredByDate for dependencies). Items can be linked to governance stages via `relatedStageId`. Filterable by item type within the RAID Log tab.
- **FlightPath Governance Framework:** A 5-stage governance engine (Stage 0: Value Framing → Stage 4: Value Realization & Evolution) embedded into every project. Each stage has defined deliverables with RACI accountability matrices, gate criteria, and playbook guidance. PMs track progress by completing checkpoint items and clearing gates before advancing stages.
  - **Schema:** `flightpath_stages` (stage definitions, keyed by `tenantId`), `flightpath_deliverables` (per-stage deliverables with RACI data as JSONB), `project_checkpoints` (per-project deliverable completion tracking), `project_gates` (per-project gate status with AI evaluator results).
  - **Seed Data:** 46 deliverables across 5 stages with full RACI matrices seeded on server startup (idempotent). Stage 0 has 14 deliverables, Stage 1 has 11, Stage 2 has 9, Stage 3 has 7, Stage 4 has 5.
  - **Gate Enforcement:** Stage advancement is enforced via `POST /api/timelines/:id/advance-stage` — validates that the current stage's gate has passed or has an approved exception before allowing progression. The `flightpathStageId` field on timelines is read-only in the UI and cannot be changed via the regular PATCH endpoint. Projects can activate governance (set to Stage 0) without a gate check. The current governance stage is displayed as a read-only badge in the project detail header.
  - **AI Evaluator:** `POST /api/timelines/:id/evaluate-gate` — checks checkpoint completion, RAID status, and EVM indicators. Returns structured pass/fail assessment via OpenAI (gpt-5.2).
  - **Settings:** FlightPath tab in Settings page allows viewing and editing stages, deliverables, RACI matrices, and gate criteria.
  - **Governance Tab:** In project detail, shows stage stepper, checkpoint list, RACI viewer, RAID summary, and gate panel.
- **FlightPath AI Coach:** Conversational chatbot at `/chat` that knows the full governance framework. System prompt dynamically built from database stages/deliverables/RACI. Uses OpenAI (gpt-5.2) via Replit AI Integrations (no API key needed, billed to Replit credits). Chat UI with distinct user/agent styling, loading indicators, and auto-scroll.
- **Document Repository Integration:** Projects can link to a Google Drive folder for artifact management. Each governance checkpoint/deliverable can have a document attached from the repository. The `project_checkpoints` table stores `artifactUrl`, `artifactFileName`, `artifactVerified`, `artifactVerifiedAt`, and `artifactSummary`. AI-powered artifact verification reads file metadata and content (for Google Docs, text files) to assess whether artifacts meet deliverable requirements. Gate evaluation considers three dimensions: checkpoint completion, artifact presence/quality, and RAID status. SharePoint connector available but requires user authorization. API endpoints: `GET /api/timelines/:id/artifacts` (list files), `POST /api/timelines/:id/link-artifact`, `DELETE /api/timelines/:id/unlink-artifact`, `POST /api/timelines/:id/verify-artifacts`.
- **Multi-Tenancy Readiness:** All FlightPath stage tables use `tenantId` column (default "default"), matching the existing `branding_config` pattern. AI Coach system prompt is dynamically built from whatever framework the tenant has configured. Different companies can define entirely different stage structures, deliverables, RACI roles, and gate criteria.
- **Resource Allocation:** A resource planning matrix view for team members and their weekly hours across projects.
- **Configurable Fields:** Many dropdown fields (e.g., Project Type, Engagement Model, Statuses, Roles, Regions) are user-configurable via the settings page, stored as JSONB.
- **Date Formatting:** Per-project date format setting, applied consistently across all date inputs and displays within that project.
- **Branding & Theming:** Database-driven branding system (`branding_config` table) allowing customization of app name, logo, favicon, and color scheme (primary, sidebar background/text/accent, accent colors). Multi-tenant ready — keyed by tenant ID (currently "default"). Colors stored as HSL strings, injected as CSS custom properties at runtime via `BrandingProvider` context. Logo/favicon uploaded via API and served from `public/uploads/`. All page titles use `useAppTitle` hook for dynamic app name. Settings > Branding tab provides full UI with color pickers, file uploads, live preview, and reset-to-defaults.
- **Authentication:** Replit Auth via OpenID Connect (passport + express-session). Session stored in PostgreSQL (`sessions` table). Users table tracks profile info. Auth middleware protects all `/api/*` routes except public paths (`/api/login`, `/api/logout`, `/api/callback`, `/api/auth/user`, `/api/branding`). Landing page shown to unauthenticated users; authenticated users see the full app with sidebar. User profile and logout button displayed in sidebar footer.

## External Dependencies
- **React:** Frontend library.
- **Vite:** Build tool for the frontend.
- **Tailwind CSS:** Utility-first CSS framework.
- **shadcn/ui:** UI component library.
- **TanStack React Query:** Data fetching and state management.
- **Express.js:** Web application framework for Node.js.
- **Node.js:** JavaScript runtime environment for the backend.
- **PostgreSQL:** Relational database.
- **Drizzle ORM:** TypeScript ORM for PostgreSQL.
- **xlsx:** Library for parsing Excel (.xlsx, .xls) and CSV files.
- **wouter:** A tiny (~1.5KB) router for React.
- **html2canvas:** Library to take screenshots of webpages or parts of them.
- **jspdf:** Library to generate PDFs in client-side JavaScript.
- **OpenAI (via Replit AI Integrations):** Powers FlightPath AI Coach and Gate Evaluator. Uses `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` env vars. Billed to Replit credits at public API rates. Model: gpt-5.2.
- **Google Drive (via Replit Connector):** Provides OAuth-based access to Google Drive for artifact management. Uses `googleapis` package. Client factory in `server/google-drive.ts`. SharePoint connector available but not yet authorized.
- **Note:** SharePoint integration is available via Replit connector but was dismissed during setup. Can be added later by re-proposing the connector.
