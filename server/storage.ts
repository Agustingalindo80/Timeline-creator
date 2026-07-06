import { eq, and, inArray, desc, asc, gte, lte, sql, count } from "drizzle-orm";
import { db } from "./db";
import {
  tenants,
  clients,
  contacts,
  timelines,
  milestones,
  tasks,
  risks,
  teamMembers,
  rateCards,
  projectTeamMembers,
  allocations,
  appSettings,
  brandingConfig,
  timesheetEntries,
  progressEntries,
  flightpathStages,
  flightpathDeliverables,
  projectCheckpoints,
  projectGates,
  workstreamResources,
  orgRoles,
  orgRolePermissions,
  orgPermissions,
  userOrgRoles,
  objectAssignments,
  objectRolePermissions,
  auditLog,
  evmSnapshots,
  users,
  apiTokens,
  conversations,
  messages,
  type BrandingConfig,
  type InsertBranding,
  type Client,
  type InsertClient,
  type Contact,
  type InsertContact,
  type Timeline,
  type InsertTimeline,
  type Milestone,
  type InsertMilestone,
  type Task,
  type InsertTask,
  type Risk,
  type InsertRisk,
  type TeamMember,
  type InsertTeamMember,
  type RateCard,
  type InsertRateCard,
  type ProjectTeamMember,
  type InsertProjectTeamMember,
  type ProjectTeamMemberWithDetails,
  type Allocation,
  type InsertAllocation,
  type AllocationWithProject,
  type AllocationWithTeamMember,
  type AppSettings,
  type TimelineWithMilestones,
  type ClientWithProjects,
  type TimesheetEntry,
  type InsertTimesheetEntry,
  type ProgressEntry,
  type InsertProgressEntry,
  type FlightpathStage,
  type InsertFlightpathStage,
  type FlightpathDeliverable,
  type InsertFlightpathDeliverable,
  type ProjectCheckpoint,
  type InsertProjectCheckpoint,
  type ProjectGate,
  type InsertProjectGate,
  type WorkstreamResource,
  type InsertWorkstreamResource,
  type OrgRole,
  type ObjectAssignment,
  type InsertObjectAssignment,
  type InsertAuditLog,
  type AuditLog,
  type User,
  type EvmSnapshot,
  type InsertEvmSnapshot,
  businessOutcomes,
  type BusinessOutcome,
  type InsertBusinessOutcome,
  timelineHealthHistory,
  type TimelineHealthHistory,
  type InsertTimelineHealthHistory,
  projectQualityMetrics,
  type ProjectQualityMetric,
  type InsertProjectQualityMetric,
  scopeChangeRequests,
  type ScopeChangeRequest,
  type InsertScopeChangeRequest,
  executiveAttentionItems,
  type ExecutiveAttentionItem,
  type InsertExecutiveAttentionItem,
  projectStageEntries,
  type ProjectStageEntry,
  type InsertProjectStageEntry,
  portfolioSnapshots,
  type PortfolioSnapshot,
  type InsertPortfolioSnapshot,
} from "@shared/schema";

export type HealthHistoryRange = { from?: Date; to?: Date };

