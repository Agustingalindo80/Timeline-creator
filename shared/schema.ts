import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, jsonb, numeric, timestamp, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export * from "./models/auth";
export * from "./models/chat";
export * from "./models/rbac";

export const tenants = pgTable("tenants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  status: text("status").notNull().default("active"),
  plan: text("plan").notNull().default("free"),
  maxUsers: integer("max_users").notNull().default(10),
  maxProjects: integer("max_projects").notNull().default(25),
  storageLimit: integer("storage_limit").notNull().default(1024),
  billingEmail: text("billing_email"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by"),
});

export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Tenant = typeof tenants.$inferSelect;

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
export const DEFAULT_DATE_FORMATS: FieldOption[] = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
  { value: "Month DD, YYYY", label: "Month DD, YYYY" },
];

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  name: text("name").notNull(),
  industry: text("industry"),
  contactPhone: text("contact_phone"),
  website: text("website"),
  address: text("address"),
  notes: text("notes"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  role: text("role"),
  isLegalRepresentative: boolean("is_legal_representative").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("contacts_client_email_uniq").on(table.clientId, table.email),
]);

export const timelines = pgTable("timelines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
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
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "set null" }),
  approvedBudget: numeric("approved_budget", { precision: 12, scale: 2 }),
  totalRunningCost: numeric("total_running_cost", { precision: 12, scale: 2 }),
  grossMargin: numeric("gross_margin", { precision: 5, scale: 2 }),
  projectStatus: text("project_status").notNull().default("not_started"),
  region: text("region"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  dateFormat: text("date_format"),
  flightpathStageId: varchar("flightpath_stage_id").references(() => flightpathStages.id, { onDelete: "set null" }),
  docRepositoryType: text("doc_repository_type"),
  docRepositoryUrl: text("doc_repository_url"),
  docRepositoryFolderId: text("doc_repository_folder_id"),
  recordType: text("record_type").notNull().default("project"),
  estimatedRevenue: numeric("estimated_revenue", { precision: 12, scale: 2 }),
  riskFactorPercent: numeric("risk_factor_percent", { precision: 5, scale: 2 }),
  bufferPercent: numeric("buffer_percent", { precision: 5, scale: 2 }),
  opportunityStatus: text("opportunity_status"),
  sourceOpportunityId: varchar("source_opportunity_id"),
  convertedAt: text("converted_at"),
  salesforceClouds: text("salesforce_clouds"),
  currency: text("currency").notNull().default("USD"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by"),
}, (table) => [
  index("idx_timelines_tenant_client").on(table.tenantId, table.clientId),
  index("idx_timelines_tenant_record").on(table.tenantId, table.recordType),
]);

export const milestones = pgTable("milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  date: text("date").notNull(),
  actualDate: text("actual_date"),
  color: text("color"),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  isFinancialObligation: boolean("is_financial_obligation").notNull().default(false),
  amount: numeric("amount", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by"),
}, (table) => [
  index("idx_milestones_timeline").on(table.timelineId, table.sortOrder),
]);

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  actualStartDate: text("actual_start_date"),
  actualEndDate: text("actual_end_date"),
  color: text("color"),
  percentComplete: integer("percent_complete").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  status: text("status").notNull().default("not_started"),
  health: text("health").notNull().default("green"),
  itemType: text("item_type").notNull().default("workstream"),
  parentTaskId: varchar("parent_task_id").references((): any => tasks.id, { onDelete: "cascade" }),
  estimatedHours: numeric("estimated_hours", { precision: 8, scale: 2 }),
  confidenceLevel: text("confidence_level"),
  taskType: text("task_type"),
  assignedRoleId: varchar("assigned_role_id"),
  durationWeeks: numeric("duration_weeks", { precision: 5, scale: 1 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by"),
}, (table) => [
  index("idx_tasks_timeline").on(table.timelineId, table.parentTaskId, table.sortOrder),
]);

export const risks = pgTable("risks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
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
  itemType: text("item_type").notNull().default("risk"),
  raisedDate: text("raised_date"),
  resolvedDate: text("resolved_date"),
  relatedStageId: varchar("related_stage_id"),
  validationCriteria: text("validation_criteria"),
  validatedDate: text("validated_date"),
  dependencySource: text("dependency_source"),
  requiredByDate: text("required_by_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by"),
}, (table) => [
  index("idx_risks_timeline").on(table.timelineId),
]);

