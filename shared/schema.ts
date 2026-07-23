import { sql } from "drizzle-orm";
import { pgTable, pgEnum, text, varchar, integer, bigint, boolean, jsonb, numeric, timestamp, date, index, unique, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export * from "./models/auth";
export * from "./models/chat";
export * from "./models/rbac";

export const healthStatusEnum = pgEnum("health_status", ["green", "amber", "red"]);
export const recordTypeEnum = pgEnum("record_type", ["project", "opportunity"]);
export const projectStatusEnum = pgEnum("project_status", ["not_started", "in_progress", "completed"]);
export const taskStatusEnum = pgEnum("task_status", ["not_started", "in_progress", "complete"]);
export const taskItemTypeEnum = pgEnum("task_item_type", ["workstream", "phase"]);
export const gateStatusEnum = pgEnum("gate_status", ["pending", "in_review", "approved", "rejected", "failed", "passed", "exception", "exception_requested"]);
export const riskStatusEnum = pgEnum("risk_status", ["open", "mitigated", "closed", "accepted"]);

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

const LOCALIZED_DEFAULTS: Record<string, Record<string, FieldOption[]>> = {
  taskStatuses: {
    en: DEFAULT_TASK_STATUSES,
    es: [
      { value: "not_started", label: "No Iniciado" },
      { value: "in_progress", label: "En Progreso" },
      { value: "complete", label: "Completado" },
    ],
    pt: [
      { value: "not_started", label: "Não Iniciado" },
      { value: "in_progress", label: "Em Andamento" },
      { value: "complete", label: "Concluído" },
    ],
  },
  taskHealthOptions: {
    en: DEFAULT_TASK_HEALTH,
    es: [
      { value: "green", label: "Verde" },
      { value: "amber", label: "Ámbar" },
      { value: "red", label: "Rojo" },
    ],
    pt: [
      { value: "green", label: "Verde" },
      { value: "amber", label: "Âmbar" },
      { value: "red", label: "Vermelho" },
    ],
  },
  taskItemTypes: {
    en: DEFAULT_TASK_ITEM_TYPES,
    es: [
      { value: "workstream", label: "Flujo de Trabajo" },
      { value: "phase", label: "Fase" },
    ],
    pt: [
      { value: "workstream", label: "Fluxo de Trabalho" },
      { value: "phase", label: "Fase" },
    ],
  },
  riskProbabilities: {
    en: DEFAULT_RISK_PROBABILITIES,
    es: [
      { value: "low", label: "Bajo" },
      { value: "medium", label: "Medio" },
      { value: "high", label: "Alto" },
      { value: "very_high", label: "Muy Alto" },
    ],
    pt: [
      { value: "low", label: "Baixo" },
      { value: "medium", label: "Médio" },
      { value: "high", label: "Alto" },
      { value: "very_high", label: "Muito Alto" },
    ],
  },
  riskImpacts: {
    en: DEFAULT_RISK_IMPACTS,
    es: [
      { value: "low", label: "Bajo" },
      { value: "medium", label: "Medio" },
      { value: "high", label: "Alto" },
      { value: "very_high", label: "Muy Alto" },
    ],
    pt: [
      { value: "low", label: "Baixo" },
      { value: "medium", label: "Médio" },
      { value: "high", label: "Alto" },
      { value: "very_high", label: "Muito Alto" },
    ],
  },
  riskStatuses: {
    en: DEFAULT_RISK_STATUSES,
    es: [
      { value: "open", label: "Abierto" },
      { value: "mitigated", label: "Mitigado" },
      { value: "closed", label: "Cerrado" },
      { value: "accepted", label: "Aceptado" },
    ],
    pt: [
      { value: "open", label: "Aberto" },
      { value: "mitigated", label: "Mitigado" },
      { value: "closed", label: "Fechado" },
      { value: "accepted", label: "Aceito" },
    ],
  },
  projectTypes: {
    en: DEFAULT_PROJECT_TYPES,
    es: [
      { value: "billable", label: "Facturable" },
      { value: "non_billable", label: "No Facturable" },
    ],
    pt: [
      { value: "billable", label: "Faturável" },
      { value: "non_billable", label: "Não Faturável" },
    ],
  },
  engagementModels: {
    en: DEFAULT_ENGAGEMENT_MODELS,
    es: [
      { value: "fixed_bid", label: "Precio Fijo" },
      { value: "t_and_m", label: "T&M" },
      { value: "managed_capacity", label: "Capacidad Gestionada" },
    ],
    pt: [
      { value: "fixed_bid", label: "Preço Fixo" },
      { value: "t_and_m", label: "T&M" },
      { value: "managed_capacity", label: "Capacidade Gerenciada" },
    ],
  },
  projectStatuses: {
    en: DEFAULT_PROJECT_STATUSES,
    es: [
      { value: "not_started", label: "No Iniciado" },
      { value: "in_progress", label: "En Progreso" },
      { value: "completed", label: "Completado" },
    ],
    pt: [
      { value: "not_started", label: "Não Iniciado" },
      { value: "in_progress", label: "Em Andamento" },
      { value: "completed", label: "Concluído" },
    ],
  },
  teamMemberRoles: {
    en: DEFAULT_TEAM_MEMBER_ROLES,
    es: [
      { value: "solution_architect", label: "Arquitecto de Soluciones" },
      { value: "technical_architect", label: "Arquitecto Técnico" },
      { value: "project_manager", label: "Gerente de Proyecto" },
      { value: "business_analyst", label: "Analista de Negocios" },
      { value: "senior_developer", label: "Desarrollador Senior" },
      { value: "developer", label: "Desarrollador" },
      { value: "qa_lead", label: "Líder de QA" },
      { value: "qa_engineer", label: "Ingeniero de QA" },
      { value: "data_migration_specialist", label: "Especialista en Migración de Datos" },
      { value: "integration_specialist", label: "Especialista en Integración" },
      { value: "admin_config_specialist", label: "Especialista en Configuración" },
      { value: "change_management", label: "Gestión del Cambio" },
      { value: "training_specialist", label: "Especialista en Capacitación" },
      { value: "release_manager", label: "Gerente de Versiones" },
    ],
    pt: [
      { value: "solution_architect", label: "Arquiteto de Soluções" },
      { value: "technical_architect", label: "Arquiteto Técnico" },
      { value: "project_manager", label: "Gerente de Projeto" },
      { value: "business_analyst", label: "Analista de Negócios" },
      { value: "senior_developer", label: "Desenvolvedor Sênior" },
      { value: "developer", label: "Desenvolvedor" },
      { value: "qa_lead", label: "Líder de QA" },
      { value: "qa_engineer", label: "Engenheiro de QA" },
      { value: "data_migration_specialist", label: "Especialista em Migração de Dados" },
      { value: "integration_specialist", label: "Especialista em Integração" },
      { value: "admin_config_specialist", label: "Especialista em Configuração" },
      { value: "change_management", label: "Gestão de Mudanças" },
      { value: "training_specialist", label: "Especialista em Treinamento" },
      { value: "release_manager", label: "Gerente de Releases" },
    ],
  },
  regions: {
    en: DEFAULT_REGIONS,
    es: [
      { value: "us", label: "EE.UU." },
      { value: "latam", label: "LATAM" },
      { value: "caribe", label: "Caribe" },
    ],
    pt: [
      { value: "us", label: "EUA" },
      { value: "latam", label: "LATAM" },
      { value: "caribe", label: "Caribe" },
    ],
  },
  industries: {
    en: DEFAULT_INDUSTRIES,
    es: [
      { value: "technology", label: "Tecnología" },
      { value: "healthcare", label: "Salud" },
      { value: "finance", label: "Finanzas" },
      { value: "manufacturing", label: "Manufactura" },
      { value: "retail", label: "Retail" },
      { value: "education", label: "Educación" },
      { value: "consulting", label: "Consultoría" },
      { value: "government", label: "Gobierno" },
    ],
    pt: [
      { value: "technology", label: "Tecnologia" },
      { value: "healthcare", label: "Saúde" },
      { value: "finance", label: "Finanças" },
      { value: "manufacturing", label: "Manufatura" },
      { value: "retail", label: "Varejo" },
      { value: "education", label: "Educação" },
      { value: "consulting", label: "Consultoria" },
      { value: "government", label: "Governo" },
    ],
  },
  contactRoles: {
    en: DEFAULT_CONTACT_ROLES,
    es: [
      { value: "executive_sponsor", label: "Patrocinador Ejecutivo" },
      { value: "project_manager", label: "Gerente de Proyecto" },
      { value: "technical_lead", label: "Líder Técnico" },
      { value: "stakeholder", label: "Parte Interesada" },
      { value: "legal", label: "Legal" },
    ],
    pt: [
      { value: "executive_sponsor", label: "Patrocinador Executivo" },
      { value: "project_manager", label: "Gerente de Projeto" },
      { value: "technical_lead", label: "Líder Técnico" },
      { value: "stakeholder", label: "Parte Interessada" },
      { value: "legal", label: "Jurídico" },
    ],
  },
  dateFormats: {
    en: DEFAULT_DATE_FORMATS,
    es: DEFAULT_DATE_FORMATS,
    pt: DEFAULT_DATE_FORMATS,
  },
  clients: {
    en: DEFAULT_CLIENTS,
    es: [
      { value: "client_a", label: "Cliente A" },
      { value: "client_b", label: "Cliente B" },
    ],
    pt: [
      { value: "client_a", label: "Cliente A" },
      { value: "client_b", label: "Cliente B" },
    ],
  },
  segments: {
    en: [
      { value: "smb", label: "SMB" },
      { value: "cbu", label: "CBU" },
      { value: "enterprise", label: "Enterprise" },
      { value: "public_sector", label: "Public Sector" },
    ],
    es: [
      { value: "smb", label: "SMB" },
      { value: "cbu", label: "CBU" },
      { value: "enterprise", label: "Empresa" },
      { value: "public_sector", label: "Sector Público" },
    ],
    pt: [
      { value: "smb", label: "SMB" },
      { value: "cbu", label: "CBU" },
      { value: "enterprise", label: "Empresa" },
      { value: "public_sector", label: "Setor Público" },
    ],
  },
  opportunityStatuses: {
    en: [
      { value: "qualifying", label: "Qualifying" },
      { value: "estimating", label: "Estimating" },
      { value: "proposed", label: "Proposed" },
      { value: "won", label: "Won" },
      { value: "lost", label: "Lost" },
    ],
    es: [
      { value: "qualifying", label: "Calificando" },
      { value: "estimating", label: "Estimando" },
      { value: "proposed", label: "Propuesta" },
      { value: "won", label: "Ganada" },
      { value: "lost", label: "Perdida" },
    ],
    pt: [
      { value: "qualifying", label: "Qualificando" },
      { value: "estimating", label: "Estimando" },
      { value: "proposed", label: "Proposta" },
      { value: "won", label: "Ganha" },
      { value: "lost", label: "Perdida" },
    ],
  },
  stakeholderTypes: {
    en: [
      { value: "sponsor", label: "Sponsor" },
      { value: "decision_maker", label: "Decision Maker" },
      { value: "it", label: "IT" },
      { value: "finance", label: "Finance" },
      { value: "c_level", label: "C-Level" },
      { value: "influencer", label: "Influencer" },
    ],
    es: [
      { value: "sponsor", label: "Patrocinador" },
      { value: "decision_maker", label: "Tomador de Decisiones" },
      { value: "it", label: "TI" },
      { value: "finance", label: "Finanzas" },
      { value: "c_level", label: "Nivel C" },
      { value: "influencer", label: "Influenciador" },
    ],
    pt: [
      { value: "sponsor", label: "Patrocinador" },
      { value: "decision_maker", label: "Tomador de Decisão" },
      { value: "it", label: "TI" },
      { value: "finance", label: "Finanças" },
      { value: "c_level", label: "Nível C" },
      { value: "influencer", label: "Influenciador" },
    ],
  },
};

export function getDefaultFieldOptions(category: string, locale: string = "en"): FieldOption[] {
  const localeDefaults = LOCALIZED_DEFAULTS[category];
  if (!localeDefaults) return [];
  return localeDefaults[locale] || localeDefaults["en"] || [];
}

export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  industry: text("industry"),
  country: text("country"),
  segment: text("segment"),
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
  stakeholderType: text("stakeholder_type").array(),
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
  healthOverall: healthStatusEnum("health_overall").notNull().default("green"),
  scopeHealth: healthStatusEnum("scope_health").notNull().default("green"),
  budgetHealth: healthStatusEnum("budget_health").notNull().default("green"),
  teamHealth: healthStatusEnum("team_health").notNull().default("green"),
  projectType: text("project_type"),
  engagementModel: text("engagement_model"),
  client: text("client"),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "set null" }),
  approvedBudget: numeric("approved_budget", { precision: 12, scale: 2 }),
  totalRunningCost: numeric("total_running_cost", { precision: 12, scale: 2 }),
  grossMargin: numeric("gross_margin", { precision: 5, scale: 2 }),
  projectStatus: projectStatusEnum("project_status").notNull().default("not_started"),
  region: text("region"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  dateFormat: text("date_format"),
  flightpathStageId: varchar("flightpath_stage_id").references(() => flightpathStages.id, { onDelete: "set null" }),
  operatingModelId: varchar("operating_model_id").references(() => operatingModels.id, { onDelete: "set null" }),
  operatingModelConfirmedAt: timestamp("operating_model_confirmed_at", { withTimezone: true }),
  docRepositoryType: text("doc_repository_type"),
  docRepositoryUrl: text("doc_repository_url"),
  docRepositoryFolderId: text("doc_repository_folder_id"),
  recordType: recordTypeEnum("record_type").notNull().default("project"),
  estimatedRevenue: numeric("estimated_revenue", { precision: 12, scale: 2 }),
  initialEstimate: numeric("initial_estimate", { precision: 12, scale: 2 }),
  riskFactorPercent: numeric("risk_factor_percent", { precision: 5, scale: 2 }),
  bufferPercent: numeric("buffer_percent", { precision: 5, scale: 2 }),
  opportunityStatus: text("opportunity_status"),
  confidencePercent: numeric("confidence_percent", { precision: 5, scale: 2 }),
  wonApprovalStatus: text("won_approval_status"),
  wonApprovalRequestedBy: varchar("won_approval_requested_by"),
  wonApprovalRequestedAt: timestamp("won_approval_requested_at", { withTimezone: true }),
  wonApprovalMarginAtRequest: numeric("won_approval_margin_at_request", { precision: 5, scale: 2 }),
  wonApprovalThresholdAtRequest: numeric("won_approval_threshold_at_request", { precision: 5, scale: 2 }),
  wonApprovalDecidedBy: varchar("won_approval_decided_by"),
  wonApprovalDecidedAt: timestamp("won_approval_decided_at", { withTimezone: true }),
  wonApprovalReason: text("won_approval_reason"),
  sourceOpportunityId: varchar("source_opportunity_id"),
  convertedAt: timestamp("converted_at", { withTimezone: true }),
  salesforceClouds: text("salesforce_clouds"),
  currency: text("currency").notNull().default("USD"),
  subsidiary: text("subsidiary"),
  engagementManagerId: varchar("engagement_manager_id").references(() => teamMembers.id, { onDelete: "set null" }),
  targetGoLiveDate: date("target_go_live_date"),
  contractedRevenue: numeric("contracted_revenue", { precision: 14, scale: 2 }),
  targetMarginPct: numeric("target_margin_pct", { precision: 5, scale: 2 }),
  strategicAccount: boolean("strategic_account").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by"),
}, (table) => [
  index("idx_timelines_tenant_client").on(table.tenantId, table.clientId),
  index("idx_timelines_tenant_record").on(table.tenantId, table.recordType),
]);

