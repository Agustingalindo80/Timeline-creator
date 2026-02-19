# Timeline Studio

## Overview
A visual timeline creation tool that supports two input methods:
1. **Manual creation** - Add stages/milestones one by one with title, date, and description
2. **Excel import** - Upload .xlsx, .xls, or .csv files to bulk-import milestones

## Tech Stack
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + TanStack React Query
- Backend: Express.js + Node.js
- Database: PostgreSQL with Drizzle ORM
- File parsing: xlsx library for Excel/CSV import
- Routing: wouter

## Project Structure
- `client/src/pages/home.tsx` - Home page listing all timelines
- `client/src/pages/create-timeline.tsx` - Create timeline with manual entry or Excel import
- `client/src/pages/timeline-detail.tsx` - View timeline with vertical/horizontal views, manage milestones
- `client/src/components/timeline-view.tsx` - Timeline visualization components (vertical + horizontal)
- `client/src/components/theme-provider.tsx` - Dark/light mode provider
- `server/routes.ts` - API routes for timelines, milestones, and Excel parsing
- `server/storage.ts` - Database storage layer using Drizzle
- `server/db.ts` - Database connection
- `server/seed.ts` - Seed data for demo timelines
- `shared/schema.ts` - Drizzle schema + Zod types

## API Routes
- GET /api/timelines - List all timelines with milestones
- GET /api/timelines/:id - Get single timeline
- POST /api/timelines - Create timeline with milestones
- PATCH /api/timelines/:id - Update timeline
- DELETE /api/timelines/:id - Delete timeline
- POST /api/timelines/:id/milestones - Add milestone
- DELETE /api/milestones/:id - Delete milestone
- POST /api/parse-excel - Parse Excel/CSV file (multipart form)

## Database
- timelines: id, title, description, color
- milestones: id, timelineId, title, description, date, color, icon, sortOrder
