import { sql } from "drizzle-orm";
import { pgTable, text, varchar, boolean, jsonb, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./auth";

export const orgRoles = pgTable("org_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const orgPermissions = pgTable("org_permissions", {
  key: varchar("key").primaryKey(),
  description: text("description"),
  category: text("category"),
});

export const orgRolePermissions = pgTable("org_role_permissions", {
  tenantId: text("tenant_id").notNull().default("default"),
  roleId: varchar("role_id").notNull().references(() => orgRoles.id, { onDelete: "cascade" }),
  permissionKey: varchar("permission_key").notNull().references(() => orgPermissions.key, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.tenantId, table.roleId, table.permissionKey] }),
]);

export const userOrgRoles = pgTable("user_org_roles", {
  tenantId: text("tenant_id").notNull().default("default"),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  roleId: varchar("role_id").notNull().references(() => orgRoles.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.tenantId, table.userId, table.roleId] }),
]);

export const OBJECT_ROLES = [
  "ae",
  "se",
  "dl",
  "pm",
  "contributor",
  "executive_viewer",
] as const;
export type ObjectRole = typeof OBJECT_ROLES[number];

export const objectAssignments = pgTable("object_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull().default("default"),
  objectType: text("object_type").notNull(),
  objectId: varchar("object_id").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  objectRole: text("object_role").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const objectRolePermissions = pgTable("object_role_permissions", {
  objectRole: text("object_role").notNull(),
  permissionKey: varchar("permission_key").notNull().references(() => orgPermissions.key, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.objectRole, table.permissionKey] }),
]);

