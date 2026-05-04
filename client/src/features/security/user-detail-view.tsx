import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Edit3, Check, Link2, Unlink, X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RbacUser, RbacRole, TeamMemberBasic } from "./types";

export function UserDetailView({
  user,
  roles,
  availableTeamMembers,
  onBack,
}: {
  user: RbacUser;
  roles: RbacRole[];
  availableTeamMembers: TeamMemberBasic[];
  onBack: () => void;
}) {
  const { toast } = useToast();
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState<string>("");
  const [linkingTm, setLinkingTm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editFirstName, setEditFirstName] = useState(user.firstName || "");
  const [editLastName, setEditLastName] = useState(user.lastName || "");
  const [editEmail, setEditEmail] = useState(user.email || "");

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Unknown User";
  const availableRoles = roles.filter(r => !user.orgRoles.some(ur => ur.id === r.id));

  const updateUserMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; email: string }) => {
      await apiRequest("PATCH", `/api/rbac/users/${user.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "User updated", description: user.teamMember ? "Changes synced to linked team member." : undefined });
      setEditing(false);
    },
    onError: (err: any) => {
      toast({ title: "Failed to update user", description: err.message, variant: "destructive" });
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: async ({ roleId }: { roleId: string }) => {
      await apiRequest("POST", `/api/rbac/users/${user.id}/roles`, { roleId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/users"] });
      toast({ title: "Role assigned" });
      setSelectedRoleId("");
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      await apiRequest("DELETE", `/api/rbac/users/${user.id}/roles/${roleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/users"] });
      toast({ title: "Role removed" });
    },
  });

  const linkTeamMemberMutation = useMutation({
    mutationFn: async (teamMemberId: string) => {
      await apiRequest("POST", `/api/rbac/users/${user.id}/link-team-member`, { teamMemberId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "Team member linked" });
      setLinkingTm(false);
      setSelectedTeamMemberId("");
    },
    onError: (err: any) => {
      toast({ title: "Failed to link", description: err.message, variant: "destructive" });
    },
  });

  const unlinkTeamMemberMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/rbac/users/${user.id}/unlink-team-member`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "Team member unlinked" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to unlink", description: err.message, variant: "destructive" });
    },
  });

  const startEditing = () => {
    setEditFirstName(user.firstName || "");
    setEditLastName(user.lastName || "");
    setEditEmail(user.email || "");
    setEditing(true);
  };

  const initials = [user.firstName, user.lastName]
    .filter(Boolean)
    .map(n => n!.charAt(0).toUpperCase())
    .join("") || "?";

  return (
    <div data-testid="user-detail-view">
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          data-testid="button-back-to-users"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Users
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4 mb-6" data-testid="user-detail-header">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary shrink-0">
            {user.profileImageUrl ? (
              <img src={user.profileImageUrl} alt={fullName} className="w-14 h-14 rounded-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div>
            <h1 className="text-xl font-semibold" data-testid="text-user-detail-name">{fullName}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {user.email && (
                <span className="text-sm text-muted-foreground" data-testid="text-user-detail-email">{user.email}</span>
              )}
              {user.teamMember ? (
                <Badge variant="secondary" data-testid="badge-linked-tm">
                  <Link2 className="w-3 h-3 mr-1" />
                  {user.teamMember.name}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-muted-foreground" data-testid="text-no-linked-tm">No Team Member</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!editing ? (
            <Button variant="outline" size="sm" onClick={startEditing} data-testid="button-edit-user">
              <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
                disabled={updateUserMutation.isPending}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => updateUserMutation.mutate({ firstName: editFirstName, lastName: editLastName, email: editEmail })}
                disabled={updateUserMutation.isPending}
                data-testid="button-save-user"
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                {updateUserMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="border rounded-md p-4 mb-6 bg-muted/30 space-y-3" data-testid="form-edit-user">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <Label>First Name</Label>
              <Input
                value={editFirstName}
                onChange={(e) => setEditFirstName(e.target.value)}
                placeholder="First name"
                data-testid="input-user-firstname"
              />
            </div>
            <div>
              <Label>Last Name</Label>
              <Input
                value={editLastName}
                onChange={(e) => setEditLastName(e.target.value)}
                placeholder="Last name"
                data-testid="input-user-lastname"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="Email address"
                data-testid="input-user-email"
              />
            </div>
          </div>
          {user.teamMember && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 flex-wrap">
              <Link2 className="w-3 h-3" />
              Changes will be synced to linked team member: {user.teamMember.name}
            </p>
          )}
        </div>
      )}

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="details" data-testid="tab-user-details">Details</TabsTrigger>
          <TabsTrigger value="roles" data-testid="tab-user-roles">Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-3" data-testid="heading-user-info">User Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">First Name</div>
                  <div className="text-sm font-medium" data-testid="text-user-firstname">{user.firstName || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Last Name</div>
                  <div className="text-sm font-medium" data-testid="text-user-lastname">{user.lastName || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Email</div>
                  <div className="text-sm font-medium" data-testid="text-user-email">{user.email || "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Created</div>
                  <div className="text-sm font-medium" data-testid="text-user-created">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Last Updated</div>
                  <div className="text-sm font-medium" data-testid="text-user-updated">{user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : "—"}</div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3" data-testid="heading-team-member-link">Team Member Link</h3>
              <div className="border rounded-md p-4 bg-muted/30">
                {user.teamMember ? (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-sm font-medium" data-testid="text-linked-tm-name">{user.teamMember.name}</div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Linked for record-level access and resource tracking.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => unlinkTeamMemberMutation.mutate()}
                      disabled={unlinkTeamMemberMutation.isPending}
                      data-testid="button-unlink-tm"
                    >
                      <Unlink className="w-3.5 h-3.5 mr-1" />
                      {unlinkTeamMemberMutation.isPending ? "Unlinking..." : "Unlink"}
                    </Button>
                  </div>
                ) : linkingTm ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Select a team member to link to this user.</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Select value={selectedTeamMemberId} onValueChange={setSelectedTeamMemberId}>
                        <SelectTrigger className="w-64" data-testid="select-link-tm">
                          <SelectValue placeholder="Select team member..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTeamMembers.map((tm) => (
                            <SelectItem key={tm.id} value={tm.id} data-testid={`select-item-tm-${tm.id}`}>
                              {tm.name}{tm.email ? ` (${tm.email})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (selectedTeamMemberId) linkTeamMemberMutation.mutate(selectedTeamMemberId);
                        }}
                        disabled={!selectedTeamMemberId || linkTeamMemberMutation.isPending}
                        data-testid="button-confirm-link-tm"
                      >
                        {linkTeamMemberMutation.isPending ? "Linking..." : "Link"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setLinkingTm(false); setSelectedTeamMemberId(""); }}
                        data-testid="button-cancel-link-tm"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-sm text-muted-foreground">Not linked</div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Link a team member to enable record-level access filtering and resource tracking.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setLinkingTm(true)}
                      data-testid="button-link-tm"
                    >
                      <Link2 className="w-3.5 h-3.5 mr-1" />
                      Link Team Member
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="roles">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold mb-3" data-testid="heading-assigned-roles">Assigned Roles</h3>
              {user.orgRoles.length > 0 ? (
                <div className="space-y-2">
                  {user.orgRoles.map((role) => {
                    const roleDetail = roles.find(r => r.id === role.id);
                    return (
                      <div key={role.id} className="border rounded-md p-3 flex items-center justify-between gap-3" data-testid={`card-role-${role.id}`}>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium" data-testid={`text-role-name-${role.id}`}>{role.name}</span>
                            {(roleDetail?.isSystem || role.isSystem) && (
                              <Badge variant="outline" className="text-[10px]">System</Badge>
                            )}
                          </div>
                          {(roleDetail?.description || role.description) && (
                            <p className="text-xs text-muted-foreground mt-0.5">{roleDetail?.description || role.description}</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeRoleMutation.mutate(role.id)}
                          disabled={removeRoleMutation.isPending}
                          data-testid={`button-remove-role-${role.id}`}
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          Remove
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="border rounded-md p-6 text-center">
                  <p className="text-sm text-muted-foreground" data-testid="text-no-roles">No roles assigned to this user.</p>
                </div>
              )}
            </div>

            {availableRoles.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3" data-testid="heading-add-role">Add Role</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                    <SelectTrigger className="w-64" data-testid="select-assign-role">
                      <SelectValue placeholder="Select a role to assign..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoles.map((r) => (
                        <SelectItem key={r.id} value={r.id} data-testid={`select-item-role-${r.id}`}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (selectedRoleId) assignRoleMutation.mutate({ roleId: selectedRoleId });
                    }}
                    disabled={!selectedRoleId || assignRoleMutation.isPending}
                    data-testid="button-assign-role"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    {assignRoleMutation.isPending ? "Assigning..." : "Assign Role"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
