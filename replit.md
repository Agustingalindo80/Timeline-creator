# Project High Level Planning

## Overview
A visual project planning tool that supports two input methods:
1. **Manual creation** - Add stages/milestones one by one with title, date, and description
2. **Excel import** - Upload .xlsx, .xls, or .csv files to bulk-import milestones

## Tech Stack
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + TanStack React Query
- Backend: Express.js + Node.js
- Database: PostgreSQL with Drizzle ORM
- File parsing: xlsx library for Excel/CSV import
- Routing: wouter

## App Navigation
- Left sidebar (shadcn Sidebar) with: Dashboard, Projects, Clients, Settings
- Dashboard: placeholder page at `/` (content TBD)
- Projects: list view at `/projects` showing all projects with health indicators
- Clients: list view at `/clients` showing all clients; detail view at `/clients/:id` with demographic info and projects tab
- Settings: admin console at `/admin` with feature toggles and field options
- Theme toggle in sidebar footer

## Project Structure
- `client/src/App.tsx` - Root layout with sidebar, routing
- `client/src/components/app-sidebar.tsx` - Left navigation sidebar
- `client/src/pages/dashboard.tsx` - Dashboard placeholder page
- `client/src/pages/home.tsx` - Projects list view at /projects
- `client/src/pages/create-timeline.tsx` - Create project with manual entry or Excel import
- `client/src/pages/timeline-detail.tsx` - View project with vertical/horizontal views, manage milestones
- `client/src/pages/clients.tsx` - Clients list page
- `client/src/pages/client-detail.tsx` - Client detail with demographics and projects tab
- `client/src/pages/admin.tsx` - Settings page with feature toggles
- `client/src/components/timeline-view.tsx` - Timeline visualization components (vertical + horizontal)
- `client/src/components/risk-register.tsx` - Risk register component for project risk tracking
- `client/src/components/theme-provider.tsx` - Dark/light mode provider
- `server/routes.ts` - API routes for clients, timelines, milestones, risks, settings, and Excel parsing
- `server/migrate-clients.ts` - One-time migration of legacy client text fields to clients table
- `server/storage.ts` - Database storage layer using Drizzle
- `server/db.ts` - Database connection
- `server/seed.ts` - Seed data for demo projects
- `shared/schema.ts` - Drizzle schema + Zod types

## API Routes
- GET /api/clients - List all clients
- GET /api/clients/:id - Get single client with associated projects
- POST /api/clients - Create client
- PATCH /api/clients/:id - Update client
- DELETE /api/clients/:id - Delete client (unlinks projects, deletes contacts)
- GET /api/clients/:clientId/contacts - Get contacts for client
- POST /api/clients/:clientId/contacts - Create contact
- PATCH /api/contacts/:id - Update contact
- DELETE /api/contacts/:id - Delete contact
- GET /api/timelines - List all projects with milestones and tasks
- GET /api/timelines/:id - Get single project
- POST /api/timelines - Create project with milestones
- PATCH /api/timelines/:id - Update project (title, description, color, health fields)
- DELETE /api/timelines/:id - Delete project
- POST /api/timelines/:id/milestones - Add milestone
- PATCH /api/milestones/:id - Update milestone
- DELETE /api/milestones/:id - Delete milestone
- POST /api/timelines/:id/tasks - Add task
- PATCH /api/tasks/:id - Update task
- DELETE /api/tasks/:id - Delete task
- GET /api/timelines/:id/risks - Get risks for project
- POST /api/timelines/:id/risks - Add risk
- PATCH /api/risks/:id - Update risk
- DELETE /api/risks/:id - Delete risk
- GET /api/settings - Get app settings
- PATCH /api/settings - Update app settings
- POST /api/parse-excel - Parse Excel/CSV file (multipart form)

## Database
- clients: id, name, industry, contactName, contactEmail, contactPhone, website, address, notes, status
- contacts: id, clientId (FK to clients), firstName, lastName, email, phone, role, isLegalRepresentative
- timelines: id, title, description, color, healthOverall, scopeHealth, budgetHealth, teamHealth, projectType, engagementModel, client (legacy), clientId (FK to clients), approvedBudget, grossMargin
- milestones: id, timelineId, title, description, date, actualDate, color, icon, sortOrder
- tasks: id, timelineId, title, description, startDate, endDate, actualStartDate, actualEndDate, percentComplete, color, sortOrder, status, health, itemType, parentTaskId
- risks: id, timelineId, title, description, category, owner, probability, impact, mitigation, contingency, status, dueDate, sortOrder
- app_settings: id, riskRegisterEnabled, taskStatuses, taskHealthOptions, taskItemTypes, riskProbabilities, riskImpacts, riskStatuses, projectTypes, engagementModels, clients

## Features
- Project Type: classification field (Billable / Non-Billable by default), editable on detail page, shown as badge on project list
- Engagement Model: classification field (Fixed Bid / T&M / Managed Capacity by default), editable on detail page, shown as badge on project list
- Client: first-class entity with own table, demographics (name, industry, contact, phone, website, address, notes, status), linked to projects via clientId FK; editable on project detail page and projects list; client detail page shows projects tab
- Approved Budget: currency field (numeric with $ prefix), editable inline on detail page
- Gross Margin: percentage field (manual entry, numeric with % suffix), editable inline on detail page
- Project Health: 4 health fields per project (Overall, Scope, Budget, Team Composition)
  - Uses same options as Task Health (Green/Amber/Red by default)
  - Displayed as colored dots on project list cards
  - Editable inline on project detail page in a "Health" section
  - Labels shown without the word "Health" (Overall, Scope, Budget, Team Composition)
- Milestones: point-in-time events shown as dots on the timeline
- Tasks: duration-based items shown as horizontal bars in Gantt section below milestones
  - Status: Not Started, In Progress, Complete
  - Health: Green, Amber, Red (traffic light indicators)
  - Item Type: Workstream (current task) or Phase (parent of workstream)
  - parentTaskId: optional link to a Phase task for hierarchy
- Planned vs Actual: milestones have optional actualDate; tasks have optional actualStartDate/actualEndDate
  - Visual: planned bars shown as dashed outline, actual bars as solid; milestones show ring (planned) + filled dot (actual)
  - Legend shown when any actual dates are present
- Progress tracking: tasks have percentComplete (0-100) shown as fill on bars
- Filter toggle: "All" shows milestones + tasks, "Milestones Only" hides tasks for clean roadmap exports
- Export: PNG and PDF downloads via html2canvas + jspdf
- Themes: 12 named color themes for projects
- Project cards: show milestone count, task count, health indicators, and overall weighted completion %
  - Completion = weighted average of task percentComplete, weighted by task duration (months)
- Risk Register: optional feature (toggled in Settings)
  - Fields: title, description, category, owner, probability (Low/Medium/High/Very High), impact, mitigation, contingency, status (Open/Mitigated/Closed/Accepted), dueDate
  - Risk score = probability × impact (1-16 scale)
  - Expandable cards with edit/delete
- Settings: /admin page with feature toggles and field option management
  - Risk Register toggle (on/off)
  - Field Options: customizable dropdown values for all list-based fields
    - Task Status, Task Health, Task Item Type
    - Risk Probability, Risk Impact, Risk Status
    - Project Type, Engagement Model, Client
    - Each field supports add, remove, rename, reorder, and reset to defaults
    - Stored as JSONB in app_settings table; falls back to defaults when null
