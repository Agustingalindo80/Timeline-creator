export type RbacUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profileImageUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  orgRoles: { id: string; name: string; description: string | null; isSystem: boolean; tenantId: string }[];
  teamMember: { id: string; name: string } | null;
};

export type RbacRole = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
};

export type RbacPermission = {
  key: string;
  description: string | null;
  category: string | null;
};

export type AuditEntry = {
  id: string;
  actorUserId: string | null;
  action: string;
  objectType: string | null;
  objectId: string | null;
  metadata: Record<string, any> | null;
  createdAt: string | null;
};

export type TeamMemberBasic = {
  id: string;
  name: string;
  email: string | null;
  userId: string | null;
};
