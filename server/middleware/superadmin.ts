import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

function extractUserId(req: Request): string | null {
  const user = (req as any).user;
  if (!user) return null;
  return user?.claims?.sub || user?.id || null;
}

export function requireSuperAdmin() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = extractUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const [user] = await db
        .select({ isSuperAdmin: users.isSuperAdmin })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user || !user.isSuperAdmin) {
        return res.status(403).json({ message: "Super admin access required" });
      }

      next();
    } catch (err) {
      console.error("Super admin check error:", err);
      return res.status(500).json({ message: "Access check failed" });
    }
  };
}
