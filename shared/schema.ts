import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const fieldOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});
export type FieldOption = z.infer<typeof fieldOptionSchema>;

export const DEFAULT_TASK_STATUSES: FieldOption[] = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "complete", label: "Complete" },
];
export const DEFAULT_TASK_HEALTH: FieldOption[] = [
  { value: "green", label: "Green" },
  { value: "amber", label: "Amber" },
  { value: "red", label: "Red" },
];
export const DEFAULT_TASK_ITEM_TYPES: FieldOption[] = [
  { value: "workstream", label: "Workstream" },
  { value: "phase", label: "Phase" },
];
export const DEFAULT_RISK_PROBABILITIES: FieldOption[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "very_high", label: "Very High" },
];
export const DEFAULT_RISK_IMPACTS: FieldOption[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "very_high", label: "Very High" },
];
export const DEFAULT_RISK_STATUSES: FieldOption[] = [
  { value: "open", label: "Open" },
  { value: "mitigated", label: "Mitigated" },
  { value: "closed", label: "Closed" },
  { value: "accepted", label: "Accepted" },
];

export const timelines = pgTable("timelines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#2563eb"),
  healthOverall: text("health_overall").notNull().default("green"),
  scopeHealth: text("scope_health").notNull().default("green"),
  budgetHealth: text("budget_health").notNull().default("green"),
  teamHealth: text("team_health").notNull().default("green"),
});

export const milestones = pgTable("milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  date: text("date").notNull(),
  actualDate: text("actual_date"),
  color: text("color"),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  actualStartDate: text("actual_start_date"),
  actualEndDate: text("actual_end_date"),
  color: text("color"),
  percentComplete: integer("percent_complete").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  status: text("status").notNull().default("not_started"),
  health: text("health").notNull().default("green"),
  itemType: text("item_type").notNull().default("workstream"),
  parentTaskId: varchar("parent_task_id"),
});

export const risks = pgTable("risks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  owner: text("owner"),
  probability: text("probability").notNull().default("medium"),
  impact: text("impact").notNull().default("medium"),
  mitigation: text("mitigation"),
  contingency: text("contingency"),
  status: text("status").notNull().default("open"),
  dueDate: text("due_date"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default("app"),
  riskRegisterEnabled: boolean("risk_register_enabled").notNull().default(false),
  taskStatuses: jsonb("task_statuses").$type<FieldOption[]>(),
  taskHealthOptions: jsonb("task_health_options").$type<FieldOption[]>(),
  taskItemTypes: jsonb("task_item_types").$type<FieldOption[]>(),
  riskProbabilities: jsonb("risk_probabilities").$type<FieldOption[]>(),
  riskImpacts: jsonb("risk_impacts").$type<FieldOption[]>(),
  riskStatuses: jsonb("risk_statuses").$type<FieldOption[]>(),
});

export const insertTimelineSchema = createInsertSchema(timelines).omit({ id: true });
export const insertMilestoneSchema = createInsertSchema(milestones).omit({ id: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true }).extend({
  status: z.string().default("not_started"),
  health: z.string().default("green"),
  itemType: z.string().default("workstream"),
});
export const insertRiskSchema = createInsertSchema(risks).omit({ id: true }).extend({
  probability: z.string().default("medium"),
  impact: z.string().default("medium"),
  status: z.string().default("open"),
});

export type InsertTimeline = z.infer<typeof insertTimelineSchema>;
export type Timeline = typeof timelines.$inferSelect;
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type Milestone = typeof milestones.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertRisk = z.infer<typeof insertRiskSchema>;
export type Risk = typeof risks.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;

export type TimelineWithMilestones = Timeline & { milestones: Milestone[]; tasks: Task[] };
export type TimelineWithAll = TimelineWithMilestones & { risks: Risk[] };
