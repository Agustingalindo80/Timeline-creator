import type { Request, Response, NextFunction } from "express";
import { db } from "../db";
import { userOrgRoles, users, tenants } from "@shared/schema";
import { eq, and } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      tenantId: string;
      tenantSlug?: string;
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
  // TODO: Lock down Super Admin tenant access before commercial launch
  if (superAdmin?.isSuperAdmin) return true;

  const roles = await db
    .select({ tenantId: userOrgRoles.tenantId })
    .from(userOrgRoles)
    .where(and(eq(userOrgRoles.userId, userId), eq(userOrgRoles.tenantId, tenantId)))
    .limit(1);
  return roles.length > 0;
}

const slugTenantCache = new Map<string, { id: string; timestamp: number }>();
const SLUG_CACHE_TTL = 30000;

async function resolveTenantBySlug(slug: string): Promise<string | null> {
  const cached = slugTenantCache.get(slug);
  if (cached && Date.now() - cached.timestamp < SLUG_CACHE_TTL) {
    return cached.id;
  }
  const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, slug)).limit(1);
  if (tenant) {
    slugTenantCache.set(slug, { id: tenant.id, timestamp: Date.now() });
    return tenant.id;
  }
  return null;
}

export function tenantContext() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if ((req as any).isApiToken && (req as any).apiTokenTenantId) {
      req.tenantId = (req as any).apiTokenTenantId;
      return next();
    }

    const slugMatch = req.originalUrl.match(/^\/t\/([a-z0-9-]+)(\/|$)/);
    if (slugMatch) {
      const slug = slugMatch[1];
      const resolvedTenantId = await resolveTenantBySlug(slug);
      if (resolvedTenantId) {
        const userId = extractUserId(req);
        if (userId) {
          const hasAccess = await userHasTenantAccess(userId, resolvedTenantId);
          if (!hasAccess) {
            req.tenantId = "default";
            return next();
          }
        }
        req.tenantId = resolvedTenantId;
        req.tenantSlug = slug;
        (req as any).session && ((req.session as any).activeTenantId = resolvedTenantId);
        return next();
      }
    }

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
