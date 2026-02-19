import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  timelines,
  milestones,
  type Timeline,
  type InsertTimeline,
  type Milestone,
  type InsertMilestone,
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
}

export class DatabaseStorage implements IStorage {
  async getTimelines(): Promise<TimelineWithMilestones[]> {
    const allTimelines = await db.select().from(timelines);
    const allMilestones = await db.select().from(milestones);

    return allTimelines.map((t) => ({
      ...t,
      milestones: allMilestones
        .filter((m) => m.timelineId === t.id)
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

    return {
      ...timeline,
      milestones: timelineMilestones.sort((a, b) => a.sortOrder - b.sortOrder),
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
}

export const storage = new DatabaseStorage();
