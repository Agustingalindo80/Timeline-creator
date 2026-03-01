# Project High Level Planning

## Overview
This project is a visual project planning tool designed to streamline project management. It supports manual and bulk input for stages and milestones, enabling comprehensive management of projects, clients, team members, and resource allocations. Key features include tracking project health, financial aspects, RAID management, and stage-gated governance with AI-powered coaching. The goal is to provide an intuitive platform for efficient project planning, execution, and monitoring, enhancing transparency and decision-making for project managers. The business vision is to provide a robust platform for project managers, improving project success rates and financial outcomes.

## User Preferences
I prefer iterative development with a focus on delivering core features first. Please ask for clarification if any requirements are unclear, especially regarding complex business logic or UI/UX interactions. I am open to suggestions for improvements but prefer to be consulted before major architectural changes or significant deviations from the outlined feature set.

## System Architecture
The application uses a modern web stack with React, Vite, Tailwind CSS, and shadcn/ui for the frontend, and Express.js on Node.js with PostgreSQL and Drizzle ORM for the backend.

**UI/UX Decisions:**
- Consistent left-hand sidebar navigation with module-permission-gated items. Admin section has Settings + Security sub-items.
- Supports dark/light mode.
- Project visualizations include horizontal timeline views and Gantt-like bars.
- Health indicators use colored dots.
- Data tables support inline editing and CRUD operations.
- Dynamic forms for project creation and detail management.
- A static "About" page for stakeholder overview.
- **Color Palette:** Executive-grade dark-first design with a primary blue (`#3B82F6`), slate-900 background for dark mode, and clean whites for light mode.
- **Component Classes:** Standardized classes for cards, metrics, tables, and financial displays.
- **Dashboard:** Mission Control layout with metric cards and pipeline funnel bars.
- **Data Tables:** Stripe-style tight rows with uppercase headers and tabular numbers.
- **Detail Pages:** Stripe-inspired precision layout with KPI cards and inline edit mode.

**Technical Implementations:**
- **Project Structure:** Clear separation of client-side and server-side code.
- **API Design:** RESTful endpoints for all entities.
- **Database Schema:** Detailed schemas for all project entities with `tenantId` for multi-tenancy. Date fields use PostgreSQL `date` type (Drizzle `date()` in string mode). Event timestamps use `timestamp with time zone`. Status fields use `pgEnum` constraints (`health_status`, `record_type`, `project_status`, `task_status`, `task_item_type`, `gate_status`, `risk_status`). EVM snapshots have a partial unique index (`evm_current_uniq`) preventing duplicate current snapshots. `tasks.parentTaskId` uses `ON DELETE SET NULL` to prevent cascade deletion of task hierarchies.
- **Financial Calculations:** Automated calculation of `Approved Budget`, `Total Running Cost`, and `Gross Margin`.
- **Project Health:** Four configurable health indicators.
- **Milestones & Tasks:** Milestones are point-in-time events; tasks are duration-based with hierarchical structure and progress tracking.
- **Resource-Based Estimation:** Workstreams use multi-resource assignments with rate cards, calculating estimated hours, cost, and revenue.
- **Timesheet Management:** Global page for tracking daily effort.
- **Progress Tracking:** Project-level tab for weekly % complete per workstream.
- **EVM Dashboard:** Project-level tab displaying Earned Value Management metrics with historical snapshot tracking and revision versioning. Server-side EVM engine ensures persistence. Includes S-Curve chart (PV/AC/EV over time with BAC reference line) and CPI/SPI Performance Trend chart using Recharts.
- **RAID Log:** Supports Risks, Assumptions, Issues, and Dependencies.
- **Opportunities Module:** Pre-sales entity with a dedicated API, Estimate tab for financial roll-ups (price-driven model), and "Convert to Project" feature.
- **Estimate Template Import/Export:** Functionality to download an Excel template and import estimates.
- **Operating Model Governance Framework:** A 5-stage governance engine with deliverables, RACI matrices, and AI-evaluated gate criteria. Tenant-customizable label via `governanceModelLabel` in app settings (default: "Operating Model"). DB tables remain as `flightpath_*` (Path A). API available at both `/api/governance-model/*` (canonical) and `/api/flightpath-*` (backward compat). Frontend uses `/api/governance-model/*` endpoints. Terminology config at `client/src/config/terminology.ts` with i18n foundation (EN/ES/PT).
- **Governance AI Coach:** Conversational chatbot powered by OpenAI, uses tenant's governance label in system prompt. Hook: `useGovernanceLabel()` from `client/src/hooks/use-governance-label.ts`.
- **Document Repository Integration:** Links to Google Drive for artifact management with AI-powered verification.
- **Team Composition:** Supports role-based assignments for opportunities and required team members for projects, with a "Sync from Estimate" feature.
- **Resource Allocation:** Matrix view for team members' weekly hours.
- **Configurable Fields:** User-configurable dropdown fields.
- **Branding & Theming:** Database-driven system for app name, logo, favicon, and color scheme.
- **Authentication:** Replit Auth via OpenID Connect with session storage.
- **RBAC Security System:** Two-layer access model with full server-side enforcement:
  - **Layer 1 — Security Roles:** Unlimited admin-configurable roles. Each role defines module access (sidebar visibility), action permissions (what users can do), and a `record.global_access` flag. Users assigned one or more roles; effective access = union of all. 9 seeded default roles: Global Admin, Org Admin, PMO Lead, Finance, Delivery Lead, Project Manager, Contributor, Timesheet Only, Member. Custom roles via Role Builder UI.
  - **Layer 2 — Record-Level Filtering:** Roles with `record.global_access` see all records. Non-global roles see only records assigned via `project_team_members` or `allocations`. User ↔ Team Member link (`team_members.userId`) is the bridge.
  - **Server-Side Enforcement:** `requireModuleAccess()` middleware on all write endpoints. `checkTimelineAccess()` on all timeline subresource endpoints (milestones, tasks, timesheets, progress, risks, checkpoints, gates, artifacts, EVM). Admin/RBAC endpoints require `module.admin`.
  - **Frontend Guards:** Sidebar module-gated via `/api/rbac/my-modules`. `ProtectedRoute` component wraps module routes. Access Denied page for unauthorized direct navigation.
  - **Admin UI Split:** Settings (`/admin/settings`) for app configuration. Security (`/admin/security`) with Roles, Users, Audit Log, Role Matrix tabs.
  - **Users Tab — List→Detail Pattern:** Clean summary table (Name, Email, Roles badges, Team Member, chevron). Clicking a row opens `UserDetailView` with Back button, avatar header, and two tabs: **Details** (editable demographics with inline edit mode + team member link/unlink) and **Roles** (role cards with remove + add role dropdown). Follows the same Back+Header+Tabs pattern as client-detail, team-member-detail, etc. Editing user demographics (first name, last name, email) auto-syncs to the linked team member record via `PATCH /api/rbac/users/:userId`.
  - **Auto-Role Assignment:** New users auto-assigned "Member" role (or "Global Admin" if first user ever). Auto-links team member by email match on first login.
  - **Team Member ↔ User Linking:** Admin can link/unlink team members to users from Security > Users detail view. API: `POST /api/rbac/users/:userId/link-team-member` and `/unlink-team-member`.
  - **Permission Cache:** 10-second TTL with explicit invalidation on role changes via API.
  - Audit logging for sensitive actions.
