import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import {
  orgRoles,
  orgPermissions,
  orgRolePermissions,
  userOrgRoles,
  SYSTEM_ORG_ROLES,
  ALL_PERMISSIONS,
  SYSTEM_ROLE_PERMISSIONS,
} from "@shared/schema";
import { users } from "@shared/schema";
import { seedFlightpathData } from "./seed-flightpath";
import { storage } from "./storage";

export interface TenantAdminInfo {
  email: string;
  firstName: string;
  lastName: string;
}

export async function provisionTenant(
  tenantId: string,
  tenantAdmin?: TenantAdminInfo,
  creatorUserId?: string,
  locale: string = "en",
): Promise<void> {
  console.log(`Provisioning tenant "${tenantId}"...`);

  try {
    for (const perm of ALL_PERMISSIONS) {
      await db.insert(orgPermissions).values({
        key: perm.key,
        description: perm.description,
        category: perm.category,
      }).onConflictDoNothing();
    }

    const roleIdsByName: Record<string, string> = {};
    for (const role of SYSTEM_ORG_ROLES) {
      const existing = await db.select().from(orgRoles).where(
        and(eq(orgRoles.tenantId, tenantId), eq(orgRoles.name, role.name))
      );
      if (existing.length > 0) {
        roleIdsByName[role.name] = existing[0].id;
      } else {
        const [inserted] = await db.insert(orgRoles).values({
          tenantId,
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
        }).returning();
        roleIdsByName[role.name] = inserted.id;
      }
    }

    for (const [roleName, permKeys] of Object.entries(SYSTEM_ROLE_PERMISSIONS)) {
      const roleId = roleIdsByName[roleName];
      if (!roleId) continue;
      for (const permKey of permKeys) {
        await db.insert(orgRolePermissions).values({
          tenantId,
          roleId,
          permissionKey: permKey,
        }).onConflictDoNothing();
      }
    }
    console.log(`  RBAC roles and permissions seeded for tenant "${tenantId}"`);

    await seedFlightpathData(tenantId);
    console.log(`  Governance stages seeded for tenant "${tenantId}"`);

    const settings = await storage.getSettings(tenantId);
    if (settings && locale !== "en") {
      await storage.updateSettings({ locale }, tenantId);
    }
    await storage.getBranding(tenantId);
    console.log(`  Settings and branding initialized for tenant "${tenantId}" (locale: ${locale})`);

    const adminRoleId = roleIdsByName["Global Admin"];

    if (tenantAdmin && adminRoleId) {
      const [existingUser] = await db.select().from(users).where(eq(users.email, tenantAdmin.email));
      let adminUserId: string;

      if (existingUser) {
        adminUserId = existingUser.id;
        console.log(`  Found existing user "${tenantAdmin.email}" (${adminUserId})`);
      } else {
        const [created] = await db.insert(users).values({
          id: sql`gen_random_uuid()`,
          email: tenantAdmin.email,
          firstName: tenantAdmin.firstName,
          lastName: tenantAdmin.lastName,
        }).returning();
        adminUserId = created.id;
        console.log(`  Created Tenant Admin user "${tenantAdmin.email}" (${adminUserId})`);
      }

      await db.insert(userOrgRoles).values({
        tenantId,
        userId: adminUserId,
        roleId: adminRoleId,
      }).onConflictDoNothing();
      console.log(`  Tenant Admin assigned Global Admin role for tenant "${tenantId}"`);
    } else if (creatorUserId && adminRoleId) {
      await db.insert(userOrgRoles).values({
        tenantId,
        userId: creatorUserId,
        roleId: adminRoleId,
      }).onConflictDoNothing();
      console.log(`  Creator assigned Global Admin role for tenant "${tenantId}" (legacy fallback)`);
    }

    console.log(`Tenant "${tenantId}" provisioning complete`);
  } catch (err) {
    console.error(`Tenant "${tenantId}" provisioning failed:`, err);
    throw err;
  }
}
