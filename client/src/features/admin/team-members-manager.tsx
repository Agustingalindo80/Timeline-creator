import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, X, Users, Edit3, Trash2, Save, ChevronDown, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useTranslation } from "react-i18next";
import type { AppSettings, TeamMember, AllocationWithProject, TimelineWithMilestones } from "@shared/schema";
import { getDefaultFieldOptions } from "@shared/schema";

function MemberAllocations({ memberId, memberName }: { memberId: string; memberName: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [newProjectId, setNewProjectId] = useState("");
  const [newWeeklyHours, setNewWeeklyHours] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newStatus, setNewStatus] = useState("active");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editProjectId, setEditProjectId] = useState("");
  const [editWeeklyHours, setEditWeeklyHours] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("active");

  const { data: allocs = [], isLoading } = useQuery<AllocationWithProject[]>({
    queryKey: ["/api/team-members", memberId, "allocations"],
  });

  const { data: projects = [] } = useQuery<TimelineWithMilestones[]>({
    queryKey: ["/api/timelines"],
  });

  const assignedProjectIds = allocs.map(a => a.timelineId);
  const availableProjects = projects.filter(p => !assignedProjectIds.includes(p.id));

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiRequest("POST", `/api/team-members/${memberId}/allocations`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members", memberId, "allocations"] });
      toast({ title: "Allocation added" });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      await apiRequest("PATCH", `/api/allocations/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members", memberId, "allocations"] });
      toast({ title: "Allocation updated" });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/allocations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members", memberId, "allocations"] });
      toast({ title: "Allocation removed" });
    },
  });

  const resetForm = () => {
    setShowAdd(false);
    setNewProjectId("");
    setNewWeeklyHours("");
    setNewStartDate("");
    setNewEndDate("");
    setNewNotes("");
    setNewStatus("active");
  };

  const startEditing = (a: AllocationWithProject) => {
    setEditingId(a.id);
    setEditProjectId(a.timelineId);
    setEditWeeklyHours(a.weeklyHours ?? "");
    setEditStartDate(a.startDate || "");
    setEditEndDate(a.endDate || "");
    setEditNotes(a.notes || "");
    setEditStatus(a.status || "active");
  };

  const totalWeeklyHours = allocs.reduce((sum, a) => sum + (a.weeklyHours ? parseFloat(a.weeklyHours) : 0), 0);

  if (isLoading) return <Skeleton className="h-8 w-full" />;

  return (
    <div className="mt-2 pl-11 border-t pt-2" data-testid={`allocations-section-${memberId}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Weekly Allocations ({allocs.length})
            {totalWeeklyHours > 0 && <span className="ml-1">· {totalWeeklyHours}h/week total</span>}
          </span>
        </div>
        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setShowAdd(!showAdd)} data-testid={`button-add-allocation-${memberId}`}>
          <Plus className="w-3 h-3 mr-1" />
          Add
        </Button>
      </div>

      {showAdd && (
        <div className="border rounded-md p-2.5 bg-muted/30 mb-2 space-y-2" data-testid={`form-add-allocation-${memberId}`}>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Project *</label>
              <select className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs" value={newProjectId} onChange={e => setNewProjectId(e.target.value)} data-testid={`select-new-alloc-project-${memberId}`}>
                <option value="">Select project...</option>
                {availableProjects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Hours/Week</label>
              <Input className="h-8 text-xs" type="number" step="0.5" min="0" max="80" value={newWeeklyHours} onChange={e => setNewWeeklyHours(e.target.value)} placeholder="40" data-testid={`input-new-alloc-hours-${memberId}`} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Start Date</label>
              <Input className="h-8 text-xs" type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} data-testid={`input-new-alloc-start-${memberId}`} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">End Date</label>
              <Input className="h-8 text-xs" type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} data-testid={`input-new-alloc-end-${memberId}`} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <select className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs" value={newStatus} onChange={e => setNewStatus(e.target.value)} data-testid={`select-new-alloc-status-${memberId}`}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
              <Input className="h-8 text-xs" value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Optional" data-testid={`input-new-alloc-notes-${memberId}`} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetForm}>Cancel</Button>
            <Button size="sm" className="h-7 text-xs" onClick={() => createMutation.mutate({ timelineId: newProjectId, weeklyHours: newWeeklyHours || null, startDate: newStartDate || null, endDate: newEndDate || null, status: newStatus, notes: newNotes || null })} disabled={!newProjectId || createMutation.isPending} data-testid={`button-save-new-alloc-${memberId}`}>
              {createMutation.isPending ? "Adding..." : "Add"}
            </Button>
          </div>
        </div>
      )}

      {allocs.length === 0 && !showAdd && (
        <p className="text-xs text-muted-foreground text-center py-2">No allocations yet.</p>
      )}

      <div className="space-y-1.5">
        {allocs.map(a => (
          <div key={a.id} className="border rounded-md p-2 bg-background text-xs" data-testid={`allocation-${a.id}`}>
            {editingId === a.id ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Project</label>
                    <select className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs" value={editProjectId} onChange={e => setEditProjectId(e.target.value)} data-testid={`select-edit-alloc-project-${a.id}`}>
                      {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Hours/Week</label>
                    <Input className="h-8 text-xs" type="number" step="0.5" min="0" max="80" value={editWeeklyHours} onChange={e => setEditWeeklyHours(e.target.value)} data-testid={`input-edit-alloc-hours-${a.id}`} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Start Date</label>
                    <Input className="h-8 text-xs" type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} data-testid={`input-edit-alloc-start-${a.id}`} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">End Date</label>
                    <Input className="h-8 text-xs" type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)} data-testid={`input-edit-alloc-end-${a.id}`} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
                    <select className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-xs" value={editStatus} onChange={e => setEditStatus(e.target.value)} data-testid={`select-edit-alloc-status-${a.id}`}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes</label>
                    <Input className="h-8 text-xs" value={editNotes} onChange={e => setEditNotes(e.target.value)} data-testid={`input-edit-alloc-notes-${a.id}`} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                  <Button size="sm" className="h-6 text-xs" onClick={() => updateMutation.mutate({ id: a.id, data: { timelineId: editProjectId, weeklyHours: editWeeklyHours || null, startDate: editStartDate || null, endDate: editEndDate || null, status: editStatus, notes: editNotes || null } })} disabled={updateMutation.isPending} data-testid={`button-save-edit-alloc-${a.id}`}>
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium truncate" data-testid={`text-alloc-project-${a.id}`}>{a.project.title}</span>
                  {a.weeklyHours && <span className="text-muted-foreground shrink-0">{parseFloat(a.weeklyHours)}h/week</span>}
                  {a.startDate && a.endDate && <span className="text-muted-foreground shrink-0">{a.startDate} → {a.endDate}</span>}
                  {a.startDate && !a.endDate && <span className="text-muted-foreground shrink-0">from {a.startDate}</span>}
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${a.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"}`} data-testid={`badge-alloc-status-${a.id}`}>
                    {a.status === "active" ? "Active" : "Inactive"}
                  </span>
                  {a.notes && <span className="text-muted-foreground truncate">· {a.notes}</span>}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEditing(a)} data-testid={`button-edit-alloc-${a.id}`}>
                    <Edit3 className="w-3 h-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteMutation.mutate(a.id)} data-testid={`button-delete-alloc-${a.id}`}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TeamMembersManager() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newMonthlyCost, setNewMonthlyCost] = useState("");
  const [newHourlyCost, setNewHourlyCost] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editMonthlyCost, setEditMonthlyCost] = useState("");
  const [editHourlyCost, setEditHourlyCost] = useState("");
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);

  const { data: members = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });
  const roleOptions = settings?.teamMemberRoles || getDefaultFieldOptions("teamMemberRoles", settings?.locale || "en");

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiRequest("POST", "/api/team-members", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "Team member created" });
      setNewName(""); setNewEmail(""); setNewRole(""); setNewDept(""); setNewMonthlyCost(""); setNewHourlyCost("");
      setShowAdd(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      await apiRequest("PATCH", `/api/team-members/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "Team member updated" });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/team-members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "Team member deleted" });
    },
  });

  const startEditing = (m: TeamMember) => {
    setEditingId(m.id);
    setEditName(m.name);
    setEditEmail(m.email || "");
    setEditRole(m.role || "");
    setEditDept(m.department || "");
    setEditMonthlyCost(m.monthlyCost ?? "");
    setEditHourlyCost(m.hourlyCost ?? "");
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4" />
            Team Members
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage team members that can be assigned to projects.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)} data-testid="button-add-team-member-settings">
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Member
        </Button>
      </div>

      {showAdd && (
        <Card className="p-4" data-testid="form-add-team-member">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" data-testid="input-new-member-name" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
              <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email" data-testid="input-new-member-email" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Role</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={newRole} onChange={e => setNewRole(e.target.value)} data-testid="select-new-member-role">
                <option value="">Select role...</option>
                {roleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Department</label>
              <Input value={newDept} onChange={e => setNewDept(e.target.value)} placeholder="e.g. Engineering" data-testid="input-new-member-dept" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Monthly Cost ($)</label>
              <Input type="number" step="0.01" min="0" value={newMonthlyCost} onChange={e => setNewMonthlyCost(e.target.value)} placeholder="0.00" data-testid="input-new-member-monthly-cost" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Hourly Cost ($)</label>
              <Input type="number" step="0.01" min="0" value={newHourlyCost} onChange={e => setNewHourlyCost(e.target.value)} placeholder="0.00" data-testid="input-new-member-hourly-cost" />
            </div>
          </div>
          <div className="flex gap-2 mt-3 justify-end">
            <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); setNewName(""); setNewEmail(""); setNewRole(""); setNewDept(""); setNewMonthlyCost(""); setNewHourlyCost(""); }} data-testid="button-cancel-add-member">
              Cancel
            </Button>
            <Button size="sm" onClick={() => createMutation.mutate({ name: newName, email: newEmail || null, role: newRole || null, department: newDept || null, monthlyCost: newMonthlyCost || null, hourlyCost: newHourlyCost || null })} disabled={!newName.trim() || createMutation.isPending} data-testid="button-save-new-member">
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </Card>
      )}

      {members.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">No team members yet. Add your first team member above.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {members.map(m => (
            <Card key={m.id} className="p-3" data-testid={`team-member-${m.id}`}>
              {editingId === m.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
                      <Input value={editName} onChange={e => setEditName(e.target.value)} data-testid={`input-edit-member-name-${m.id}`} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
                      <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} data-testid={`input-edit-member-email-${m.id}`} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Role</label>
                      <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={editRole} onChange={e => setEditRole(e.target.value)} data-testid={`select-edit-member-role-${m.id}`}>
                        <option value="">Select role...</option>
                        {roleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Department</label>
                      <Input value={editDept} onChange={e => setEditDept(e.target.value)} data-testid={`input-edit-member-dept-${m.id}`} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Monthly Cost ($)</label>
                      <Input type="number" step="0.01" min="0" value={editMonthlyCost} onChange={e => setEditMonthlyCost(e.target.value)} data-testid={`input-edit-member-monthly-cost-${m.id}`} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Hourly Cost ($)</label>
                      <Input type="number" step="0.01" min="0" value={editHourlyCost} onChange={e => setEditHourlyCost(e.target.value)} data-testid={`input-edit-member-hourly-cost-${m.id}`} />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} data-testid={`button-cancel-edit-member-${m.id}`}>Cancel</Button>
                    <Button size="sm" onClick={() => updateMutation.mutate({ id: m.id, data: { name: editName, email: editEmail || null, role: editRole || null, department: editDept || null, monthlyCost: editMonthlyCost || null, hourlyCost: editHourlyCost || null } })} disabled={!editName.trim() || updateMutation.isPending} data-testid={`button-save-edit-member-${m.id}`}>
                      <Save className="w-3.5 h-3.5 mr-1" />
                      {updateMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0 hover:bg-primary/20 transition-colors cursor-pointer"
                        onClick={() => setExpandedMemberId(expandedMemberId === m.id ? null : m.id)}
                        data-testid={`button-toggle-allocations-${m.id}`}
                      >
                        {expandedMemberId === m.id ? <ChevronDown className="w-3.5 h-3.5" /> : m.name.charAt(0).toUpperCase()}
                      </button>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" data-testid={`text-member-name-${m.id}`}>{m.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {m.role && <span>{roleOptions.find(r => r.value === m.role)?.label || m.role}</span>}
                          {m.department && <span>· {m.department}</span>}
                          {m.email && <span>· {m.email}</span>}
                          {m.monthlyCost && <span>· ${parseFloat(m.monthlyCost).toFixed(2)}/mo</span>}
                          {m.hourlyCost && <span>· ${parseFloat(m.hourlyCost).toFixed(2)}/hr</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => startEditing(m)} data-testid={`button-edit-member-${m.id}`}>
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" data-testid={`button-delete-member-${m.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete team member?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete "{m.name}" and remove them from all project assignments and allocations.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(m.id)} data-testid={`button-confirm-delete-member-${m.id}`}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  {expandedMemberId === m.id && (
                    <MemberAllocations memberId={m.id} memberName={m.name} />
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
