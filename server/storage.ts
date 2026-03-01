import { eq, and, inArray, desc } from "drizzle-orm";
import { db } from "./db";
import {
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
} from "@shared/schema";

export interface IStorage {
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  getClientWithProjects(id: string): Promise<ClientWithProjects | undefined>;
  createClient(data: InsertClient): Promise<Client>;
  updateClient(id: string, data: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;
  getAllContacts(): Promise<Contact[]>;
  getContacts(clientId: string): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  createContact(data: InsertContact): Promise<Contact>;
  updateContact(id: string, data: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: string): Promise<void>;
  getTimelines(recordType?: string): Promise<TimelineWithMilestones[]>;
  getTimeline(id: string): Promise<TimelineWithMilestones | undefined>;
  createTimeline(data: InsertTimeline): Promise<Timeline>;
  updateTimeline(id: string, data: Partial<InsertTimeline>): Promise<Timeline | undefined>;
  deleteTimeline(id: string): Promise<void>;
  createMilestone(data: InsertMilestone): Promise<Milestone>;
  updateMilestone(id: string, data: Partial<InsertMilestone>): Promise<Milestone | undefined>;
  deleteMilestone(id: string): Promise<void>;
  getTask(id: string): Promise<Task | undefined>;
  getTasksByTimeline(timelineId: string): Promise<Task[]>;
  getTasksByParent(parentTaskId: string): Promise<Task[]>;
  createTask(data: InsertTask): Promise<Task>;
  updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string): Promise<void>;
  getRisks(timelineId: string): Promise<Risk[]>;
  createRisk(data: InsertRisk): Promise<Risk>;
  updateRisk(id: string, data: Partial<InsertRisk>): Promise<Risk | undefined>;
  deleteRisk(id: string): Promise<void>;
  getTeamMembers(): Promise<TeamMember[]>;
  getTeamMember(id: string): Promise<TeamMember | undefined>;
  createTeamMember(data: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(id: string, data: Partial<InsertTeamMember>): Promise<TeamMember | undefined>;
  deleteTeamMember(id: string): Promise<void>;
  getRateCards(): Promise<RateCard[]>;
  getRateCard(id: string): Promise<RateCard | undefined>;
  createRateCard(data: InsertRateCard): Promise<RateCard>;
  updateRateCard(id: string, data: Partial<InsertRateCard>): Promise<RateCard | undefined>;
  deleteRateCard(id: string): Promise<void>;
  getProjectTeamMembers(timelineId: string): Promise<ProjectTeamMemberWithDetails[]>;
  getProjectTeamMemberById(id: string): Promise<ProjectTeamMember | undefined>;
  createProjectTeamMember(data: InsertProjectTeamMember): Promise<ProjectTeamMember>;
  updateProjectTeamMember(id: string, data: Partial<InsertProjectTeamMember>): Promise<ProjectTeamMember | undefined>;
  deleteProjectTeamMember(id: string): Promise<void>;
  getAllocation(id: string): Promise<Allocation | undefined>;
  getAllocations(teamMemberId: string): Promise<AllocationWithProject[]>;
  getAllAllAllocations(): Promise<import("@shared/schema").AllocationFull[]>;
  getAllocationsByTimeline(timelineId: string): Promise<AllocationWithTeamMember[]>;
  createAllocation(data: InsertAllocation): Promise<Allocation>;
  updateAllocation(id: string, data: Partial<InsertAllocation>): Promise<Allocation | undefined>;
  deleteAllocation(id: string): Promise<void>;
  getSettings(): Promise<AppSettings>;
  updateSettings(data: Partial<Omit<AppSettings, "id">>): Promise<AppSettings>;
  getBranding(): Promise<BrandingConfig>;
  updateBranding(data: Partial<InsertBranding>): Promise<BrandingConfig>;
  getTimesheetEntries(filters?: { timelineId?: string; teamMemberId?: string; weekEnding?: string; taskId?: string; dayDate?: string }): Promise<TimesheetEntry[]>;
  getTimesheetEntry(id: string): Promise<TimesheetEntry | undefined>;
  createTimesheetEntry(data: InsertTimesheetEntry): Promise<TimesheetEntry>;
  updateTimesheetEntry(id: string, data: Partial<InsertTimesheetEntry>): Promise<TimesheetEntry | undefined>;
  deleteTimesheetEntry(id: string): Promise<void>;
  getProgressEntries(filters?: { timelineId?: string; taskId?: string; weekEnding?: string }): Promise<ProgressEntry[]>;
  getProgressEntry(id: string): Promise<ProgressEntry | undefined>;
  createProgressEntry(data: InsertProgressEntry): Promise<ProgressEntry>;
  updateProgressEntry(id: string, data: Partial<InsertProgressEntry>): Promise<ProgressEntry | undefined>;
  deleteProgressEntry(id: string): Promise<void>;
  getFlightpathStages(tenantId?: string): Promise<FlightpathStage[]>;
  getFlightpathStage(id: string): Promise<FlightpathStage | undefined>;
  createFlightpathStage(data: InsertFlightpathStage): Promise<FlightpathStage>;
  updateFlightpathStage(id: string, data: Partial<InsertFlightpathStage>): Promise<FlightpathStage | undefined>;
  deleteFlightpathStage(id: string): Promise<void>;
  getStageDeliverables(stageId: string): Promise<FlightpathDeliverable[]>;
  getAllDeliverables(tenantId?: string): Promise<FlightpathDeliverable[]>;
  createDeliverable(data: InsertFlightpathDeliverable): Promise<FlightpathDeliverable>;
  updateDeliverable(id: string, data: Partial<InsertFlightpathDeliverable>): Promise<FlightpathDeliverable | undefined>;
  deleteDeliverable(id: string): Promise<void>;
  getProjectCheckpoints(timelineId: string): Promise<ProjectCheckpoint[]>;
  getProjectCheckpointsByStage(timelineId: string, stageId: string): Promise<ProjectCheckpoint[]>;
  createProjectCheckpoint(data: InsertProjectCheckpoint): Promise<ProjectCheckpoint>;
  updateProjectCheckpoint(id: string, data: Partial<InsertProjectCheckpoint>): Promise<ProjectCheckpoint | undefined>;
  deleteProjectCheckpoint(id: string): Promise<void>;
  getProjectGates(timelineId: string): Promise<ProjectGate[]>;
  getProjectGate(timelineId: string, stageId: string): Promise<ProjectGate | undefined>;
  createProjectGate(data: InsertProjectGate): Promise<ProjectGate>;
  updateProjectGate(id: string, data: Partial<InsertProjectGate>): Promise<ProjectGate | undefined>;
  getWorkstreamResources(taskId: string): Promise<WorkstreamResource[]>;
  getWorkstreamResourcesByTimeline(timelineId: string): Promise<WorkstreamResource[]>;
  createWorkstreamResource(data: InsertWorkstreamResource): Promise<WorkstreamResource>;
  updateWorkstreamResource(id: string, data: Partial<InsertWorkstreamResource>): Promise<WorkstreamResource | undefined>;
  deleteWorkstreamResource(id: string): Promise<void>;

  getOrgRoles(tenantId: string): Promise<OrgRole[]>;
  getUserOrgRoles(userId: string, tenantId: string): Promise<OrgRole[]>;
  assignUserOrgRole(userId: string, roleId: string, tenantId: string): Promise<void>;
  removeUserOrgRole(userId: string, roleId: string, tenantId: string): Promise<void>;
  getObjectAssignments(objectType: string, objectId: string, tenantId: string): Promise<(ObjectAssignment & { user?: User | null; teamMember?: TeamMember | null })[]>;
  getObjectAssignmentsByUser(userId: string, tenantId: string): Promise<ObjectAssignment[]>;
  assignObjectRole(objectType: string, objectId: string, userId: string, objectRole: string, tenantId: string): Promise<ObjectAssignment>;
  removeObjectAssignment(id: string): Promise<void>;
  getAuditLog(tenantId: string, filters?: { action?: string; limit?: number; offset?: number }): Promise<AuditLog[]>;
  createAuditEntry(entry: InsertAuditLog): Promise<AuditLog>;
  getUsersByTenant(tenantId: string): Promise<(User & { orgRoles?: OrgRole[]; teamMember?: TeamMember | null })[]>;
  linkTeamMemberToUser(teamMemberId: string, userId: string): Promise<void>;
  unlinkTeamMemberFromUser(teamMemberId: string): Promise<void>;
  getTeamMemberByUserId(userId: string): Promise<TeamMember | undefined>;
  createUserFromTeamMember(email: string, teamMemberId: string): Promise<User>;
  getEvmSnapshots(timelineId: string): Promise<EvmSnapshot[]>;
  getEvmSnapshotAllVersions(timelineId: string, weekEnding: string): Promise<EvmSnapshot[]>;
  getEvmSnapshot(timelineId: string, weekEnding: string): Promise<EvmSnapshot | undefined>;
  createEvmSnapshot(data: InsertEvmSnapshot): Promise<EvmSnapshot>;
  deleteEvmSnapshot(id: string): Promise<void>;
  getLatestEvmSnapshot(timelineId: string): Promise<EvmSnapshot | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getClients(): Promise<Client[]> {
    return db.select().from(clients);
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async getClientWithProjects(id: string): Promise<ClientWithProjects | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    if (!client) return undefined;

    const allTimelines = await db.select().from(timelines).where(eq(timelines.clientId, id));
    const allMilestones = await db.select().from(milestones);
    const allTasks = await db.select().from(tasks);
    const clientContacts = await db.select().from(contacts).where(eq(contacts.clientId, id));

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

  async updateClient(id: string, data: Partial<InsertClient>): Promise<Client | undefined> {
    const [client] = await db
      .update(clients)
      .set(data)
      .where(eq(clients.id, id))
      .returning();
    return client;
  }

  async deleteClient(id: string): Promise<void> {
    await db.update(timelines).set({ clientId: null }).where(eq(timelines.clientId, id));
    await db.delete(contacts).where(eq(contacts.clientId, id));
    await db.delete(clients).where(eq(clients.id, id));
  }

  async getAllContacts(): Promise<Contact[]> {
    return db.select().from(contacts);
  }

  async getContacts(clientId: string): Promise<Contact[]> {
    return db.select().from(contacts).where(eq(contacts.clientId, clientId));
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact;
  }

  async createContact(data: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(data).returning();
    return contact;
  }

  async updateContact(id: string, data: Partial<InsertContact>): Promise<Contact | undefined> {
    const [contact] = await db.update(contacts).set(data).where(eq(contacts.id, id)).returning();
    return contact;
  }

  async deleteContact(id: string): Promise<void> {
    await db.delete(contacts).where(eq(contacts.id, id));
  }

  async getTimelines(recordType?: string): Promise<TimelineWithMilestones[]> {
    const filterType = recordType || "project";
    const allTimelines = await db.select().from(timelines).where(eq(timelines.recordType, filterType));
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

  async getTimeline(id: string): Promise<TimelineWithMilestones | undefined> {
    const [timeline] = await db.select().from(timelines).where(eq(timelines.id, id));
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

  async createTimeline(data: InsertTimeline): Promise<Timeline> {
    const [timeline] = await db.insert(timelines).values(data).returning();
    return timeline;
  }

  async updateTimeline(id: string, data: Partial<InsertTimeline>): Promise<Timeline | undefined> {
    const [timeline] = await db
      .update(timelines)
      .set(data)
      .where(eq(timelines.id, id))
      .returning();
    return timeline;
  }

  async deleteTimeline(id: string): Promise<void> {
    await db.delete(projectTeamMembers).where(eq(projectTeamMembers.timelineId, id));
    await db.delete(risks).where(eq(risks.timelineId, id));
    await db.delete(tasks).where(eq(tasks.timelineId, id));
    await db.delete(milestones).where(eq(milestones.timelineId, id));
    await db.delete(timelines).where(eq(timelines.id, id));
  }

  async createMilestone(data: InsertMilestone): Promise<Milestone> {
    const [milestone] = await db.insert(milestones).values(data).returning();
    return milestone;
  }

  async updateMilestone(id: string, data: Partial<InsertMilestone>): Promise<Milestone | undefined> {
    const [milestone] = await db
      .update(milestones)
      .set(data)
      .where(eq(milestones.id, id))
      .returning();
    return milestone;
  }

  async deleteMilestone(id: string): Promise<void> {
    await db.delete(milestones).where(eq(milestones.id, id));
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async getTasksByTimeline(timelineId: string): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.timelineId, timelineId));
  }

  async getTasksByParent(parentTaskId: string): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.parentTaskId, parentTaskId));
  }

  async createTask(data: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(data).returning();
    return task;
  }

  async updateTask(id: string, data: Partial<InsertTask>): Promise<Task | undefined> {
    const [task] = await db
      .update(tasks)
      .set(data)
      .where(eq(tasks.id, id))
      .returning();
    return task;
  }

  async deleteTask(id: string): Promise<void> {
    await db.delete(tasks).where(eq(tasks.id, id));
  }

  async getRisks(timelineId: string): Promise<Risk[]> {
    return db
      .select()
      .from(risks)
      .where(eq(risks.timelineId, timelineId));
  }

  async createRisk(data: InsertRisk): Promise<Risk> {
    const [risk] = await db.insert(risks).values(data).returning();
    return risk;
  }

  async updateRisk(id: string, data: Partial<InsertRisk>): Promise<Risk | undefined> {
    const [risk] = await db
      .update(risks)
      .set(data)
      .where(eq(risks.id, id))
      .returning();
    return risk;
  }

  async deleteRisk(id: string): Promise<void> {
    await db.delete(risks).where(eq(risks.id, id));
  }

  async getTeamMembers(): Promise<TeamMember[]> {
    return db.select().from(teamMembers);
  }

  async getTeamMember(id: string): Promise<TeamMember | undefined> {
    const [member] = await db.select().from(teamMembers).where(eq(teamMembers.id, id));
    return member;
  }

  async createTeamMember(data: InsertTeamMember): Promise<TeamMember> {
    const [member] = await db.insert(teamMembers).values(data).returning();
    return member;
  }

  async updateTeamMember(id: string, data: Partial<InsertTeamMember>): Promise<TeamMember | undefined> {
    const [member] = await db.update(teamMembers).set(data).where(eq(teamMembers.id, id)).returning();
    return member;
  }

  async deleteTeamMember(id: string): Promise<void> {
    await db.delete(projectTeamMembers).where(eq(projectTeamMembers.teamMemberId, id));
    await db.delete(teamMembers).where(eq(teamMembers.id, id));
  }

  async getRateCards(): Promise<RateCard[]> {
    return db.select().from(rateCards);
  }

  async getRateCard(id: string): Promise<RateCard | undefined> {
    const [card] = await db.select().from(rateCards).where(eq(rateCards.id, id));
    return card;
  }

  async createRateCard(data: InsertRateCard): Promise<RateCard> {
    const [card] = await db.insert(rateCards).values(data).returning();
    return card;
  }

  async updateRateCard(id: string, data: Partial<InsertRateCard>): Promise<RateCard | undefined> {
    const [card] = await db.update(rateCards).set(data).where(eq(rateCards.id, id)).returning();
    return card;
  }

  async deleteRateCard(id: string): Promise<void> {
    await db.update(projectTeamMembers).set({ rateCardId: null }).where(eq(projectTeamMembers.rateCardId, id));
    await db.delete(rateCards).where(eq(rateCards.id, id));
  }

  async getProjectTeamMembers(timelineId: string): Promise<ProjectTeamMemberWithDetails[]> {
    const assignments = await db.select().from(projectTeamMembers).where(eq(projectTeamMembers.timelineId, timelineId));
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

  async getProjectTeamMemberById(id: string): Promise<ProjectTeamMember | undefined> {
    const [member] = await db.select().from(projectTeamMembers).where(eq(projectTeamMembers.id, id));
    return member;
  }

  async createProjectTeamMember(data: InsertProjectTeamMember): Promise<ProjectTeamMember> {
    const [assignment] = await db.insert(projectTeamMembers).values(data).returning();
    return assignment;
  }

  async updateProjectTeamMember(id: string, data: Partial<InsertProjectTeamMember>): Promise<ProjectTeamMember | undefined> {
    const [assignment] = await db.update(projectTeamMembers).set(data).where(eq(projectTeamMembers.id, id)).returning();
    return assignment;
  }

  async deleteProjectTeamMember(id: string): Promise<void> {
    await db.delete(projectTeamMembers).where(eq(projectTeamMembers.id, id));
  }

  async getSettings(): Promise<AppSettings> {
    const [settings] = await db.select().from(appSettings);
    if (settings) return settings;
    const [created] = await db
      .insert(appSettings)
      .values({ id: "app", riskRegisterEnabled: false, opportunitiesEnabled: true })
      .returning();
    return created;
  }

  async getAllocations(teamMemberId: string): Promise<AllocationWithProject[]> {
    const rows = await db
      .select()
      .from(allocations)
      .where(eq(allocations.teamMemberId, teamMemberId));
    const result: AllocationWithProject[] = [];
    for (const row of rows) {
      const [project] = await db.select().from(timelines).where(eq(timelines.id, row.timelineId));
      if (project) {
        result.push({ ...row, project });
      }
    }
    return result;
  }

  async getAllAllAllocations(): Promise<import("@shared/schema").AllocationFull[]> {
    const rows = await db.select().from(allocations);
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

  async getAllocation(id: string): Promise<Allocation | undefined> {
    const [row] = await db.select().from(allocations).where(eq(allocations.id, id));
    return row;
  }

  async getAllocationsByTimeline(timelineId: string): Promise<AllocationWithTeamMember[]> {
    const rows = await db
      .select()
      .from(allocations)
      .where(eq(allocations.timelineId, timelineId));
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

  async updateAllocation(id: string, data: Partial<InsertAllocation>): Promise<Allocation | undefined> {
    const [allocation] = await db.update(allocations).set(data).where(eq(allocations.id, id)).returning();
    return allocation;
  }

  async deleteAllocation(id: string): Promise<void> {
    await db.delete(allocations).where(eq(allocations.id, id));
  }

  async updateSettings(data: Partial<Omit<AppSettings, "id">>): Promise<AppSettings> {
    await this.getSettings();
    const [updated] = await db
      .update(appSettings)
      .set(data)
      .where(eq(appSettings.id, "app"))
      .returning();
    return updated;
  }

  async getBranding(): Promise<BrandingConfig> {
    const [branding] = await db.select().from(brandingConfig);
    if (branding) return branding;
    const [created] = await db
      .insert(brandingConfig)
      .values({ id: "default" })
      .returning();
    return created;
  }

  async updateBranding(data: Partial<InsertBranding>): Promise<BrandingConfig> {
    await this.getBranding();
    const [updated] = await db
      .update(brandingConfig)
      .set(data)
      .where(eq(brandingConfig.id, "default"))
      .returning();
    return updated;
  }

  async getTimesheetEntries(filters?: { timelineId?: string; teamMemberId?: string; weekEnding?: string; taskId?: string; dayDate?: string }): Promise<TimesheetEntry[]> {
    const conditions = [];
    if (filters?.timelineId) conditions.push(eq(timesheetEntries.timelineId, filters.timelineId));
    if (filters?.teamMemberId) conditions.push(eq(timesheetEntries.teamMemberId, filters.teamMemberId));
    if (filters?.weekEnding) conditions.push(eq(timesheetEntries.weekEnding, filters.weekEnding));
    if (filters?.taskId) conditions.push(eq(timesheetEntries.taskId, filters.taskId));
    if (filters?.dayDate) conditions.push(eq(timesheetEntries.dayDate, filters.dayDate));
    if (conditions.length === 0) return db.select().from(timesheetEntries);
    return db.select().from(timesheetEntries).where(and(...conditions));
  }

  async getTimesheetEntry(id: string): Promise<TimesheetEntry | undefined> {
    const [entry] = await db.select().from(timesheetEntries).where(eq(timesheetEntries.id, id));
    return entry;
  }

  async createTimesheetEntry(data: InsertTimesheetEntry): Promise<TimesheetEntry> {
    const [entry] = await db.insert(timesheetEntries).values(data).returning();
    return entry;
  }

  async updateTimesheetEntry(id: string, data: Partial<InsertTimesheetEntry>): Promise<TimesheetEntry | undefined> {
    const [entry] = await db.update(timesheetEntries).set(data).where(eq(timesheetEntries.id, id)).returning();
    return entry;
  }

  async deleteTimesheetEntry(id: string): Promise<void> {
    await db.delete(timesheetEntries).where(eq(timesheetEntries.id, id));
  }

  async getProgressEntries(filters?: { timelineId?: string; taskId?: string; weekEnding?: string }): Promise<ProgressEntry[]> {
    const conditions = [];
    if (filters?.timelineId) conditions.push(eq(progressEntries.timelineId, filters.timelineId));
    if (filters?.taskId) conditions.push(eq(progressEntries.taskId, filters.taskId));
    if (filters?.weekEnding) conditions.push(eq(progressEntries.weekEnding, filters.weekEnding));
    if (conditions.length === 0) return db.select().from(progressEntries);
    return db.select().from(progressEntries).where(and(...conditions));
  }

  async getProgressEntry(id: string): Promise<ProgressEntry | undefined> {
    const [entry] = await db.select().from(progressEntries).where(eq(progressEntries.id, id));
    return entry;
  }

  async createProgressEntry(data: InsertProgressEntry): Promise<ProgressEntry> {
    const [entry] = await db.insert(progressEntries).values(data).returning();
    return entry;
  }

  async updateProgressEntry(id: string, data: Partial<InsertProgressEntry>): Promise<ProgressEntry | undefined> {
    const [entry] = await db.update(progressEntries).set(data).where(eq(progressEntries.id, id)).returning();
    return entry;
  }

  async deleteProgressEntry(id: string): Promise<void> {
    await db.delete(progressEntries).where(eq(progressEntries.id, id));
  }

  async getFlightpathStages(tenantId?: string): Promise<FlightpathStage[]> {
    const tid = tenantId || "default";
    return db.select().from(flightpathStages).where(eq(flightpathStages.tenantId, tid));
  }

  async getFlightpathStage(id: string): Promise<FlightpathStage | undefined> {
    const [stage] = await db.select().from(flightpathStages).where(eq(flightpathStages.id, id));
    return stage;
  }

  async createFlightpathStage(data: InsertFlightpathStage): Promise<FlightpathStage> {
    const [stage] = await db.insert(flightpathStages).values(data).returning();
    return stage;
  }

  async updateFlightpathStage(id: string, data: Partial<InsertFlightpathStage>): Promise<FlightpathStage | undefined> {
    const [stage] = await db.update(flightpathStages).set(data).where(eq(flightpathStages.id, id)).returning();
    return stage;
  }

  async deleteFlightpathStage(id: string): Promise<void> {
    await db.delete(flightpathDeliverables).where(eq(flightpathDeliverables.stageId, id));
    await db.delete(flightpathStages).where(eq(flightpathStages.id, id));
  }

  async getStageDeliverables(stageId: string): Promise<FlightpathDeliverable[]> {
    return db.select().from(flightpathDeliverables).where(eq(flightpathDeliverables.stageId, stageId));
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

  async updateDeliverable(id: string, data: Partial<InsertFlightpathDeliverable>): Promise<FlightpathDeliverable | undefined> {
    const [deliverable] = await db.update(flightpathDeliverables).set(data).where(eq(flightpathDeliverables.id, id)).returning();
    return deliverable;
  }

  async deleteDeliverable(id: string): Promise<void> {
    await db.delete(flightpathDeliverables).where(eq(flightpathDeliverables.id, id));
  }

  async getProjectCheckpoints(timelineId: string): Promise<ProjectCheckpoint[]> {
    return db.select().from(projectCheckpoints).where(eq(projectCheckpoints.timelineId, timelineId));
  }

  async getProjectCheckpointsByStage(timelineId: string, stageId: string): Promise<ProjectCheckpoint[]> {
    return db.select().from(projectCheckpoints).where(and(eq(projectCheckpoints.timelineId, timelineId), eq(projectCheckpoints.stageId, stageId)));
  }

  async createProjectCheckpoint(data: InsertProjectCheckpoint): Promise<ProjectCheckpoint> {
    const [checkpoint] = await db.insert(projectCheckpoints).values(data).returning();
    return checkpoint;
  }

  async updateProjectCheckpoint(id: string, data: Partial<InsertProjectCheckpoint>): Promise<ProjectCheckpoint | undefined> {
    const [checkpoint] = await db.update(projectCheckpoints).set(data).where(eq(projectCheckpoints.id, id)).returning();
    return checkpoint;
  }

  async deleteProjectCheckpoint(id: string): Promise<void> {
    await db.delete(projectCheckpoints).where(eq(projectCheckpoints.id, id));
  }

  async getProjectGates(timelineId: string): Promise<ProjectGate[]> {
    return db.select().from(projectGates).where(eq(projectGates.timelineId, timelineId));
  }

  async getProjectGate(timelineId: string, stageId: string): Promise<ProjectGate | undefined> {
    const [gate] = await db.select().from(projectGates).where(and(eq(projectGates.timelineId, timelineId), eq(projectGates.stageId, stageId)));
    return gate;
  }

  async createProjectGate(data: InsertProjectGate): Promise<ProjectGate> {
    const [gate] = await db.insert(projectGates).values(data).returning();
    return gate;
  }

  async updateProjectGate(id: string, data: Partial<InsertProjectGate>): Promise<ProjectGate | undefined> {
    const [gate] = await db.update(projectGates).set(data).where(eq(projectGates.id, id)).returning();
    return gate;
  }

  async getWorkstreamResources(taskId: string): Promise<WorkstreamResource[]> {
    return db.select().from(workstreamResources).where(eq(workstreamResources.taskId, taskId));
  }

  async getWorkstreamResourcesByTimeline(timelineId: string): Promise<WorkstreamResource[]> {
    const timelineTasks = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.timelineId, timelineId));
    const taskIds = timelineTasks.map(t => t.id);
    if (taskIds.length === 0) return [];
    return db.select().from(workstreamResources).where(inArray(workstreamResources.taskId, taskIds));
  }

  async createWorkstreamResource(data: InsertWorkstreamResource): Promise<WorkstreamResource> {
    const [resource] = await db.insert(workstreamResources).values(data).returning();
    return resource;
  }

  async updateWorkstreamResource(id: string, data: Partial<InsertWorkstreamResource>): Promise<WorkstreamResource | undefined> {
    const [resource] = await db.update(workstreamResources).set(data).where(eq(workstreamResources.id, id)).returning();
    return resource;
  }

  async deleteWorkstreamResource(id: string): Promise<void> {
    await db.delete(workstreamResources).where(eq(workstreamResources.id, id));
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

  async removeObjectAssignment(id: string): Promise<void> {
    await db.delete(objectAssignments).where(eq(objectAssignments.id, id));
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
    const allUsers = await db.select().from(users);
    const allRoleAssignments = await db
      .select()
      .from(userOrgRoles)
      .where(eq(userOrgRoles.tenantId, tenantId));
    const allRoles = await db.select().from(orgRoles).where(eq(orgRoles.tenantId, tenantId));
    const allMembers = await db.select().from(teamMembers);

    const roleMap = new Map(allRoles.map(r => [r.id, r]));
    const memberByUserIdMap = new Map(allMembers.filter(m => m.userId).map(m => [m.userId!, m]));

    return allUsers.map(u => {
      const userRoleAssignments = allRoleAssignments.filter(ra => ra.userId === u.id);
      const roles = userRoleAssignments.map(ra => roleMap.get(ra.roleId)).filter(Boolean) as OrgRole[];
      return {
        ...u,
        orgRoles: roles,
        teamMember: memberByUserIdMap.get(u.id) || null,
      };
    });
  }

  async linkTeamMemberToUser(teamMemberId: string, userId: string): Promise<void> {
    await db.update(teamMembers).set({ userId }).where(eq(teamMembers.id, teamMemberId));
  }

  async unlinkTeamMemberFromUser(teamMemberId: string): Promise<void> {
    await db.update(teamMembers).set({ userId: null }).where(eq(teamMembers.id, teamMemberId));
  }

  async getTeamMemberByUserId(userId: string): Promise<TeamMember | undefined> {
    const [member] = await db.select().from(teamMembers).where(eq(teamMembers.userId, userId));
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

    const memberRole = await db.select().from(orgRoles).where(and(
      eq(orgRoles.name, "Member"),
      eq(orgRoles.tenantId, "default"),
    ));
    if (memberRole.length > 0) {
      await db.insert(userOrgRoles).values({
        userId: user.id,
        roleId: memberRole[0].id,
        tenantId: "default",
      }).onConflictDoNothing();
    }

    return user;
  }

  async getEvmSnapshots(timelineId: string): Promise<EvmSnapshot[]> {
    return db.select().from(evmSnapshots)
      .where(and(eq(evmSnapshots.timelineId, timelineId), eq(evmSnapshots.isCurrent, true)))
      .orderBy(evmSnapshots.weekEnding);
  }

  async getEvmSnapshotAllVersions(timelineId: string, weekEnding: string): Promise<EvmSnapshot[]> {
    return db.select().from(evmSnapshots)
      .where(and(eq(evmSnapshots.timelineId, timelineId), eq(evmSnapshots.weekEnding, weekEnding)))
      .orderBy(desc(evmSnapshots.version));
  }

  async getEvmSnapshot(timelineId: string, weekEnding: string): Promise<EvmSnapshot | undefined> {
    const [snapshot] = await db.select().from(evmSnapshots)
      .where(and(
        eq(evmSnapshots.timelineId, timelineId),
        eq(evmSnapshots.weekEnding, weekEnding),
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

  async deleteEvmSnapshot(id: string): Promise<void> {
    await db.delete(evmSnapshots).where(eq(evmSnapshots.id, id));
  }

  async getLatestEvmSnapshot(timelineId: string): Promise<EvmSnapshot | undefined> {
    const [snapshot] = await db.select().from(evmSnapshots)
      .where(and(eq(evmSnapshots.timelineId, timelineId), eq(evmSnapshots.isCurrent, true)))
      .orderBy(desc(evmSnapshots.weekEnding))
      .limit(1);
    return snapshot;
  }
}

export const storage = new DatabaseStorage();
