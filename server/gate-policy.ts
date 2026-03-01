import { eq, and } from "drizzle-orm";
import { db } from "./db";
import {
  userOrgRoles,
  orgRoles,
  objectAssignments,
  auditLog,
  flightpathStages,
} from "@shared/schema";

export interface GateApprovalPolicy {
  stageNumber: number;
  requiredRoles: string[][];
  description: string;
}

const GATE_POLICIES: GateApprovalPolicy[] = [
  {
    stageNumber: 0,
    requiredRoles: [["Finance", "PMO Lead"], ["dl"]],
    description: "Stage 0 (Pre-Sales): requires (Finance OR PMO Lead) AND Delivery Lead",
  },
  {
    stageNumber: 1,
    requiredRoles: [["dl"], ["PMO Lead"]],
    description: "Stage 1 (Kickoff): requires Delivery Lead AND PMO Lead",
  },
  {
    stageNumber: 2,
    requiredRoles: [["pm"], ["dl"]],
    description: "Stage 2+ (Delivery): requires PM AND Delivery Lead",
  },
];

function getPolicyForStage(stageNumber: number): GateApprovalPolicy {
  const exact = GATE_POLICIES.find(p => p.stageNumber === stageNumber);
  if (exact) return exact;
  return GATE_POLICIES[GATE_POLICIES.length - 1];
}

async function getUserRolesForGate(
  userId: string,
  tenantId: string,
  objectType: string,
  objectId: string,
): Promise<{ orgRoleNames: string[]; objectRoles: string[] }> {
  const orgRoleRows = await db
    .select({ name: orgRoles.name })
    .from(userOrgRoles)
    .innerJoin(orgRoles, eq(orgRoles.id, userOrgRoles.roleId))
    .where(and(
      eq(userOrgRoles.userId, userId),
      eq(userOrgRoles.tenantId, tenantId),
    ));

  const objRoleRows = await db
    .select({ objectRole: objectAssignments.objectRole })
    .from(objectAssignments)
    .where(and(
      eq(objectAssignments.userId, userId),
      eq(objectAssignments.tenantId, tenantId),
      eq(objectAssignments.objectType, objectType),
      eq(objectAssignments.objectId, objectId),
    ));

  return {
    orgRoleNames: orgRoleRows.map(r => r.name),
    objectRoles: objRoleRows.map(r => r.objectRole),
  };
}

function userSatisfiesRoleGroup(
  group: string[],
  orgRoleNames: string[],
  objectRoles: string[],
): boolean {
  return group.some(role => {
    if (["ae", "se", "dl", "pm", "contributor", "executive_viewer"].includes(role)) {
      return objectRoles.includes(role);
    }
    return orgRoleNames.includes(role);
  });
}

export async function canUserApproveGate(
  userId: string,
  tenantId: string,
  objectType: string,
  objectId: string,
  stageId: string,
): Promise<{ allowed: boolean; reason: string; policy: GateApprovalPolicy }> {
  const stages = await db
    .select()
    .from(flightpathStages)
    .where(eq(flightpathStages.id, stageId));

  const stage = stages[0];
  if (!stage) {
    return { allowed: false, reason: "Stage not found", policy: getPolicyForStage(0) };
  }

  const stageNumber = stage.sortOrder || 0;
  const policy = getPolicyForStage(stageNumber);

  const { orgRoleNames, objectRoles } = await getUserRolesForGate(userId, tenantId, objectType, objectId);

  if (orgRoleNames.includes("Org Owner")) {
    return { allowed: true, reason: "Org Owner has universal gate approval", policy };
  }

  const satisfiesAll = policy.requiredRoles.every(group =>
    userSatisfiesRoleGroup(group, orgRoleNames, objectRoles)
  );

  if (satisfiesAll) {
    return { allowed: true, reason: "User satisfies gate approval policy", policy };
  }

  const missing = policy.requiredRoles
    .filter(group => !userSatisfiesRoleGroup(group, orgRoleNames, objectRoles))
    .map(group => group.join(" or "));

  return {
    allowed: false,
    reason: `Missing required approval role(s): ${missing.join(" AND ")}`,
    policy,
  };
}

export async function canUserOverrideGate(
  userId: string,
  tenantId: string,
): Promise<boolean> {
  const orgRoleRows = await db
    .select({ name: orgRoles.name })
    .from(userOrgRoles)
    .innerJoin(orgRoles, eq(orgRoles.id, userOrgRoles.roleId))
    .where(and(
      eq(userOrgRoles.userId, userId),
      eq(userOrgRoles.tenantId, tenantId),
    ));

  const names = orgRoleRows.map(r => r.name);
  return names.includes("Org Owner") || names.includes("PMO Lead");
}

export async function logGateAction(
  tenantId: string,
  actorUserId: string,
  action: string,
  objectType: string,
  objectId: string,
  metadata: Record<string, any>,
) {
  await db.insert(auditLog).values({
    tenantId,
    actorUserId,
    action,
    objectType,
    objectId,
    metadata,
  });
}
