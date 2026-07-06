import { users, type User, type UpsertUser } from "@shared/models/auth";
import { orgRoles, userOrgRoles } from "@shared/models/rbac";
import { teamMembers, objectAssignments, auditLog } from "@shared/schema";
import { db } from "../../db";
import { eq, and, ne, isNull, sql } from "drizzle-orm";
import { isSuperAdminEmail } from "../../super-admin-allowlist";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = await this.getUser(userData.id);

    // If an admin pre-created an account with this email (before first login),
    // merge it into the real auth identity so roles and links carry over.
    let mergedPreCreated = false;
    if (!existingUser && userData.email) {
      mergedPreCreated = await this.mergePreCreatedUser(userData);
    }

    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!existingUser && !mergedPreCreated) {
      await this.assignDefaultRole(user.id);
      await this.autoLinkTeamMember(user);
    }

    await this.ensureSuperAdminAllowlist(user);

    return user;
  }

  private async mergePreCreatedUser(userData: UpsertUser): Promise<boolean> {
    try {
      const authId = userData.id;
      if (!authId || !userData.email) return false;
      const [preCreated] = await db.select()
        .from(users)
        .where(and(sql`lower(${users.email}) = lower(${userData.email})`, ne(users.id, authId)))
        .limit(1);
      if (!preCreated) return false;

      await db.transaction(async (tx) => {
        // Free the unique email, then create the real auth user
        await tx.update(users).set({ email: null }).where(eq(users.id, preCreated.id));
        await tx.insert(users).values({
          ...userData,
          firstName: userData.firstName || preCreated.firstName,
          lastName: userData.lastName || preCreated.lastName,
          isSuperAdmin: preCreated.isSuperAdmin || undefined,
        }).onConflictDoNothing();

        // Move all references from the pre-created placeholder to the real user
        await tx.update(userOrgRoles).set({ userId: userData.id }).where(eq(userOrgRoles.userId, preCreated.id));
        await tx.update(teamMembers).set({ userId: userData.id }).where(eq(teamMembers.userId, preCreated.id));
        await tx.update(objectAssignments).set({ userId: userData.id }).where(eq(objectAssignments.userId, preCreated.id));
        await tx.update(auditLog).set({ actorUserId: userData.id }).where(eq(auditLog.actorUserId, preCreated.id));

        await tx.delete(users).where(eq(users.id, preCreated.id));
      });

      console.log(`Merged pre-created account for ${userData.email} into auth user ${userData.id}`);
      return true;
    } catch (err) {
      console.error("Failed to merge pre-created user account:", err);
      return false;
    }
  }

  private async ensureSuperAdminAllowlist(user: User): Promise<void> {
    try {
      if (!isSuperAdminEmail(user.email)) return;

      if (!user.isSuperAdmin) {
        await db.update(users)
          .set({ isSuperAdmin: true })
          .where(eq(users.id, user.id));
        user.isSuperAdmin = true;
        console.log(`Granted Super Admin to allowlisted user: ${user.email}`);
      }

      await this.ensureGlobalAdminRole(user.id);
    } catch (err) {
      console.error("Failed to enforce super admin allowlist:", err);
    }
  }

  private async ensureGlobalAdminRole(userId: string): Promise<void> {
    const allRoles = await db.select().from(orgRoles).where(eq(orgRoles.tenantId, "default"));
    const adminRole = allRoles.find(r => r.name === "Global Admin") || allRoles.find(r => r.name === "Org Owner");
    if (!adminRole) return;

    const existing = await db.select()
      .from(userOrgRoles)
      .where(and(
        eq(userOrgRoles.userId, userId),
        eq(userOrgRoles.tenantId, "default"),
        eq(userOrgRoles.roleId, adminRole.id),
      ))
      .limit(1);
    if (existing.length > 0) return;

    await db.insert(userOrgRoles).values({
      tenantId: "default",
      userId,
      roleId: adminRole.id,
    }).onConflictDoNothing();
    console.log(`Assigned "${adminRole.name}" role to allowlisted user ${userId}`);
  }

  private async assignDefaultRole(userId: string): Promise<void> {
    try {
      const existingAssignment = await db.select()
        .from(userOrgRoles)
        .where(and(
          eq(userOrgRoles.userId, userId),
          eq(userOrgRoles.tenantId, "default"),
        ))
        .limit(1);
      if (existingAssignment.length > 0) return;

      const allAssignments = await db.select().from(userOrgRoles);
      const allRoles = await db.select().from(orgRoles).where(eq(orgRoles.tenantId, "default"));

      let targetRole;
      if (allAssignments.length === 0) {
        targetRole = allRoles.find(r => r.name === "Global Admin") || allRoles.find(r => r.name === "Org Owner");
      } else {
        targetRole = allRoles.find(r => r.name === "Member");
      }

      if (targetRole) {
        await db.insert(userOrgRoles).values({
          tenantId: "default",
          userId,
          roleId: targetRole.id,
        }).onConflictDoNothing();
        console.log(`Auto-assigned role "${targetRole.name}" to new user ${userId}`);
      }
    } catch (err) {
      console.error("Failed to assign default role:", err);
    }
  }
  private async autoLinkTeamMember(user: User): Promise<void> {
    try {
      if (!user.email) return;
      const [tm] = await db.select()
        .from(teamMembers)
        .where(and(
          eq(teamMembers.email, user.email),
          isNull(teamMembers.userId),
        ))
        .limit(1);
      if (tm) {
        await db.update(teamMembers)
          .set({ userId: user.id })
          .where(eq(teamMembers.id, tm.id));
        console.log(`Auto-linked team member "${tm.name}" to user ${user.id} (email match: ${user.email})`);
      }
    } catch (err) {
      console.error("Failed to auto-link team member:", err);
    }
  }
}

export const authStorage = new AuthStorage();
