import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";

import { db, pool } from "./db";
import { provisionTenant } from "./tenant-provisioning";
import {
  orgRoles,
  orgRolePermissions,
  orgPermissions,
  userOrgRoles,
  appSettings,
  brandingConfig,
  flightpathStages,
  flightpathDeliverables,
  SYSTEM_ORG_ROLES,
  SYSTEM_ROLE_PERMISSIONS,
} from "@shared/schema";

const TEST_TENANT_ID = `test-tenant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const BUSINESS_OUTCOMES_PERMISSION = "module.business_outcomes";

const ROLES_WITH_BUSINESS_OUTCOMES = [
  "Global Admin",
  "Org Admin",
  "PMO Lead",
  "Finance",
  "Delivery Lead",
  "Project Manager",
] as const;

const ROLES_WITHOUT_BUSINESS_OUTCOMES = [
  "Contributor",
  "Member",
  "Timesheet Only",
] as const;

async function cleanupTenant(tenantId: string): Promise<void> {
  await db.delete(flightpathDeliverables).where(eq(flightpathDeliverables.tenantId, tenantId));
  await db.delete(flightpathStages).where(eq(flightpathStages.tenantId, tenantId));
  await db.delete(userOrgRoles).where(eq(userOrgRoles.tenantId, tenantId));
  await db.delete(orgRolePermissions).where(eq(orgRolePermissions.tenantId, tenantId));
  await db.delete(orgRoles).where(eq(orgRoles.tenantId, tenantId));
  await db.delete(appSettings).where(eq(appSettings.tenantId, tenantId));
  await db.delete(brandingConfig).where(eq(brandingConfig.tenantId, tenantId));
}

async function getRoleIdsByName(tenantId: string): Promise<Record<string, string>> {
  const roles = await db.select().from(orgRoles).where(eq(orgRoles.tenantId, tenantId));
  const map: Record<string, string> = {};
  for (const role of roles) map[role.name] = role.id;
  return map;
}

async function getGrantedPermissionsByRoleName(tenantId: string): Promise<Record<string, Set<string>>> {
  const roleIdsByName = await getRoleIdsByName(tenantId);
  const nameByRoleId: Record<string, string> = {};
  for (const [name, id] of Object.entries(roleIdsByName)) nameByRoleId[id] = name;

  const grants = await db
    .select()
    .from(orgRolePermissions)
    .where(eq(orgRolePermissions.tenantId, tenantId));

  const result: Record<string, Set<string>> = {};
  for (const grant of grants) {
    const roleName = nameByRoleId[grant.roleId];
    if (!roleName) continue;
    if (!result[roleName]) result[roleName] = new Set();
    result[roleName].add(grant.permissionKey);
  }
  return result;
}

describe("provisionTenant module access", () => {
  before(async () => {
    await cleanupTenant(TEST_TENANT_ID);
    await provisionTenant(TEST_TENANT_ID);
  });

  after(async () => {
    await cleanupTenant(TEST_TENANT_ID);
    await pool.end();
  });

  it("creates the Business Outcomes module permission row", async () => {
    const [perm] = await db
      .select()
      .from(orgPermissions)
      .where(eq(orgPermissions.key, BUSINESS_OUTCOMES_PERMISSION));
    assert.ok(perm, `expected permission "${BUSINESS_OUTCOMES_PERMISSION}" to exist`);
    assert.equal(perm.category, "module");
  });

  it("grants Business Outcomes to exactly the expected default roles", async () => {
    const granted = await getGrantedPermissionsByRoleName(TEST_TENANT_ID);

    for (const roleName of ROLES_WITH_BUSINESS_OUTCOMES) {
      assert.ok(
        granted[roleName]?.has(BUSINESS_OUTCOMES_PERMISSION),
        `expected role "${roleName}" to have ${BUSINESS_OUTCOMES_PERMISSION}`,
      );
    }

    for (const roleName of ROLES_WITHOUT_BUSINESS_OUTCOMES) {
      assert.ok(
        !granted[roleName]?.has(BUSINESS_OUTCOMES_PERMISSION),
        `expected role "${roleName}" to NOT have ${BUSINESS_OUTCOMES_PERMISSION}`,
      );
    }
  });

  it("grants every role exactly the permissions defined in SYSTEM_ROLE_PERMISSIONS", async () => {
    const granted = await getGrantedPermissionsByRoleName(TEST_TENANT_ID);

    for (const role of SYSTEM_ORG_ROLES) {
      const expected = new Set(SYSTEM_ROLE_PERMISSIONS[role.name] ?? []);
      const actual = granted[role.name] ?? new Set<string>();

      const missing = [...expected].filter((p) => !actual.has(p));
      const extra = [...actual].filter((p) => !expected.has(p));

      assert.deepEqual(
        missing,
        [],
        `role "${role.name}" is missing permissions: ${missing.join(", ")}`,
      );
      assert.deepEqual(
        extra,
        [],
        `role "${role.name}" has unexpected permissions: ${extra.join(", ")}`,
      );
    }
  });

  it("is idempotent — re-running does not duplicate grants or error", async () => {
    const countGrants = async () =>
      (await db.select().from(orgRolePermissions).where(eq(orgRolePermissions.tenantId, TEST_TENANT_ID))).length;
    const countRoles = async () =>
      (await db.select().from(orgRoles).where(eq(orgRoles.tenantId, TEST_TENANT_ID))).length;

    const grantsBefore = await countGrants();
    const rolesBefore = await countRoles();

    await provisionTenant(TEST_TENANT_ID);

    const grantsAfter = await countGrants();
    const rolesAfter = await countRoles();

    assert.equal(grantsAfter, grantsBefore, "re-provisioning changed the number of permission grants");
    assert.equal(rolesAfter, rolesBefore, "re-provisioning changed the number of roles");
  });
});