export interface IStorage {
  getClients(tenantId?: string): Promise<Client[]>;
  getClient(id: string, tenantId: string): Promise<Client | undefined>;
  getClientWithProjects(id: string, tenantId: string): Promise<ClientWithProjects | undefined>;
  createClient(data: InsertClient): Promise<Client>;
  updateClient(id: string, tenantId: string, data: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string, tenantId: string): Promise<void>;
  getAllContacts(tenantId?: string): Promise<Contact[]>;
  getContacts(clientId: string, tenantId: string): Promise<Contact[]>;
  getContact(id: string, tenantId: string): Promise<Contact | undefined>;
  createContact(data: InsertContact): Promise<Contact>;
  updateContact(id: string, tenantId: string, data: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: string, tenantId: string): Promise<void>;
  getTimelines(recordType?: string, tenantId?: string): Promise<TimelineWithMilestones[]>;
  getTimeline(id: string, tenantId: string): Promise<TimelineWithMilestones | undefined>;
  getTimelinesBySource(sourceOpportunityId: string, tenantId: string): Promise<Timeline | undefined>;
  createTimeline(data: InsertTimeline): Promise<Timeline>;
  updateTimeline(id: string, tenantId: string, data: Partial<InsertTimeline>): Promise<Timeline | undefined>;
  deleteTimeline(id: string, tenantId: string): Promise<void>;
  createMilestone(data: InsertMilestone): Promise<Milestone>;
  updateMilestone(id: string, tenantId: string, data: Partial<InsertMilestone>): Promise<Milestone | undefined>;
  deleteMilestone(id: string, tenantId: string): Promise<void>;
  getTask(id: string, tenantId: string): Promise<Task | undefined>;
  getTasksByTimeline(timelineId: string, tenantId: string): Promise<Task[]>;
  getTasksByParent(parentTaskId: string, tenantId: string): Promise<Task[]>;
  createTask(data: InsertTask): Promise<Task>;
  updateTask(id: string, tenantId: string, data: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string, tenantId: string): Promise<void>;
  getRisks(timelineId: string, tenantId: string): Promise<Risk[]>;
  createRisk(data: InsertRisk): Promise<Risk>;
  updateRisk(id: string, tenantId: string, data: Partial<InsertRisk>): Promise<Risk | undefined>;
  deleteRisk(id: string, tenantId: string): Promise<void>;
  getTeamMembers(tenantId?: string): Promise<TeamMember[]>;
  getTeamMember(id: string, tenantId: string): Promise<TeamMember | undefined>;
  createTeamMember(data: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(id: string, tenantId: string, data: Partial<InsertTeamMember>): Promise<TeamMember | undefined>;
  deleteTeamMember(id: string, tenantId: string): Promise<void>;
  getRateCards(tenantId?: string): Promise<RateCard[]>;
  getRateCard(id: string, tenantId: string): Promise<RateCard | undefined>;
  createRateCard(data: InsertRateCard): Promise<RateCard>;
  updateRateCard(id: string, tenantId: string, data: Partial<InsertRateCard>): Promise<RateCard | undefined>;
  deleteRateCard(id: string, tenantId: string): Promise<void>;
  getProjectTeamMembers(timelineId: string, tenantId: string): Promise<ProjectTeamMemberWithDetails[]>;
  getProjectTeamMemberById(id: string, tenantId: string): Promise<ProjectTeamMember | undefined>;
  createProjectTeamMember(data: InsertProjectTeamMember): Promise<ProjectTeamMember>;
  updateProjectTeamMember(id: string, tenantId: string, data: Partial<InsertProjectTeamMember>): Promise<ProjectTeamMember | undefined>;
  deleteProjectTeamMember(id: string, tenantId: string): Promise<void>;
  getAllocation(id: string, tenantId: string): Promise<Allocation | undefined>;
  getAllocations(teamMemberId: string, tenantId: string): Promise<AllocationWithProject[]>;
  getAllAllAllocations(tenantId?: string): Promise<import("@shared/schema").AllocationFull[]>;
  getAllocationsByTimeline(timelineId: string, tenantId: string): Promise<AllocationWithTeamMember[]>;
  createAllocation(data: InsertAllocation): Promise<Allocation>;
  updateAllocation(id: string, tenantId: string, data: Partial<InsertAllocation>): Promise<Allocation | undefined>;
  deleteAllocation(id: string, tenantId: string): Promise<void>;
  getSettings(tenantId?: string): Promise<AppSettings>;
  updateSettings(data: Partial<Omit<AppSettings, "id">>, tenantId?: string): Promise<AppSettings>;
  getBranding(tenantId?: string): Promise<BrandingConfig>;
  updateBranding(data: Partial<InsertBranding>, tenantId?: string): Promise<BrandingConfig>;
  getTimesheetEntries(tenantId: string, filters?: { timelineId?: string; teamMemberId?: string; weekEnding?: string; taskId?: string; dayDate?: string }): Promise<TimesheetEntry[]>;
  getTimesheetEntry(id: string, tenantId: string): Promise<TimesheetEntry | undefined>;
  createTimesheetEntry(data: InsertTimesheetEntry): Promise<TimesheetEntry>;
  updateTimesheetEntry(id: string, tenantId: string, data: Partial<InsertTimesheetEntry>): Promise<TimesheetEntry | undefined>;
  deleteTimesheetEntry(id: string, tenantId: string): Promise<void>;
  getProgressEntries(tenantId: string, filters?: { timelineId?: string; taskId?: string; weekEnding?: string }): Promise<ProgressEntry[]>;
  getProgressEntry(id: string, tenantId: string): Promise<ProgressEntry | undefined>;
  createProgressEntry(data: InsertProgressEntry): Promise<ProgressEntry>;
  updateProgressEntry(id: string, tenantId: string, data: Partial<InsertProgressEntry>): Promise<ProgressEntry | undefined>;
  deleteProgressEntry(id: string, tenantId: string): Promise<void>;
  getFlightpathStages(tenantId?: string): Promise<FlightpathStage[]>;
  getFlightpathStage(id: string, tenantId: string): Promise<FlightpathStage | undefined>;
  createFlightpathStage(data: InsertFlightpathStage): Promise<FlightpathStage>;
  updateFlightpathStage(id: string, tenantId: string, data: Partial<InsertFlightpathStage>): Promise<FlightpathStage | undefined>;
  deleteFlightpathStage(id: string, tenantId: string): Promise<void>;
  getStageDeliverables(stageId: string, tenantId: string): Promise<FlightpathDeliverable[]>;
  getAllDeliverables(tenantId?: string): Promise<FlightpathDeliverable[]>;
  createDeliverable(data: InsertFlightpathDeliverable): Promise<FlightpathDeliverable>;
  updateDeliverable(id: string, tenantId: string, data: Partial<InsertFlightpathDeliverable>): Promise<FlightpathDeliverable | undefined>;
  deleteDeliverable(id: string, tenantId: string): Promise<void>;
  getProjectCheckpoints(timelineId: string, tenantId: string): Promise<ProjectCheckpoint[]>;
  getProjectCheckpointsByStage(timelineId: string, stageId: string, tenantId: string): Promise<ProjectCheckpoint[]>;
  createProjectCheckpoint(data: InsertProjectCheckpoint): Promise<ProjectCheckpoint>;
  updateProjectCheckpoint(id: string, tenantId: string, data: Partial<InsertProjectCheckpoint>): Promise<ProjectCheckpoint | undefined>;
  deleteProjectCheckpoint(id: string, tenantId: string): Promise<void>;
  getProjectGates(timelineId: string, tenantId: string): Promise<ProjectGate[]>;
  getProjectGate(timelineId: string, stageId: string, tenantId: string): Promise<ProjectGate | undefined>;
  createProjectGate(data: InsertProjectGate): Promise<ProjectGate>;
  updateProjectGate(id: string, tenantId: string, data: Partial<InsertProjectGate>): Promise<ProjectGate | undefined>;
  getWorkstreamResources(taskId: string, tenantId: string): Promise<WorkstreamResource[]>;
  getWorkstreamResourcesByTimeline(timelineId: string, tenantId: string): Promise<WorkstreamResource[]>;
  createWorkstreamResource(data: InsertWorkstreamResource): Promise<WorkstreamResource>;
  updateWorkstreamResource(id: string, tenantId: string, data: Partial<InsertWorkstreamResource>): Promise<WorkstreamResource | undefined>;
  deleteWorkstreamResource(id: string, tenantId: string): Promise<void>;

  getTenants(): Promise<import("@shared/schema").Tenant[]>;
  getTenant(id: string): Promise<import("@shared/schema").Tenant | undefined>;
  createTenant(data: import("@shared/schema").InsertTenant): Promise<import("@shared/schema").Tenant>;
  updateTenant(id: string, data: Partial<import("@shared/schema").InsertTenant>): Promise<import("@shared/schema").Tenant | undefined>;
  deleteTenant(id: string): Promise<boolean>;
  getTenantUsage(tenantId: string): Promise<{ userCount: number; projectCount: number; opportunityCount: number }>;

  getOrgRoles(tenantId: string): Promise<OrgRole[]>;
  getUserOrgRoles(userId: string, tenantId: string): Promise<OrgRole[]>;
  assignUserOrgRole(userId: string, roleId: string, tenantId: string): Promise<void>;
  removeUserOrgRole(userId: string, roleId: string, tenantId: string): Promise<void>;
  getObjectAssignments(objectType: string, objectId: string, tenantId: string): Promise<(ObjectAssignment & { user?: User | null; teamMember?: TeamMember | null })[]>;
  getObjectAssignmentsByUser(userId: string, tenantId: string): Promise<ObjectAssignment[]>;
  assignObjectRole(objectType: string, objectId: string, userId: string, objectRole: string, tenantId: string): Promise<ObjectAssignment>;
  removeObjectAssignment(id: string, tenantId: string): Promise<void>;
  getAuditLog(tenantId: string, filters?: { action?: string; limit?: number; offset?: number }): Promise<AuditLog[]>;
  createAuditEntry(entry: InsertAuditLog): Promise<AuditLog>;
  getUsersByTenant(tenantId: string): Promise<(User & { orgRoles?: OrgRole[]; teamMember?: TeamMember | null })[]>;
  updateUserDemographics(userId: string, data: { firstName?: string; lastName?: string; email?: string }): Promise<User | undefined>;
  linkTeamMemberToUser(teamMemberId: string, userId: string): Promise<void>;
  unlinkTeamMemberFromUser(teamMemberId: string): Promise<void>;
  getTeamMemberByUserId(userId: string, tenantId?: string): Promise<TeamMember | undefined>;
  createUserFromTeamMember(email: string, teamMemberId: string): Promise<User>;
  getEvmSnapshots(timelineId: string, tenantId: string): Promise<EvmSnapshot[]>;
  getEvmSnapshotAllVersions(timelineId: string, weekEnding: string, tenantId: string): Promise<EvmSnapshot[]>;
  getEvmSnapshot(timelineId: string, weekEnding: string, tenantId: string): Promise<EvmSnapshot | undefined>;
  createEvmSnapshot(data: InsertEvmSnapshot): Promise<EvmSnapshot>;
  getLatestEvmSnapshot(timelineId: string, tenantId: string): Promise<EvmSnapshot | undefined>;
  getAssignedTimelineIds(teamMemberId: string): Promise<string[]>;
  getTimelinesByIds(ids: string[], recordType?: string): Promise<TimelineWithMilestones[]>;
  getClientsByTimelineIds(timelineIds: string[]): Promise<Client[]>;
  getContactsByClientIds(clientIds: string[]): Promise<Contact[]>;
  getTeamMembersByTimelineIds(timelineIds: string[]): Promise<TeamMember[]>;
  getTenantBySlug(slug: string): Promise<import("@shared/schema").Tenant | undefined>;
  createOrgRole(data: { tenantId: string; name: string; description?: string; isSystem?: boolean }): Promise<OrgRole>;
  getOrgRolePermissions(roleId: string, tenantId: string): Promise<string[]>;
  setOrgRolePermissions(roleId: string, tenantId: string, permissionKeys: string[]): Promise<void>;
  getOrgRoleUserCount(roleId: string, tenantId: string): Promise<number>;

  getApiTokens(tenantId: string): Promise<import("@shared/schema").ApiToken[]>;
  getApiToken(id: string, tenantId: string): Promise<import("@shared/schema").ApiToken | undefined>;
  getApiTokenByHash(tokenHash: string): Promise<import("@shared/schema").ApiToken | undefined>;
  createApiToken(data: import("@shared/schema").InsertApiToken): Promise<import("@shared/schema").ApiToken>;
  revokeApiToken(id: string, tenantId: string): Promise<import("@shared/schema").ApiToken | undefined>;
  updateApiTokenLastUsed(id: string): Promise<void>;
  deleteEvmSnapshot(id: string, tenantId: string): Promise<void>;
  deleteOrgRole(id: string, tenantId: string): Promise<void>;
  updateOrgRole(id: string, tenantId: string, data: { name?: string; description?: string }): Promise<OrgRole | undefined>;

  getBusinessOutcomes(tenantId: string, filters?: { projectId?: string; opportunityId?: string }): Promise<BusinessOutcome[]>;
  getBusinessOutcome(id: string, tenantId: string): Promise<BusinessOutcome | undefined>;
  createBusinessOutcome(data: InsertBusinessOutcome): Promise<BusinessOutcome>;
  updateBusinessOutcome(id: string, tenantId: string, data: Partial<InsertBusinessOutcome>): Promise<BusinessOutcome | undefined>;
  deleteBusinessOutcome(id: string, tenantId: string): Promise<void>;

  createHealthHistory(data: InsertTimelineHealthHistory): Promise<TimelineHealthHistory>;
  getHealthHistory(timelineId: string, tenantId: string, range?: HealthHistoryRange): Promise<TimelineHealthHistory[]>;
  getHealthHistoryByTimelineIds(timelineIds: string[], tenantId: string, range?: HealthHistoryRange): Promise<TimelineHealthHistory[]>;
  getHealthHistoryBaseline(timelineIds: string[], tenantId: string, before: Date): Promise<TimelineHealthHistory[]>;

  getProjectQualityMetrics(timelineId: string, tenantId: string): Promise<ProjectQualityMetric[]>;
  getQualityMetricsByTimelineIds(timelineIds: string[], tenantId: string): Promise<ProjectQualityMetric[]>;
  createProjectQualityMetric(data: InsertProjectQualityMetric): Promise<ProjectQualityMetric>;

  getScopeChangeRequests(timelineId: string, tenantId: string): Promise<ScopeChangeRequest[]>;
  getScopeChangeRequestsByTimelineIds(timelineIds: string[], tenantId: string): Promise<ScopeChangeRequest[]>;
  createScopeChangeRequest(data: InsertScopeChangeRequest): Promise<ScopeChangeRequest>;

  getExecutiveAttentionItems(timelineId: string, tenantId: string): Promise<ExecutiveAttentionItem[]>;
  getExecutiveAttentionItemsByTimelineIds(timelineIds: string[], tenantId: string): Promise<ExecutiveAttentionItem[]>;
  createExecutiveAttentionItem(data: InsertExecutiveAttentionItem): Promise<ExecutiveAttentionItem>;

  getProjectStageEntries(timelineId: string, tenantId: string): Promise<ProjectStageEntry[]>;
  getStageEntriesByTimelineIds(timelineIds: string[], tenantId: string): Promise<ProjectStageEntry[]>;
  createProjectStageEntry(data: InsertProjectStageEntry): Promise<ProjectStageEntry>;

  getPortfolioSnapshotsByTimelineIds(timelineIds: string[], tenantId: string, range?: HealthHistoryRange): Promise<PortfolioSnapshot[]>;
  createPortfolioSnapshot(data: InsertPortfolioSnapshot): Promise<PortfolioSnapshot>;
}

export class DatabaseStorage implements IStorage {
  async getClients(tenantId?: string): Promise<Client[]> {
    if (tenantId) return db.select().from(clients).where(eq(clients.tenantId, tenantId));
    return db.select().from(clients);
  }

