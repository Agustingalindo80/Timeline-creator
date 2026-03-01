import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Shield, List, Plus, X, GripVertical, RotateCcw, Users, CreditCard, Edit3, Trash2, Save, ChevronDown, ChevronRight, Calendar, Paintbrush, Upload, ImageIcon, Compass, ChevronUp, UserCog, ScrollText, Grid3X3, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppTitle } from "@/hooks/use-app-title";
import { Label } from "@/components/ui/label";
import { PermissionGuard } from "@/components/permission-guard";
import { SYSTEM_ROLE_PERMISSIONS, ALL_PERMISSIONS } from "@shared/models/rbac";
import type { AppSettings, FieldOption, TeamMember, RateCard, AllocationWithProject, TimelineWithMilestones, BrandingConfig, FlightpathStage, FlightpathDeliverable } from "@shared/schema";
import {
  DEFAULT_TASK_STATUSES,
  DEFAULT_TASK_HEALTH,
  DEFAULT_TASK_ITEM_TYPES,
  DEFAULT_RISK_PROBABILITIES,
  DEFAULT_RISK_IMPACTS,
  DEFAULT_RISK_STATUSES,
  DEFAULT_PROJECT_TYPES,
  DEFAULT_ENGAGEMENT_MODELS,
  DEFAULT_PROJECT_STATUSES,
  DEFAULT_CONTACT_ROLES,
  DEFAULT_INDUSTRIES,
  DEFAULT_TEAM_MEMBER_ROLES,
  DEFAULT_REGIONS,
  DEFAULT_DATE_FORMATS,
} from "@shared/schema";

interface FieldOptionEditorProps {
  title: string;
  description: string;
  options: FieldOption[];
  defaults: FieldOption[];
  settingsKey: string;
  onSave: (key: string, options: FieldOption[]) => void;
  isPending: boolean;
  testIdPrefix: string;
}

