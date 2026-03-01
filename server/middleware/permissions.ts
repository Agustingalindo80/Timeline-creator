import type { Request, Response, NextFunction } from "express";
import { hasAnyPermission, hasPermission, hasGlobalRecordAccess, getUserOrgPermissions } from "../rbac";
import { db } from "../db";
import { auditLog } from "@shared/schema";

const AUDITED_ACTIONS = new Set([
  "gate.approve",
  "gate.override",
  "pricing.approve",
  "org.settings.manage",
  "users.manage",
  "roles.manage",
]);

function extractUserId(req: Request): string | null {
  const user = (req as any).user;
  if (!user) return null;
  return user?.claims?.sub || user?.id || null;
}

function extractObjectContext(req: Request): { objectType?: string; objectId?: string } {
  const path = req.path;

  const oppMatch = path.match(/\/api\/opportunities\/([^/]+)/);
  if (oppMatch) return { objectType: "opportunity", objectId: oppMatch[1] };

  const projMatch = path.match(/\/api\/timelines\/([^/]+)/);
  if (projMatch) return { objectType: "project", objectId: projMatch[1] };

  const rbacObjMatch = path.match(/\/api\/rbac\/objects\/([^/]+)\/([^/]+)/);
  if (rbacObjMatch) return { objectType: rbacObjMatch[1], objectId: rbacObjMatch[2] };

  return {};
}

export function requirePermission(...permissionKeys: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = extractUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const tenantId = req.tenantId || "default";
    const { objectType, objectId } = extractObjectContext(req);

    try {
      const allowed = await hasAnyPermission(userId, tenantId, permissionKeys, objectType, objectId);

      if (!allowed) {
        return res.status(403).json({
          message: "Insufficient permissions",
          required: permissionKeys,
        });
      }

      const shouldAudit = permissionKeys.some(k => AUDITED_ACTIONS.has(k));
      if (shouldAudit) {
        await db.insert(auditLog).values({
          tenantId,
          actorUserId: userId,
          action: permissionKeys.join(","),
          objectType: objectType || null,
          objectId: objectId || null,
          metadata: {
            method: req.method,
            path: req.path,
          },
        }).catch(err => console.error("Audit log write failed:", err));
      }

      next();
    } catch (err) {
      console.error("Permission check error:", err);
      return res.status(500).json({ message: "Permission check failed" });
    }
  };
}

export function requireModuleAccess(moduleKey: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = extractUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const tenantId = req.tenantId || "default";
    const permKey = `module.${moduleKey}`;

    try {
      const perms = await getUserOrgPermissions(userId, tenantId);
      if (!perms.has(permKey)) {
        return res.status(403).json({
          message: `Access denied: ${moduleKey} module`,
          required: permKey,
        });
      }
      next();
    } catch (err) {
      console.error("Module access check error:", err);
      return res.status(500).json({ message: "Module access check failed" });
    }
  };
}

export function requireObjectAccess(objectType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = extractUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const tenantId = req.tenantId || "default";
    const objectId = (req.params.id || req.params.objectId) as string | undefined;
    if (!objectId) {
      return next();
    }

    try {
      const hasPortfolio = await hasPermission(userId, tenantId, "portfolio.view");
      if (hasPortfolio) return next();

      const viewPerm = objectType === "opportunity" ? "opp.view" : "project.view";
      const hasObjPerm = await hasPermission(userId, tenantId, viewPerm, objectType, objectId);
      if (hasObjPerm) return next();

      const hasOrgPerm = await hasPermission(userId, tenantId, viewPerm);
      if (hasOrgPerm) return next();

      return res.status(403).json({ message: "You don't have access to this item" });
    } catch (err) {
      console.error("Object access check error:", err);
      return res.status(500).json({ message: "Access check failed" });
    }
  };
}