export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role"),
  department: text("department"),
  monthlyCost: numeric("monthly_cost", { precision: 10, scale: 2 }),
  hourlyCost: numeric("hourly_cost", { precision: 10, scale: 2 }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const rateCards = pgTable("rate_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  name: text("name").notNull(),
  role: text("role"),
  region: text("region"),
  costRate: numeric("cost_rate", { precision: 10, scale: 2 }),
  billRate: numeric("bill_rate", { precision: 10, scale: 2 }),
  currency: text("currency").notNull().default("USD"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projectTeamMembers = pgTable("project_team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  teamMemberId: varchar("team_member_id").references(() => teamMembers.id, { onDelete: "cascade" }),
  rateCardId: varchar("rate_card_id").references(() => rateCards.id),
  monthlyCost: numeric("monthly_cost", { precision: 10, scale: 2 }),
  hourlyCost: numeric("hourly_cost", { precision: 10, scale: 2 }),
  allocation: integer("allocation").notNull().default(100),
  startDate: text("start_date"),
  endDate: text("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_ptm_timeline").on(table.timelineId),
  index("idx_ptm_member").on(table.teamMemberId),
]);

export const allocations = pgTable("allocations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  weeklyHours: numeric("weekly_hours", { precision: 5, scale: 1 }),
  startDate: text("start_date"),
  endDate: text("end_date"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_alloc_member_timeline").on(table.teamMemberId, table.timelineId),
]);

export const workstreamResources = pgTable("workstream_resources", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  rateCardId: varchar("rate_card_id").notNull().references(() => rateCards.id),
  teamMemberId: varchar("team_member_id").references(() => teamMembers.id),
  hoursPerWeek: numeric("hours_per_week", { precision: 5, scale: 1 }).notNull(),
  taskType: text("task_type"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  id: varchar("id").primaryKey().default("app"),
  tenantId: text("tenant_id").notNull().default("default"),
  riskRegisterEnabled: boolean("risk_register_enabled").notNull().default(false),
  opportunitiesEnabled: boolean("opportunities_enabled").notNull().default(true),
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
  dateFormats: jsonb("date_formats").$type<FieldOption[]>(),
  rbacMigrated: boolean("rbac_migrated").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const brandingConfig = pgTable("branding_config", {
  id: varchar("id").primaryKey().default("default"),
  tenantId: text("tenant_id").notNull().default("default"),
  appName: text("app_name").notNull().default("Project High Level Planning"),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  primaryColor: text("primary_color"),
  sidebarColor: text("sidebar_color"),
  sidebarForegroundColor: text("sidebar_foreground_color"),
  sidebarAccentColor: text("sidebar_accent_color"),
  accentColor: text("accent_color"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const timesheetEntries = pgTable("timesheet_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  teamMemberId: varchar("team_member_id").notNull().references(() => teamMembers.id, { onDelete: "cascade" }),
  taskId: varchar("task_id").references(() => tasks.id, { onDelete: "set null" }),
  weekEnding: text("week_ending").notNull(),
  dayDate: text("day_date"),
  hours: numeric("hours", { precision: 6, scale: 2 }).notNull(),
  billableType: text("billable_type").notNull().default("billable"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_timesheet_timeline_week").on(table.timelineId, table.weekEnding),
  index("idx_timesheet_member").on(table.teamMemberId),
]);

export const progressEntries = pgTable("progress_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  weekEnding: text("week_ending").notNull(),
  percentComplete: integer("percent_complete").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("progress_timeline_task_week_uniq").on(table.timelineId, table.taskId, table.weekEnding),
  index("idx_progress_timeline_week").on(table.timelineId, table.weekEnding),
]);

export type EvmWorkstreamBreakdownItem = {
  taskId: string;
  taskTitle: string;
  phaseTitle: string | null;
  percentComplete: number;
  budget: number;
  ev: number;
};

export const evmSnapshots = pgTable("evm_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  weekEnding: text("week_ending").notNull(),
  version: integer("version").notNull().default(1),
  isCurrent: boolean("is_current").notNull().default(true),
  mode: text("mode").notNull().default("manual_freeze"),
  bac: numeric("bac", { precision: 12, scale: 2 }),
  plannedValue: numeric("planned_value", { precision: 12, scale: 2 }),
  actualCost: numeric("actual_cost", { precision: 12, scale: 2 }),
  earnedValue: numeric("earned_value", { precision: 12, scale: 2 }),
  scheduleVariance: numeric("schedule_variance", { precision: 12, scale: 2 }),
  costVariance: numeric("cost_variance", { precision: 12, scale: 2 }),
  spiValue: numeric("spi_value", { precision: 6, scale: 4 }),
  cpiValue: numeric("cpi_value", { precision: 6, scale: 4 }),
  eacValue: numeric("eac_value", { precision: 12, scale: 2 }),
  etcValue: numeric("etc_value", { precision: 12, scale: 2 }),
  vacValue: numeric("vac_value", { precision: 12, scale: 2 }),
  weeklyPv: numeric("weekly_pv", { precision: 12, scale: 2 }),
  weeklyAc: numeric("weekly_ac", { precision: 12, scale: 2 }),
  weeklyEv: numeric("weekly_ev", { precision: 12, scale: 2 }),
  workstreamBreakdown: jsonb("workstream_breakdown").$type<EvmWorkstreamBreakdownItem[]>(),
  inputsHash: text("inputs_hash"),
  notes: text("notes"),
  generatedBy: varchar("generated_by"),
  generatedAt: text("generated_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("evm_tenant_timeline_week_version_uniq").on(table.tenantId, table.timelineId, table.weekEnding, table.version),
  index("idx_evm_timeline_week").on(table.tenantId, table.timelineId, table.weekEnding),
]);

export const flightpathStages = pgTable("flightpath_stages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  stageNumber: integer("stage_number").notNull(),
  name: text("name").notNull(),
  goal: text("goal").notNull(),
  description: text("description"),
  gateName: text("gate_name").notNull(),
  gateDescription: text("gate_description"),
  playbookPurpose: text("playbook_purpose"),
  playbookExitBundle: text("playbook_exit_bundle"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const flightpathDeliverables = pgTable("flightpath_deliverables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  stageId: varchar("stage_id").notNull().references(() => flightpathStages.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  raciData: jsonb("raci_data").$type<Record<string, string>>(),
  sortOrder: integer("sort_order").notNull().default(0),
  expectedArtifactName: text("expected_artifact_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const projectCheckpoints = pgTable("project_checkpoints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  stageId: varchar("stage_id").notNull().references(() => flightpathStages.id, { onDelete: "cascade" }),
  deliverableId: varchar("deliverable_id").references(() => flightpathDeliverables.id, { onDelete: "set null" }),
  checkpointName: text("checkpoint_name").notNull(),
  optional: boolean("optional").notNull().default(false),
  completed: boolean("completed").notNull().default(false),
  completedAt: text("completed_at"),
  completedBy: text("completed_by"),
  notes: text("notes"),
  artifactUrl: text("artifact_url"),
  artifactFileId: text("artifact_file_id"),
  artifactFileName: text("artifact_file_name"),
  artifactVerified: boolean("artifact_verified").notNull().default(false),
  artifactVerifiedAt: text("artifact_verified_at"),
  artifactSummary: text("artifact_summary"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by"),
}, (table) => [
  unique("checkpoint_timeline_stage_deliverable_uniq").on(table.timelineId, table.stageId, table.deliverableId),
  index("idx_checkpoint_timeline_stage").on(table.timelineId, table.stageId),
]);

export const projectGates = pgTable("project_gates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  stageId: varchar("stage_id").notNull().references(() => flightpathStages.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  approvedAt: text("approved_at"),
  approvedBy: text("approved_by"),
  notes: text("notes"),
  evaluatorResult: jsonb("evaluator_result").$type<{
    status: string;
    completionPercentage: number;
    missingItems: string[];
    raidFlags: string[];
    evmFlags: string[];
    recommendations: string[];
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by"),
}, (table) => [
  unique("gate_timeline_stage_uniq").on(table.timelineId, table.stageId),
]);

export const insertFlightpathStageSchema = createInsertSchema(flightpathStages).omit({ id: true });
export const insertFlightpathDeliverableSchema = createInsertSchema(flightpathDeliverables).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectCheckpointSchema = createInsertSchema(projectCheckpoints).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectGateSchema = createInsertSchema(projectGates).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertFlightpathStage = z.infer<typeof insertFlightpathStageSchema>;
export type FlightpathStage = typeof flightpathStages.$inferSelect;
export type InsertFlightpathDeliverable = z.infer<typeof insertFlightpathDeliverableSchema>;
export type FlightpathDeliverable = typeof flightpathDeliverables.$inferSelect;
export type InsertProjectCheckpoint = z.infer<typeof insertProjectCheckpointSchema>;
export type ProjectCheckpoint = typeof projectCheckpoints.$inferSelect;
export type InsertProjectGate = z.infer<typeof insertProjectGateSchema>;
export type ProjectGate = typeof projectGates.$inferSelect;

export const insertEvmSnapshotSchema = createInsertSchema(evmSnapshots).omit({ id: true, createdAt: true });
export type InsertEvmSnapshot = z.infer<typeof insertEvmSnapshotSchema>;
export type EvmSnapshot = typeof evmSnapshots.$inferSelect;

export const insertWorkstreamResourceSchema = createInsertSchema(workstreamResources).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  hoursPerWeek: z.string().refine((val) => {
    const n = parseFloat(val);
    return !isNaN(n) && n >= 0;
  }, { message: "Hours per week must be 0 or greater" }),
});

export const insertBrandingSchema = createInsertSchema(brandingConfig).omit({ id: true, updatedAt: true });
export type InsertBranding = z.infer<typeof insertBrandingSchema>;
export type BrandingConfig = typeof brandingConfig.$inferSelect;

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTimelineSchema = createInsertSchema(timelines).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  grossMargin: z.string().refine((val) => {
    const n = parseFloat(val);
    return !isNaN(n) && n >= 0 && n <= 100;
  }, { message: "Gross margin must be between 0 and 100" }).optional().nullable(),
});
export const insertMilestoneSchema = createInsertSchema(milestones).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  status: z.string().default("not_started"),
  health: z.string().default("green"),
  itemType: z.string().default("workstream"),
  percentComplete: z.number().min(0).max(100).default(0),
});
export const insertRiskSchema = createInsertSchema(risks).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  probability: z.string().default("medium"),
  impact: z.string().default("medium"),
  status: z.string().default("open"),
});
export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRateCardSchema = createInsertSchema(rateCards).omit({ id: true, createdAt: true, updatedAt: true });
export const insertProjectTeamMemberSchema = createInsertSchema(projectTeamMembers).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  allocation: z.number().min(0).max(100).default(100),
});
export const insertAllocationSchema = createInsertSchema(allocations).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  weeklyHours: z.string().refine((val) => {
    const n = parseFloat(val);
    return !isNaN(n) && n >= 0;
  }, { message: "Weekly hours must be 0 or greater" }).optional(),
});
export const insertTimesheetEntrySchema = createInsertSchema(timesheetEntries).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  hours: z.string().refine((val) => {
    const n = parseFloat(val);
    return !isNaN(n) && n >= 0 && n <= 24;
  }, { message: "Hours must be between 0 and 24" }),
});
export const insertProgressEntrySchema = createInsertSchema(progressEntries).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  percentComplete: z.number().min(0).max(100).default(0),
});

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
export type AllocationWithTeamMember = Allocation & { teamMember: TeamMember };
export type AllocationFull = Allocation & { teamMember: TeamMember; project: Timeline };
export type InsertWorkstreamResource = z.infer<typeof insertWorkstreamResourceSchema>;
export type WorkstreamResource = typeof workstreamResources.$inferSelect;
export type InsertTimesheetEntry = z.infer<typeof insertTimesheetEntrySchema>;
export type TimesheetEntry = typeof timesheetEntries.$inferSelect;
export type InsertProgressEntry = z.infer<typeof insertProgressEntrySchema>;
export type ProgressEntry = typeof progressEntries.$inferSelect;
export type AppSettings = typeof appSettings.$inferSelect;

export type TimesheetEntryWithDetails = TimesheetEntry & { teamMember: TeamMember; task: Task | null };
export type ProjectTeamMemberWithDetails = ProjectTeamMember & { teamMember: TeamMember | null; rateCard: RateCard | null };
export type TimelineWithMilestones = Timeline & { milestones: Milestone[]; tasks: Task[] };
export type TimelineWithAll = TimelineWithMilestones & { risks: Risk[] };
export type ClientWithProjects = Client & { projects: TimelineWithMilestones[]; contacts: Contact[] };
