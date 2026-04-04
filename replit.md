# Project High Level Planning

## Overview
This project is a visual project planning tool designed to streamline project management. It supports manual and bulk input for stages and milestones, enabling comprehensive management of projects, clients, team members, and resource allocations. Key features include tracking project health, financial aspects, RAID management, and stage-gated governance with AI-powered coaching. The goal is to provide an intuitive platform for efficient project planning, execution, and monitoring, enhancing transparency and decision-making for project managers. The business vision is to provide a robust platform for project managers, improving project success rates and financial outcomes.

## User Preferences
I prefer iterative development with a focus on delivering core features first. Please ask for clarification if any requirements are unclear, especially regarding complex business logic or UI/UX interactions. I am open to suggestions for improvements but prefer to be consulted before major architectural changes or significant deviations from the outlined feature set.

## System Architecture
The application uses a modern web stack with React, Vite, Tailwind CSS, and shadcn/ui for the frontend, and Express.js on Node.js with PostgreSQL and Drizzle ORM for the backend.

**UI/UX Decisions:**
- Consistent left-hand sidebar navigation with module-permission-gated items. Sections: Workspace (Dashboard, Companies, Contacts, Opportunities, Projects, Reports), Help & Support (Governance Coach, User Guide), Operations (Team Members, Allocations, Timesheets), Administration (Settings, Security, About), Super Admin (Global Administration).
- Supports dark/light mode with an executive-grade dark-first design.
- Project visualizations include horizontal timeline views and Gantt-like bars.
- Health indicators use colored dots.
- Data tables support inline editing and CRUD operations with a Stripe-style aesthetic.
- Dynamic forms for project creation and detail management.
- Mission Control layout dashboard with metric cards and pipeline funnel bars.
- Detail pages feature KPI cards and inline edit mode.
- **Color Palette:** Executive-grade dark-first design with a primary blue (`#3B82F6`), slate-900 background for dark mode, and clean whites for light mode.