function FieldOptionEditor({
  title,
  description,
  options,
  defaults,
  settingsKey,
  onSave,
  isPending,
  testIdPrefix,
}: FieldOptionEditorProps) {
  const [items, setItems] = useState<FieldOption[]>(options);
  const [newValue, setNewValue] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) {
      setItems(options);
    }
  }, [options, isEditing]);

  const hasChanges = JSON.stringify(items) !== JSON.stringify(options);

  const addOption = () => {
    const val = newValue.trim();
    const lbl = newLabel.trim();
    if (!val || !lbl) return;
    if (items.some((i) => i.value === val)) return;
    setItems([...items, { value: val, label: lbl }]);
    setNewValue("");
    setNewLabel("");
  };

  const removeOption = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateLabel = (index: number, label: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], label };
    setItems(updated);
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const updated = [...items];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setItems(updated);
  };

  const moveDown = (index: number) => {
    if (index === items.length - 1) return;
    const updated = [...items];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setItems(updated);
  };

  const resetToDefaults = () => {
    setItems([...defaults]);
  };

  const handleSave = () => {
    onSave(settingsKey, items);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setItems(options);
    setIsEditing(false);
    setNewValue("");
    setNewLabel("");
  };

  return (
    <Card className="p-5" data-testid={`card-${testIdPrefix}`}>
      <div className="flex items-center justify-between gap-4 mb-1">
        <div>
          <h3 className="text-sm font-medium" data-testid={`text-${testIdPrefix}-title`}>{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        {!isEditing && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsEditing(true)}
            data-testid={`button-edit-${testIdPrefix}`}
          >
            Edit
          </Button>
        )}
      </div>

      {!isEditing ? (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {items.map((opt) => (
            <span
              key={opt.value}
              className="px-2 py-0.5 text-xs rounded-md bg-muted text-muted-foreground"
              data-testid={`badge-${testIdPrefix}-${opt.value}`}
            >
              {opt.label}
            </span>
          ))}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <div className="space-y-1">
            {items.map((opt, idx) => (
              <div key={opt.value} className="flex items-center gap-2" data-testid={`row-${testIdPrefix}-${opt.value}`}>
                <div className="flex flex-col gap-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-4 w-4"
                    onClick={() => moveUp(idx)}
                    disabled={idx === 0}
                    data-testid={`button-move-up-${testIdPrefix}-${opt.value}`}
                  >
                    <GripVertical className="w-3 h-3 rotate-90" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-4 w-4"
                    onClick={() => moveDown(idx)}
                    disabled={idx === items.length - 1}
                    data-testid={`button-move-down-${testIdPrefix}-${opt.value}`}
                  >
                    <GripVertical className="w-3 h-3 rotate-90" />
                  </Button>
                </div>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded min-w-[80px]">{opt.value}</code>
                <Input
                  value={opt.label}
                  onChange={(e) => updateLabel(idx, e.target.value)}
                  className="h-8 text-sm flex-1"
                  data-testid={`input-label-${testIdPrefix}-${opt.value}`}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeOption(idx)}
                  disabled={items.length <= 1}
                  data-testid={`button-remove-${testIdPrefix}-${opt.value}`}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-1 border-t">
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
              placeholder="value_key"
              className="h-8 text-sm w-32"
              data-testid={`input-new-value-${testIdPrefix}`}
            />
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Display Label"
              className="h-8 text-sm flex-1"
              data-testid={`input-new-label-${testIdPrefix}`}
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8"
              onClick={addOption}
              disabled={!newValue.trim() || !newLabel.trim()}
              data-testid={`button-add-${testIdPrefix}`}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add
            </Button>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={resetToDefaults}
              className="text-xs"
              data-testid={`button-reset-${testIdPrefix}`}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset to defaults
            </Button>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                data-testid={`button-cancel-${testIdPrefix}`}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isPending || items.length === 0}
                data-testid={`button-save-${testIdPrefix}`}
              >
                {isPending ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

interface FieldConfig {
  title: string;
  description: string;
  key: string;
  defaults: FieldOption[];
  current: FieldOption[];
  testId: string;
}

interface TabConfig {
  value: string;
  label: string;
  fields: FieldConfig[];
}

function MemberAllocations({ memberId, memberName }: { memberId: string; memberName: string }) {
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

function TeamMembersManager() {
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
  const roleOptions = settings?.teamMemberRoles || DEFAULT_TEAM_MEMBER_ROLES;

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
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
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
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

function RateCardsManager() {
  const { toast } = useToast();
  const [addingForRegion, setAddingForRegion] = useState<string | null>(null);
  const [newRole, setNewRole] = useState("");
  const [newCostRate, setNewCostRate] = useState("");
  const [newBillRate, setNewBillRate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editCostRate, setEditCostRate] = useState("");
  const [editBillRate, setEditBillRate] = useState("");
  const [collapsedRegions, setCollapsedRegions] = useState<Set<string>>(new Set());

  const { data: cards = [], isLoading } = useQuery<RateCard[]>({
    queryKey: ["/api/rate-cards"],
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });
  const roleOptions = settings?.teamMemberRoles || DEFAULT_TEAM_MEMBER_ROLES;
  const regionOptions = settings?.regions || DEFAULT_REGIONS;

  const cardsByRegion = useMemo(() => {
    const grouped: Record<string, RateCard[]> = {};
    for (const region of regionOptions) {
      grouped[region.value] = cards.filter(c => c.region === region.value);
    }
    const unassigned = cards.filter(c => !c.region || !regionOptions.some(r => r.value === c.region));
    if (unassigned.length > 0) {
      grouped["_unassigned"] = unassigned;
    }
    return grouped;
  }, [cards, regionOptions]);

  const toggleRegion = (regionValue: string) => {
    setCollapsedRegions(prev => {
      const next = new Set(prev);
      if (next.has(regionValue)) next.delete(regionValue);
      else next.add(regionValue);
      return next;
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/rate-cards", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rate-cards"] });
      toast({ title: "Rate card created" });
      resetAddForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/rate-cards/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rate-cards"] });
      toast({ title: "Rate card updated" });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/rate-cards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rate-cards"] });
      toast({ title: "Rate card deleted" });
    },
  });

  const resetAddForm = () => {
    setAddingForRegion(null);
    setNewRole("");
    setNewCostRate("");
    setNewBillRate("");
  };

  const getRoleLabel = (value: string) => roleOptions.find(r => r.value === value)?.label || value;
  const getRegionLabel = (value: string) => regionOptions.find(r => r.value === value)?.label || value;
  const autoName = (role: string, region: string) => {
    const parts = [];
    if (region) parts.push(getRegionLabel(region));
    if (role) parts.push(getRoleLabel(role));
    return parts.length > 0 ? parts.join(" - ") : "Rate Card";
  };

  const startEditing = (c: RateCard) => {
    setEditingId(c.id);
    setEditRole(c.role || "");
    setEditCostRate(c.costRate ?? "");
    setEditBillRate(c.billRate ?? "");
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  const renderCard = (c: RateCard) => (
    <div key={c.id} className="border rounded-md p-2.5 bg-background" data-testid={`rate-card-${c.id}`}>
      {editingId === c.id ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Role *</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={editRole} onChange={e => setEditRole(e.target.value)} data-testid={`select-edit-card-role-${c.id}`}>
                <option value="">Select role...</option>
                {roleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Cost Rate ($/hr)</label>
              <Input type="number" step="0.01" min="0" value={editCostRate} onChange={e => setEditCostRate(e.target.value)} data-testid={`input-edit-card-cost-${c.id}`} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Bill Rate ($/hr)</label>
              <Input type="number" step="0.01" min="0" value={editBillRate} onChange={e => setEditBillRate(e.target.value)} data-testid={`input-edit-card-bill-${c.id}`} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} data-testid={`button-cancel-edit-card-${c.id}`}>Cancel</Button>
            <Button size="sm" onClick={() => updateMutation.mutate({ id: c.id, data: { name: autoName(editRole, c.region || ""), role: editRole || null, costRate: editCostRate || null, billRate: editBillRate || null } })} disabled={!editRole.trim() || updateMutation.isPending} data-testid={`button-save-edit-card-${c.id}`}>
              <Save className="w-3.5 h-3.5 mr-1" />
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" data-testid={`text-card-name-${c.id}`}>
              {c.role ? getRoleLabel(c.role) : c.name}
            </p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {c.costRate && <span>Cost: ${parseFloat(c.costRate).toFixed(2)}/hr</span>}
              {c.billRate && <span>Bill: ${parseFloat(c.billRate).toFixed(2)}/hr</span>}
              {c.costRate && c.billRate && (
                <span className="text-green-600 dark:text-green-400">
                  Margin: {((1 - parseFloat(c.costRate) / parseFloat(c.billRate)) * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => startEditing(c)} data-testid={`button-edit-card-${c.id}`}>
              <Edit3 className="w-3.5 h-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" data-testid={`button-delete-card-${c.id}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete rate card?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this rate card. Project assignments using this card will have the rate card unlinked.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate(c.id)} data-testid={`button-confirm-delete-card-${c.id}`}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );

  const renderAddForm = (regionValue: string) => (
    <div className="border rounded-md p-3 bg-muted/30 mt-2" data-testid={`form-add-rate-card-${regionValue}`}>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Role *</label>
          <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={newRole} onChange={e => setNewRole(e.target.value)} data-testid="select-new-card-role">
            <option value="">Select role...</option>
            {roleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Cost Rate ($/hr)</label>
          <Input type="number" step="0.01" min="0" value={newCostRate} onChange={e => setNewCostRate(e.target.value)} placeholder="0.00" data-testid="input-new-card-cost" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Bill Rate ($/hr)</label>
          <Input type="number" step="0.01" min="0" value={newBillRate} onChange={e => setNewBillRate(e.target.value)} placeholder="0.00" data-testid="input-new-card-bill" />
        </div>
      </div>
      <div className="flex gap-2 mt-3 justify-end">
        <Button variant="ghost" size="sm" onClick={resetAddForm} data-testid="button-cancel-add-card">Cancel</Button>
        <Button size="sm" onClick={() => createMutation.mutate({ name: autoName(newRole, regionValue), role: newRole || null, region: regionValue, costRate: newCostRate || null, billRate: newBillRate || null })} disabled={!newRole.trim() || createMutation.isPending} data-testid="button-save-new-card">
          {createMutation.isPending ? "Creating..." : "Create"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          Regional Rate Cards
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Each region has its own rate cards with different roles, cost rates, and bill rates.
        </p>
      </div>

      {regionOptions.map(region => {
        const regionCards = cardsByRegion[region.value] || [];
        const isCollapsed = collapsedRegions.has(region.value);
        return (
          <Card key={region.value} className="overflow-hidden" data-testid={`region-card-${region.value}`}>
            <div
              className="flex items-center justify-between px-4 py-2.5 bg-muted/50 cursor-pointer select-none"
              onClick={() => toggleRegion(region.value)}
              data-testid={`region-header-${region.value}`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs transition-transform ${isCollapsed ? "" : "rotate-90"}`}>&#9654;</span>
                <h4 className="text-sm font-semibold">{region.label}</h4>
                <span className="text-xs text-muted-foreground">({regionCards.length} {regionCards.length === 1 ? "card" : "cards"})</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); setAddingForRegion(addingForRegion === region.value ? null : region.value); }}
                data-testid={`button-add-card-${region.value}`}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            </div>
            {!isCollapsed && (
              <div className="p-3 space-y-2">
                {regionCards.length === 0 && addingForRegion !== region.value && (
                  <p className="text-xs text-muted-foreground text-center py-3">No rate cards for this region yet.</p>
                )}
                {regionCards.map(renderCard)}
                {addingForRegion === region.value && renderAddForm(region.value)}
              </div>
            )}
          </Card>
        );
      })}

      {cardsByRegion["_unassigned"] && cardsByRegion["_unassigned"].length > 0 && (
        <Card className="overflow-hidden" data-testid="region-card-unassigned">
          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/50 cursor-pointer select-none" onClick={() => toggleRegion("_unassigned")}>
            <div className="flex items-center gap-2">
              <span className={`text-xs transition-transform ${collapsedRegions.has("_unassigned") ? "" : "rotate-90"}`}>&#9654;</span>
              <h4 className="text-sm font-semibold text-muted-foreground">Unassigned</h4>
              <span className="text-xs text-muted-foreground">({cardsByRegion["_unassigned"].length})</span>
            </div>
          </div>
          {!collapsedRegions.has("_unassigned") && (
            <div className="p-3 space-y-2">
              {cardsByRegion["_unassigned"].map(renderCard)}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function hslToHex(hslStr: string): string {
  const parts = hslStr.trim().split(/\s+/);
  if (parts.length < 3) return "#888888";
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return `${h.toFixed(2)} ${(s * 100).toFixed(2)}% ${(l * 100).toFixed(2)}%`;
}

interface ColorFieldProps {
  label: string;
  description: string;
  value: string | null;
  defaultValue: string;
  onChange: (hsl: string | null) => void;
  testId: string;
}

function ColorField({ label, description, value, defaultValue, onChange, testId }: ColorFieldProps) {
  const hexValue = hslToHex(value || defaultValue);

  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded border border-border"
          style={{ backgroundColor: `hsl(${value || defaultValue})` }}
        />
        <input
          type="color"
          value={hexValue}
          onChange={(e) => onChange(hexToHsl(e.target.value))}
          className="w-10 h-8 cursor-pointer border-0 p-0 bg-transparent"
          data-testid={testId}
        />
        {value && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => onChange(null)}
            data-testid={`${testId}-reset`}
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

function BrandingManager() {
  const { toast } = useToast();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  const { data: branding, isLoading } = useQuery<BrandingConfig>({
    queryKey: ["/api/branding"],
  });

  const [appName, setAppName] = useState("");
  const [pendingColors, setPendingColors] = useState<Record<string, string | null>>({});
  const [hasNameChange, setHasNameChange] = useState(false);

  useEffect(() => {
    if (branding) {
      setAppName(branding.appName);
      setHasNameChange(false);
    }
  }, [branding]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<BrandingConfig>) => {
      await apiRequest("PATCH", "/api/branding", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branding"] });
      setPendingColors({});
      setHasNameChange(false);
      toast({ title: "Branding updated" });
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/branding/logo", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branding"] });
      toast({ title: "Logo uploaded" });
    },
  });

  const uploadFaviconMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/branding/favicon", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branding"] });
      toast({ title: "Favicon uploaded" });
    },
  });

  const handleColorChange = useCallback((key: string, value: string | null) => {
    setPendingColors((prev) => ({ ...prev, [key]: value }));
  }, []);

  const getColorValue = (key: string): string | null => {
    if (key in pendingColors) return pendingColors[key];
    if (!branding) return null;
    return (branding as any)[key] as string | null;
  };

  const hasPendingChanges = hasNameChange || Object.keys(pendingColors).length > 0;

  const saveChanges = () => {
    const updates: Partial<BrandingConfig> = {};
    if (hasNameChange) updates.appName = appName;
    for (const [key, val] of Object.entries(pendingColors)) {
      (updates as any)[key] = val;
    }
    updateMutation.mutate(updates);
  };

  const handleResetAll = () => {
    updateMutation.mutate({
      appName: "Project High Level Planning",
      primaryColor: null,
      sidebarColor: null,
      sidebarForegroundColor: null,
      sidebarAccentColor: null,
      accentColor: null,
      logoUrl: null,
      faviconUrl: null,
    } as any);
  };

  const handleRemoveLogo = () => {
    updateMutation.mutate({ logoUrl: null } as any);
  };

  const handleRemoveFavicon = () => {
    updateMutation.mutate({ faviconUrl: null } as any);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const colorFields = [
    {
      key: "primaryColor",
      label: "Primary Color",
      description: "Main accent color for buttons, links, and active states.",
      default: "342 85.11% 52.55%",
      testId: "color-primary",
    },
    {
      key: "sidebarColor",
      label: "Sidebar Background",
      description: "Background color of the sidebar navigation.",
      default: "45 25% 97%",
      testId: "color-sidebar",
    },
    {
      key: "sidebarForegroundColor",
      label: "Sidebar Text",
      description: "Text and icon color in the sidebar.",
      default: "20 14% 17%",
      testId: "color-sidebar-foreground",
    },
    {
      key: "sidebarAccentColor",
      label: "Sidebar Active Item",
      description: "Highlight color for the active navigation item.",
      default: "25 45% 80%",
      testId: "color-sidebar-accent",
    },
    {
      key: "accentColor",
      label: "Accent Color",
      description: "Secondary accent color for UI elements.",
      default: "0 0% 100%",
      testId: "color-accent",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Paintbrush className="w-4 h-4" />
          Branding & Appearance
        </h2>
        <p className="text-sm text-muted-foreground">
          Customize the application name, logo, and color scheme to match your company branding.
        </p>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-4">Application Name</h3>
        <div className="flex gap-3">
          <Input
            value={appName}
            onChange={(e) => {
              setAppName(e.target.value);
              setHasNameChange(e.target.value !== branding?.appName);
            }}
            placeholder="Application Name"
            className="flex-1"
            data-testid="input-app-name"
          />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-4">Logo</h3>
        <div className="flex items-start gap-4">
          {branding?.logoUrl ? (
            <div className="relative group">
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="h-16 w-16 rounded object-contain border border-border bg-white"
                data-testid="img-branding-logo"
              />
              <Button
                variant="destructive"
                size="sm"
                className="absolute -top-2 -right-2 h-6 w-6 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleRemoveLogo}
                data-testid="button-remove-logo"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <div className="h-16 w-16 rounded border-2 border-dashed border-border flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-2">
              Upload a logo image (PNG, JPG, SVG). Recommended size: 128x128px or larger.
            </p>
            <input
              type="file"
              ref={logoInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadLogoMutation.mutate(file);
              }}
              data-testid="input-logo-file"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadLogoMutation.isPending}
              data-testid="button-upload-logo"
            >
              <Upload className="w-3 h-3 mr-1" />
              {uploadLogoMutation.isPending ? "Uploading..." : "Upload Logo"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-4">Favicon</h3>
        <div className="flex items-start gap-4">
          {branding?.faviconUrl ? (
            <div className="relative group">
              <img
                src={branding.faviconUrl}
                alt="Favicon"
                className="h-8 w-8 rounded object-contain border border-border bg-white"
                data-testid="img-branding-favicon"
              />
              <Button
                variant="destructive"
                size="sm"
                className="absolute -top-2 -right-2 h-5 w-5 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleRemoveFavicon}
                data-testid="button-remove-favicon"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <div className="h-8 w-8 rounded border-2 border-dashed border-border flex items-center justify-center">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1">
            <p className="text-xs text-muted-foreground mb-2">
              Upload a favicon (ICO, PNG). Recommended size: 32x32px.
            </p>
            <input
              type="file"
              ref={faviconInputRef}
              accept="image/*,.ico"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFaviconMutation.mutate(file);
              }}
              data-testid="input-favicon-file"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => faviconInputRef.current?.click()}
              disabled={uploadFaviconMutation.isPending}
              data-testid="button-upload-favicon"
            >
              <Upload className="w-3 h-3 mr-1" />
              {uploadFaviconMutation.isPending ? "Uploading..." : "Upload Favicon"}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-4">Colors</h3>
        <div className="space-y-4">
          {colorFields.map((field) => (
            <ColorField
              key={field.key}
              label={field.label}
              description={field.description}
              value={getColorValue(field.key)}
              defaultValue={field.default}
              onChange={(val) => handleColorChange(field.key, val)}
              testId={field.testId}
            />
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-semibold mb-3">Preview</h3>
        <div className="flex gap-4">
          <div
            className="w-48 rounded-lg border border-border overflow-hidden"
            style={{
              backgroundColor: `hsl(${getColorValue("sidebarColor") || "45 25% 97%"})`,
              color: `hsl(${getColorValue("sidebarForegroundColor") || "20 14% 17%"})`,
            }}
          >
            <div className="px-3 py-3 border-b border-black/5">
              <div className="flex items-center gap-2">
                {branding?.logoUrl && (
                  <img src={branding.logoUrl} alt="" className="h-5 w-5 rounded object-contain" />
                )}
                <span className="text-xs font-semibold truncate">{appName || "App Name"}</span>
              </div>
            </div>
            <div className="px-2 py-2 space-y-0.5">
              <div
                className="px-2 py-1.5 rounded text-xs font-medium"
                style={{
                  backgroundColor: `hsl(${getColorValue("sidebarAccentColor") || "25 45% 80%"})`,
                }}
              >
                Dashboard
              </div>
              <div className="px-2 py-1.5 rounded text-xs opacity-70">
                Projects
              </div>
              <div className="px-2 py-1.5 rounded text-xs opacity-70">
                Settings
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-2">
              <div
                className="px-3 py-1.5 rounded text-xs font-medium text-white"
                style={{ backgroundColor: `hsl(${getColorValue("primaryColor") || "342 85.11% 52.55%"})` }}
              >
                Primary Button
              </div>
              <div
                className="px-3 py-1.5 rounded text-xs font-medium border"
                style={{
                  backgroundColor: `hsl(${getColorValue("accentColor") || "0 0% 100%"})`,
                  borderColor: `hsl(${getColorValue("accentColor") || "0 0% 100%"} / 0.3)`,
                }}
              >
                Accent Element
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              This preview shows how your branding colors will appear across the application.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <Button
          onClick={saveChanges}
          disabled={!hasPendingChanges || updateMutation.isPending}
          data-testid="button-save-branding"
        >
          <Save className="w-4 h-4 mr-1" />
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" data-testid="button-reset-branding">
              <RotateCcw className="w-4 h-4 mr-1" />
              Reset to Defaults
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Branding</AlertDialogTitle>
              <AlertDialogDescription>
                This will reset all branding settings to their defaults, including the app name, logo, favicon, and all colors.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetAll}>Reset All</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

type StageWithDeliverables = FlightpathStage & { deliverables: FlightpathDeliverable[] };

function FlightPathManager() {
  const { toast } = useToast();
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<FlightpathStage>>({});

  const { data: stages = [], isLoading } = useQuery<StageWithDeliverables[]>({
    queryKey: ["/api/flightpath-stages"],
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/flightpath-stages/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flightpath-stages"] });
      toast({ title: "Stage updated" });
      setEditingStage(null);
    },
  });

  const deleteDeliverableMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/flightpath-deliverables/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/flightpath-stages"] });
      toast({ title: "Deliverable deleted" });
    },
  });

  if (isLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Compass className="w-4 h-4" />
          FlightPath Governance Framework
        </h2>
        <p className="text-sm text-muted-foreground">
          Configure the governance stages, deliverables, and RACI matrices that define your project lifecycle.
        </p>
      </div>

      {stages.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">No stages configured. Stages will be automatically seeded on next server restart.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {stages.sort((a, b) => a.sortOrder - b.sortOrder).map(stage => {
            const isExpanded = expandedStage === stage.id;
            const isEditing = editingStage === stage.id;

            return (
              <Card key={stage.id} className="overflow-hidden" data-testid={`flightpath-stage-${stage.stageNumber}`}>
                <div
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => !isEditing && setExpandedStage(isExpanded ? null : stage.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      <div>
                        <h3 className="text-sm font-semibold" data-testid={`text-stage-name-${stage.stageNumber}`}>
                          Stage {stage.stageNumber}: {stage.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">{stage.goal}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{stage.deliverables.length} deliverables</Badge>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingStage(stage.id);
                          setEditData({
                            name: stage.name,
                            goal: stage.goal,
                            description: stage.description || "",
                            gateName: stage.gateName,
                            gateDescription: stage.gateDescription || "",
                            playbookPurpose: stage.playbookPurpose || "",
                            playbookExitBundle: stage.playbookExitBundle || "",
                          });
                          setExpandedStage(stage.id);
                        }}
                        data-testid={`button-edit-stage-${stage.stageNumber}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t px-4 pb-4">
                    {isEditing ? (
                      <div className="pt-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Name</Label>
                            <Input value={editData.name || ""} onChange={e => setEditData(d => ({...d, name: e.target.value}))} />
                          </div>
                          <div>
                            <Label className="text-xs">Goal</Label>
                            <Input value={editData.goal || ""} onChange={e => setEditData(d => ({...d, goal: e.target.value}))} />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Description</Label>
                          <Input value={editData.description || ""} onChange={e => setEditData(d => ({...d, description: e.target.value}))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">Gate Name</Label>
                            <Input value={editData.gateName || ""} onChange={e => setEditData(d => ({...d, gateName: e.target.value}))} />
                          </div>
                          <div>
                            <Label className="text-xs">Gate Description</Label>
                            <Input value={editData.gateDescription || ""} onChange={e => setEditData(d => ({...d, gateDescription: e.target.value}))} />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Playbook Purpose</Label>
                          <Input value={editData.playbookPurpose || ""} onChange={e => setEditData(d => ({...d, playbookPurpose: e.target.value}))} />
                        </div>
                        <div>
                          <Label className="text-xs">Exit Bundle</Label>
                          <Input value={editData.playbookExitBundle || ""} onChange={e => setEditData(d => ({...d, playbookExitBundle: e.target.value}))} />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setEditingStage(null)}><X className="w-3.5 h-3.5 mr-1" /> Cancel</Button>
                          <Button size="sm" onClick={() => updateStageMutation.mutate({ id: stage.id, data: editData })} disabled={updateStageMutation.isPending}>
                            <Save className="w-3.5 h-3.5 mr-1" /> Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-4 space-y-4">
                        {stage.description && (
                          <div className="text-xs"><span className="font-medium">Description:</span> {stage.description}</div>
                        )}
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div><span className="font-medium">Gate:</span> {stage.gateName}</div>
                          {stage.gateDescription && <div><span className="font-medium">Gate Criteria:</span> {stage.gateDescription}</div>}
                        </div>
                        {stage.playbookPurpose && (
                          <div className="text-xs"><span className="font-medium">Playbook Purpose:</span> {stage.playbookPurpose}</div>
                        )}
                        {stage.playbookExitBundle && (
                          <div className="text-xs"><span className="font-medium">Exit Bundle:</span> {stage.playbookExitBundle}</div>
                        )}

                        <div>
                          <h4 className="text-xs font-semibold mb-2">Deliverables ({stage.deliverables.length})</h4>
                          <div className="space-y-2">
                            {stage.deliverables.sort((a, b) => a.sortOrder - b.sortOrder).map((del, idx) => (
                              <Card key={del.id} className="p-3" data-testid={`deliverable-${del.id}`}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium">{idx + 1}. {del.name}</p>
                                    {del.description && <p className="text-xs text-muted-foreground mt-0.5">{del.description}</p>}
                                    {del.raciData && Object.keys(del.raciData).length > 0 && (
                                      <div className="mt-2 border rounded overflow-hidden">
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="bg-muted">
                                              <th className="text-left px-2 py-1 font-medium">Role</th>
                                              <th className="text-left px-2 py-1 font-medium">RACI</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {Object.entries(del.raciData).map(([role, resp]) => (
                                              <tr key={role} className="border-t">
                                                <td className="px-2 py-0.5 text-xs">{role}</td>
                                                <td className="px-2 py-0.5"><Badge variant="secondary" className="text-xs">{resp}</Badge></td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    )}
                                  </div>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => deleteDeliverableMutation.mutate(del.id)}
                                    data-testid={`button-delete-deliverable-${del.id}`}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

type RbacUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  profileImageUrl: string | null;
  orgRoles: { roleId: string; roleName: string }[];
  teamMember: { id: string; name: string } | null;
};

type RbacRole = {
  id: string;
  name: string;
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

function UsersRolesManager() {
  const { toast } = useToast();
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");

  const { data: users = [], isLoading: usersLoading } = useQuery<RbacUser[]>({
    queryKey: ["/api/rbac/users"],
  });

  const { data: roles = [] } = useQuery<RbacRole[]>({
    queryKey: ["/api/rbac/roles"],
  });

  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      await apiRequest("POST", `/api/rbac/users/${userId}/roles`, { roleId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/users"] });
      toast({ title: "Role assigned" });
      setAssigningUserId(null);
      setSelectedRoleId("");
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      await apiRequest("DELETE", `/api/rbac/users/${userId}/roles/${roleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rbac/users"] });
      toast({ title: "Role removed" });
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

  return (
    <PermissionGuard permission="users.manage" fallback={<p className="text-sm text-muted-foreground">You do not have permission to manage users.</p>}>
      <div>
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
            <UserCog className="w-4 h-4" />
            Users &amp; Role Assignments
          </h2>
          <p className="text-sm text-muted-foreground">
            View all users and manage their organization role assignments.
          </p>
        </div>

        <Card className="card-elevated overflow-visible">
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="table-users">
              <thead>
                <tr>
                  <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Name</th>
                  <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Email</th>
                  <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Org Roles</th>
                  <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Linked Team Member</th>
                  <th className="table-header-cell text-left px-4 py-3 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="table-row-hover border-t border-border" data-testid={`row-user-${user.id}`}>
                    <td className="px-4 py-3 text-sm">
                      {[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {user.email || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {user.orgRoles.map((role) => (
                          <Badge key={role.roleId} variant="secondary" className="text-xs gap-1">
                            {role.roleName}
                            <button
                              onClick={() => removeRoleMutation.mutate({ userId: user.id, roleId: role.roleId })}
                              className="ml-0.5 rounded-full"
                              data-testid={`button-remove-role-${user.id}-${role.roleId}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </Badge>
                        ))}
                        {user.orgRoles.length === 0 && (
                          <span className="text-xs text-muted-foreground">No roles</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {user.teamMember ? user.teamMember.name : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {assigningUserId === user.id ? (
                        <div className="flex items-center gap-2">
                          <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                            <SelectTrigger className="h-8 w-40 text-xs" data-testid={`select-role-${user.id}`}>
                              <SelectValue placeholder="Select role..." />
                            </SelectTrigger>
                            <SelectContent>
                              {roles
                                .filter((r) => !user.orgRoles.some((ur) => ur.roleId === r.id))
                                .map((r) => (
                                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (selectedRoleId) {
                                assignRoleMutation.mutate({ userId: user.id, roleId: selectedRoleId });
                              }
                            }}
                            disabled={!selectedRoleId || assignRoleMutation.isPending}
                          >
                            {assignRoleMutation.isPending ? "..." : "Assign"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setAssigningUserId(null); setSelectedRoleId(""); }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAssigningUserId(user.id)}
                          data-testid={`button-assign-role-${user.id}`}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Assign Role
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
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
  const { data: roles = [], isLoading: rolesLoading } = useQuery<RbacRole[]>({
    queryKey: ["/api/rbac/roles"],
  });

  const { data: permissions = [], isLoading: permsLoading } = useQuery<RbacPermission[]>({
    queryKey: ["/api/rbac/permissions"],
  });

  const isLoading = rolesLoading || permsLoading;

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

  if (isLoading) {
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

export default function Admin() {
  const { toast } = useToast();
  const appTitle = useAppTitle("Settings");

  const { data: settings, isLoading } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<Omit<AppSettings, "id">>) => {
      await apiRequest("PATCH", "/api/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Settings updated" });
    },
  });

  const handleFieldSave = (key: string, options: FieldOption[]) => {
    updateMutation.mutate({ [key]: options } as any);
  };

  const fieldTabs: TabConfig[] = [
    {
      value: "global",
      label: "Global",
      fields: [
        {
          title: "Health",
          description: "Health indicator options shared across projects and tasks (traffic light colors).",
          key: "taskHealthOptions",
          defaults: DEFAULT_TASK_HEALTH,
          current: settings?.taskHealthOptions || DEFAULT_TASK_HEALTH,
          testId: "task-health",
        },
        {
          title: "Roles",
          description: "Role options for team members and rate cards (Salesforce implementation roles).",
          key: "teamMemberRoles",
          defaults: DEFAULT_TEAM_MEMBER_ROLES,
          current: settings?.teamMemberRoles || DEFAULT_TEAM_MEMBER_ROLES,
          testId: "team-member-roles",
        },
        {
          title: "Regions",
          description: "Region options for rate cards and projects.",
          key: "regions",
          defaults: DEFAULT_REGIONS,
          current: settings?.regions || DEFAULT_REGIONS,
          testId: "regions",
        },
      ],
    },
    {
      value: "projects",
      label: "Projects",
      fields: [
        {
          title: "Project Status",
          description: "Status options for projects (e.g., Not Started, In Progress, Completed).",
          key: "projectStatuses",
          defaults: DEFAULT_PROJECT_STATUSES,
          current: settings?.projectStatuses || DEFAULT_PROJECT_STATUSES,
          testId: "project-statuses",
        },
        {
          title: "Project Type",
          description: "Type classifications for projects (e.g., Billable, Non-Billable).",
          key: "projectTypes",
          defaults: DEFAULT_PROJECT_TYPES,
          current: settings?.projectTypes || DEFAULT_PROJECT_TYPES,
          testId: "project-types",
        },
        {
          title: "Engagement Model",
          description: "Engagement model options for projects (e.g., Fixed Bid, T&M, Managed Capacity).",
          key: "engagementModels",
          defaults: DEFAULT_ENGAGEMENT_MODELS,
          current: settings?.engagementModels || DEFAULT_ENGAGEMENT_MODELS,
          testId: "engagement-models",
        },
        {
          title: "Date Formats",
          description: "Available date format options for projects. Each project selects one format at creation.",
          key: "dateFormats",
          defaults: DEFAULT_DATE_FORMATS,
          current: settings?.dateFormats || DEFAULT_DATE_FORMATS,
          testId: "date-formats",
        },
      ],
    },
    {
      value: "clients_settings",
      label: "Clients",
      fields: [
        {
          title: "Industry",
          description: "Industry options for clients (e.g., Technology, Healthcare, Finance).",
          key: "industries",
          defaults: DEFAULT_INDUSTRIES,
          current: settings?.industries || DEFAULT_INDUSTRIES,
          testId: "industries",
        },
      ],
    },
    {
      value: "contacts",
      label: "Contacts",
      fields: [
        {
          title: "Contact Role",
          description: "Role options for contacts (e.g., Executive Sponsor, Project Manager).",
          key: "contactRoles",
          defaults: DEFAULT_CONTACT_ROLES,
          current: settings?.contactRoles || DEFAULT_CONTACT_ROLES,
          testId: "contact-roles",
        },
      ],
    },
    {
      value: "tasks",
      label: "Tasks",
      fields: [
        {
          title: "Task Status",
          description: "Status options for tasks (e.g., Not Started, In Progress, Complete).",
          key: "taskStatuses",
          defaults: DEFAULT_TASK_STATUSES,
          current: settings?.taskStatuses || DEFAULT_TASK_STATUSES,
          testId: "task-statuses",
        },
        {
          title: "Task Item Type",
          description: "Type categories for tasks (e.g., Workstream, Phase).",
          key: "taskItemTypes",
          defaults: DEFAULT_TASK_ITEM_TYPES,
          current: settings?.taskItemTypes || DEFAULT_TASK_ITEM_TYPES,
          testId: "task-item-types",
        },
      ],
    },
    {
      value: "risks",
      label: "Risks",
      fields: [
        {
          title: "Risk Probability",
          description: "Probability levels for risks in the risk register.",
          key: "riskProbabilities",
          defaults: DEFAULT_RISK_PROBABILITIES,
          current: settings?.riskProbabilities || DEFAULT_RISK_PROBABILITIES,
          testId: "risk-probabilities",
        },
        {
          title: "Risk Impact",
          description: "Impact levels for risks in the risk register.",
          key: "riskImpacts",
          defaults: DEFAULT_RISK_IMPACTS,
          current: settings?.riskImpacts || DEFAULT_RISK_IMPACTS,
          testId: "risk-impacts",
        },
        {
          title: "Risk Status",
          description: "Status options for risks in the risk register.",
          key: "riskStatuses",
          defaults: DEFAULT_RISK_STATUSES,
          current: settings?.riskStatuses || DEFAULT_RISK_STATUSES,
          testId: "risk-statuses",
        },
      ],
    },
  ];

  return (
    <div className="p-6">
      <Helmet>
        <title>{appTitle}</title>
      </Helmet>

      <h1 className="text-xl font-semibold mb-6">Settings</h1>

      <div className="max-w-3xl">
        <Tabs defaultValue="general" data-testid="tabs-settings-main">
          <TabsList className="mb-6" data-testid="tabs-list-settings-main">
            <TabsTrigger value="general" data-testid="tab-settings-general">General</TabsTrigger>
            <TabsTrigger value="branding" data-testid="tab-settings-branding">Branding</TabsTrigger>
            <TabsTrigger value="team_members" data-testid="tab-settings-team-members">Team Members</TabsTrigger>
            <TabsTrigger value="rate_cards" data-testid="tab-settings-rate-cards">Rate Cards</TabsTrigger>
            <TabsTrigger value="field_options" data-testid="tab-settings-field-options">Field Options</TabsTrigger>
            <TabsTrigger value="flightpath" data-testid="tab-settings-flightpath">FlightPath</TabsTrigger>
            <TabsTrigger value="users_roles" data-testid="tab-users-roles">Users &amp; Roles</TabsTrigger>
            <TabsTrigger value="audit_log" data-testid="tab-audit-log">Audit Log</TabsTrigger>
            <TabsTrigger value="role_matrix" data-testid="tab-role-matrix">Role Matrix</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <div className="mb-6">
              <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Feature Toggles
              </h2>
              <p className="text-sm text-muted-foreground">
                Enable or disable optional features across the application.
              </p>
            </div>

            {isLoading ? (
              <Card className="p-5">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-64" />
              </Card>
            ) : (
              <div className="space-y-4">
                <Card className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-medium" data-testid="text-opportunities-label">Opportunities</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Enable the Opportunities module for pre-sales tracking. When enabled, users can create opportunities with Stage 0 governance, build estimates, and convert won opportunities to delivery projects. When disabled, projects use a simplified Stage 0 checklist.
                      </p>
                    </div>
                    <Switch
                      checked={settings?.opportunitiesEnabled ?? true}
                      onCheckedChange={(checked) =>
                        updateMutation.mutate({ opportunitiesEnabled: checked })
                      }
                      disabled={updateMutation.isPending}
                      data-testid="switch-opportunities"
                    />
                  </div>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="branding">
            <BrandingManager />
          </TabsContent>

          <TabsContent value="team_members">
            <TeamMembersManager />
          </TabsContent>

          <TabsContent value="rate_cards">
            <RateCardsManager />
          </TabsContent>

          <TabsContent value="field_options">
            <div className="mb-6">
              <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
                <List className="w-4 h-4" />
                Field Options
              </h2>
              <p className="text-sm text-muted-foreground">
                Customize the dropdown options available across the application. Fields are organized by the record type they belong to.
              </p>
            </div>

            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <Tabs defaultValue="global" data-testid="tabs-field-options">
                <TabsList className="mb-4" data-testid="tabs-list-field-options">
                  {fieldTabs.map((tab) => (
                    <TabsTrigger key={tab.value} value={tab.value} data-testid={`tab-${tab.value}`}>
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {fieldTabs.map((tab) => (
                  <TabsContent key={tab.value} value={tab.value} data-testid={`tab-content-${tab.value}`}>
                    <div className="space-y-4">
                      {tab.fields.map((config) => (
                        <FieldOptionEditor
                          key={config.key}
                          title={config.title}
                          description={config.description}
                          options={config.current}
                          defaults={config.defaults}
                          settingsKey={config.key}
                          onSave={handleFieldSave}
                          isPending={updateMutation.isPending}
                          testIdPrefix={config.testId}
                        />
                      ))}
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </TabsContent>

          <TabsContent value="flightpath">
            <FlightPathManager />
          </TabsContent>

          <TabsContent value="users_roles">
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
