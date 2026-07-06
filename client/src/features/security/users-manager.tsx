import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { UserCog, Link2, ChevronRight, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { PermissionGuard } from "@/components/permission-guard";
import { UserDetailView } from "./user-detail-view";
import type { RbacUser, RbacRole, TeamMemberBasic } from "./types";

export function UsersRolesManager() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newRoleId, setNewRoleId] = useState("");
  const { toast } = useToast();

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

  const addUserMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/rbac/users", {
        email: newEmail,
        firstName: newFirstName || undefined,
        lastName: newLastName || undefined,
        roleId: newRoleId,
      });
      return res.json();
    },
    onSuccess: (data: { created: boolean }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/users"] });
      toast({
        title: data.created ? "User added" : "Existing user added to tenant",
        description: data.created
          ? "The user will get access when they sign in with this email."
          : "The existing account was given a role in this tenant.",
      });
      setAddOpen(false);
      setNewEmail("");
      setNewFirstName("");
      setNewLastName("");
      setNewRoleId("");
    },
    onError: (err: any) => {
      toast({ title: "Failed to add user", description: err.message, variant: "destructive" });
    },
  });

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
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <UserCog className="w-4 h-4" />
              Users &amp; Role Assignments
            </h2>
            <p className="text-sm text-muted-foreground">
              Click on a user to manage their roles and team member link.
            </p>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-user">
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add User to Tenant</DialogTitle>
                <DialogDescription>
                  Add a user by email and assign them a role. If they haven't signed in yet, their access will be ready when they first log in with this email.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="add-user-email">Email *</Label>
                  <Input
                    id="add-user-email"
                    type="email"
                    placeholder="user@company.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    data-testid="input-add-user-email"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-user-first-name">First name</Label>
                    <Input
                      id="add-user-first-name"
                      value={newFirstName}
                      onChange={(e) => setNewFirstName(e.target.value)}
                      data-testid="input-add-user-first-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="add-user-last-name">Last name</Label>
                    <Input
                      id="add-user-last-name"
                      value={newLastName}
                      onChange={(e) => setNewLastName(e.target.value)}
                      data-testid="input-add-user-last-name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Select value={newRoleId} onValueChange={setNewRoleId}>
                    <SelectTrigger data-testid="select-add-user-role">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id} data-testid={`option-role-${role.id}`}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)} data-testid="button-cancel-add-user">
                  Cancel
                </Button>
                <Button
                  onClick={() => addUserMutation.mutate()}
                  disabled={!newEmail.trim() || !newRoleId || addUserMutation.isPending}
                  data-testid="button-confirm-add-user"
                >
                  {addUserMutation.isPending ? "Adding..." : "Add User"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
