import { eq, and } from "drizzle-orm";
import { db } from "./db";
import {
  orgRoles,
  orgRolePermissions,
  userOrgRoles,
  objectAssignments,
  objectRolePermissions,
  teamMembers,
} from "@shared/schema";

interface PermissionCacheEntry {
  permissions: Set<string>;
  expiry: number;
}

const CACHE_TTL_MS = 10_000;
const orgPermCache = new Map<string, PermissionCacheEntry>();
const objectPermCache = new Map<string, PermissionCacheEntry>();

function cacheKey(userId: string, tenantId: string, objectType?: string, objectId?: string): string {
  return `${tenantId}:${userId}:${objectType || ""}:${objectId || ""}`;
}

export function invalidatePermissionCache(userId?: string) {
  if (userId) {
    const orgKeys = Array.from(orgPermCache.keys());
    for (const key of orgKeys) {
      if (key.includes(`:${userId}:`)) orgPermCache.delete(key);
    }
    const objKeys = Array.from(objectPermCache.keys());
    for (const key of objKeys) {
      if (key.includes(`:${userId}:`)) objectPermCache.delete(key);
    }
  } else {
    orgPermCache.clear();
    objectPermCache.clear();
  }
}

export async function getUserOrgPermissions(userId: string, tenantId: string): Promise<Set<string>> {
  const key = cacheKey(userId, tenantId);
  const cached = orgPermCache.get(key);
  if (cached && cached.expiry > Date.now()) return cached.permissions;

  const rows = await db
    .select({ permissionKey: orgRolePermissions.permissionKey })
    .from(userOrgRoles)
    .innerJoin(orgRolePermissions, and(
      eq(orgRolePermissions.roleId, userOrgRoles.roleId),
      eq(orgRolePermissions.tenantId, userOrgRoles.tenantId),
    ))
    .where(and(
      eq(userOrgRoles.userId, userId),
      eq(userOrgRoles.tenantId, tenantId),
    ));

  const perms = new Set(rows.map(r => r.permissionKey));
  orgPermCache.set(key, { permissions: perms, expiry: Date.now() + CACHE_TTL_MS });
  return perms;
}

export async function getUserObjectPermissions(
  userId: string,
  tenantId: string,
  objectType: string,
  objectId: string,
): Promise<Set<string>> {
  const key = cacheKey(userId, tenantId, objectType, objectId);
  const cached = objectPermCache.get(key);
  if (cached && cached.expiry > Date.now()) return cached.permissions;

  const assignments = await db
    .select({ objectRole: objectAssignments.objectRole })
    .from(objectAssignments)
    .where(and(
      eq(objectAssignments.userId, userId),
      eq(objectAssignments.tenantId, tenantId),
      eq(objectAssignments.objectType, objectType),
      eq(objectAssignments.objectId, objectId),
    ));

  if (assignments.length === 0) {
    const perms = new Set<string>();
    objectPermCache.set(key, { permissions: perms, expiry: Date.now() + CACHE_TTL_MS });
    return perms;
  }

  const roles = assignments.map(a => a.objectRole);
  const allPermRows = [];
  for (const role of roles) {
    const rows = await db
      .select({ permissionKey: objectRolePermissions.permissionKey })
      .from(objectRolePermissions)
      .where(eq(objectRolePermissions.objectRole, role));
    allPermRows.push(...rows);
  }

  const perms = new Set(allPermRows.map(r => r.permissionKey));
  objectPermCache.set(key, { permissions: perms, expiry: Date.now() + CACHE_TTL_MS });
  return perms;
}

export async function getEffectivePermissions(
  userId: string,
  tenantId: string,
  objectType?: string,
  objectId?: string,
): Promise<Set<string>> {
  const orgPerms = await getUserOrgPermissions(userId, tenantId);

  if (!objectType || !objectId) return orgPerms;

  const objPerms = await getUserObjectPermissions(userId, tenantId, objectType, objectId);
  return new Set(Array.from(orgPerms).concat(Array.from(objPerms)));
}

export async function hasPermission(
  userId: string,
  tenantId: string,
  permissionKey: string,
  objectType?: string,
  objectId?: string,
): Promise<boolean> {
  const perms = await getEffectivePermissions(userId, tenantId, objectType, objectId);
  return perms.has(permissionKey);
}

export async function hasAnyPermission(
  userId: string,
  tenantId: string,
  permissionKeys: string[],
  objectType?: string,
  objectId?: string,
): Promise<boolean> {
  const perms = await getEffectivePermissions(userId, tenantId, objectType, objectId);
  return permissionKeys.some(k => perms.has(k));
}

export async function hasGlobalRecordAccess(userId: string, tenantId: string): Promise<boolean> {
  const perms = await getUserOrgPermissions(userId, tenantId);
  return perms.has("record.global_access");
}

export async function getUserModulePermissions(userId: string, tenantId: string): Promise<string[]> {
  const perms = await getUserOrgPermissions(userId, tenantId);
  return Array.from(perms).filter(p => p.startsWith("module."));
}

export async function getLinkedTeamMemberId(userId: string): Promise<string | null> {
  const rows = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId))
    .limit(1);
  return rows.length > 0 ? rows[0].id : null;
}

export async function getUserObjectAssignments(userId: string, tenantId: string) {
  return db
    .select()
    .from(objectAssignments)
    .where(and(
      eq(objectAssignments.userId, userId),
      eq(objectAssignments.tenantId, tenantId),
    ));
}

export async function isUserAssignedToObject(
  userId: string,
  tenantId: string,
  objectType: string,
  objectId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: objectAssignments.id })
    .from(objectAssignments)
    .where(and(
      eq(objectAssignments.userId, userId),
      eq(objectAssignments.tenantId, tenantId),
      eq(objectAssignments.objectType, objectType),
      eq(objectAssignments.objectId, objectId),
    ))
    .limit(1);
  return rows.length > 0;
}
