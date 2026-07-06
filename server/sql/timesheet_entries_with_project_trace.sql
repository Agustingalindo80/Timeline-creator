-- Reporting view for ClickUp -> Atlas timesheet import traceability.
-- drizzle-kit push does not manage raw views, so this is applied manually:
--   psql "$DATABASE_URL" -f server/sql/timesheet_entries_with_project_trace.sql
-- Idempotent: safe to re-run (CREATE OR REPLACE VIEW).

CREATE OR REPLACE VIEW timesheet_entries_with_project_trace AS
SELECT
  te.id          AS timesheet_entry_id,
  te.tenant_id,
  te.timeline_id,
  tl.title       AS timeline_name,
  te.team_member_id,
  tm.name        AS team_member_name,
  te.task_id,
  t.title        AS task_title,
  te.week_ending,
  te.day_date,
  te.hours,
  te.billable_type,
  te.notes,
  te.created_at,
  te.updated_at
FROM timesheet_entries te
JOIN timelines tl ON tl.id = te.timeline_id
LEFT JOIN team_members tm ON tm.id = te.team_member_id
LEFT JOIN tasks t ON t.id = te.task_id;
