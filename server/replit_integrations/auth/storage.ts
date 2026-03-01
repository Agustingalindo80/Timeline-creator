import { users, type User, type UpsertUser } from "@shared/models/auth";
import { orgRoles, userOrgRoles } from "@shared/models/rbac";
import { teamMembers } from "@shared/schema";
import { db } from "../../db";
import { eq, and, isNull } from "drizzle-orm";

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

    if (!existingUser) {
      await this.assignDefaultRole(user.id);
      await this.autoLinkTeamMember(user);
    }

    return user;
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