**Technical Implementations:**
- **Project Structure:** Clear separation of client-side and server-side code.
- **API Design:** RESTful endpoints for all entities.
- **Database Schema:** Detailed schemas for all project entities with `tenantId` for multi-tenancy and specific `pgEnum` constraints for status fields. Includes partial unique indexes and `ON DELETE SET NULL` for hierarchical data.
- **Financial Calculations:** Automated calculation of `Approved Budget`, `Total Running Cost`, and `Gross Margin`.
- **Project Health:** Four configurable health indicators.
- **Milestones & Tasks:** Milestones are point-in-time events; tasks are duration-based with hierarchical structure and progress tracking.
- **Resource-Based Estimation:** Workstreams use multi-resource assignments with rate cards from any region (multi-region selection), calculating estimated hours, cost, and revenue. Rate card dropdowns are grouped by region for clarity.
- **Timesheet Management:** Global page for tracking daily effort.
- **Progress Tracking:** Project-level tab for weekly % complete per workstream.
- **EVM Dashboard:** Project-level tab displaying Earned Value Management metrics with historical snapshot tracking, revision versioning, S-Curve, and CPI/SPI charts.
- **RAID Log:** Supports Risks, Assumptions, Issues, and Dependencies.
- **Reports Module:** Provides operational reports (Portfolio Health, Project Status, Milestone Tracker, RAID Summary) with CSV and PDF export, and server-side aggregation.
- **Opportunities Module:** Pre-sales entity with an Estimate tab and "Convert to Project" feature.
- **Estimate Template Import/Export:** Functionality for Excel template download and import.
- **Operating Model Governance Framework:** Fully configurable stage-gated governance engine. Tenant admins can add, edit, reorder, and delete stages and deliverables. Editable RACI matrices per deliverable with custom roles. Gate enforcement with AI-evaluated readiness criteria.
- **Governance AI Coach:** Conversational chatbot powered by OpenAI.
- **Document Repository Integration:** Links to Google Drive for artifact management with AI-powered verification.
- **Team Composition:** Supports role-based assignments and "Sync from Estimate" feature.
- **Resource Allocation:** Matrix view for team members' weekly hours.
- **Configurable Fields:** User-configurable dropdown fields.
- **Branding & Theming:** Database-driven system for app name, logo, favicon, and color scheme.
- **Authentication:** Replit Auth via OpenID Connect with session storage. Optional Bearer token authentication for external API integrations via `api_tokens` table (SHA-256 hashed, tenant-scoped, configurable expiration). Managed from Settings > API Tokens tab.
- **RBAC Security System:** Two-layer access model with server-side enforcement: configurable Security Roles and Record-Level Filtering based on assignments. Features include custom role builder, auto-role assignment, and user-team member linking.
- **Multi-Tenancy Architecture:** All core tables include `tenantId`. Tenant resolution from slug-based URLs with caching. Tenant-specific settings and branding.
- **Tenant Provisioning Pipeline:** Automates tenant creation, seeding RBAC, governance, app settings, and branding, including the initial tenant admin user.
- **Super Admin & Global Admin Console:** Dedicated interface for platform administration, tenant management, and system-wide statistics. Supports tenant switching.
- **Internationalization (i18n):** Uses `i18next` + `react-i18next` for EN, ES, PT. Locale is set per tenant at creation and influences UI translations, picklist defaults, and AI coach responses.
  - **Library:** Initialized in `client/src/i18n/i18n.ts`, imported in `client/src/main.tsx`.
  - **Translation files:** `client/src/i18n/{en,es,pt}.json` with ~300+ keys across namespaces: `nav.*`, `common.*`, `dashboard.*`, `clients.*`, `contacts.*`, `opportunities.*`, `projects.*`, `teamMembers.*`, `allocations.*`, `timesheets.*`, `settings.*`, `security.*`, `governance.*`, `reports.*`, `globalAdmin.*`, `accessDenied.*`, `health.*`, `status.*`, `about.*`.
  - **Terminology:** "Company/Companies" used everywhere in UI (not "Client/Clients"). DB/API routes still use `/clients` internally.
  - **Locale Selection:** Set by Super Admin at tenant creation only (immutable). Stored in `app_settings.locale`. Read-only display in tenant Settings > General.
  - **useLocale() Hook:** `client/src/hooks/use-locale.ts` reads `settings?.locale` and calls `i18n.changeLanguage()`. Called in `AuthenticatedApp` component.
  - **Pre-Translated Picklist Defaults:** `getDefaultFieldOptions(category, locale)` in `shared/schema.ts` returns locale-aware `FieldOption[]` for 12+ dropdown categories.
  - **Governance Terminology:** `shared/terminology.ts` provides `getTerm()`, `getGovernanceLabel()`, `getCoachLabel()` with locale support.
  - **Server-Side AI Coach:** Fetches tenant locale; uses localized governance label and instructs OpenAI to respond in the tenant's language.
  - **Tenant Provisioning:** `provisionTenant()` accepts `locale` parameter; stores in new tenant's `app_settings`.

**Multi-Tenancy Architecture:**
- All core tables include `tenantId` column for data isolation.
- Tenant resolution from slug-based URLs with in-memory caching.
- Tenant-specific settings, branding, and RBAC configuration.
- Sidebar: "Super Admin" section with "Global Admin" link, visible only to super admins. "TESTING MODE" badge shown when viewing a non-natural tenant.
- Tenant switching: `POST /api/tenant/switch`, `GET /api/tenant/current`, `GET /api/tenant/my-tenants`.
- Slug-based URL routing: `/t/:slug/*` pattern. Client-side uses wouter `Router` with dynamic `base` prop. API calls auto-prefixed via `queryClient.ts`. Server URL rewrite middleware strips `/t/:slug` prefix.

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
- **i18next + react-i18next:** Internationalization framework for UI string translation (EN/ES/PT).
