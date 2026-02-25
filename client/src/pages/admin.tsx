import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Shield, List, Plus, X, GripVertical, RotateCcw, Users, CreditCard, Edit3, Trash2, Save } from "lucide-react";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AppSettings, FieldOption, TeamMember, RateCard } from "@shared/schema";
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
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
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
                            This will permanently delete "{m.name}" and remove them from all project assignments.
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
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newRegion, setNewRegion] = useState("");
  const [newCostRate, setNewCostRate] = useState("");
  const [newBillRate, setNewBillRate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editCostRate, setEditCostRate] = useState("");
  const [editBillRate, setEditBillRate] = useState("");

  const { data: cards = [], isLoading } = useQuery<RateCard[]>({
    queryKey: ["/api/rate-cards"],
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });
  const roleOptions = settings?.teamMemberRoles || DEFAULT_TEAM_MEMBER_ROLES;
  const regionOptions = settings?.regions || DEFAULT_REGIONS;

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/rate-cards", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rate-cards"] });
      toast({ title: "Rate card created" });
      setNewName(""); setNewRole(""); setNewRegion(""); setNewCostRate(""); setNewBillRate("");
      setShowAdd(false);
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

  const startEditing = (c: RateCard) => {
    setEditingId(c.id);
    setEditName(c.name);
    setEditRole(c.role || "");
    setEditRegion(c.region || "");
    setEditCostRate(c.costRate ?? "");
    setEditBillRate(c.billRate ?? "");
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Rate Cards
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define cost and bill rates that can be assigned to team members on projects.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)} data-testid="button-add-rate-card">
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Rate Card
        </Button>
      </div>

      {showAdd && (
        <Card className="p-4" data-testid="form-add-rate-card">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. US Senior Developer" data-testid="input-new-card-name" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Role</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={newRole} onChange={e => setNewRole(e.target.value)} data-testid="select-new-card-role">
                <option value="">Select role...</option>
                {roleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Region</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={newRegion} onChange={e => setNewRegion(e.target.value)} data-testid="select-new-card-region">
                <option value="">Select region...</option>
                {regionOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
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
            <Button variant="ghost" size="sm" onClick={() => { setShowAdd(false); setNewName(""); setNewRole(""); setNewRegion(""); setNewCostRate(""); setNewBillRate(""); }} data-testid="button-cancel-add-card">
              Cancel
            </Button>
            <Button size="sm" onClick={() => createMutation.mutate({ name: newName, role: newRole || null, region: newRegion || null, costRate: newCostRate || null, billRate: newBillRate || null })} disabled={!newName.trim() || createMutation.isPending} data-testid="button-save-new-card">
              {createMutation.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </Card>
      )}

      {cards.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">No rate cards yet. Add your first rate card above.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {cards.map(c => (
            <Card key={c.id} className="p-3" data-testid={`rate-card-${c.id}`}>
              {editingId === c.id ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
                      <Input value={editName} onChange={e => setEditName(e.target.value)} data-testid={`input-edit-card-name-${c.id}`} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Role</label>
                      <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={editRole} onChange={e => setEditRole(e.target.value)} data-testid={`select-edit-card-role-${c.id}`}>
                        <option value="">Select role...</option>
                        {roleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">Region</label>
                      <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={editRegion} onChange={e => setEditRegion(e.target.value)} data-testid={`select-edit-card-region-${c.id}`}>
                        <option value="">Select region...</option>
                        {regionOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
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
                    <Button size="sm" onClick={() => updateMutation.mutate({ id: c.id, data: { name: editName, role: editRole || null, region: editRegion || null, costRate: editCostRate || null, billRate: editBillRate || null } })} disabled={!editName.trim() || updateMutation.isPending} data-testid={`button-save-edit-card-${c.id}`}>
                      <Save className="w-3.5 h-3.5 mr-1" />
                      {updateMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" data-testid={`text-card-name-${c.id}`}>{c.name}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {c.role && <span>{roleOptions.find(r => r.value === c.role)?.label || c.role}</span>}
                      {c.region && <span className="bg-muted px-1.5 py-0.5 rounded">{regionOptions.find(r => r.value === c.region)?.label || c.region}</span>}
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
                            This will permanently delete the "{c.name}" rate card. Project assignments using this card will have the rate card unlinked.
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
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const { toast } = useToast();

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
        <title>Settings | Project High Level Planning</title>
      </Helmet>

      <h1 className="text-xl font-semibold mb-6">Settings</h1>

      <div className="max-w-3xl">
        <Tabs defaultValue="general" data-testid="tabs-settings-main">
          <TabsList className="mb-6" data-testid="tabs-list-settings-main">
            <TabsTrigger value="general" data-testid="tab-settings-general">General</TabsTrigger>
            <TabsTrigger value="team_members" data-testid="tab-settings-team-members">Team Members</TabsTrigger>
            <TabsTrigger value="rate_cards" data-testid="tab-settings-rate-cards">Rate Cards</TabsTrigger>
            <TabsTrigger value="field_options" data-testid="tab-settings-field-options">Field Options</TabsTrigger>
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
                      <h3 className="text-sm font-medium" data-testid="text-risk-register-label">Risk Register</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Enable the risk register feature on all projects. When enabled, each project will have a Risk Register tab for tracking project risks, their probability, impact, and mitigation strategies.
                      </p>
                    </div>
                    <Switch
                      checked={settings?.riskRegisterEnabled ?? false}
                      onCheckedChange={(checked) =>
                        updateMutation.mutate({ riskRegisterEnabled: checked })
                      }
                      disabled={updateMutation.isPending}
                      data-testid="switch-risk-register"
                    />
                  </div>
                </Card>
              </div>
            )}
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
        </Tabs>
      </div>
    </div>
  );
}
