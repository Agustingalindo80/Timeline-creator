import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, jsonb, numeric } from "drizzle-orm/pg-core";
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
export const DEFAULT_PROJECT_TYPES: FieldOption[] = [
  { value: "billable", label: "Billable" },
  { value: "non_billable", label: "Non-Billable" },
];
export const DEFAULT_ENGAGEMENT_MODELS: FieldOption[] = [
  { value: "fixed_bid", label: "Fixed Bid" },
  { value: "t_and_m", label: "T&M" },
  { value: "managed_capacity", label: "Managed Capacity" },
];
export const DEFAULT_PROJECT_STATUSES: FieldOption[] = [
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];
export const DEFAULT_TEAM_MEMBER_ROLES: FieldOption[] = [
  { value: "solution_architect", label: "Solution Architect" },
  { value: "technical_architect", label: "Technical Architect" },
  { value: "project_manager", label: "Project Manager" },
  { value: "business_analyst", label: "Business Analyst" },
  { value: "senior_developer", label: "Senior Developer" },
  { value: "developer", label: "Developer" },
  { value: "qa_lead", label: "QA Lead" },
  { value: "qa_engineer", label: "QA Engineer" },
  { value: "data_migration_specialist", label: "Data Migration Specialist" },
  { value: "integration_specialist", label: "Integration Specialist" },
  { value: "admin_config_specialist", label: "Admin/Configuration Specialist" },
  { value: "change_management", label: "Change Management" },
  { value: "training_specialist", label: "Training Specialist" },
  { value: "release_manager", label: "Release Manager" },
];
export const DEFAULT_REGIONS: FieldOption[] = [
  { value: "us", label: "US" },
  { value: "latam", label: "LATAM" },
  { value: "caribe", label: "Caribe" },
];
export const DEFAULT_CLIENTS: FieldOption[] = [
  { value: "client_a", label: "Client A" },
  { value: "client_b", label: "Client B" },
];
export const DEFAULT_INDUSTRIES: FieldOption[] = [
  { value: "technology", label: "Technology" },
  { value: "healthcare", label: "Healthcare" },
  { value: "finance", label: "Finance" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "retail", label: "Retail" },
  { value: "education", label: "Education" },
  { value: "consulting", label: "Consulting" },
  { value: "government", label: "Government" },
];
export const DEFAULT_CONTACT_ROLES: FieldOption[] = [
  { value: "executive_sponsor", label: "Executive Sponsor" },
  { value: "project_manager", label: "Project Manager" },
  { value: "technical_lead", label: "Technical Lead" },
  { value: "stakeholder", label: "Stakeholder" },
  { value: "legal", label: "Legal" },
];

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  industry: text("industry"),
  contactPhone: text("contact_phone"),
  website: text("website"),
  address: text("address"),
  notes: text("notes"),
  status: text("status").notNull().default("active"),
});

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  role: text("role"),
  isLegalRepresentative: boolean("is_legal_representative").notNull().default(false),
});

export const timelines = pgTable("timelines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#2563eb"),
  healthOverall: text("health_overall").notNull().default("green"),
  scopeHealth: text("scope_health").notNull().default("green"),
  budgetHealth: text("budget_health").notNull().default("green"),
  teamHealth: text("team_health").notNull().default("green"),
  projectType: text("project_type"),
  engagementModel: text("engagement_model"),
  client: text("client"),
  clientId: varchar("client_id"),
  approvedBudget: numeric("approved_budget", { precision: 12, scale: 2 }),
  totalRunningCost: numeric("total_running_cost", { precision: 12, scale: 2 }),
  grossMargin: numeric("gross_margin", { precision: 5, scale: 2 }),
  projectStatus: text("project_status").notNull().default("not_started"),
  region: text("region"),
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

export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role"),
  department: text("department"),
  monthlyCost: numeric("monthly_cost", { precision: 10, scale: 2 }),
  hourlyCost: numeric("hourly_cost", { precision: 10, scale: 2 }),
});

export const rateCards = pgTable("rate_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  role: text("role"),
  region: text("region"),
  costRate: numeric("cost_rate", { precision: 10, scale: 2 }),
  billRate: numeric("bill_rate", { precision: 10, scale: 2 }),
});

export const projectTeamMembers = pgTable("project_team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
  rateCardId: varchar("rate_card_id").references(() => rateCards.id),
  monthlyCost: numeric("monthly_cost", { precision: 10, scale: 2 }),
  hourlyCost: numeric("hourly_cost", { precision: 10, scale: 2 }),
  allocation: integer("allocation").notNull().default(100),
  startDate: text("start_date"),
  endDate: text("end_date"),
});

export const allocations = pgTable("allocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  weeklyHours: numeric("weekly_hours", { precision: 5, scale: 1 }),
  startDate: text("start_date"),
  endDate: text("end_date"),
  notes: text("notes"),
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
  projectTypes: jsonb("project_types").$type<FieldOption[]>(),
  engagementModels: jsonb("engagement_models").$type<FieldOption[]>(),
  clients: jsonb("clients").$type<FieldOption[]>(),
  contactRoles: jsonb("contact_roles").$type<FieldOption[]>(),
  industries: jsonb("industries").$type<FieldOption[]>(),
  projectStatuses: jsonb("project_statuses").$type<FieldOption[]>(),
  teamMemberRoles: jsonb("team_member_roles").$type<FieldOption[]>(),
  regions: jsonb("regions").$type<FieldOption[]>(),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true });
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true });
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
export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({ id: true });
export const insertRateCardSchema = createInsertSchema(rateCards).omit({ id: true });
export const insertProjectTeamMemberSchema = createInsertSchema(projectTeamMembers).omit({ id: true });
export const insertAllocationSchema = createInsertSchema(allocations).omit({ id: true });

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertTimeline = z.infer<typeof insertTimelineSchema>;
export type Timeline = typeof timelines.$inferSelect;
export type InsertMilestone = z.infer<typeof insertMilestoneSchema>;
export type Milestone = typeof milestones.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;
export type InsertRisk = z.infer<typeof insertRiskSchema>;
export type Risk = typeof risks.$inferSelect;
export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;
export type InsertRateCard = z.infer<typeof insertRateCardSchema>;
export type RateCard = typeof rateCards.$inferSelect;
export type InsertProjectTeamMember = z.infer<typeof insertProjectTeamMemberSchema>;
export type ProjectTeamMember = typeof projectTeamMembers.$inferSelect;
export type InsertAllocation = z.infer<typeof insertAllocationSchema>;
export type Allocation = typeof allocations.$inferSelect;
export type AllocationWithProject = Allocation & { project: Timeline };
export type AppSettings = typeof appSettings.$inferSelect;

export type ProjectTeamMemberWithDetails = ProjectTeamMember & { teamMember: TeamMember; rateCard: RateCard | null };
export type TimelineWithMilestones = Timeline & { milestones: Milestone[]; tasks: Task[] };
export type TimelineWithAll = TimelineWithMilestones & { risks: Risk[] };
export type ClientWithProjects = Client & { projects: TimelineWithMilestones[]; contacts: Contact[] };
