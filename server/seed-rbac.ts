import { db } from "./db";
import { eq } from "drizzle-orm";
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

export async function seedRBAC() {
  const existingRoles = await db.select().from(orgRoles);
  if (existingRoles.length > 0) {
    console.log("RBAC already seeded, skipping");
    return;
  }

  console.log("Seeding RBAC tables...");

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

export async function migrateExistingUsersToRBAC() {
  const settings = await db.select().from(appSettings);
  const rbacMigrated = settings[0]?.rbacMigrated;
  if (rbacMigrated) return;

  const allRoles = await db.select().from(orgRoles);
  const memberRole = allRoles.find(r => r.name === "Member");
  const ownerRole = allRoles.find(r => r.name === "Org Owner");
  if (!memberRole || !ownerRole) return;

  const allUsers = await db.select().from(users);
  const existingAssignments = await db.select().from(userOrgRoles);

  for (const user of allUsers) {
    const hasRole = existingAssignments.some(a => a.userId === user.id);
    if (!hasRole) {
      if (allUsers.indexOf(user) === 0 && existingAssignments.length === 0) {
        await db.insert(userOrgRoles).values({
          tenantId: "default",
          userId: user.id,
          roleId: ownerRole.id,
        }).onConflictDoNothing();
        console.log(`Assigned Org Owner to first user: ${user.email}`);
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