- **Multi-Tenancy Architecture:**
  - `tenants` table: id, name, slug (unique), status (active/suspended/trial), plan (free/pro/enterprise), maxUsers, maxProjects, storageLimit, billingEmail, timestamps.
  - All 20+ core tables have `tenantId` column (default "default"). `app_settings` and `branding_config` have `UNIQUE(tenant_id)` constraints for tenant isolation.
  - `server/middleware/tenant.ts`: Derives `req.tenantId` from session → header → user_org_roles DB lookup → fallback "default".
  - Storage layer methods accept optional `tenantId` for list queries (getClients, getTimelines, getTeamMembers, getRateCards, getAllContacts, getAllAllAllocations). `getSettings()`, `updateSettings()`, `getBranding()`, `updateBranding()` accept `tenantId`.
  - All route handlers pass `req.tenantId` to storage/rbac calls — no hardcoded "default" in routes.
  - Performance indexes on 13 key query patterns (timeline tenant+client, tasks timeline, timesheets, progress, EVM, etc.).
- **Tenant Provisioning Pipeline:**
  - `server/tenant-provisioning.ts`: `provisionTenant(tenantId, creatorUserId)` automatically called after `POST /api/global-admin/tenants`.
  - Seeds: RBAC system roles + permissions, governance stages + deliverables, app settings, branding config.
  - Assigns creator as Global Admin in the new tenant.
  - Idempotent: checks for existing roles before inserting (safe to retry on partial failures). Uses `onConflictDoNothing()` for permissions and role-permission mappings.
  - New tenants are immediately functional after creation — no manual setup required.
- **Super Admin & Global Admin Console:**
  - `users.isSuperAdmin` boolean — first user auto-promoted.
  - `server/middleware/superadmin.ts`: Blocks non-super-admins from global admin endpoints.
  - API: `GET/POST/PATCH/DELETE /api/global-admin/tenants`, `/tenants/:id/usage`, `/tenants/:id/users`, `/api/global-admin/stats`, `/api/global-admin/check`.
  - UI: `/global-admin` page with Tenants tab (list→detail, create dialog, edit inline, suspend) and System tab (aggregate stats).
  - Sidebar: "Super Admin" section with "Global Admin" link, visible only to super admins (via `/api/global-admin/check`).
  - Tenant switching: `POST /api/tenant/switch`, `GET /api/tenant/current`, `GET /api/tenant/my-tenants`.

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
- **OpenAI (via Replit AI Integrations):** Powers Governance AI Coach and Gate Evaluator (model: gpt-5.2).
- **Google Drive (via Replit Connector):** For artifact management.