  async getClient(id: string, tenantId: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)));
    return client;
  }

  async getClientWithProjects(id: string, tenantId: string): Promise<ClientWithProjects | undefined> {
    const [client] = await db.select().from(clients).where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)));
    if (!client) return undefined;

    const allTimelines = await db.select().from(timelines).where(and(eq(timelines.clientId, id), eq(timelines.tenantId, tenantId)));
    const timelineIds = allTimelines.map(t => t.id);
    const allMilestones = timelineIds.length > 0 ? await db.select().from(milestones).where(inArray(milestones.timelineId, timelineIds)) : [];
    const allTasks = timelineIds.length > 0 ? await db.select().from(tasks).where(inArray(tasks.timelineId, timelineIds)) : [];
    const clientContacts = await db.select().from(contacts).where(and(eq(contacts.clientId, id), eq(contacts.tenantId, tenantId)));

    const projects = allTimelines.map((t) => ({
      ...t,
      milestones: allMilestones
        .filter((m) => m.timelineId === t.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
      tasks: allTasks
        .filter((task) => task.timelineId === t.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }));

    return { ...client, projects, contacts: clientContacts };
  }

  async createClient(data: InsertClient): Promise<Client> {
    const [client] = await db.insert(clients).values(data).returning();
    return client;
  }

  async updateClient(id: string, tenantId: string, data: Partial<InsertClient>): Promise<Client | undefined> {
    const [client] = await db
      .update(clients)
      .set(data)
      .where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)))
      .returning();
    return client;
  }

  async deleteClient(id: string, tenantId: string): Promise<void> {
    await db.update(timelines).set({ clientId: null }).where(and(eq(timelines.clientId, id), eq(timelines.tenantId, tenantId)));
    await db.delete(contacts).where(and(eq(contacts.clientId, id), eq(contacts.tenantId, tenantId)));
    await db.delete(clients).where(and(eq(clients.id, id), eq(clients.tenantId, tenantId)));
  }

  async getAllContacts(tenantId?: string): Promise<Contact[]> {
    if (tenantId) return db.select().from(contacts).where(eq(contacts.tenantId, tenantId));
    return db.select().from(contacts);
  }

  async getContacts(clientId: string, tenantId: string): Promise<Contact[]> {
    return db.select().from(contacts).where(and(eq(contacts.clientId, clientId), eq(contacts.tenantId, tenantId)));
  }

  async getContact(id: string, tenantId: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)));
    return contact;
  }

  async createContact(data: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(data).returning();
    return contact;
  }

  async updateContact(id: string, tenantId: string, data: Partial<InsertContact>): Promise<Contact | undefined> {
    const [contact] = await db.update(contacts).set(data).where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId))).returning();
    return contact;
  }

  async deleteContact(id: string, tenantId: string): Promise<void> {
    await db.delete(contacts).where(and(eq(contacts.id, id), eq(contacts.tenantId, tenantId)));
  }

  async getTimelines(recordType?: string, tenantId?: string): Promise<TimelineWithMilestones[]> {
    const filterType = recordType || "project";
    const conditions = [eq(timelines.recordType, filterType)];
    if (tenantId) conditions.push(eq(timelines.tenantId, tenantId));
    const allTimelines = await db.select().from(timelines).where(and(...conditions));
    const allMilestones = await db.select().from(milestones);
    const allTasks = await db.select().from(tasks);

    return allTimelines.map((t) => ({
      ...t,
      milestones: allMilestones
        .filter((m) => m.timelineId === t.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
      tasks: allTasks
        .filter((task) => task.timelineId === t.id)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    }));
  }

  async getTimeline(id: string, tenantId: string): Promise<TimelineWithMilestones | undefined> {
    const [timeline] = await db.select().from(timelines).where(and(eq(timelines.id, id), eq(timelines.tenantId, tenantId)));
    if (!timeline) return undefined;

    const timelineMilestones = await db
      .select()
      .from(milestones)
      .where(eq(milestones.timelineId, id));

    const timelineTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.timelineId, id));

    return {
      ...timeline,
      milestones: timelineMilestones.sort((a, b) => a.sortOrder - b.sortOrder),
      tasks: timelineTasks.sort((a, b) => a.sortOrder - b.sortOrder),
    };
  }

  async getTimelinesBySource(sourceOpportunityId: string, tenantId: string): Promise<Timeline | undefined> {
    const [timeline] = await db
      .select()
      .from(timelines)
      .where(and(eq(timelines.sourceOpportunityId, sourceOpportunityId), eq(timelines.tenantId, tenantId)))
      .limit(1);
    return timeline;
  }

  async createTimeline(data: InsertTimeline): Promise<Timeline> {
    const [timeline] = await db.insert(timelines).values(data).returning();
    return timeline;
  }

  async updateTimeline(id: string, tenantId: string, data: Partial<InsertTimeline>): Promise<Timeline | undefined> {
    const [timeline] = await db
      .update(timelines)
      .set(data)
      .where(and(eq(timelines.id, id), eq(timelines.tenantId, tenantId)))
      .returning();
    return timeline;
  }

  async deleteTimeline(id: string, tenantId: string): Promise<void> {
    await db.delete(projectTeamMembers).where(and(eq(projectTeamMembers.timelineId, id), eq(projectTeamMembers.tenantId, tenantId)));
    await db.delete(risks).where(and(eq(risks.timelineId, id), eq(risks.tenantId, tenantId)));
    await db.delete(tasks).where(and(eq(tasks.timelineId, id), eq(tasks.tenantId, tenantId)));
    await db.delete(milestones).where(and(eq(milestones.timelineId, id), eq(milestones.tenantId, tenantId)));
    await db.delete(timelines).where(and(eq(timelines.id, id), eq(timelines.tenantId, tenantId)));
  }

  async createMilestone(data: InsertMilestone): Promise<Milestone> {
    const [milestone] = await db.insert(milestones).values(data).returning();
    return milestone;
  }

  async updateMilestone(id: string, tenantId: string, data: Partial<InsertMilestone>): Promise<Milestone | undefined> {
    const [milestone] = await db
      .update(milestones)
      .set(data)
      .where(and(eq(milestones.id, id), eq(milestones.tenantId, tenantId)))
      .returning();
    return milestone;
  }

  async deleteMilestone(id: string, tenantId: string): Promise<void> {
    await db.delete(milestones).where(and(eq(milestones.id, id), eq(milestones.tenantId, tenantId)));
  }

  async getTask(id: string, tenantId: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)));
    return task;
  }

  async getTasksByTimeline(timelineId: string, tenantId: string): Promise<Task[]> {
    return db.select().from(tasks).where(and(eq(tasks.timelineId, timelineId), eq(tasks.tenantId, tenantId)));
  }

  async getTasksByParent(parentTaskId: string, tenantId: string): Promise<Task[]> {
    return db.select().from(tasks).where(and(eq(tasks.parentTaskId, parentTaskId), eq(tasks.tenantId, tenantId)));
  }

  async createTask(data: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(data).returning();
    return task;
  }

  async updateTask(id: string, tenantId: string, data: Partial<InsertTask>): Promise<Task | undefined> {
    const [task] = await db
      .update(tasks)
      .set(data)
      .where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)))
      .returning();
    return task;
  }

  async deleteTask(id: string, tenantId: string): Promise<void> {
    await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.tenantId, tenantId)));
  }

  async getRisks(timelineId: string, tenantId: string): Promise<Risk[]> {
    return db
      .select()
      .from(risks)
      .where(and(eq(risks.timelineId, timelineId), eq(risks.tenantId, tenantId)));
  }

  async createRisk(data: InsertRisk): Promise<Risk> {
    const [risk] = await db.insert(risks).values(data).returning();
    return risk;
  }

  async updateRisk(id: string, tenantId: string, data: Partial<InsertRisk>): Promise<Risk | undefined> {
    const [risk] = await db
      .update(risks)
      .set(data)
      .where(and(eq(risks.id, id), eq(risks.tenantId, tenantId)))
      .returning();
    return risk;
  }

  async deleteRisk(id: string, tenantId: string): Promise<void> {
    await db.delete(risks).where(and(eq(risks.id, id), eq(risks.tenantId, tenantId)));
  }

  async getTeamMembers(tenantId?: string): Promise<TeamMember[]> {
    if (tenantId) return db.select().from(teamMembers).where(eq(teamMembers.tenantId, tenantId));
    return db.select().from(teamMembers);
  }

  async getTeamMember(id: string, tenantId: string): Promise<TeamMember | undefined> {
    const [member] = await db.select().from(teamMembers).where(and(eq(teamMembers.id, id), eq(teamMembers.tenantId, tenantId)));
    return member;
  }

  async createTeamMember(data: InsertTeamMember): Promise<TeamMember> {
    const [member] = await db.insert(teamMembers).values(data).returning();
    return member;
  }

  async updateTeamMember(id: string, tenantId: string, data: Partial<InsertTeamMember>): Promise<TeamMember | undefined> {
    const [member] = await db.update(teamMembers).set(data).where(and(eq(teamMembers.id, id), eq(teamMembers.tenantId, tenantId))).returning();
    return member;
  }

  async deleteTeamMember(id: string, tenantId: string): Promise<void> {
    await db.delete(projectTeamMembers).where(and(eq(projectTeamMembers.teamMemberId, id), eq(projectTeamMembers.tenantId, tenantId)));
    await db.delete(teamMembers).where(and(eq(teamMembers.id, id), eq(teamMembers.tenantId, tenantId)));
  }

  async getRateCards(tenantId?: string): Promise<RateCard[]> {
    if (tenantId) return db.select().from(rateCards).where(eq(rateCards.tenantId, tenantId));
    return db.select().from(rateCards);
  }

  async getRateCard(id: string, tenantId: string): Promise<RateCard | undefined> {
    const [card] = await db.select().from(rateCards).where(and(eq(rateCards.id, id), eq(rateCards.tenantId, tenantId)));
    return card;
  }

  async createRateCard(data: InsertRateCard): Promise<RateCard> {
    const [card] = await db.insert(rateCards).values(data).returning();
    return card;
  }

  async updateRateCard(id: string, tenantId: string, data: Partial<InsertRateCard>): Promise<RateCard | undefined> {
    const [card] = await db.update(rateCards).set(data).where(and(eq(rateCards.id, id), eq(rateCards.tenantId, tenantId))).returning();
    return card;
  }

  async deleteRateCard(id: string, tenantId: string): Promise<void> {
    await db.update(projectTeamMembers).set({ rateCardId: null }).where(and(eq(projectTeamMembers.rateCardId, id), eq(projectTeamMembers.tenantId, tenantId)));
    await db.delete(rateCards).where(and(eq(rateCards.id, id), eq(rateCards.tenantId, tenantId)));
  }

  async getProjectTeamMembers(timelineId: string, tenantId: string): Promise<ProjectTeamMemberWithDetails[]> {
    const assignments = await db.select().from(projectTeamMembers).where(and(eq(projectTeamMembers.timelineId, timelineId), eq(projectTeamMembers.tenantId, tenantId)));
    const allMembers = await db.select().from(teamMembers);
    const allCards = await db.select().from(rateCards);

    const memberMap = new Map(allMembers.map(m => [m.id, m]));
    const cardMap = new Map(allCards.map(c => [c.id, c]));

    return assignments.map(a => ({
      ...a,
      teamMember: a.teamMemberId ? memberMap.get(a.teamMemberId) || null : null,
      rateCard: a.rateCardId ? cardMap.get(a.rateCardId) || null : null,
    }));
  }

  async getProjectTeamMemberById(id: string, tenantId: string): Promise<ProjectTeamMember | undefined> {
    const [member] = await db.select().from(projectTeamMembers).where(and(eq(projectTeamMembers.id, id), eq(projectTeamMembers.tenantId, tenantId)));
    return member;
  }

  async createProjectTeamMember(data: InsertProjectTeamMember): Promise<ProjectTeamMember> {
    const [assignment] = await db.insert(projectTeamMembers).values(data).returning();
    return assignment;
  }

  async updateProjectTeamMember(id: string, tenantId: string, data: Partial<InsertProjectTeamMember>): Promise<ProjectTeamMember | undefined> {
    const [assignment] = await db.update(projectTeamMembers).set(data).where(and(eq(projectTeamMembers.id, id), eq(projectTeamMembers.tenantId, tenantId))).returning();
    return assignment;
  }

  async deleteProjectTeamMember(id: string, tenantId: string): Promise<void> {
    await db.delete(projectTeamMembers).where(and(eq(projectTeamMembers.id, id), eq(projectTeamMembers.tenantId, tenantId)));
  }

  async getSettings(tenantId: string = "default"): Promise<AppSettings> {
    const [settings] = await db.select().from(appSettings).where(eq(appSettings.tenantId, tenantId));
    if (settings) return settings;
    const [created] = await db
      .insert(appSettings)
      .values({ id: tenantId === "default" ? "app" : `app_${tenantId}`, tenantId, riskRegisterEnabled: false, opportunitiesEnabled: true })
      .returning();
    return created;
  }

  async getAllocations(teamMemberId: string, tenantId: string): Promise<AllocationWithProject[]> {
    const rows = await db
      .select()
      .from(allocations)
      .where(and(eq(allocations.teamMemberId, teamMemberId), eq(allocations.tenantId, tenantId)));
    const result: AllocationWithProject[] = [];
    for (const row of rows) {
      const [project] = await db.select().from(timelines).where(eq(timelines.id, row.timelineId));
      if (project) {
        result.push({ ...row, project });
      }
    }
    return result;
  }

  async getAllAllAllocations(tenantId?: string): Promise<import("@shared/schema").AllocationFull[]> {
    const rows = tenantId
      ? await db.select().from(allocations).where(eq(allocations.tenantId, tenantId))
      : await db.select().from(allocations);
    const result: import("@shared/schema").AllocationFull[] = [];
    for (const row of rows) {
      const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, row.teamMemberId));
      const [project] = await db.select().from(timelines).where(eq(timelines.id, row.timelineId));
      if (member && project) {
        result.push({ ...row, teamMember: member, project });
      }
    }
    return result;
  }

  async getAllocation(id: string, tenantId: string): Promise<Allocation | undefined> {
    const [row] = await db.select().from(allocations).where(and(eq(allocations.id, id), eq(allocations.tenantId, tenantId)));
    return row;
  }

  async getAllocationsByTimeline(timelineId: string, tenantId: string): Promise<AllocationWithTeamMember[]> {
    const rows = await db
      .select()
      .from(allocations)
      .where(and(eq(allocations.timelineId, timelineId), eq(allocations.tenantId, tenantId)));
    const result: AllocationWithTeamMember[] = [];
    for (const row of rows) {
      const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, row.teamMemberId));
      if (member) {
        result.push({ ...row, teamMember: member });
      }
    }
    return result;
  }

  async createAllocation(data: InsertAllocation): Promise<Allocation> {
    const [allocation] = await db.insert(allocations).values(data).returning();
    return allocation;
  }

  async updateAllocation(id: string, tenantId: string, data: Partial<InsertAllocation>): Promise<Allocation | undefined> {
    const [allocation] = await db.update(allocations).set(data).where(and(eq(allocations.id, id), eq(allocations.tenantId, tenantId))).returning();
    return allocation;
  }

  async deleteAllocation(id: string, tenantId: string): Promise<void> {
    await db.delete(allocations).where(and(eq(allocations.id, id), eq(allocations.tenantId, tenantId)));
  }

  async updateSettings(data: Partial<Omit<AppSettings, "id">>, tenantId: string = "default"): Promise<AppSettings> {
    await this.getSettings(tenantId);
    const [updated] = await db
      .update(appSettings)
      .set(data)
      .where(eq(appSettings.tenantId, tenantId))
      .returning();
    return updated;
  }

  async getBranding(tenantId: string = "default"): Promise<BrandingConfig> {
    const [branding] = await db.select().from(brandingConfig).where(eq(brandingConfig.tenantId, tenantId));
    if (branding) return branding;
    const [created] = await db
      .insert(brandingConfig)
      .values({ id: tenantId === "default" ? "default" : `brand_${tenantId}`, tenantId })
      .returning();
    return created;
  }

  async updateBranding(data: Partial<InsertBranding>, tenantId: string = "default"): Promise<BrandingConfig> {
    await this.getBranding(tenantId);
    const [updated] = await db
      .update(brandingConfig)
      .set(data)
      .where(eq(brandingConfig.tenantId, tenantId))
      .returning();
    return updated;
  }

  async getTimesheetEntries(tenantId: string, filters?: { timelineId?: string; teamMemberId?: string; weekEnding?: string; taskId?: string; dayDate?: string }): Promise<TimesheetEntry[]> {
    const conditions = [eq(timesheetEntries.tenantId, tenantId)];
    if (filters?.timelineId) conditions.push(eq(timesheetEntries.timelineId, filters.timelineId));
    if (filters?.teamMemberId) conditions.push(eq(timesheetEntries.teamMemberId, filters.teamMemberId));
    if (filters?.weekEnding) conditions.push(eq(timesheetEntries.weekEnding, filters.weekEnding));
    if (filters?.taskId) conditions.push(eq(timesheetEntries.taskId, filters.taskId));
    if (filters?.dayDate) conditions.push(eq(timesheetEntries.dayDate, filters.dayDate));
    return db.select().from(timesheetEntries).where(and(...conditions));
  }

  async getTimesheetEntry(id: string, tenantId: string): Promise<TimesheetEntry | undefined> {
    const [entry] = await db.select().from(timesheetEntries).where(and(eq(timesheetEntries.id, id), eq(timesheetEntries.tenantId, tenantId)));
    return entry;
  }

  async createTimesheetEntry(data: InsertTimesheetEntry): Promise<TimesheetEntry> {
    const [entry] = await db.insert(timesheetEntries).values(data).returning();
    return entry;
  }

  async updateTimesheetEntry(id: string, tenantId: string, data: Partial<InsertTimesheetEntry>): Promise<TimesheetEntry | undefined> {
    const [entry] = await db.update(timesheetEntries).set(data).where(and(eq(timesheetEntries.id, id), eq(timesheetEntries.tenantId, tenantId))).returning();
    return entry;
  }

  async deleteTimesheetEntry(id: string, tenantId: string): Promise<void> {
    await db.delete(timesheetEntries).where(and(eq(timesheetEntries.id, id), eq(timesheetEntries.tenantId, tenantId)));
  }

  async getProgressEntries(tenantId: string, filters?: { timelineId?: string; taskId?: string; weekEnding?: string }): Promise<ProgressEntry[]> {
    const conditions = [eq(progressEntries.tenantId, tenantId)];
    if (filters?.timelineId) conditions.push(eq(progressEntries.timelineId, filters.timelineId));
    if (filters?.taskId) conditions.push(eq(progressEntries.taskId, filters.taskId));
    if (filters?.weekEnding) conditions.push(eq(progressEntries.weekEnding, filters.weekEnding));
    return db.select().from(progressEntries).where(and(...conditions));
  }

  async getProgressEntry(id: string, tenantId: string): Promise<ProgressEntry | undefined> {
    const [entry] = await db.select().from(progressEntries).where(and(eq(progressEntries.id, id), eq(progressEntries.tenantId, tenantId)));
    return entry;
  }

  async createProgressEntry(data: InsertProgressEntry): Promise<ProgressEntry> {
    const [entry] = await db.insert(progressEntries).values(data).returning();
    return entry;
  }

  async updateProgressEntry(id: string, tenantId: string, data: Partial<InsertProgressEntry>): Promise<ProgressEntry | undefined> {
    const [entry] = await db.update(progressEntries).set(data).where(and(eq(progressEntries.id, id), eq(progressEntries.tenantId, tenantId))).returning();
    return entry;
  }

  async deleteProgressEntry(id: string, tenantId: string): Promise<void> {
    await db.delete(progressEntries).where(and(eq(progressEntries.id, id), eq(progressEntries.tenantId, tenantId)));
  }

  async getFlightpathStages(tenantId?: string): Promise<FlightpathStage[]> {
    const tid = tenantId || "default";
    return db.select().from(flightpathStages).where(eq(flightpathStages.tenantId, tid));
  }

  async getFlightpathStage(id: string, tenantId: string): Promise<FlightpathStage | undefined> {
    const [stage] = await db.select().from(flightpathStages).where(and(eq(flightpathStages.id, id), eq(flightpathStages.tenantId, tenantId)));
    return stage;
  }

  async createFlightpathStage(data: InsertFlightpathStage): Promise<FlightpathStage> {
    const [stage] = await db.insert(flightpathStages).values(data).returning();
    return stage;
  }

  async updateFlightpathStage(id: string, tenantId: string, data: Partial<InsertFlightpathStage>): Promise<FlightpathStage | undefined> {
    const [stage] = await db.update(flightpathStages).set(data).where(and(eq(flightpathStages.id, id), eq(flightpathStages.tenantId, tenantId))).returning();
    return stage;
  }

  async deleteFlightpathStage(id: string, tenantId: string): Promise<void> {
    await db.delete(flightpathDeliverables).where(and(eq(flightpathDeliverables.stageId, id), eq(flightpathDeliverables.tenantId, tenantId)));
    await db.delete(flightpathStages).where(and(eq(flightpathStages.id, id), eq(flightpathStages.tenantId, tenantId)));
  }

  async getStageDeliverables(stageId: string, tenantId: string): Promise<FlightpathDeliverable[]> {
    return db.select().from(flightpathDeliverables).where(and(eq(flightpathDeliverables.stageId, stageId), eq(flightpathDeliverables.tenantId, tenantId)));
  }

  async getAllDeliverables(tenantId?: string): Promise<FlightpathDeliverable[]> {
    const stages = await this.getFlightpathStages(tenantId);
    const stageIds = stages.map(s => s.id);
    if (stageIds.length === 0) return [];
    const allDeliverables = await db.select().from(flightpathDeliverables);
    return allDeliverables.filter(d => stageIds.includes(d.stageId));
  }

  async createDeliverable(data: InsertFlightpathDeliverable): Promise<FlightpathDeliverable> {
    const [deliverable] = await db.insert(flightpathDeliverables).values(data).returning();
    return deliverable;
  }

  async updateDeliverable(id: string, tenantId: string, data: Partial<InsertFlightpathDeliverable>): Promise<FlightpathDeliverable | undefined> {
    const [deliverable] = await db.update(flightpathDeliverables).set(data).where(and(eq(flightpathDeliverables.id, id), eq(flightpathDeliverables.tenantId, tenantId))).returning();
    return deliverable;
  }

  async deleteDeliverable(id: string, tenantId: string): Promise<void> {
    await db.delete(flightpathDeliverables).where(and(eq(flightpathDeliverables.id, id), eq(flightpathDeliverables.tenantId, tenantId)));
  }

  async getProjectCheckpoints(timelineId: string, tenantId: string): Promise<ProjectCheckpoint[]> {
    return db.select().from(projectCheckpoints).where(and(eq(projectCheckpoints.timelineId, timelineId), eq(projectCheckpoints.tenantId, tenantId)));
  }

  async getProjectCheckpointsByStage(timelineId: string, stageId: string, tenantId: string): Promise<ProjectCheckpoint[]> {
    return db.select().from(projectCheckpoints).where(and(eq(projectCheckpoints.timelineId, timelineId), eq(projectCheckpoints.stageId, stageId), eq(projectCheckpoints.tenantId, tenantId)));
  }

  async createProjectCheckpoint(data: InsertProjectCheckpoint): Promise<ProjectCheckpoint> {
    const [checkpoint] = await db.insert(projectCheckpoints).values(data).returning();
    return checkpoint;
  }

  async updateProjectCheckpoint(id: string, tenantId: string, data: Partial<InsertProjectCheckpoint>): Promise<ProjectCheckpoint | undefined> {
    const [checkpoint] = await db.update(projectCheckpoints).set(data).where(and(eq(projectCheckpoints.id, id), eq(projectCheckpoints.tenantId, tenantId))).returning();
    return checkpoint;
  }

  async deleteProjectCheckpoint(id: string, tenantId: string): Promise<void> {
    await db.delete(projectCheckpoints).where(and(eq(projectCheckpoints.id, id), eq(projectCheckpoints.tenantId, tenantId)));
  }

  async getProjectGates(timelineId: string, tenantId: string): Promise<ProjectGate[]> {
    return db.select().from(projectGates).where(and(eq(projectGates.timelineId, timelineId), eq(projectGates.tenantId, tenantId)));
  }

  async getProjectGate(timelineId: string, stageId: string, tenantId: string): Promise<ProjectGate | undefined> {
    const [gate] = await db.select().from(projectGates).where(and(eq(projectGates.timelineId, timelineId), eq(projectGates.stageId, stageId), eq(projectGates.tenantId, tenantId)));
    return gate;
  }

  async createProjectGate(data: InsertProjectGate): Promise<ProjectGate> {
    const [gate] = await db.insert(projectGates).values(data).returning();
    return gate;
  }

  async updateProjectGate(id: string, tenantId: string, data: Partial<InsertProjectGate>): Promise<ProjectGate | undefined> {
    const [gate] = await db.update(projectGates).set(data).where(and(eq(projectGates.id, id), eq(projectGates.tenantId, tenantId))).returning();
    return gate;
  }

  async getWorkstreamResources(taskId: string, tenantId: string): Promise<WorkstreamResource[]> {
    return db.select().from(workstreamResources).where(and(eq(workstreamResources.taskId, taskId), eq(workstreamResources.tenantId, tenantId)));
  }

  async getWorkstreamResourcesByTimeline(timelineId: string, tenantId: string): Promise<WorkstreamResource[]> {
    const timelineTasks = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.timelineId, timelineId), eq(tasks.tenantId, tenantId)));
    const taskIds = timelineTasks.map(t => t.id);
    if (taskIds.length === 0) return [];
    return db.select().from(workstreamResources).where(inArray(workstreamResources.taskId, taskIds));
  }

  async createWorkstreamResource(data: InsertWorkstreamResource): Promise<WorkstreamResource> {
    const [resource] = await db.insert(workstreamResources).values(data).returning();
    return resource;
  }

  async updateWorkstreamResource(id: string, tenantId: string, data: Partial<InsertWorkstreamResource>): Promise<WorkstreamResource | undefined> {
    const [resource] = await db.update(workstreamResources).set(data).where(and(eq(workstreamResources.id, id), eq(workstreamResources.tenantId, tenantId))).returning();
    return resource;
  }

  async deleteWorkstreamResource(id: string, tenantId: string): Promise<void> {
    await db.delete(workstreamResources).where(and(eq(workstreamResources.id, id), eq(workstreamResources.tenantId, tenantId)));
  }

  async getOrgRoles(tenantId: string): Promise<OrgRole[]> {
    return db.select().from(orgRoles).where(eq(orgRoles.tenantId, tenantId));
  }

  async getUserOrgRoles(userId: string, tenantId: string): Promise<OrgRole[]> {
    const rows = await db
      .select({ role: orgRoles })
      .from(userOrgRoles)
      .innerJoin(orgRoles, eq(orgRoles.id, userOrgRoles.roleId))
      .where(and(
        eq(userOrgRoles.userId, userId),
        eq(userOrgRoles.tenantId, tenantId),
      ));
    return rows.map(r => r.role);
  }

  async assignUserOrgRole(userId: string, roleId: string, tenantId: string): Promise<void> {
    await db.insert(userOrgRoles).values({ userId, roleId, tenantId }).onConflictDoNothing();
  }

  async removeUserOrgRole(userId: string, roleId: string, tenantId: string): Promise<void> {
    await db.delete(userOrgRoles).where(and(
      eq(userOrgRoles.userId, userId),
      eq(userOrgRoles.roleId, roleId),
      eq(userOrgRoles.tenantId, tenantId),
    ));
  }

  async getObjectAssignments(objectType: string, objectId: string, tenantId: string): Promise<(ObjectAssignment & { user?: User | null; teamMember?: TeamMember | null })[]> {
    const assignments = await db
      .select()
      .from(objectAssignments)
      .where(and(
        eq(objectAssignments.objectType, objectType),
        eq(objectAssignments.objectId, objectId),
        eq(objectAssignments.tenantId, tenantId),
      ));

    const allUsers = await db.select().from(users);
    const allMembers = await db.select().from(teamMembers);
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    const memberByUserIdMap = new Map(allMembers.filter(m => m.userId).map(m => [m.userId!, m]));

    return assignments.map(a => ({
      ...a,
      user: userMap.get(a.userId) || null,
      teamMember: memberByUserIdMap.get(a.userId) || null,
    }));
  }

  async getObjectAssignmentsByUser(userId: string, tenantId: string): Promise<ObjectAssignment[]> {
    return db
      .select()
      .from(objectAssignments)
      .where(and(
        eq(objectAssignments.userId, userId),
        eq(objectAssignments.tenantId, tenantId),
      ));
  }

  async assignObjectRole(objectType: string, objectId: string, userId: string, objectRole: string, tenantId: string): Promise<ObjectAssignment> {
    const [assignment] = await db.insert(objectAssignments).values({
      tenantId,
      objectType,
      objectId,
      userId,
      objectRole,
    }).returning();
    return assignment;
  }

  async removeObjectAssignment(id: string, tenantId: string): Promise<void> {
    await db.delete(objectAssignments).where(and(eq(objectAssignments.id, id), eq(objectAssignments.tenantId, tenantId)));
  }

  async getAuditLog(tenantId: string, filters?: { action?: string; limit?: number; offset?: number }): Promise<AuditLog[]> {
    const conditions = [eq(auditLog.tenantId, tenantId)];
    if (filters?.action) conditions.push(eq(auditLog.action, filters.action));

    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    return db
      .select()
      .from(auditLog)
      .where(and(...conditions))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async createAuditEntry(entry: InsertAuditLog): Promise<AuditLog> {
    const [row] = await db.insert(auditLog).values(entry).returning();
    return row;
  }

  async getUsersByTenant(tenantId: string): Promise<(User & { orgRoles?: OrgRole[]; teamMember?: TeamMember | null })[]> {
    const roleAssignments = await db
      .select()
      .from(userOrgRoles)
      .where(eq(userOrgRoles.tenantId, tenantId));

    const tenantUserIds = [...new Set(roleAssignments.map(ra => ra.userId))];
    if (tenantUserIds.length === 0) return [];

    const tenantUsers = await db.select().from(users).where(inArray(users.id, tenantUserIds));
    const tenantRoles = await db.select().from(orgRoles).where(eq(orgRoles.tenantId, tenantId));
    const tenantMembers = await db.select().from(teamMembers).where(eq(teamMembers.tenantId, tenantId));

    const roleMap = new Map(tenantRoles.map(r => [r.id, r]));
    const memberByUserIdMap = new Map(tenantMembers.filter(m => m.userId).map(m => [m.userId!, m]));

    return tenantUsers.map(u => {
      const userRoles = roleAssignments.filter(ra => ra.userId === u.id);
      const roles = userRoles.map(ra => roleMap.get(ra.roleId)).filter(Boolean) as OrgRole[];
      return {
        ...u,
        orgRoles: roles,
        teamMember: memberByUserIdMap.get(u.id) || null,
      };
    });
  }

  async updateUserDemographics(userId: string, data: { firstName?: string; lastName?: string; email?: string }): Promise<User | undefined> {
    const updateData: Record<string, any> = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.email !== undefined) updateData.email = data.email;
    updateData.updatedAt = new Date();
    const [updated] = await db.update(users).set(updateData).where(eq(users.id, userId)).returning();
    return updated;
  }

  async linkTeamMemberToUser(teamMemberId: string, userId: string): Promise<void> {
    await db.update(teamMembers).set({ userId }).where(eq(teamMembers.id, teamMemberId));
  }

  async unlinkTeamMemberFromUser(teamMemberId: string): Promise<void> {
    await db.update(teamMembers).set({ userId: null }).where(eq(teamMembers.id, teamMemberId));
  }

  async getTeamMemberByUserId(userId: string, tenantId?: string): Promise<TeamMember | undefined> {
    const conditions = [eq(teamMembers.userId, userId)];
    if (tenantId) conditions.push(eq(teamMembers.tenantId, tenantId));
    const [member] = await db.select().from(teamMembers).where(and(...conditions));
    return member;
  }

  async createUserFromTeamMember(email: string, teamMemberId: string): Promise<User> {
    const [existingUser] = await db.select().from(users).where(eq(users.email, email));

    let user: User;
    if (existingUser) {
      user = existingUser;
    } else {
      const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, teamMemberId));
      const nameParts = member?.name?.split(" ") || [];
      const [created] = await db.insert(users).values({
        email,
        firstName: nameParts[0] || null,
        lastName: nameParts.slice(1).join(" ") || null,
      }).returning();
      user = created;
    }

    await db.update(teamMembers).set({ userId: user.id }).where(eq(teamMembers.id, teamMemberId));

    const [linkedMember] = await db.select().from(teamMembers).where(eq(teamMembers.id, teamMemberId));
    const memberTenantId = linkedMember?.tenantId || "default";
    const memberRole = await db.select().from(orgRoles).where(and(
      eq(orgRoles.name, "Member"),
      eq(orgRoles.tenantId, memberTenantId),
    ));
    if (memberRole.length > 0) {
      await db.insert(userOrgRoles).values({
        userId: user.id,
        roleId: memberRole[0].id,
        tenantId: memberTenantId,
      }).onConflictDoNothing();
    }

    return user;
  }

  async getEvmSnapshots(timelineId: string, tenantId: string): Promise<EvmSnapshot[]> {
    return db.select().from(evmSnapshots)
      .where(and(eq(evmSnapshots.timelineId, timelineId), eq(evmSnapshots.isCurrent, true), eq(evmSnapshots.tenantId, tenantId)))
      .orderBy(evmSnapshots.weekEnding);
  }

  async getEvmSnapshotAllVersions(timelineId: string, weekEnding: string, tenantId: string): Promise<EvmSnapshot[]> {
    return db.select().from(evmSnapshots)
      .where(and(eq(evmSnapshots.timelineId, timelineId), eq(evmSnapshots.weekEnding, weekEnding), eq(evmSnapshots.tenantId, tenantId)))
      .orderBy(desc(evmSnapshots.version));
  }

  async getEvmSnapshot(timelineId: string, weekEnding: string, tenantId: string): Promise<EvmSnapshot | undefined> {
    const [snapshot] = await db.select().from(evmSnapshots)
      .where(and(
        eq(evmSnapshots.timelineId, timelineId),
        eq(evmSnapshots.weekEnding, weekEnding),
        eq(evmSnapshots.tenantId, tenantId),
        eq(evmSnapshots.isCurrent, true),
      ));
    return snapshot;
  }

  async createEvmSnapshot(data: InsertEvmSnapshot): Promise<EvmSnapshot> {
    const existing = await db.select().from(evmSnapshots)
      .where(and(
        eq(evmSnapshots.timelineId, data.timelineId),
        eq(evmSnapshots.weekEnding, data.weekEnding),
        eq(evmSnapshots.isCurrent, true),
      ));

    let nextVersion = 1;
    if (existing.length > 0) {
      const maxVersion = Math.max(...existing.map(e => e.version));
      nextVersion = maxVersion + 1;
      await db.update(evmSnapshots)
        .set({ isCurrent: false })
        .where(and(
          eq(evmSnapshots.timelineId, data.timelineId),
          eq(evmSnapshots.weekEnding, data.weekEnding),
          eq(evmSnapshots.isCurrent, true),
        ));
    }

    const [snapshot] = await db.insert(evmSnapshots).values({
      ...data,
      version: nextVersion,
      isCurrent: true,
    }).returning();
    return snapshot;
  }

  async deleteEvmSnapshot(id: string, tenantId: string): Promise<void> {
    await db.delete(evmSnapshots).where(and(eq(evmSnapshots.id, id), eq(evmSnapshots.tenantId, tenantId)));
  }

  async getLatestEvmSnapshot(timelineId: string, tenantId: string): Promise<EvmSnapshot | undefined> {
    const [snapshot] = await db.select().from(evmSnapshots)
      .where(and(eq(evmSnapshots.timelineId, timelineId), eq(evmSnapshots.isCurrent, true), eq(evmSnapshots.tenantId, tenantId)))
      .orderBy(desc(evmSnapshots.weekEnding))
      .limit(1);
    return snapshot;
  }

  async getAssignedTimelineIds(teamMemberId: string): Promise<string[]> {
    const ptmRows = await db.select({ timelineId: projectTeamMembers.timelineId })
      .from(projectTeamMembers)
      .where(eq(projectTeamMembers.teamMemberId, teamMemberId));
    const allocRows = await db.select({ timelineId: allocations.timelineId })
      .from(allocations)
      .where(eq(allocations.teamMemberId, teamMemberId));
    const idSet = new Set([
      ...ptmRows.map(r => r.timelineId),
      ...allocRows.map(r => r.timelineId),
    ]);
    return Array.from(idSet);
  }

  async getTimelinesByIds(ids: string[], recordType?: string): Promise<TimelineWithMilestones[]> {
    if (ids.length === 0) return [];
    const allTimelines = await db.select().from(timelines).where(inArray(timelines.id, ids));
    const filtered = recordType ? allTimelines.filter(t => t.recordType === recordType) : allTimelines;
    const allMilestones = ids.length > 0 ? await db.select().from(milestones).where(inArray(milestones.timelineId, ids)) : [];
    return filtered.map(t => ({
      ...t,
      milestones: allMilestones.filter(m => m.timelineId === t.id),
    }));
  }

  async getClientsByTimelineIds(timelineIds: string[]): Promise<Client[]> {
    if (timelineIds.length === 0) return [];
    const rows = await db.select({ clientId: timelines.clientId })
      .from(timelines)
      .where(inArray(timelines.id, timelineIds));
    const clientIds = [...new Set(rows.map(r => r.clientId).filter(Boolean))] as string[];
    if (clientIds.length === 0) return [];
    return db.select().from(clients).where(inArray(clients.id, clientIds));
  }

  async getContactsByClientIds(clientIds: string[]): Promise<Contact[]> {
    if (clientIds.length === 0) return [];
    return db.select().from(contacts).where(inArray(contacts.clientId, clientIds));
  }

  async getTeamMembersByTimelineIds(timelineIds: string[]): Promise<TeamMember[]> {
    if (timelineIds.length === 0) return [];
    const ptmRows = await db.select({ teamMemberId: projectTeamMembers.teamMemberId })
      .from(projectTeamMembers)
      .where(inArray(projectTeamMembers.timelineId, timelineIds));
    const allocRows = await db.select({ teamMemberId: allocations.teamMemberId })
      .from(allocations)
      .where(inArray(allocations.timelineId, timelineIds));
    const tmIds = [...new Set([
      ...ptmRows.map(r => r.teamMemberId),
      ...allocRows.map(r => r.teamMemberId),
    ])].filter(Boolean) as string[];
    if (tmIds.length === 0) return [];
    return db.select().from(teamMembers).where(inArray(teamMembers.id, tmIds));
  }

  async createOrgRole(data: { tenantId: string; name: string; description?: string; isSystem?: boolean }): Promise<OrgRole> {
    const [role] = await db.insert(orgRoles).values({
      tenantId: data.tenantId,
      name: data.name,
      description: data.description || null,
      isSystem: data.isSystem ?? false,
    }).returning();
    return role;
  }

  async updateOrgRole(id: string, tenantId: string, data: { name?: string; description?: string }): Promise<OrgRole | undefined> {
    const [role] = await db.update(orgRoles)
      .set(data)
      .where(and(eq(orgRoles.id, id), eq(orgRoles.tenantId, tenantId)))
      .returning();
    return role;
  }

  async deleteOrgRole(id: string, tenantId: string): Promise<void> {
    await db.delete(orgRoles).where(and(eq(orgRoles.id, id), eq(orgRoles.tenantId, tenantId)));
  }

  async getOrgRolePermissions(roleId: string, tenantId: string): Promise<string[]> {
    const rows = await db.select({ permissionKey: orgRolePermissions.permissionKey })
      .from(orgRolePermissions)
      .where(and(
        eq(orgRolePermissions.roleId, roleId),
        eq(orgRolePermissions.tenantId, tenantId),
      ));
    return rows.map(r => r.permissionKey);
  }

  async setOrgRolePermissions(roleId: string, tenantId: string, permissionKeys: string[]): Promise<void> {
    await db.delete(orgRolePermissions).where(and(
      eq(orgRolePermissions.roleId, roleId),
      eq(orgRolePermissions.tenantId, tenantId),
    ));
    for (const permKey of permissionKeys) {
      await db.insert(orgRolePermissions).values({
        tenantId,
        roleId,
        permissionKey: permKey,
      }).onConflictDoNothing();
    }
  }

  async getOrgRoleUserCount(roleId: string, tenantId: string): Promise<number> {
    const rows = await db.select({ userId: userOrgRoles.userId })
      .from(userOrgRoles)
      .where(and(
        eq(userOrgRoles.roleId, roleId),
        eq(userOrgRoles.tenantId, tenantId),
      ));
    return rows.length;
  }

  async getTenants(): Promise<import("@shared/schema").Tenant[]> {
    return db.select().from(tenants);
  }

  async getTenant(id: string): Promise<import("@shared/schema").Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async getTenantBySlug(slug: string): Promise<import("@shared/schema").Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.slug, slug));
    return tenant;
  }

  async createTenant(data: import("@shared/schema").InsertTenant): Promise<import("@shared/schema").Tenant> {
    const [tenant] = await db.insert(tenants).values(data).returning();
    return tenant;
  }

  async updateTenant(id: string, data: Partial<import("@shared/schema").InsertTenant>): Promise<import("@shared/schema").Tenant | undefined> {
    const [tenant] = await db.update(tenants).set({ ...data, updatedAt: new Date() }).where(eq(tenants.id, id)).returning();
    return tenant;
  }

  async deleteTenant(id: string): Promise<boolean> {
    return db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, id));
      if (!existing) return false;

      // Delete all tenant-scoped data. Order matters: referencing tables are
      // deleted before the tables they reference (rate_cards / team_members are
      // referenced without ON DELETE cascade). Cascade FKs handle deeper children.
      await tx.delete(messages).where(eq(messages.tenantId, id));
      await tx.delete(conversations).where(eq(conversations.tenantId, id));
      await tx.delete(orgRolePermissions).where(eq(orgRolePermissions.tenantId, id));
      await tx.delete(userOrgRoles).where(eq(userOrgRoles.tenantId, id));
      await tx.delete(objectAssignments).where(eq(objectAssignments.tenantId, id));
      await tx.delete(auditLog).where(eq(auditLog.tenantId, id));
      await tx.delete(workstreamResources).where(eq(workstreamResources.tenantId, id));
      await tx.delete(projectTeamMembers).where(eq(projectTeamMembers.tenantId, id));
      await tx.delete(allocations).where(eq(allocations.tenantId, id));
      await tx.delete(timesheetEntries).where(eq(timesheetEntries.tenantId, id));
      await tx.delete(progressEntries).where(eq(progressEntries.tenantId, id));
      await tx.delete(evmSnapshots).where(eq(evmSnapshots.tenantId, id));
      await tx.delete(projectCheckpoints).where(eq(projectCheckpoints.tenantId, id));
      await tx.delete(projectGates).where(eq(projectGates.tenantId, id));
      await tx.delete(tasks).where(eq(tasks.tenantId, id));
      await tx.delete(milestones).where(eq(milestones.tenantId, id));
      await tx.delete(risks).where(eq(risks.tenantId, id));
      await tx.delete(flightpathDeliverables).where(eq(flightpathDeliverables.tenantId, id));
      await tx.delete(flightpathStages).where(eq(flightpathStages.tenantId, id));
      await tx.delete(businessOutcomes).where(eq(businessOutcomes.tenantId, id));
      await tx.delete(contacts).where(eq(contacts.tenantId, id));
      await tx.delete(timelines).where(eq(timelines.tenantId, id));
      await tx.delete(clients).where(eq(clients.tenantId, id));
      await tx.delete(rateCards).where(eq(rateCards.tenantId, id));
      await tx.delete(teamMembers).where(eq(teamMembers.tenantId, id));
      await tx.delete(orgRoles).where(eq(orgRoles.tenantId, id));
      await tx.delete(apiTokens).where(eq(apiTokens.tenantId, id));
      await tx.delete(appSettings).where(eq(appSettings.tenantId, id));
      await tx.delete(brandingConfig).where(eq(brandingConfig.tenantId, id));
      await tx.delete(tenants).where(eq(tenants.id, id));

      return true;
    });
  }

  async getTenantUsage(tenantId: string): Promise<{ userCount: number; projectCount: number; opportunityCount: number }> {
    const userRows = await db.select({ userId: userOrgRoles.userId })
      .from(userOrgRoles)
      .where(eq(userOrgRoles.tenantId, tenantId));
    const uniqueUsers = new Set(userRows.map(r => r.userId));

    const projectRows = await db.select({ id: timelines.id })
      .from(timelines)
      .where(and(eq(timelines.tenantId, tenantId), eq(timelines.recordType, "project")));

    const oppRows = await db.select({ id: timelines.id })
      .from(timelines)
      .where(and(eq(timelines.tenantId, tenantId), eq(timelines.recordType, "opportunity")));

    return {
      userCount: uniqueUsers.size,
      projectCount: projectRows.length,
      opportunityCount: oppRows.length,
    };
  }

  async getApiTokens(tenantId: string): Promise<import("@shared/schema").ApiToken[]> {
    return db.select().from(apiTokens).where(eq(apiTokens.tenantId, tenantId)).orderBy(desc(apiTokens.createdAt));
  }

  async getApiToken(id: string, tenantId: string): Promise<import("@shared/schema").ApiToken | undefined> {
    const [token] = await db.select().from(apiTokens).where(and(eq(apiTokens.id, id), eq(apiTokens.tenantId, tenantId)));
    return token;
  }

  async getApiTokenByHash(tokenHash: string): Promise<import("@shared/schema").ApiToken | undefined> {
    const [token] = await db.select().from(apiTokens).where(eq(apiTokens.tokenHash, tokenHash));
    return token;
  }

  async createApiToken(data: import("@shared/schema").InsertApiToken): Promise<import("@shared/schema").ApiToken> {
    const [token] = await db.insert(apiTokens).values(data).returning();
    return token;
  }

  async revokeApiToken(id: string, tenantId: string): Promise<import("@shared/schema").ApiToken | undefined> {
    const [token] = await db.update(apiTokens).set({ revokedAt: new Date() }).where(and(eq(apiTokens.id, id), eq(apiTokens.tenantId, tenantId))).returning();
    return token;
  }

  async updateApiTokenLastUsed(id: string): Promise<void> {
    await db.update(apiTokens).set({ lastUsedAt: new Date() }).where(eq(apiTokens.id, id));
  }

  async getBusinessOutcomes(tenantId: string, filters?: { projectId?: string; opportunityId?: string }): Promise<BusinessOutcome[]> {
    const conditions = [eq(businessOutcomes.tenantId, tenantId)];
    if (filters?.projectId) conditions.push(eq(businessOutcomes.projectId, filters.projectId));
    if (filters?.opportunityId) conditions.push(eq(businessOutcomes.opportunityId, filters.opportunityId));
    return db.select().from(businessOutcomes).where(and(...conditions)).orderBy(desc(businessOutcomes.createdAt));
  }

  async getBusinessOutcome(id: string, tenantId: string): Promise<BusinessOutcome | undefined> {
    const [outcome] = await db.select().from(businessOutcomes).where(and(eq(businessOutcomes.id, id), eq(businessOutcomes.tenantId, tenantId)));
    return outcome;
  }

  async createBusinessOutcome(data: InsertBusinessOutcome): Promise<BusinessOutcome> {
    const [outcome] = await db.insert(businessOutcomes).values(data).returning();
    return outcome;
  }

  async updateBusinessOutcome(id: string, tenantId: string, data: Partial<InsertBusinessOutcome>): Promise<BusinessOutcome | undefined> {
    const [outcome] = await db.update(businessOutcomes).set({ ...data, updatedAt: new Date() }).where(and(eq(businessOutcomes.id, id), eq(businessOutcomes.tenantId, tenantId))).returning();
    return outcome;
  }

  async deleteBusinessOutcome(id: string, tenantId: string): Promise<void> {
    await db.delete(businessOutcomes).where(and(eq(businessOutcomes.id, id), eq(businessOutcomes.tenantId, tenantId)));
  }

  async createHealthHistory(data: InsertTimelineHealthHistory): Promise<TimelineHealthHistory> {
    const [row] = await db.insert(timelineHealthHistory).values(data).returning();
    return row;
  }

  async getHealthHistory(timelineId: string, tenantId: string, range?: HealthHistoryRange): Promise<TimelineHealthHistory[]> {
    const conditions = [eq(timelineHealthHistory.timelineId, timelineId), eq(timelineHealthHistory.tenantId, tenantId)];
    if (range?.from) conditions.push(gte(timelineHealthHistory.recordedAt, range.from));
    if (range?.to) conditions.push(lte(timelineHealthHistory.recordedAt, range.to));
    return db.select().from(timelineHealthHistory).where(and(...conditions)).orderBy(asc(timelineHealthHistory.recordedAt));
  }

  async getHealthHistoryByTimelineIds(timelineIds: string[], tenantId: string, range?: HealthHistoryRange): Promise<TimelineHealthHistory[]> {
    if (timelineIds.length === 0) return [];
    const conditions = [inArray(timelineHealthHistory.timelineId, timelineIds), eq(timelineHealthHistory.tenantId, tenantId)];
    if (range?.from) conditions.push(gte(timelineHealthHistory.recordedAt, range.from));
    if (range?.to) conditions.push(lte(timelineHealthHistory.recordedAt, range.to));
    return db.select().from(timelineHealthHistory).where(and(...conditions)).orderBy(asc(timelineHealthHistory.recordedAt));
  }

  async getHealthHistoryBaseline(timelineIds: string[], tenantId: string, before: Date): Promise<TimelineHealthHistory[]> {
    if (timelineIds.length === 0) return [];
    return db
      .selectDistinctOn([timelineHealthHistory.timelineId])
      .from(timelineHealthHistory)
      .where(
        and(
          inArray(timelineHealthHistory.timelineId, timelineIds),
          eq(timelineHealthHistory.tenantId, tenantId),
          lte(timelineHealthHistory.recordedAt, before),
        ),
      )
      .orderBy(asc(timelineHealthHistory.timelineId), desc(timelineHealthHistory.recordedAt));
  }

  async getProjectQualityMetrics(timelineId: string, tenantId: string): Promise<ProjectQualityMetric[]> {
    return db.select().from(projectQualityMetrics)
      .where(and(eq(projectQualityMetrics.timelineId, timelineId), eq(projectQualityMetrics.tenantId, tenantId)))
      .orderBy(desc(projectQualityMetrics.snapshotDate));
  }

  async getQualityMetricsByTimelineIds(timelineIds: string[], tenantId: string): Promise<ProjectQualityMetric[]> {
    if (timelineIds.length === 0) return [];
    return db.select().from(projectQualityMetrics)
      .where(and(inArray(projectQualityMetrics.timelineId, timelineIds), eq(projectQualityMetrics.tenantId, tenantId)))
      .orderBy(desc(projectQualityMetrics.snapshotDate));
  }

  async createProjectQualityMetric(data: InsertProjectQualityMetric): Promise<ProjectQualityMetric> {
    const [row] = await db.insert(projectQualityMetrics).values(data).returning();
    return row;
  }

  async getScopeChangeRequests(timelineId: string, tenantId: string): Promise<ScopeChangeRequest[]> {
    return db.select().from(scopeChangeRequests)
      .where(and(eq(scopeChangeRequests.timelineId, timelineId), eq(scopeChangeRequests.tenantId, tenantId)))
      .orderBy(desc(scopeChangeRequests.createdAt));
  }

  async getScopeChangeRequestsByTimelineIds(timelineIds: string[], tenantId: string): Promise<ScopeChangeRequest[]> {
    if (timelineIds.length === 0) return [];
    return db.select().from(scopeChangeRequests)
      .where(and(inArray(scopeChangeRequests.timelineId, timelineIds), eq(scopeChangeRequests.tenantId, tenantId)))
      .orderBy(desc(scopeChangeRequests.createdAt));
  }

  async createScopeChangeRequest(data: InsertScopeChangeRequest): Promise<ScopeChangeRequest> {
    const [row] = await db.insert(scopeChangeRequests).values(data).returning();
    return row;
  }

  async getExecutiveAttentionItems(timelineId: string, tenantId: string): Promise<ExecutiveAttentionItem[]> {
    return db.select().from(executiveAttentionItems)
      .where(and(eq(executiveAttentionItems.timelineId, timelineId), eq(executiveAttentionItems.tenantId, tenantId)))
      .orderBy(desc(executiveAttentionItems.createdAt));
  }

  async getExecutiveAttentionItemsByTimelineIds(timelineIds: string[], tenantId: string): Promise<ExecutiveAttentionItem[]> {
    if (timelineIds.length === 0) return [];
    return db.select().from(executiveAttentionItems)
      .where(and(inArray(executiveAttentionItems.timelineId, timelineIds), eq(executiveAttentionItems.tenantId, tenantId)))
      .orderBy(desc(executiveAttentionItems.createdAt));
  }

  async createExecutiveAttentionItem(data: InsertExecutiveAttentionItem): Promise<ExecutiveAttentionItem> {
    const [row] = await db.insert(executiveAttentionItems).values(data).returning();
    return row;
  }

  async getProjectStageEntries(timelineId: string, tenantId: string): Promise<ProjectStageEntry[]> {
    return db.select().from(projectStageEntries)
      .where(and(eq(projectStageEntries.timelineId, timelineId), eq(projectStageEntries.tenantId, tenantId)))
      .orderBy(asc(projectStageEntries.enteredAt));
  }

  async getStageEntriesByTimelineIds(timelineIds: string[], tenantId: string): Promise<ProjectStageEntry[]> {
    if (timelineIds.length === 0) return [];
    return db.select().from(projectStageEntries)
      .where(and(inArray(projectStageEntries.timelineId, timelineIds), eq(projectStageEntries.tenantId, tenantId)))
      .orderBy(asc(projectStageEntries.enteredAt));
  }

  async createProjectStageEntry(data: InsertProjectStageEntry): Promise<ProjectStageEntry> {
    const [row] = await db.insert(projectStageEntries).values(data).returning();
    return row;
  }

  async getPortfolioSnapshotsByTimelineIds(timelineIds: string[], tenantId: string, range?: HealthHistoryRange): Promise<PortfolioSnapshot[]> {
    if (timelineIds.length === 0) return [];
    const conditions = [inArray(portfolioSnapshots.timelineId, timelineIds), eq(portfolioSnapshots.tenantId, tenantId)];
    if (range?.from) conditions.push(gte(portfolioSnapshots.snapshotDate, range.from.toISOString().split("T")[0]));
    if (range?.to) conditions.push(lte(portfolioSnapshots.snapshotDate, range.to.toISOString().split("T")[0]));
    return db.select().from(portfolioSnapshots)
      .where(and(...conditions))
      .orderBy(asc(portfolioSnapshots.snapshotDate));
  }

  async createPortfolioSnapshot(data: InsertPortfolioSnapshot): Promise<PortfolioSnapshot> {
    const [row] = await db.insert(portfolioSnapshots).values(data).returning();
    return row;
  }
}

export const storage = new DatabaseStorage();
