import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { UserCog, Link2, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PermissionGuard } from "@/components/permission-guard";
import { UserDetailView } from "./user-detail-view";
import type { RbacUser, RbacRole, TeamMemberBasic } from "./types";

export function UsersRolesManager() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: users = [], isLoading: usersLoading } = useQuery<RbacUser[]>({
    queryKey: ["/api/rbac/users"],
  });

  const { data: roles = [] } = useQuery<RbacRole[]>({
    queryKey: ["/api/rbac/roles"],
  });

  const { data: allTeamMembers = [] } = useQuery<TeamMemberBasic[]>({
    queryKey: ["/api/team-members"],
  });

  const availableTeamMembers = useMemo(() => {
    const linkedUserIds = new Set(users.filter(u => u.teamMember).map(u => u.id));
    return allTeamMembers.filter(tm => !tm.userId || linkedUserIds.has(tm.userId) === false);
  }, [allTeamMembers, users]);

  const selectedUser = useMemo(() => {
    return users.find(u => u.id === selectedUserId) || null;
  }, [users, selectedUserId]);

  if (usersLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (selectedUser) {
    return (
      <PermissionGuard permission="users.manage" fallback={<p className="text-sm text-muted-foreground">You do not have permission to manage users.</p>}>
        <UserDetailView
          user={selectedUser}
          roles={roles}
          availableTeamMembers={availableTeamMembers}
          onBack={() => setSelectedUserId(null)}
        />
      </PermissionGuard>
    );
  }

  return (
    <PermissionGuard permission="users.manage" fallback={<p className="text-sm text-muted-foreground">You do not have permission to manage users.</p>}>
      <div>
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <UserCog className="w-4 h-4" />
            Users &amp; Role Assignments
          </h2>
          <p className="text-sm text-muted-foreground">
            Click on a user to manage their roles and team member link.
          </p>
        </div>

        <Card className="card-elevated overflow-visible">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="table-users">
              <thead>
                <tr>
                  <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                  <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Email</th>
                  <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Roles</th>
                  <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Team Member</th>
                  <th className="table-header-cell w-10"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="table-row-hover border-t border-border cursor-pointer"
                    onClick={() => setSelectedUserId(user.id)}
                    data-testid={`row-user-${user.id}`}
                  >
                    <td className="px-4 py-3 text-sm font-medium" data-testid={`text-user-name-${user.id}`}>
                      {[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {user.email || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {user.orgRoles.map((role) => (
                          <Badge key={role.id} variant="secondary" className="text-xs" data-testid={`badge-role-${user.id}-${role.id}`}>
                            {role.name}
                          </Badge>
                        ))}
                        {user.orgRoles.length === 0 && (
                          <span className="text-xs text-muted-foreground">No roles</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {user.teamMember ? (
                        <span className="flex items-center gap-1">
                          <Link2 className="w-3 h-3" />
                          {user.teamMember.name}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <ChevronRight className="w-4 h-4" />
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground" data-testid="text-no-users">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