export const timelineHealthHistory = pgTable("timeline_health_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  healthOverall: healthStatusEnum("health_overall").notNull().default("green"),
  scopeHealth: healthStatusEnum("scope_health").notNull().default("green"),
  budgetHealth: healthStatusEnum("budget_health").notNull().default("green"),
  teamHealth: healthStatusEnum("team_health").notNull().default("green"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_health_history_timeline").on(table.timelineId, table.recordedAt),
  index("idx_health_history_tenant").on(table.tenantId),
]);

export const insertTimelineHealthHistorySchema = createInsertSchema(timelineHealthHistory).omit({ id: true, recordedAt: true });
export type InsertTimelineHealthHistory = z.infer<typeof insertTimelineHealthHistorySchema>;
export type TimelineHealthHistory = typeof timelineHealthHistory.$inferSelect;

export const milestones = pgTable("milestones", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  date: date("date").notNull(),
  actualDate: date("actual_date"),
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
  startDate: date("start_date"),
  endDate: date("end_date"),
  actualStartDate: date("actual_start_date"),
  actualEndDate: date("actual_end_date"),
  color: text("color"),
  percentComplete: integer("percent_complete").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
  status: taskStatusEnum("status").notNull().default("not_started"),
  health: healthStatusEnum("health").notNull().default("green"),
  itemType: taskItemTypeEnum("item_type").notNull().default("workstream"),
  parentTaskId: varchar("parent_task_id").references((): any => tasks.id, { onDelete: "set null" }),
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
  status: riskStatusEnum("status").notNull().default("open"),
  dueDate: date("due_date"),
  sortOrder: integer("sort_order").notNull().default(0),
  itemType: text("item_type").notNull().default("risk"),
  raisedDate: date("raised_date"),
  resolvedDate: date("resolved_date"),
  relatedStageId: varchar("related_stage_id"),
  validationCriteria: text("validation_criteria"),
  validatedDate: date("validated_date"),
  dependencySource: text("dependency_source"),
  requiredByDate: date("required_by_date"),
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
  startDate: date("start_date"),
  endDate: date("end_date"),
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
  startDate: date("start_date"),
  endDate: date("end_date"),
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
  tenantId: text("tenant_id").notNull().default("default").unique("app_settings_tenant_uniq"),
  riskRegisterEnabled: boolean("risk_register_enabled").notNull().default(false),
  opportunitiesEnabled: boolean("opportunities_enabled").notNull().default(true),
  minMarginForWon: numeric("min_margin_for_won", { precision: 5, scale: 2 }),
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
  opportunityStatuses: jsonb("opportunity_statuses").$type<FieldOption[]>(),
  rbacMigrated: boolean("rbac_migrated").notNull().default(false),
  governanceModelLabel: text("governance_model_label"),
  locale: text("locale").notNull().default("en"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const brandingConfig = pgTable("branding_config", {
  id: varchar("id").primaryKey().default("default"),
  tenantId: text("tenant_id").notNull().default("default").unique("branding_config_tenant_uniq"),
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
  weekEnding: date("week_ending").notNull(),
  dayDate: date("day_date"),
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
  weekEnding: date("week_ending").notNull(),
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
  weekEnding: date("week_ending").notNull(),
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
  generatedAt: timestamp("generated_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("evm_tenant_timeline_week_version_uniq").on(table.tenantId, table.timelineId, table.weekEnding, table.version),
  index("idx_evm_timeline_week").on(table.tenantId, table.timelineId, table.weekEnding),
]);

export const operatingModels = pgTable("operating_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

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
  operatingModelId: varchar("operating_model_id").references(() => operatingModels.id, { onDelete: "cascade" }),
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
  completedAt: timestamp("completed_at", { withTimezone: true }),
  completedBy: text("completed_by"),
  notes: text("notes"),
  artifactUrl: text("artifact_url"),
  artifactFileId: text("artifact_file_id"),
  artifactFileName: text("artifact_file_name"),
  artifactVerified: boolean("artifact_verified").notNull().default(false),
  artifactVerifiedAt: timestamp("artifact_verified_at", { withTimezone: true }),
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
  status: gateStatusEnum("status").notNull().default("pending"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
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

export const insertOperatingModelSchema = createInsertSchema(operatingModels).omit({ id: true, createdAt: true });
export type InsertOperatingModel = z.infer<typeof insertOperatingModelSchema>;
export type OperatingModel = typeof operatingModels.$inferSelect;

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
export const businessOutcomeStatusEnum = pgEnum("business_outcome_status", ["draft", "active", "achieved", "at_risk", "cancelled"]);

export const businessOutcomes = pgTable("business_outcomes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  title: text("title").notNull(),
  strategicObjective: text("strategic_objective"),
  successMetric: text("success_metric"),
  baseline: text("baseline"),
  target: text("target"),
  currentValue: text("current_value"),
  status: businessOutcomeStatusEnum("status").notNull().default("draft"),
  evidence: text("evidence"),
  valueNotes: text("value_notes"),
  clientId: varchar("client_id").references(() => clients.id, { onDelete: "set null" }),
  opportunityId: varchar("opportunity_id").references(() => timelines.id, { onDelete: "set null" }),
  projectId: varchar("project_id").references(() => timelines.id, { onDelete: "set null" }),
  stageId: varchar("stage_id").references(() => flightpathStages.id, { onDelete: "set null" }),
  ownerId: varchar("owner_id").references(() => teamMembers.id, { onDelete: "set null" }),
  targetDate: date("target_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  createdBy: varchar("created_by"),
}, (table) => [
  index("idx_bo_tenant").on(table.tenantId),
  index("idx_bo_project").on(table.tenantId, table.projectId),
]);

export const insertBusinessOutcomeSchema = createInsertSchema(businessOutcomes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBusinessOutcome = z.infer<typeof insertBusinessOutcomeSchema>;
export type BusinessOutcome = typeof businessOutcomes.$inferSelect;

// ---- Portfolio governance data models (Atlas executive cockpit) ----

export const projectQualityMetrics = pgTable("project_quality_metrics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  snapshotDate: date("snapshot_date").notNull(),
  openDefects: integer("open_defects").notNull().default(0),
  criticalDefects: integer("critical_defects").notNull().default(0),
  uatBlockers: integer("uat_blockers").notNull().default(0),
  failedTests: integer("failed_tests").notNull().default(0),
  reopenedTests: integer("reopened_tests").notNull().default(0),
  regressionReady: boolean("regression_ready").notNull().default(false),
  qaExitStatus: text("qa_exit_status").notNull().default("not_ready"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_quality_tenant_timeline").on(table.tenantId, table.timelineId),
  index("idx_quality_timeline_date").on(table.timelineId, table.snapshotDate),
]);

export const scopeChangeRequests = pgTable("scope_change_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("submitted"),
  commercialImpact: numeric("commercial_impact", { precision: 14, scale: 2 }),
  timelineImpactDays: integer("timeline_impact_days"),
  marginImpactPct: numeric("margin_impact_pct", { precision: 6, scale: 2 }),
  approvedBy: text("approved_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  raisedDate: date("raised_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_scope_tenant_timeline").on(table.tenantId, table.timelineId),
]);

export const executiveAttentionItems = pgTable("executive_attention_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull().default("medium"),
  issueType: text("issue_type"),
  owner: text("owner"),
  dueDate: date("due_date"),
  recommendedAction: text("recommended_action"),
  escalationStatus: text("escalation_status").notNull().default("none"),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_attention_tenant_timeline").on(table.tenantId, table.timelineId),
  index("idx_attention_tenant_status").on(table.tenantId, table.status),
]);

export const projectStageEntries = pgTable("project_stage_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  stageId: varchar("stage_id").notNull().references(() => flightpathStages.id, { onDelete: "cascade" }),
  enteredAt: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
}, (table) => [
  index("idx_stage_entry_timeline").on(table.timelineId, table.enteredAt),
  index("idx_stage_entry_tenant").on(table.tenantId),
]);

export const portfolioSnapshots = pgTable("portfolio_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  snapshotDate: date("snapshot_date").notNull(),
  overallScore: numeric("overall_score", { precision: 5, scale: 2 }),
  overallRag: text("overall_rag").notNull().default("gray"),
  dimensionRags: jsonb("dimension_rags").$type<Record<string, string>>(),
  marginPct: numeric("margin_pct", { precision: 6, scale: 2 }),
  forecastRevenue: numeric("forecast_revenue", { precision: 14, scale: 2 }),
  riskExposure: numeric("risk_exposure", { precision: 14, scale: 2 }),
  openCriticalRisks: integer("open_critical_risks").notNull().default(0),
  blockedGates: integer("blocked_gates").notNull().default(0),
  outcomesOnTrack: integer("outcomes_on_track").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("portfolio_snapshot_timeline_date_uniq").on(table.tenantId, table.timelineId, table.snapshotDate),
  index("idx_portfolio_snapshot_tenant_date").on(table.tenantId, table.snapshotDate),
]);

export const insertProjectQualityMetricSchema = createInsertSchema(projectQualityMetrics).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProjectQualityMetric = z.infer<typeof insertProjectQualityMetricSchema>;
export type ProjectQualityMetric = typeof projectQualityMetrics.$inferSelect;

export const insertScopeChangeRequestSchema = createInsertSchema(scopeChangeRequests).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertScopeChangeRequest = z.infer<typeof insertScopeChangeRequestSchema>;
export type ScopeChangeRequest = typeof scopeChangeRequests.$inferSelect;

export const insertExecutiveAttentionItemSchema = createInsertSchema(executiveAttentionItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertExecutiveAttentionItem = z.infer<typeof insertExecutiveAttentionItemSchema>;
export type ExecutiveAttentionItem = typeof executiveAttentionItems.$inferSelect;

export const insertProjectStageEntrySchema = createInsertSchema(projectStageEntries).omit({ id: true });
export type InsertProjectStageEntry = z.infer<typeof insertProjectStageEntrySchema>;
export type ProjectStageEntry = typeof projectStageEntries.$inferSelect;

export const insertPortfolioSnapshotSchema = createInsertSchema(portfolioSnapshots).omit({ id: true, createdAt: true });
export type InsertPortfolioSnapshot = z.infer<typeof insertPortfolioSnapshotSchema>;
export type PortfolioSnapshot = typeof portfolioSnapshots.$inferSelect;

export const apiTokens = pgTable("api_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull(),
  userId: varchar("user_id").notNull(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull(),
  tokenPrefix: text("token_prefix").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_api_tokens_hash_unique").on(table.tokenHash),
  index("idx_api_tokens_tenant").on(table.tenantId),
]);

export const insertApiTokenSchema = createInsertSchema(apiTokens).omit({ id: true, createdAt: true });
export type InsertApiToken = z.infer<typeof insertApiTokenSchema>;
export type ApiToken = typeof apiTokens.$inferSelect;

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

// ============================================================================
// ClickUp -> Atlas timesheet import DB layer
// ----------------------------------------------------------------------------
// Supports importing ClickUp time entries into `timesheet_entries` while
// preserving project traceability (ClickUp entry -> Atlas timesheet entry ->
// Atlas timeline/project) and preventing duplicate imports. All tables are
// tenant-scoped. `import_status` and `issue_type` are text columns (not DB
// enums) validated at the application layer via the constants below, matching
// Atlas's existing mix of text-based status fields.
// ============================================================================

// Allowed `import_status` values for clickup_time_entry_staging.
export const CLICKUP_IMPORT_STATUSES = ["pending", "imported", "updated", "exception", "skipped"] as const;
export type ClickupImportStatus = (typeof CLICKUP_IMPORT_STATUSES)[number];

// Allowed `issue_type` values for timesheet_import_exceptions.
export const TIMESHEET_IMPORT_ISSUE_TYPES = [
  "missing_timeline_mapping",
  "invalid_timeline_id",
  "missing_team_member_mapping",
  "invalid_team_member_id",
  "invalid_duration",
  "running_timer",
  "processing_error",
  "locked_timesheet",
] as const;
export type TimesheetImportIssueType = (typeof TIMESHEET_IMPORT_ISSUE_TYPES)[number];

// Raw ClickUp time-entry payloads staged before final processing.
export const clickupTimeEntryStaging = pgTable("clickup_time_entry_staging", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  clickupEntryId: text("clickup_entry_id").notNull(),
  clickupTaskId: text("clickup_task_id"),
  clickupUserId: text("clickup_user_id"),
  clickupWorkspaceId: text("clickup_workspace_id"),
  startMs: bigint("start_ms", { mode: "number" }),
  endMs: bigint("end_ms", { mode: "number" }),
  durationMs: bigint("duration_ms", { mode: "number" }),
  billable: boolean("billable"),
  rawPayload: jsonb("raw_payload").notNull(),
  syncRunId: varchar("sync_run_id").notNull(),
  importStatus: text("import_status").notNull().default("pending"),
  importError: text("import_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("uq_clickup_staging_tenant_entry").on(table.tenantId, table.clickupEntryId),
  index("idx_clickup_staging_run_status").on(table.tenantId, table.syncRunId, table.importStatus),
]);

// Idempotency + traceability: ClickUp time entry -> Atlas timesheet entry -> timeline/project.
export const clickupTimesheetImportLedger = pgTable("clickup_timesheet_import_ledger", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  clickupEntryId: text("clickup_entry_id").notNull(),
  clickupTaskId: text("clickup_task_id"),
  clickupUserId: text("clickup_user_id"),
  timelineId: varchar("timeline_id").notNull().references(() => timelines.id, { onDelete: "cascade" }),
  timesheetEntryId: varchar("timesheet_entry_id").notNull().references(() => timesheetEntries.id, { onDelete: "cascade" }),
  syncRunId: varchar("sync_run_id").notNull(),
  importedAt: timestamp("imported_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  rawPayload: jsonb("raw_payload"),
}, (table) => [
  unique("uq_clickup_ledger_tenant_entry").on(table.tenantId, table.clickupEntryId),
  index("idx_clickup_ledger_tenant_timeline").on(table.tenantId, table.timelineId),
]);

// Maps external (ClickUp) objects to Atlas objects (user->team_member, task->task, list/folder/space/task->timeline).
export const externalSystemMappings = pgTable("external_system_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  sourceSystem: text("source_system").notNull(),
  sourceObjectType: text("source_object_type").notNull(),
  sourceObjectId: text("source_object_id").notNull(),
  atlasObjectType: text("atlas_object_type").notNull(),
  atlasObjectId: varchar("atlas_object_id").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  unique("uq_external_mapping_tenant_source_atlas").on(
    table.tenantId,
    table.sourceSystem,
    table.sourceObjectType,
    table.sourceObjectId,
    table.atlasObjectType,
  ),
  index("idx_external_mapping_lookup").on(table.tenantId, table.sourceSystem, table.sourceObjectType),
]);

// Entries that could not be imported due to missing/invalid mappings or other issues.
export const timesheetImportExceptions = pgTable("timesheet_import_exceptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  sourceSystem: text("source_system").notNull().default("clickup"),
  sourceEntryId: text("source_entry_id").notNull(),
  issueType: text("issue_type").notNull(),
  issueDetail: text("issue_detail").notNull(),
  rawPayload: jsonb("raw_payload"),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: varchar("resolved_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_import_exceptions_tenant_resolved").on(table.tenantId, table.resolved),
  index("idx_import_exceptions_source_entry").on(table.tenantId, table.sourceSystem, table.sourceEntryId),
]);

export const insertClickupTimeEntryStagingSchema = createInsertSchema(clickupTimeEntryStaging).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClickupTimeEntryStaging = z.infer<typeof insertClickupTimeEntryStagingSchema>;
export type ClickupTimeEntryStaging = typeof clickupTimeEntryStaging.$inferSelect;

export const insertClickupTimesheetImportLedgerSchema = createInsertSchema(clickupTimesheetImportLedger).omit({ id: true, importedAt: true, lastSeenAt: true });
export type InsertClickupTimesheetImportLedger = z.infer<typeof insertClickupTimesheetImportLedgerSchema>;
export type ClickupTimesheetImportLedger = typeof clickupTimesheetImportLedger.$inferSelect;

export const insertExternalSystemMappingSchema = createInsertSchema(externalSystemMappings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertExternalSystemMapping = z.infer<typeof insertExternalSystemMappingSchema>;
export type ExternalSystemMapping = typeof externalSystemMappings.$inferSelect;

export const insertTimesheetImportExceptionSchema = createInsertSchema(timesheetImportExceptions).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTimesheetImportException = z.infer<typeof insertTimesheetImportExceptionSchema>;
export type TimesheetImportException = typeof timesheetImportExceptions.$inferSelect;
