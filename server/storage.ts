import { eq } from "drizzle-orm";
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
  getTimelines(): Promise<TimelineWithMilestones[]>;
  getTimeline(id: string): Promise<TimelineWithMilestones | undefined>;
  createTimeline(data: InsertTimeline): Promise<Timeline>;
  updateTimeline(id: string, data: Partial<InsertTimeline>): Promise<Timeline | undefined>;
  deleteTimeline(id: string): Promise<void>;
  createMilestone(data: InsertMilestone): Promise<Milestone>;
  updateMilestone(id: string, data: Partial<InsertMilestone>): Promise<Milestone | undefined>;
  deleteMilestone(id: string): Promise<void>;
  getTask(id: string): Promise<Task | undefined>;
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

  async getTimelines(): Promise<TimelineWithMilestones[]> {
    const allTimelines = await db.select().from(timelines);
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

    return assignments
      .map(a => {
        const teamMember = memberMap.get(a.teamMemberId);
        if (!teamMember) return null;
        return {
          ...a,
          teamMember,
          rateCard: a.rateCardId ? cardMap.get(a.rateCardId) || null : null,
        };
      })
      .filter((a): a is ProjectTeamMemberWithDetails => a !== null);
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
      .values({ id: "app", riskRegisterEnabled: false })
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
}

export const storage = new DatabaseStorage();
