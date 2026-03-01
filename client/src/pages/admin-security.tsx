import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Shield, Plus, X, UserCog, ScrollText, Grid3X3, Check, Edit3, Trash2, Link2, Unlink, ArrowLeft, ChevronRight, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppTitle } from "@/hooks/use-app-title";
import { PermissionGuard } from "@/components/permission-guard";
import { MODULE_KEYS, MODULE_LABELS, ALL_PERMISSIONS, PERMISSION_CATEGORIES, SYSTEM_ROLE_PERMISSIONS } from "@shared/models/rbac";
import type { ModuleKey } from "@shared/models/rbac";

type RbacUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profileImageUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  orgRoles: { roleId: string; roleName: string }[];
  teamMember: { id: string; name: string } | null;
};

type RbacRole = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
};

type RbacPermission = {
  key: string;
  description: string | null;
  category: string | null;
};

type AuditEntry = {
  id: string;
  actorUserId: string | null;
  action: string;
  objectType: string | null;
  objectId: string | null;
  metadata: Record<string, any> | null;
  createdAt: string | null;
};

function RolesManager() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RbacRole | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formModules, setFormModules] = useState<Set<string>>(new Set());
  const [formGlobalAccess, setFormGlobalAccess] = useState(false);
  const [formActionPerms, setFormActionPerms] = useState<Set<string>>(new Set());

  const { data: roles = [], isLoading: rolesLoading } = useQuery<RbacRole[]>({
    queryKey: ["/api/rbac/roles"],
  });

  const { data: users = [] } = useQuery<RbacUser[]>({
    queryKey: ["/api/rbac/users"],
  });

  const userCountByRole = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const u of users) {
      for (const r of u.orgRoles) {
        counts[r.roleId] = (counts[r.roleId] || 0) + 1;
      }
    }
    return counts;
  }, [users]);

  const actionCategories = PERMISSION_CATEGORIES.filter(c => c.key !== "module" && c.key !== "access");
  const actionPermissions = ALL_PERMISSIONS.filter(p => !p.key.startsWith("module.") && !p.key.startsWith("record."));

  const openCreateDialog = () => {
    setEditingRole(null);
    setFormName("");
    setFormDescription("");
    setFormModules(new Set());
    setFormGlobalAccess(false);
    setFormActionPerms(new Set());
    setDialogOpen(true);
  };

  const openEditDialog = async (role: RbacRole) => {
    setEditingRole(role);
    setFormName(role.name);
    setFormDescription(role.description || "");
    try {
      const res = await fetch(`/api/rbac/roles/${role.id}/permissions`);
      const data = await res.json();
      const perms: string[] = data.permissions || [];
      const mods = new Set<string>();
      const actions = new Set<string>();
      let globalAccess = false;
      for (const p of perms) {
        if (p.startsWith("module.")) {
          mods.add(p);
        } else if (p === "record.global_access") {
          globalAccess = true;
        } else {
          actions.add(p);
        }
      }
      setFormModules(mods);
      setFormGlobalAccess(globalAccess);
      setFormActionPerms(actions);
    } catch {
      setFormModules(new Set());
      setFormGlobalAccess(false);
      setFormActionPerms(new Set());
    }
    setDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; permissions: string[] }) => {
      await apiRequest("POST", "/api/rbac/roles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/users"] });
      toast({ title: "Role created" });
      setDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; description: string; permissions: string[] } }) => {
      await apiRequest("PATCH", `/api/rbac/roles/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/my-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/my-modules"] });
      toast({ title: "Role updated" });
      setDialogOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/rbac/roles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/roles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/users"] });
      toast({ title: "Role deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    const permissions: string[] = [];
    formModules.forEach(m => permissions.push(m));
    if (formGlobalAccess) permissions.push("record.global_access");
    formActionPerms.forEach(p => permissions.push(p));

    const payload = { name: formName.trim(), description: formDescription.trim(), permissions };

    if (editingRole) {
      updateMutation.mutate({ id: editingRole.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const toggleModule = (moduleKey: string) => {
    const permKey = `module.${moduleKey}`;
    setFormModules(prev => {
      const next = new Set(prev);
      if (next.has(permKey)) {
        next.delete(permKey);
      } else {
        next.add(permKey);
      }
      return next;
    });
  };

  const toggleActionPerm = (key: string) => {
    setFormActionPerms(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const moduleCount = (roleId: string, roleName: string) => {
    const systemPerms = SYSTEM_ROLE_PERMISSIONS[roleName];
    if (systemPerms) {
      return systemPerms.filter(p => p.startsWith("module.")).length;
    }
    return 0;
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (rolesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <PermissionGuard permission="roles.manage" fallback={<p className="text-sm text-muted-foreground">You do not have permission to manage roles.</p>}>
      <div>
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Role Management
            </h2>
            <p className="text-sm text-muted-foreground">
              Define roles and configure their module access and permissions.
            </p>
          </div>
          <Button onClick={openCreateDialog} data-testid="button-create-role">
            <Plus className="w-4 h-4 mr-1" />
            Create Role
          </Button>
        </div>

        <Card className="card-elevated overflow-visible">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="table-roles">
              <thead>
                <tr>
                  <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                  <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Description</th>
                  <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Type</th>
                  <th className="table-header-cell text-center px-4 py-3 text-xs font-medium text-muted-foreground">Users</th>
                  <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} className="table-row-hover border-t border-border" data-testid={`row-role-${role.id}`}>
                    <td className="px-4 py-3 text-sm font-medium" data-testid={`text-role-name-${role.id}`}>
                      {role.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground max-w-xs truncate">
                      {role.description || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {role.isSystem ? (
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-system-${role.id}`}>System</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs" data-testid={`badge-custom-${role.id}`}>Custom</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-center text-muted-foreground" data-testid={`text-role-users-${role.id}`}>
                      {userCountByRole[role.id] || 0}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openEditDialog(role)}
                          data-testid={`button-edit-role-${role.id}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </Button>
                        {!role.isSystem && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                data-testid={`button-delete-role-${role.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Role</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete the role "{role.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(role.id)}
                                  data-testid={`button-confirm-delete-role-${role.id}`}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {roles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No roles defined.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle data-testid="text-role-dialog-title">
                {editingRole ? `Edit Role: ${editingRole.name}` : "Create Role"}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Name</Label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Role name"
                    disabled={editingRole?.isSystem}
                    data-testid="input-role-name"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Description</Label>
                  <Input
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Brief description of this role"
                    data-testid="input-role-description"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3">Module Access</h3>
                <div className="grid grid-cols-2 gap-2">
                  {MODULE_KEYS.filter(k => k !== "dashboard").map((moduleKey) => (
                    <label
                      key={moduleKey}
                      className="flex items-center gap-2 p-2 rounded-md border border-border cursor-pointer"
                      data-testid={`checkbox-module-${moduleKey}`}
                    >
                      <Checkbox
                        checked={formModules.has(`module.${moduleKey}`)}
                        onCheckedChange={() => toggleModule(moduleKey)}
                      />
                      <span className="text-sm">{MODULE_LABELS[moduleKey as ModuleKey]}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3">Record Access</h3>
                <div className="flex items-center justify-between p-3 rounded-md border border-border">
                  <div>
                    <p className="text-sm font-medium">
                      {formGlobalAccess ? "Global (see all records)" : "Assignment-based (see only assigned records)"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formGlobalAccess
                        ? "Users with this role can see all records regardless of assignment."
                        : "Users will only see records they are explicitly assigned to."}
                    </p>
                  </div>
                  <Switch
                    checked={formGlobalAccess}
                    onCheckedChange={setFormGlobalAccess}
                    data-testid="switch-global-access"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-3">Action Permissions</h3>
                <div className="space-y-4">
                  {actionCategories.map((cat) => {
                    const catPerms = actionPermissions.filter(p => p.category === cat.key);
                    if (catPerms.length === 0) return null;
                    return (
                      <div key={cat.key}>
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{cat.label}</p>
                        <div className="space-y-1">
                          {catPerms.map((perm) => (
                            <label
                              key={perm.key}
                              className="flex items-start gap-2 p-2 rounded-md border border-border cursor-pointer"
                              data-testid={`checkbox-perm-${perm.key}`}
                            >
                              <Checkbox
                                checked={formActionPerms.has(perm.key)}
                                onCheckedChange={() => toggleActionPerm(perm.key)}
                                className="mt-0.5"
                              />
                              <div>
                                <span className="text-sm font-medium">{perm.key}</span>
                                <span className="block text-xs text-muted-foreground">{perm.description}</span>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-role">
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!formName.trim() || isSaving}
                data-testid="button-save-role"
              >
                {isSaving ? "Saving..." : editingRole ? "Update Role" : "Create Role"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PermissionGuard>
  );
}

type TeamMemberBasic = {
  id: string;
  name: string;
  email: string | null;
  userId: string | null;
};

function UserDetailView({
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
  const availableRoles = roles.filter(r => !user.orgRoles.some(ur => ur.roleId === r.id));

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

  return (
    <div data-testid="user-detail-view">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="mb-4 gap-1"
        data-testid="button-back-to-users"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Users
      </Button>

      <div className="flex items-start gap-4 mb-6" data-testid="user-detail-header">
        <Avatar className="w-12 h-12">
          {user.profileImageUrl && <AvatarImage src={user.profileImageUrl} alt={fullName} />}
          <AvatarFallback>
            <User className="w-6 h-6 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold" data-testid="text-user-detail-name">{fullName}</h1>
          <p className="text-sm text-muted-foreground" data-testid="text-user-detail-email">{user.email || "No email"}</p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {user.teamMember ? (
              <Badge variant="secondary" className="text-xs gap-1" data-testid="badge-linked-tm">
                <Link2 className="w-3 h-3" />
                Linked to {user.teamMember.name}
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground" data-testid="text-no-linked-tm">No linked team member</span>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="details" data-testid="tab-user-details">Details</TabsTrigger>
          <TabsTrigger value="roles" data-testid="tab-user-roles">Roles</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold" data-testid="heading-user-info">User Information</h3>
                {!editing ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditFirstName(user.firstName || "");
                      setEditLastName(user.lastName || "");
                      setEditEmail(user.email || "");
                      setEditing(true);
                    }}
                    data-testid="button-edit-user"
                  >
                    <Edit3 className="w-3.5 h-3.5 mr-1" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => updateUserMutation.mutate({ firstName: editFirstName, lastName: editLastName, email: editEmail })}
                      disabled={updateUserMutation.isPending}
                      data-testid="button-save-user"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      {updateUserMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditing(false)}
                      disabled={updateUserMutation.isPending}
                      data-testid="button-cancel-edit"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              {editing ? (
                <Card className="card-elevated">
                  <CardContent className="pt-4 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">First Name</Label>
                        <Input
                          value={editFirstName}
                          onChange={(e) => setEditFirstName(e.target.value)}
                          placeholder="First name"
                          data-testid="input-user-firstname"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Last Name</Label>
                        <Input
                          value={editLastName}
                          onChange={(e) => setEditLastName(e.target.value)}
                          placeholder="Last name"
                          data-testid="input-user-lastname"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground mb-1.5 block">Email</Label>
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
                      <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1">
                        <Link2 className="w-3 h-3" />
                        Changes will be synced to linked team member: {user.teamMember.name}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <div className="text-xs text-muted-foreground mb-1">First Name</div>
                      <div className="text-sm font-medium" data-testid="text-user-firstname">{user.firstName || "—"}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <div className="text-xs text-muted-foreground mb-1">Last Name</div>
                      <div className="text-sm font-medium" data-testid="text-user-lastname">{user.lastName || "—"}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <div className="text-xs text-muted-foreground mb-1">Email</div>
                      <div className="text-sm font-medium" data-testid="text-user-email">{user.email || "—"}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <div className="text-xs text-muted-foreground mb-1">Created</div>
                      <div className="text-sm font-medium" data-testid="text-user-created">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4">
                      <div className="text-xs text-muted-foreground mb-1">Last Updated</div>
                      <div className="text-sm font-medium" data-testid="text-user-updated">{user.updatedAt ? new Date(user.updatedAt).toLocaleDateString() : "—"}</div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-3" data-testid="heading-team-member-link">Team Member Link</h3>
              <Card className="card-elevated overflow-visible">
                <CardContent className="pt-4 pb-4">
                  {user.teamMember ? (
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <div className="text-sm font-medium" data-testid="text-linked-tm-name">{user.teamMember.name}</div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          This user is linked to a team member for record-level access and resource tracking.
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
                    <div className="flex items-center justify-between flex-wrap gap-3">
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
                </CardContent>
              </Card>
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
                    const roleDetail = roles.find(r => r.id === role.roleId);
                    return (
                      <Card key={role.roleId} data-testid={`card-role-${role.roleId}`}>
                        <CardContent className="pt-3 pb-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium" data-testid={`text-role-name-${role.roleId}`}>{role.roleName}</span>
                              {roleDetail?.isSystem && (
                                <Badge variant="outline" className="text-[10px]">System</Badge>
                              )}
                            </div>
                            {roleDetail?.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{roleDetail.description}</p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeRoleMutation.mutate(role.roleId)}
                            disabled={removeRoleMutation.isPending}
                            data-testid={`button-remove-role-${role.roleId}`}
                          >
                            <X className="w-3.5 h-3.5 mr-1" />
                            Remove
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-6 pb-6 text-center">
                    <p className="text-sm text-muted-foreground" data-testid="text-no-roles">No roles assigned to this user.</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {availableRoles.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3" data-testid="heading-add-role">Add Role</h3>
                <Card className="card-elevated overflow-visible">
                  <CardContent className="pt-4 pb-4">
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
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UsersRolesManager() {
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
                          <Badge key={role.roleId} variant="secondary" className="text-xs" data-testid={`badge-role-${user.id}-${role.roleId}`}>
                            {role.roleName}
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

function AuditLogViewer() {
  const { data: entries = [], isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["/api/audit-log"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <ScrollText className="w-4 h-4" />
          Audit Log
        </h2>
        <p className="text-sm text-muted-foreground">
          A chronological record of significant actions performed in the system.
        </p>
      </div>

      <Card className="card-elevated overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="table-audit-log">
            <thead>
              <tr>
                <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Timestamp</th>
                <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Actor</th>
                <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Action</th>
                <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Object</th>
                <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="table-row-hover border-t border-border" data-testid={`row-audit-${entry.id}`}>
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {entry.actorUserId || "System"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-xs">{entry.action}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {entry.objectType ? `${entry.objectType}${entry.objectId ? `:${entry.objectId}` : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate">
                    {entry.metadata ? JSON.stringify(entry.metadata) : "—"}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No audit log entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function RoleMatrixViewer() {
  const { data: permissions = [], isLoading: permsLoading } = useQuery<RbacPermission[]>({
    queryKey: ["/api/rbac/permissions"],
  });

  const categories = useMemo(() => {
    const cats: Record<string, RbacPermission[]> = {};
    for (const p of permissions) {
      const cat = p.category || "other";
      if (!cats[cat]) cats[cat] = [];
      cats[cat].push(p);
    }
    return cats;
  }, [permissions]);

  const systemRoleNames = Object.keys(SYSTEM_ROLE_PERMISSIONS);

  if (permsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Grid3X3 className="w-4 h-4" />
          Role Permission Matrix
        </h2>
        <p className="text-sm text-muted-foreground">
          Reference view showing which permissions are granted to each system role.
        </p>
      </div>

      <Card className="card-elevated overflow-visible">
        <div className="overflow-x-auto">
          <table className="w-full" data-testid="table-role-matrix">
            <thead>
              <tr>
                <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground sticky left-0 bg-card dark:bg-card z-10">Permission</th>
                {systemRoleNames.map((roleName) => (
                  <th key={roleName} className="table-header-cell text-center px-3 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {roleName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(categories).map(([category, perms]) => (
                <>
                  <tr key={`cat-${category}`}>
                    <td colSpan={systemRoleNames.length + 1} className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 dark:bg-muted/30">
                      {category}
                    </td>
                  </tr>
                  {perms.map((perm) => (
                    <tr key={perm.key} className="table-row-hover border-t border-border">
                      <td className="px-4 py-2 text-xs sticky left-0 bg-card dark:bg-card z-10">
                        <div>
                          <span className="font-medium">{perm.key}</span>
                          {perm.description && (
                            <span className="block text-muted-foreground text-[10px]">{perm.description}</span>
                          )}
                        </div>
                      </td>
                      {systemRoleNames.map((roleName) => {
                        const hasIt = SYSTEM_ROLE_PERMISSIONS[roleName]?.includes(perm.key);
                        return (
                          <td key={roleName} className="px-3 py-2 text-center">
                            {hasIt ? (
                              <Check className="w-4 h-4 text-green-600 dark:text-green-400 mx-auto" />
                            ) : (
                              <span className="text-muted-foreground/30">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
              {permissions.length === 0 && (
                <tr>
                  <td colSpan={systemRoleNames.length + 1} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No permissions defined.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function AdminSecurity() {
  const appTitle = useAppTitle("Security");

  return (
    <div className="p-6">
      <Helmet>
        <title>{appTitle}</title>
      </Helmet>

      <h1 className="text-xl font-semibold mb-6">Security</h1>

      <div className="max-w-4xl">
        <Tabs defaultValue="roles" data-testid="tabs-security-main">
          <TabsList className="mb-6" data-testid="tabs-list-security-main">
            <TabsTrigger value="roles" data-testid="tab-security-roles">Roles</TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-security-users">Users</TabsTrigger>
            <TabsTrigger value="audit_log" data-testid="tab-security-audit-log">Audit Log</TabsTrigger>
            <TabsTrigger value="role_matrix" data-testid="tab-security-role-matrix">Role Matrix</TabsTrigger>
          </TabsList>

          <TabsContent value="roles">
            <RolesManager />
          </TabsContent>

          <TabsContent value="users">
            <UsersRolesManager />
          </TabsContent>

          <TabsContent value="audit_log">
            <AuditLogViewer />
          </TabsContent>

          <TabsContent value="role_matrix">
            <RoleMatrixViewer />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
