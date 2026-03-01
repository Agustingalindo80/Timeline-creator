import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { userOrgRoles, users } from "@shared/schema";
import { eq, and } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      tenantId: string;
    }
  }
}

function extractUserId(req: Request): string | null {
  const user = (req as any).user;
  if (!user) return null;
  return user?.claims?.sub || user?.id || null;
}

async function userHasTenantAccess(userId: string, tenantId: string): Promise<boolean> {
  const [superAdmin] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (superAdmin?.isSuperAdmin) return true;

  const roles = await db
    .select({ tenantId: userOrgRoles.tenantId })
    .from(userOrgRoles)
    .where(and(eq(userOrgRoles.userId, userId), eq(userOrgRoles.tenantId, tenantId)))
    .limit(1);
  return roles.length > 0;
}

export function tenantContext() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const userId = extractUserId(req);

    if (!userId) {
      req.tenantId = "default";
      return next();
    }

    const sessionTenant = (req.session as any)?.activeTenantId;
    if (sessionTenant) {
      const hasAccess = await userHasTenantAccess(userId, sessionTenant);
      if (hasAccess) {
        req.tenantId = sessionTenant;
        return next();
      }
      delete (req.session as any).activeTenantId;
    }

    try {
      const roles = await db
        .select({ tenantId: userOrgRoles.tenantId })
        .from(userOrgRoles)
        .where(eq(userOrgRoles.userId, userId))
        .limit(1);

      req.tenantId = roles.length > 0 ? roles[0].tenantId : "default";
    } catch {
      req.tenantId = "default";
    }

    next();
  };
}
