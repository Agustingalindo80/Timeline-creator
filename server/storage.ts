import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  timelines,
  milestones,
  tasks,
  risks,
  appSettings,
  type Timeline,
  type InsertTimeline,
  type Milestone,
  type InsertMilestone,
  type Task,
  type InsertTask,
  type Risk,
  type InsertRisk,
  type AppSettings,
  type TimelineWithMilestones,
} from "@shared/schema";

export interface IStorage {
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
  getSettings(): Promise<AppSettings>;
  updateSettings(data: Partial<Omit<AppSettings, "id">>): Promise<AppSettings>;
}

export class DatabaseStorage implements IStorage {
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

  async getSettings(): Promise<AppSettings> {
    const [settings] = await db.select().from(appSettings);
    if (settings) return settings;
    const [created] = await db
      .insert(appSettings)
      .values({ id: "app", riskRegisterEnabled: false })
      .returning();
    return created;
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
