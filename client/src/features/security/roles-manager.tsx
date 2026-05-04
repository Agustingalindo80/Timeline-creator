import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Shield, Plus, Edit3, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
import { PermissionGuard } from "@/components/permission-guard";
import { MODULE_KEYS, MODULE_LABELS, ALL_PERMISSIONS, PERMISSION_CATEGORIES, SYSTEM_ROLE_PERMISSIONS } from "@shared/models/rbac";
import type { ModuleKey } from "@shared/models/rbac";
import type { RbacUser, RbacRole } from "./types";

export function RolesManager() {
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
        counts[r.id] = (counts[r.id] || 0) + 1;
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