export const auditLog = pgTable("audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  tenantId: text("tenant_id").notNull(),
  actorUserId: varchar("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  objectType: text("object_type"),
  objectId: varchar("object_id"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOrgRoleSchema = createInsertSchema(orgRoles).omit({ id: true, createdAt: true });
export const insertObjectAssignmentSchema = createInsertSchema(objectAssignments).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLog).omit({ id: true, createdAt: true });

export type InsertOrgRole = z.infer<typeof insertOrgRoleSchema>;
export type OrgRole = typeof orgRoles.$inferSelect;
export type OrgPermission = typeof orgPermissions.$inferSelect;
export type OrgRolePermission = typeof orgRolePermissions.$inferSelect;
export type UserOrgRole = typeof userOrgRoles.$inferSelect;
export type InsertObjectAssignment = z.infer<typeof insertObjectAssignmentSchema>;
export type ObjectAssignment = typeof objectAssignments.$inferSelect;
export type ObjectRolePermission = typeof objectRolePermissions.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLog.$inferSelect;

export const MODULE_KEYS = [
  "dashboard",
  "coach",
  "projects",
  "opportunities",
  "clients",
  "contacts",
  "business_outcomes",
  "allocations",
  "timesheets",
  "team_members",
  "reports",
  "admin",
] as const;
export type ModuleKey = typeof MODULE_KEYS[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  coach: "AI Coach",
  projects: "Projects",
  opportunities: "Opportunities",
  clients: "Clients",
  contacts: "Contacts",
  business_outcomes: "Business Outcomes",
  allocations: "Allocations",
  timesheets: "Timesheets",
  team_members: "Team Members",
  reports: "Reports",
  admin: "Admin",
};

export const ALL_PERMISSIONS = [
  { key: "module.dashboard", description: "Access the dashboard", category: "module" },
  { key: "module.coach", description: "Access AI Coach", category: "module" },
  { key: "module.projects", description: "Access the Projects module", category: "module" },
  { key: "module.opportunities", description: "Access the Opportunities module", category: "module" },
  { key: "module.clients", description: "Access the Clients module", category: "module" },
  { key: "module.contacts", description: "Access the Contacts module", category: "module" },
  { key: "module.business_outcomes", description: "Access the Business Outcomes module", category: "module" },
  { key: "module.allocations", description: "Access the Allocations module", category: "module" },
  { key: "module.timesheets", description: "Access the Timesheets module", category: "module" },
  { key: "module.team_members", description: "Access the Team Members module", category: "module" },
  { key: "module.reports", description: "Access the Reports module", category: "module" },
  { key: "module.admin", description: "Access the Admin / Settings area", category: "module" },

  { key: "record.global_access", description: "See all records regardless of assignment (bypass record-level filtering)", category: "access" },

  { key: "users.manage", description: "Manage users and role assignments", category: "admin" },
  { key: "roles.manage", description: "Manage role definitions", category: "admin" },
  { key: "org.settings.manage", description: "Manage organization settings, branding, integrations", category: "admin" },
  { key: "integrations.manage", description: "Manage third-party integrations", category: "admin" },

  { key: "opp.create", description: "Create new opportunities", category: "commercial" },
  { key: "opp.view", description: "View opportunities", category: "commercial" },
  { key: "opp.edit", description: "Edit opportunity details", category: "commercial" },
  { key: "estimate.view", description: "View estimation data", category: "commercial" },
  { key: "estimate.edit", description: "Edit estimation data (phases, workstreams, resources)", category: "commercial" },
  { key: "rates.view", description: "View rate cards and cost rates", category: "commercial" },
  { key: "rates.edit", description: "Edit rate cards", category: "commercial" },
  { key: "pricing.approve", description: "Approve pricing and commercial terms", category: "commercial" },

  { key: "gate.submit", description: "Submit gate for approval", category: "governance" },
  { key: "gate.review", description: "Review gate and provide comments", category: "governance" },
  { key: "gate.approve", description: "Approve governance gates", category: "governance" },
  { key: "gate.override", description: "Override gate decisions (exceptional)", category: "governance" },
  { key: "artifacts.manage", description: "Upload, link, and validate artifacts", category: "governance" },
  { key: "raci.manage", description: "Manage RACI templates and assignments", category: "governance" },

  { key: "project.create", description: "Create new projects", category: "delivery" },
  { key: "project.view", description: "View project details", category: "delivery" },
  { key: "project.edit", description: "Edit project details", category: "delivery" },
  { key: "timesheet.submit", description: "Submit timesheet entries", category: "delivery" },
  { key: "timesheet.approve", description: "Approve timesheet entries", category: "delivery" },

  { key: "raid.view", description: "View RAID log entries", category: "risk" },
  { key: "raid.edit", description: "Create and edit RAID log entries", category: "risk" },
  { key: "health.view", description: "View project health indicators", category: "risk" },
  { key: "health.edit", description: "Edit project health indicators", category: "risk" },

  { key: "reports.view", description: "View reports and dashboards", category: "reporting" },
  { key: "reports.export", description: "Export reports as PDF", category: "reporting" },
  { key: "portfolio.view", description: "View all projects/opportunities across the portfolio", category: "reporting" },
] as const;

export const PERMISSION_CATEGORIES = [
  { key: "module", label: "Module Access" },
  { key: "access", label: "Record Access" },
  { key: "admin", label: "Administration" },
  { key: "commercial", label: "Commercial" },
  { key: "governance", label: "Governance" },
  { key: "delivery", label: "Delivery" },
  { key: "risk", label: "Risk" },
  { key: "reporting", label: "Reporting" },
] as const;

export const SYSTEM_ORG_ROLES = [
  { name: "Global Admin", description: "Full access to all modules, all records, and all permissions", isSystem: true },
  { name: "Org Admin", description: "Full module access with global records — cannot override gates or approve pricing", isSystem: true },
  { name: "PMO Lead", description: "Portfolio oversight with global record access across delivery modules", isSystem: true },
  { name: "Finance", description: "Financial oversight with global access to projects, opportunities, and clients", isSystem: true },
  { name: "Delivery Lead", description: "Delivery management with global record access across projects and teams", isSystem: true },
  { name: "Project Manager", description: "Manages assigned projects — sees only projects they are allocated to", isSystem: true },
  { name: "Contributor", description: "Team member on assigned projects — can view projects and submit timesheets", isSystem: true },
  { name: "Timesheet Only", description: "Can only access timesheets for assigned projects", isSystem: true },
  { name: "Member", description: "Baseline login role — dashboard access only", isSystem: true },
] as const;

const ALL_PERM_KEYS = ALL_PERMISSIONS.map(p => p.key);

export const SYSTEM_ROLE_PERMISSIONS: Record<string, string[]> = {
  "Global Admin": [...ALL_PERM_KEYS],

  "Org Admin": ALL_PERM_KEYS.filter(k => k !== "gate.override" && k !== "pricing.approve"),

  "PMO Lead": [
    "module.dashboard", "module.projects", "module.clients", "module.allocations",
    "module.timesheets", "module.team_members", "module.reports", "module.admin", "module.coach", "module.business_outcomes",
    "record.global_access",
    "opp.view", "estimate.view", "rates.view",
    "gate.review", "gate.approve", "artifacts.manage", "raci.manage",
    "project.view", "project.create",
    "timesheet.approve",
    "raid.view", "raid.edit", "health.view", "health.edit",
    "reports.view", "reports.export", "portfolio.view",
    "users.manage", "roles.manage",
  ],

  "Finance": [
    "module.dashboard", "module.projects", "module.opportunities", "module.clients", "module.reports", "module.admin", "module.business_outcomes",
    "record.global_access",
    "opp.view", "estimate.view", "rates.view", "rates.edit", "pricing.approve",
    "project.view",
    "reports.view", "reports.export", "portfolio.view",
  ],

  "Delivery Lead": [
    "module.dashboard", "module.projects", "module.clients", "module.allocations",
    "module.timesheets", "module.team_members", "module.reports", "module.coach", "module.business_outcomes",
    "record.global_access",
    "opp.view", "opp.edit", "estimate.view", "estimate.edit",
    "gate.review", "gate.submit", "gate.approve", "artifacts.manage",
    "project.view", "project.edit", "project.create",
    "timesheet.approve",
    "raid.view", "raid.edit", "health.view", "health.edit",
    "reports.view", "portfolio.view",
  ],

  "Project Manager": [
    "module.dashboard", "module.projects", "module.timesheets", "module.allocations", "module.reports", "module.coach", "module.business_outcomes",
    "gate.submit", "gate.review", "artifacts.manage",
    "project.view", "project.edit",
    "timesheet.submit", "timesheet.approve",
    "raid.view", "raid.edit", "health.view", "health.edit",
    "estimate.view",
    "reports.view",
  ],

  "Contributor": [
    "module.dashboard", "module.projects", "module.timesheets",
    "project.view",
    "timesheet.submit",
    "raid.view",
    "health.view",
    "estimate.view",
  ],

  "Timesheet Only": [
    "module.dashboard", "module.timesheets",
    "timesheet.submit",
  ],

  "Member": [
    "module.dashboard",
  ],
};

export const OBJECT_ROLE_PERMISSIONS: Record<string, string[]> = {
  "ae": [
    "opp.view", "opp.edit", "estimate.view",
    "gate.submit",
    "raid.view", "raid.edit",
  ],
  "se": [
    "opp.view", "estimate.view", "estimate.edit",
    "gate.submit", "artifacts.manage",
    "raid.view", "raid.edit",
  ],
  "dl": [
    "opp.view", "opp.edit", "estimate.view", "estimate.edit",
    "gate.review", "gate.submit", "artifacts.manage",
    "project.view", "project.edit",
    "raid.view", "raid.edit", "health.view", "health.edit",
    "timesheet.approve",
  ],
  "pm": [
    "project.view", "project.edit",
    "gate.submit", "gate.review", "artifacts.manage",
    "raid.view", "raid.edit", "health.view", "health.edit",
    "timesheet.approve",
    "estimate.view",
  ],
  "contributor": [
    "project.view", "opp.view",
    "timesheet.submit",
    "raid.view",
    "health.view",
    "estimate.view",
  ],
  "executive_viewer": [
    "project.view", "opp.view",
    "estimate.view", "rates.view",
    "raid.view", "health.view",
    "reports.view", "reports.export",
  ],
};

export const OBJECT_ROLE_LABELS: Record<string, string> = {
  "ae": "Account Executive",
  "se": "Sales Engineer",
  "dl": "Delivery Lead",
  "pm": "Project Manager",
  "contributor": "Contributor",
  "executive_viewer": "Executive Viewer",
};
