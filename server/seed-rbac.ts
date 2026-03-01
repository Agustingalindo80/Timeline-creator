import { db } from "./db";
import { eq, and, inArray } from "drizzle-orm";
import {
  orgRoles,
  orgPermissions,
  orgRolePermissions,
  objectRolePermissions,
  userOrgRoles,
  teamMembers,
  users,
  appSettings,
  SYSTEM_ORG_ROLES,
  ALL_PERMISSIONS,
  SYSTEM_ROLE_PERMISSIONS,
  OBJECT_ROLE_PERMISSIONS,
} from "@shared/schema";

const ROLE_RENAMES: Record<string, string> = {
  "Org Owner": "Global Admin",
  "Delivery Ops": "Delivery Lead",
};

export async function seedRBAC() {
  const existingRoles = await db.select().from(orgRoles);

  if (existingRoles.length > 0) {
    console.log("RBAC tables have existing roles — running incremental migration...");
    await incrementalMigration(existingRoles);
    return;
  }

  console.log("Seeding RBAC tables (fresh install)...");

  for (const perm of ALL_PERMISSIONS) {
    await db.insert(orgPermissions).values({
      key: perm.key,
      description: perm.description,
      category: perm.category,
    }).onConflictDoNothing();
  }

  const createdRoles: Record<string, string> = {};
  for (const role of SYSTEM_ORG_ROLES) {
    const [inserted] = await db.insert(orgRoles).values({
      tenantId: "default",
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
    }).returning();
    createdRoles[role.name] = inserted.id;
  }

  for (const [roleName, permKeys] of Object.entries(SYSTEM_ROLE_PERMISSIONS)) {
    const roleId = createdRoles[roleName];
    if (!roleId) continue;
    for (const permKey of permKeys) {
      await db.insert(orgRolePermissions).values({
        tenantId: "default",
        roleId,
        permissionKey: permKey,
      }).onConflictDoNothing();
    }
  }

  for (const [objectRole, permKeys] of Object.entries(OBJECT_ROLE_PERMISSIONS)) {
    for (const permKey of permKeys) {
      await db.insert(objectRolePermissions).values({
        objectRole,
        permissionKey: permKey,
      }).onConflictDoNothing();
    }
  }

  console.log("RBAC seed complete");
}

async function incrementalMigration(existingRoles: { id: string; name: string; tenantId: string }[]) {
  for (const perm of ALL_PERMISSIONS) {
    await db.insert(orgPermissions).values({
      key: perm.key,
      description: perm.description,
      category: perm.category,
    }).onConflictDoNothing();
  }
  console.log("  Permissions synced");

  for (const [oldName, newName] of Object.entries(ROLE_RENAMES)) {
    const existing = existingRoles.find(r => r.name === oldName);
    if (existing) {
      const alreadyRenamed = existingRoles.find(r => r.name === newName);
      if (!alreadyRenamed) {
        const roleDesc = SYSTEM_ORG_ROLES.find(r => r.name === newName)?.description || null;
        await db.update(orgRoles)
          .set({ name: newName, description: roleDesc })
          .where(eq(orgRoles.id, existing.id));
        console.log(`  Renamed role "${oldName}" → "${newName}"`);
        existing.name = newName;
      }
    }
  }

  const refreshedRoles = await db.select().from(orgRoles);

  for (const roleDef of SYSTEM_ORG_ROLES) {
    const exists = refreshedRoles.find(r => r.name === roleDef.name && r.tenantId === "default");
    if (!exists) {
      const [inserted] = await db.insert(orgRoles).values({
        tenantId: "default",
        name: roleDef.name,
        description: roleDef.description,
        isSystem: roleDef.isSystem,
      }).returning();
      refreshedRoles.push(inserted);
      console.log(`  Added new role: "${roleDef.name}"`);
    } else if (!exists.description) {
      await db.update(orgRoles)
        .set({ description: roleDef.description })
        .where(eq(orgRoles.id, exists.id));
    }
  }

  for (const [roleName, permKeys] of Object.entries(SYSTEM_ROLE_PERMISSIONS)) {
    const role = refreshedRoles.find(r => r.name === roleName && r.tenantId === "default");
    if (!role) continue;

    const existingPerms = await db.select()
      .from(orgRolePermissions)
      .where(and(
        eq(orgRolePermissions.tenantId, "default"),
        eq(orgRolePermissions.roleId, role.id),
      ));
    const existingKeys = new Set(existingPerms.map(p => p.permissionKey));

    for (const permKey of permKeys) {
      if (!existingKeys.has(permKey)) {
        await db.insert(orgRolePermissions).values({
          tenantId: "default",
          roleId: role.id,
          permissionKey: permKey,
        }).onConflictDoNothing();
      }
    }
  }
  console.log("  Role permissions synced");

  for (const [objectRole, permKeys] of Object.entries(OBJECT_ROLE_PERMISSIONS)) {
    for (const permKey of permKeys) {
      await db.insert(objectRolePermissions).values({
        objectRole,
        permissionKey: permKey,
      }).onConflictDoNothing();
    }
  }

  console.log("  Incremental RBAC migration complete");
}

export async function migrateExistingUsersToRBAC() {
  const settings = await db.select().from(appSettings);
  const rbacMigrated = settings[0]?.rbacMigrated;
  if (rbacMigrated) return;

  const allRoles = await db.select().from(orgRoles);
  const memberRole = allRoles.find(r => r.name === "Member");
  const adminRole = allRoles.find(r => r.name === "Global Admin") || allRoles.find(r => r.name === "Org Owner");
  if (!memberRole || !adminRole) return;

  const allUsers = await db.select().from(users);
  const existingAssignments = await db.select().from(userOrgRoles);

  for (const user of allUsers) {
    const hasRole = existingAssignments.some(a => a.userId === user.id);
    if (!hasRole) {
      if (allUsers.indexOf(user) === 0 && existingAssignments.length === 0) {
        await db.insert(userOrgRoles).values({
          tenantId: "default",
          userId: user.id,
          roleId: adminRole.id,
        }).onConflictDoNothing();
        console.log(`Assigned Global Admin to first user: ${user.email}`);
      } else {
        await db.insert(userOrgRoles).values({
          tenantId: "default",
          userId: user.id,
          roleId: memberRole.id,
        }).onConflictDoNothing();
      }
    }
  }

  const allTeamMembers = await db.select().from(teamMembers);
  for (const tm of allTeamMembers) {
    if (tm.email && !tm.userId) {
      const matchingUser = allUsers.find(u =>
        u.email && u.email.toLowerCase() === tm.email!.toLowerCase()
      );
      if (matchingUser) {
        await db.update(teamMembers)
          .set({ userId: matchingUser.id })
          .where(eq(teamMembers.id, tm.id));
        console.log(`Auto-linked team member "${tm.name}" to user ${matchingUser.email}`);
      }
    }
  }

  await db.update(appSettings)
    .set({ rbacMigrated: true })
    .where(eq(appSettings.id, "app"));

  console.log("RBAC migration for existing users complete");
}
