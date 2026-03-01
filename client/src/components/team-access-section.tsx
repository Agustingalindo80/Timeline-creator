import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Users, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PermissionGuard } from "@/components/permission-guard";
import { OBJECT_ROLE_LABELS } from "@shared/schema";
import type { TeamMember } from "@shared/schema";

type AssignmentWithUser = {
  id: string;
  objectType: string;
  objectId: string;
  userId: string;
  objectRole: string;
  user?: { id: string; username?: string; email?: string; firstName?: string; lastName?: string } | null;
  teamMember?: TeamMember | null;
};

const OBJECT_ROLE_OPTIONS = [
  { value: "ae", label: "AE" },
  { value: "se", label: "SE" },
  { value: "dl", label: "DL" },
  { value: "pm", label: "PM" },
  { value: "contributor", label: "Contributor" },
  { value: "executive_viewer", label: "Executive Viewer" },
];

interface TeamAccessSectionProps {
  objectType: "project" | "opportunity";
  objectId: string;
}

export function TeamAccessSection({ objectType, objectId }: TeamAccessSectionProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState("");
  const [selectedRole, setSelectedRole] = useState("");

  const permissionKey = objectType === "project" ? "project.edit" : "opp.edit";

  const { data: assignments = [], isLoading } = useQuery<AssignmentWithUser[]>({
    queryKey: ["/api/rbac/objects", objectType, objectId, "assignments"],
    queryFn: async () => {
      const res = await fetch(`/api/rbac/objects/${objectType}/${objectId}/assignments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch assignments");
      return res.json();
    },
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });

  const teamMembersWithAccess = teamMembers.filter(tm => !!tm.userId);

  const selectedTm = teamMembers.find(tm => tm.id === selectedTeamMemberId);
  const selectedTmHasAccess = selectedTm ? !!selectedTm.userId : true;

  const addMutation = useMutation({
    mutationFn: async (data: { userId: string; objectRole: string }) => {
      await apiRequest("POST", `/api/rbac/objects/${objectType}/${objectId}/assignments`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/objects", objectType, objectId, "assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/my-assignments"] });
      toast({ title: "Member added successfully" });
      setDialogOpen(false);
      setSelectedTeamMemberId("");
      setSelectedRole("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      await apiRequest("DELETE", `/api/rbac/assignments/${assignmentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/objects", objectType, objectId, "assignments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/my-assignments"] });
      toast({ title: "Member removed" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleAdd = () => {
    if (!selectedTm || !selectedTm.userId || !selectedRole) return;
    addMutation.mutate({ userId: selectedTm.userId, objectRole: selectedRole });
  };

  const getUserDisplayName = (a: AssignmentWithUser) => {
    if (a.teamMember?.name) return a.teamMember.name;
    if (a.user?.firstName || a.user?.lastName) return `${a.user.firstName || ""} ${a.user.lastName || ""}`.trim();
    if (a.user?.username) return a.user.username;
    if (a.user?.email) return a.user.email;
    return "Unknown User";
  };

  return (
    <div className="space-y-4" data-testid="section-team-access">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Users className="w-4 h-4" />
          Team & Access Assignments
        </h3>
        <PermissionGuard permission={permissionKey}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
            data-testid="button-add-member"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Member
          </Button>
        </PermissionGuard>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Loading assignments...</div>
      ) : assignments.length === 0 ? (
        <div className="text-center py-8">
          <Users className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No team members assigned yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Add members to define roles and access for this {objectType}.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm" data-testid="table-assignments">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium">Name</th>
                <th className="text-left p-3 font-medium">Role</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id} className="border-b last:border-b-0 hover:bg-muted/20" data-testid={`row-assignment-${a.id}`}>
                  <td className="p-3">
                    <span className="font-medium">{getUserDisplayName(a)}</span>
                  </td>
                  <td className="p-3">
                    <Badge variant="secondary" className="text-xs">
                      {OBJECT_ROLE_LABELS[a.objectRole] || a.objectRole}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <PermissionGuard permission={permissionKey}>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeMutation.mutate(a.id)}
                        disabled={removeMutation.isPending}
                        data-testid={`button-remove-assignment-${a.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </PermissionGuard>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Team Member</label>
              <Select value={selectedTeamMemberId} onValueChange={setSelectedTeamMemberId}>
                <SelectTrigger data-testid="select-add-member-team-member">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map((tm) => (
                    <SelectItem key={tm.id} value={tm.id} data-testid={`select-tm-option-${tm.id}`}>
                      {tm.name} {!tm.userId && "(No App Access)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTeamMemberId && !selectedTmHasAccess && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 dark:text-amber-400" data-testid="text-no-access-warning">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  This team member needs App Access to be assigned a role
                </div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Object Role</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger data-testid="select-add-member-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {OBJECT_ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value} data-testid={`select-role-option-${r.value}`}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-add-member">
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={!selectedTeamMemberId || !selectedTmHasAccess || !selectedRole || addMutation.isPending}
              data-testid="button-confirm-add-member"
            >
              {addMutation.isPending ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
