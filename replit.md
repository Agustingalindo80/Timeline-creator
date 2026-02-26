# Project High Level Planning

## Overview
This project aims to develop a visual project planning tool offering two input methods: manual creation of stages/milestones and bulk import via Excel/CSV files. The tool will enable users to manage projects, clients, team members, and resource allocations effectively. It includes features for tracking project health, financial aspects like budget and gross margin, and managing risks and tasks. The overarching vision is to provide a comprehensive, intuitive platform for project managers to plan, execute, and monitor projects efficiently, enhancing transparency and decision-making.

## User Preferences
I prefer iterative development with a focus on delivering core features first. Please ask for clarification if any requirements are unclear, especially regarding complex business logic or UI/UX interactions. I am open to suggestions for improvements but prefer to be consulted before major architectural changes or significant deviations from the outlined feature set.

## System Architecture
The application is built with a modern web stack, utilizing React with Vite, Tailwind CSS, and shadcn/ui for the frontend, ensuring a responsive and aesthetically pleasing user interface. State management and data fetching are handled by TanStack React Query. The backend is powered by Express.js on Node.js, providing robust API services. PostgreSQL, accessed via Drizzle ORM, serves as the primary data store.

**UI/UX Decisions:**
- A consistent left-hand sidebar navigation (shadcn Sidebar) provides access to key sections: Dashboard, Clients, Contacts, Projects, Team Members, Allocations, Timesheets, and Settings.
- Dark/light mode theme toggling is available.
- Project visualisations include horizontal timeline views for milestones and Gantt-like bars for tasks.
- Health indicators are visually represented by colored dots.
- Data tables (e.g., Contacts, Team Members, Rate Cards) feature inline editing and CRUD operations.
- Dynamic forms and components are used for project creation and detail management.

**Technical Implementations:**
- **Project Structure:** Clear separation of client-side (React components, pages, utilities) and server-side (API routes, database interactions) code. A `shared` directory holds common schema definitions (Drizzle + Zod).
- **Routing:** Handled client-side.
- **API Design:** RESTful API endpoints for managing all entities (clients, projects, milestones, tasks, risks, team members, allocations, rate cards, settings, timesheet entries, progress entries).
- **Database Schema:** Detailed schemas for clients, contacts, timelines (projects), milestones, tasks, risks, team members, rate_cards, project_team_members, allocations, app_settings, timesheet_entries, and progress_entries.
- **Financial Calculations:** Automated calculation of `Approved Budget` (sum of financial obligation milestones), `Total Running Cost` (based on team allocations and elapsed time), and `Gross Margin`.
- **Project Health:** Four independent health indicators (Overall, Scope, Budget, Team Composition) with configurable options.
- **Milestones & Tasks:** Milestones are point-in-time events; tasks are duration-based with progress tracking (`percentComplete`) and planned vs. actual date visualization. Tasks have a hierarchical structure with `itemType` ("phase" or "workstream") and `parentTaskId`. Phase `percentComplete` is auto-calculated from child workstreams using duration-weighted average when children exist (read-only in UI). Status cascades upward: if any child is "in_progress" or "complete", the parent phase auto-upgrades to "in_progress". Workstream dates are validated against parent phase date range. Helper function `recalcPhaseProgress(phaseId)` in routes.ts handles all recalculations on create/update/delete. Storage method `getTasksByParent(parentTaskId)` fetches children.
- **Timesheet Management:** Global-level page (`/timesheets`) for tracking actual effort (hours) per team member, per workstream. Supports two view modes: **Weekly** (matrix: team member rows × workstream columns, single hours value per cell) and **Daily** (per-team-member cards with workstream rows × day columns Mon–Sun, with day totals). Toggle between modes via tabs. Data stored in `timesheet_entries` table (timelineId, teamMemberId, taskId, weekEnding, dayDate, hours, billableType, notes). Weekly entries have `dayDate = null`; daily entries have specific date in `dayDate`. EVM groups by `weekEnding` regardless of entry type.
- **Progress Tracking:** Project-level tab (inside project detail, before EVM/Risks) for weekly % complete per workstream. Phases auto-calculate from child workstreams. Progress entries stored in `progress_entries` table (timelineId, taskId, weekEnding, percentComplete, notes). On save, syncs `tasks.percentComplete` and triggers `recalcPhaseProgress` on parent phase.
- **EVM Dashboard:** Read-only project-level tab showing Earned Value Management metrics. Calculates BAC, PV, AC, EV, SV, CV, SPI, CPI, EAC, ETC. Color-coded indicators (green ≥1.0, amber 0.9-1.0, red <0.9). Weekly cumulative breakdown table and per-workstream breakdown. PV from allocations×rates, AC from timesheets×rates, EV from progress×workstream budgets.
- **Project Detail Tab Order:** Milestones | Phases | Workstreams | Team Members | Progress | EVM | Risks
- **Risk Register:** Optional feature for tracking project risks with detailed fields and a calculated risk score.
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