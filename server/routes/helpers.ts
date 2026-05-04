import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "../db";
import { storage } from "../storage";
import { eq } from "drizzle-orm";
import { users } from "@shared/schema";
import { hasGlobalRecordAccess, getLinkedTeamMemberId } from "../rbac";

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

export const uploadsDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export function extractUserId(req: any): string | null {
  const user = req.user;
  if (!user) return null;
  return user?.claims?.sub || user?.id || null;
}

export async function getRecordAccessContext(req: any): Promise<{
  userId: string;
  isGlobal: boolean;
  teamMemberId: string | null;
  assignedTimelineIds: string[];
} | null> {
  const userId = extractUserId(req);
  if (!userId) return null;
  const tenantId = req.tenantId || "default";

  // TODO: Remove before commercial launch — Super Admins get global access in all tenants for testing
  const [superCheck] = await db.select({ isSuperAdmin: users.isSuperAdmin }).from(users).where(eq(users.id, userId));
  if (superCheck?.isSuperAdmin) {
    return { userId, isGlobal: true, teamMemberId: null, assignedTimelineIds: [] };
  }

  const isGlobal = await hasGlobalRecordAccess(userId, tenantId);
  if (isGlobal) {
    return { userId, isGlobal: true, teamMemberId: null, assignedTimelineIds: [] };
  }
  const teamMemberId = await getLinkedTeamMemberId(userId);
  const assignedTimelineIds = teamMemberId
    ? await storage.getAssignedTimelineIds(teamMemberId)
    : [];
  return { userId, isGlobal: false, teamMemberId, assignedTimelineIds };
}

export async function checkTimelineAccess(req: any, res: any, timelineId: string): Promise<boolean> {
  const ctx = await getRecordAccessContext(req);
  if (!ctx) { res.status(401).json({ message: "Authentication required" }); return false; }
  if (ctx.isGlobal) return true;
  if (!ctx.assignedTimelineIds.includes(timelineId)) {
    res.status(403).json({ message: "You don't have access to this project" });
    return false;
  }
  return true;
}
