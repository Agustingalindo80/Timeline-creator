import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Users, Mail, Building, Save, Calendar, Plus, Edit3, Trash2, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { formatDateForProject } from "@/lib/date-format";
import type { TeamMember, AppSettings, AllocationWithProject, TimelineWithMilestones } from "@shared/schema";
import { DEFAULT_TEAM_MEMBER_ROLES } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function TeamMemberDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editMonthlyCost, setEditMonthlyCost] = useState("");
  const [editHourlyCost, setEditHourlyCost] = useState("");

  const { data: member, isLoading } = useQuery<TeamMember>({
    queryKey: ["/api/team-members", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/team-members/${params.id}`);
      if (!res.ok) throw new Error("Team member not found");
      return res.json();
    },
  });

  const { data: allocs = [], isLoading: allocsLoading } = useQuery<AllocationWithProject[]>({
    queryKey: ["/api/team-members", params.id, "allocations"],
  });

  const { data: projects = [] } = useQuery<TimelineWithMilestones[]>({
    queryKey: ["/api/timelines"],
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });
  const roleOptions = settings?.teamMemberRoles || DEFAULT_TEAM_MEMBER_ROLES;

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/team-members/${params.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "Team member updated" });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/team-members/${params.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "Team member deleted" });
      navigate("/team-members");
    },
  });

  const startEditing = () => {
    if (!member) return;
    setEditName(member.name);
    setEditEmail(member.email || "");
    setEditRole(member.role || "");
    setEditDept(member.department || "");
    setEditMonthlyCost(member.monthlyCost ?? "");
    setEditHourlyCost(member.hourlyCost ?? "");
    setEditing(true);
  };

  const getRoleLabel = (value: string | null) => {
    if (!value) return null;
    return roleOptions.find(r => r.value === value)?.label || value;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="p-6">
        <Link href="/team-members">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
        </Link>
        <p className="text-muted-foreground mt-4">Team member not found.</p>
      </div>
    );
  }

  const totalWeeklyHours = allocs.reduce((sum, a) => sum + (a.weeklyHours ? parseFloat(a.weeklyHours) : 0), 0);

  return (
    <div className="p-4 md:p-6 max-w-[1000px] mx-auto">
      <Helmet><title>{member.name} | Team Members</title></Helmet>

      <div className="flex items-center gap-2 mb-4">
        <Link href="/team-members">
          <Button variant="ghost" size="sm" data-testid="button-back-to-members">
            <ArrowLeft className="w-4 h-4 mr-1" /> Team Members
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
            {member.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-semibold" data-testid="text-member-name">{member.name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {member.role && <Badge variant="secondary" data-testid="badge-member-role">{getRoleLabel(member.role)}</Badge>}
              {member.department && <Badge variant="outline" data-testid="badge-member-dept">{member.department}</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={startEditing} data-testid="button-edit-member">
            <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-delete-member">
                <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete team member?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{member.name}" and remove all their project assignments and allocations.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()} data-testid="button-confirm-delete-member">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {editing && (
        <div className="border rounded-lg p-4 mb-6 bg-muted/30 space-y-3" data-testid="form-edit-member">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label>Name *</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} data-testid="input-edit-name" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={editEmail} onChange={e => setEditEmail(e.target.value)} data-testid="input-edit-email" />
            </div>
            <div>
              <Label>Role</Label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={editRole} onChange={e => setEditRole(e.target.value)} data-testid="select-edit-role">
                <option value="">Select role...</option>
                {roleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <Label>Department</Label>
              <Input value={editDept} onChange={e => setEditDept(e.target.value)} data-testid="input-edit-dept" />
            </div>
            <div>
              <Label>Monthly Cost ($)</Label>
              <Input type="number" step="0.01" min="0" value={editMonthlyCost} onChange={e => setEditMonthlyCost(e.target.value)} data-testid="input-edit-monthly" />
            </div>
            <div>
              <Label>Hourly Cost ($)</Label>
              <Input type="number" step="0.01" min="0" value={editHourlyCost} onChange={e => setEditHourlyCost(e.target.value)} data-testid="input-edit-hourly" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={() => updateMutation.mutate({ name: editName, email: editEmail || null, role: editRole || null, department: editDept || null, monthlyCost: editMonthlyCost || null, hourlyCost: editHourlyCost || null })} disabled={!editName.trim() || updateMutation.isPending} data-testid="button-save-member">
              <Save className="w-3.5 h-3.5 mr-1" />
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {member.email && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="w-4 h-4 shrink-0" />
            <span className="truncate" data-testid="text-member-email">{member.email}</span>
          </div>
        )}
        {member.department && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building className="w-4 h-4 shrink-0" />
            <span data-testid="text-member-department">{member.department}</span>
          </div>
        )}
        {member.monthlyCost && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="w-4 h-4 shrink-0" />
            <span data-testid="text-member-monthly">${parseFloat(member.monthlyCost).toLocaleString()}/mo</span>
          </div>
        )}
        {member.hourlyCost && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <DollarSign className="w-4 h-4 shrink-0" />
            <span data-testid="text-member-hourly">${parseFloat(member.hourlyCost).toFixed(2)}/hr</span>
          </div>
        )}
      </div>

      <Tabs defaultValue="allocations">
        <TabsList data-testid="tabs-member-detail">
          <TabsTrigger value="allocations" data-testid="tab-allocations">
            <Calendar className="w-4 h-4 mr-1.5" />
            Allocations ({allocs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="allocations">
          <AllocationsTab
            memberId={member.id}
            allocs={allocs}
            projects={projects}
            isLoading={allocsLoading}
            totalWeeklyHours={totalWeeklyHours}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AllocationsTab({ memberId, allocs, projects, isLoading, totalWeeklyHours }: {
  memberId: string;
  allocs: AllocationWithProject[];
  projects: TimelineWithMilestones[];
  isLoading: boolean;
  totalWeeklyHours: number;
}) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [newProjectId, setNewProjectId] = useState("");
  const [newWeeklyHours, setNewWeeklyHours] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newStatus, setNewStatus] = useState("active");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeeklyHours, setEditWeeklyHours] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("active");

  const assignedProjectIds = allocs.map(a => a.timelineId);
  const availableProjects = projects.filter(p => !assignedProjectIds.includes(p.id));
  const selectedProject = projects.find(p => p.id === newProjectId);
  const selectedDateFormat = selectedProject?.dateFormat || "";

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", `/api/team-members/${memberId}/allocations`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members", memberId, "allocations"] });
      toast({ title: "Allocation added" });
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
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
    setEditWeeklyHours(a.weeklyHours ?? "");
    setEditStartDate(a.startDate || "");
    setEditEndDate(a.endDate || "");
    setEditNotes(a.notes || "");
    setEditStatus(a.status || "active");
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {allocs.length > 0 && (
            <span>Total: <strong>{totalWeeklyHours}h/week</strong> across {allocs.length} project{allocs.length !== 1 ? "s" : ""}</span>
          )}
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)} data-testid="button-add-allocation">
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Allocation
        </Button>
      </div>

      {showAdd && (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-3" data-testid="form-add-allocation">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <div>
              <Label>Project *</Label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={newProjectId} onChange={e => setNewProjectId(e.target.value)} data-testid="select-alloc-project">
                <option value="">Select project...</option>
                {availableProjects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div>
              <Label>Hours/Week</Label>
              <Input type="number" step="0.5" min="0" max="80" value={newWeeklyHours} onChange={e => setNewWeeklyHours(e.target.value)} placeholder="40" data-testid="input-alloc-hours" />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} data-testid="input-alloc-start" />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} data-testid="input-alloc-end" />
            </div>
            <div>
              <Label>Status</Label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={newStatus} onChange={e => setNewStatus(e.target.value)} data-testid="select-alloc-status">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Optional" data-testid="input-alloc-notes" />
            </div>
          </div>
          {selectedDateFormat && (
            <p className="text-xs text-muted-foreground">Date format for this project: <strong>{selectedDateFormat}</strong></p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={resetForm}>Cancel</Button>
            <Button size="sm" onClick={() => createMutation.mutate({ timelineId: newProjectId, weeklyHours: newWeeklyHours || null, startDate: newStartDate || null, endDate: newEndDate || null, status: newStatus, notes: newNotes || null })} disabled={!newProjectId || createMutation.isPending} data-testid="button-save-allocation">
              {createMutation.isPending ? "Adding..." : "Add Allocation"}
            </Button>
          </div>
        </div>
      )}

      {allocs.length === 0 && !showAdd ? (
        <div className="border rounded-lg p-8 text-center text-muted-foreground">
          No allocations yet. Click "Add Allocation" to assign this member to a project.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2.5 font-medium text-xs">Project</th>
                <th className="text-right p-2.5 font-medium text-xs">Hours/Week</th>
                <th className="text-left p-2.5 font-medium text-xs">Start Date</th>
                <th className="text-left p-2.5 font-medium text-xs">End Date</th>
                <th className="text-left p-2.5 font-medium text-xs">Status</th>
                <th className="text-left p-2.5 font-medium text-xs">Notes</th>
                <th className="w-20 p-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {allocs.map(a => (
                <tr key={a.id} className="border-b hover:bg-muted/30 transition-colors" data-testid={`row-allocation-${a.id}`}>
                  {editingId === a.id ? (
                    <>
                      <td className="p-2.5">
                        <span className="text-sm font-medium">{a.project.title}</span>
                      </td>
                      <td className="p-2.5">
                        <Input className="h-8 text-xs w-20 ml-auto text-right" type="number" step="0.5" min="0" max="80" value={editWeeklyHours} onChange={e => setEditWeeklyHours(e.target.value)} data-testid={`input-edit-hours-${a.id}`} />
                      </td>
                      <td className="p-2.5">
                        <Input className="h-8 text-xs" type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} data-testid={`input-edit-start-${a.id}`} />
                      </td>
                      <td className="p-2.5">
                        <Input className="h-8 text-xs" type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)} data-testid={`input-edit-end-${a.id}`} />
                      </td>
                      <td className="p-2.5">
                        <select className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={editStatus} onChange={e => setEditStatus(e.target.value)} data-testid={`select-edit-status-${a.id}`}>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>
                      <td className="p-2.5">
                        <Input className="h-8 text-xs" value={editNotes} onChange={e => setEditNotes(e.target.value)} data-testid={`input-edit-notes-${a.id}`} />
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          <Button size="sm" className="h-7 text-xs" onClick={() => updateMutation.mutate({ id: a.id, data: { weeklyHours: editWeeklyHours || null, startDate: editStartDate || null, endDate: editEndDate || null, status: editStatus, notes: editNotes || null } })} disabled={updateMutation.isPending} data-testid={`button-save-alloc-${a.id}`}>
                            Save
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-2.5">
                        <Link href={`/timeline/${a.timelineId}`}>
                          <span className="text-sm font-medium hover:underline cursor-pointer" data-testid={`link-alloc-project-${a.id}`}>
                            {a.project.title}
                          </span>
                        </Link>
                      </td>
                      <td className="p-2.5 text-right">
                        {a.weeklyHours ? <span className="font-medium">{parseFloat(a.weeklyHours)}h</span> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="p-2.5 text-muted-foreground">{a.startDate || "—"}</td>
                      <td className="p-2.5 text-muted-foreground">{a.endDate || "—"}</td>
                      <td className="p-2.5">
                        <Badge variant={a.status === "active" ? "default" : "secondary"} className={a.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"} data-testid={`badge-status-${a.id}`}>
                          {a.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="p-2.5 text-muted-foreground truncate max-w-[150px]">{a.notes || "—"}</td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEditing(a)} data-testid={`button-edit-alloc-${a.id}`}>
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`button-delete-alloc-${a.id}`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove allocation?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Remove allocation for "{a.project.title}"?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(a.id)} data-testid={`button-confirm-delete-alloc-${a.id}`}>
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
