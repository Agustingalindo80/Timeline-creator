import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Save, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { TeamMember, RateCard, ProjectTeamMemberWithDetails } from "@shared/schema";

interface TeamCompositionProps {
  timelineId: string;
}

export function TeamComposition({ timelineId }: TeamCompositionProps) {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTeamMemberId, setNewTeamMemberId] = useState("");
  const [newRateCardId, setNewRateCardId] = useState("");
  const [newMonthlyCost, setNewMonthlyCost] = useState("");
  const [newHourlyCost, setNewHourlyCost] = useState("");
  const [newAllocation, setNewAllocation] = useState("100");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRateCardId, setEditRateCardId] = useState("");
  const [editMonthlyCost, setEditMonthlyCost] = useState("");
  const [editHourlyCost, setEditHourlyCost] = useState("");
  const [editAllocation, setEditAllocation] = useState("100");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  const { data: assignments = [], isLoading: loadingAssignments } = useQuery<ProjectTeamMemberWithDetails[]>({
    queryKey: ["/api/timelines", timelineId, "team"],
  });

  const { data: allTeamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });

  const { data: allRateCards = [] } = useQuery<RateCard[]>({
    queryKey: ["/api/rate-cards"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", `/api/timelines/${timelineId}/team`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "team"] });
      toast({ title: "Team member added to project" });
      resetAddForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/project-team/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "team"] });
      toast({ title: "Assignment updated" });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/project-team/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "team"] });
      toast({ title: "Team member removed from project" });
    },
  });

  const resetAddForm = () => {
    setNewTeamMemberId("");
    setNewRateCardId("");
    setNewMonthlyCost("");
    setNewHourlyCost("");
    setNewAllocation("100");
    setNewStartDate("");
    setNewEndDate("");
    setShowAddForm(false);
  };

  const handleAdd = () => {
    if (!newTeamMemberId) return;
    addMutation.mutate({
      teamMemberId: newTeamMemberId,
      rateCardId: newRateCardId || null,
      monthlyCost: newMonthlyCost || null,
      hourlyCost: newHourlyCost || null,
      allocation: parseInt(newAllocation) || 100,
      startDate: newStartDate || null,
      endDate: newEndDate || null,
    });
  };

  const startEditing = (a: ProjectTeamMemberWithDetails) => {
    setEditingId(a.id);
    setEditRateCardId(a.rateCardId || "");
    setEditMonthlyCost(a.monthlyCost ?? "");
    setEditHourlyCost(a.hourlyCost ?? "");
    setEditAllocation(String(a.allocation));
    setEditStartDate(a.startDate || "");
    setEditEndDate(a.endDate || "");
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      data: {
        rateCardId: editRateCardId || null,
        monthlyCost: editMonthlyCost || null,
        hourlyCost: editHourlyCost || null,
        allocation: parseInt(editAllocation) || 100,
        startDate: editStartDate || null,
        endDate: editEndDate || null,
      },
    });
  };

  const totalMonthlyCost = assignments.reduce((sum, a) => {
    const cost = parseFloat(a.monthlyCost ?? "0") || 0;
    const alloc = (a.allocation || 100) / 100;
    return sum + cost * alloc;
  }, 0);

  const totalHourlyCost = assignments.reduce((sum, a) => {
    const cost = parseFloat(a.hourlyCost ?? "0") || 0;
    const alloc = (a.allocation || 100) / 100;
    return sum + cost * alloc;
  }, 0);

  const assignedMemberIds = new Set(assignments.map(a => a.teamMemberId));
  const availableMembers = allTeamMembers.filter(m => !assignedMemberIds.has(m.id));

  if (loadingAssignments) {
    return <p className="text-sm text-muted-foreground py-4 text-center">Loading team...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2" data-testid="summary-monthly-cost">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total Monthly Cost</p>
              <p className="text-sm font-semibold">${totalMonthlyCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2" data-testid="summary-hourly-cost">
            <DollarSign className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total Hourly Cost</p>
              <p className="text-sm font-semibold">${totalHourlyCost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={availableMembers.length === 0 && !showAddForm}
          data-testid="button-add-team-member"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Member
        </Button>
      </div>

      {allTeamMembers.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground mb-2">No team members have been created yet.</p>
          <p className="text-xs text-muted-foreground">Go to Settings to add Team Members and Rate Cards first.</p>
        </Card>
      )}

      {showAddForm && availableMembers.length > 0 && (
        <Card className="p-4" data-testid="form-add-team-assignment">
          <h4 className="text-xs font-medium text-muted-foreground mb-3">Add Team Member to Project</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Team Member *</label>
              <Select value={newTeamMemberId} onValueChange={setNewTeamMemberId}>
                <SelectTrigger data-testid="select-new-team-member">
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Rate Card</label>
              <Select value={newRateCardId} onValueChange={(v) => {
                const val = v === "none" ? "" : v;
                setNewRateCardId(val);
                const card = allRateCards.find(c => c.id === val);
                if (card) {
                  if (card.costRate && !newMonthlyCost) setNewMonthlyCost(card.costRate);
                  if (card.billRate && !newHourlyCost) setNewHourlyCost(card.billRate);
                }
              }}>
                <SelectTrigger data-testid="select-new-rate-card">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {allRateCards.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Monthly Cost ($)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={newMonthlyCost}
                onChange={e => setNewMonthlyCost(e.target.value)}
                placeholder="0.00"
                data-testid="input-new-monthly-cost"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Hourly Cost ($)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={newHourlyCost}
                onChange={e => setNewHourlyCost(e.target.value)}
                placeholder="0.00"
                data-testid="input-new-hourly-cost"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Allocation (%)</label>
              <Input
                type="number"
                min="0"
                max="100"
                value={newAllocation}
                onChange={e => setNewAllocation(e.target.value)}
                data-testid="input-new-allocation"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Start Date</label>
              <Input
                value={newStartDate}
                onChange={e => setNewStartDate(e.target.value)}
                placeholder="e.g. Jan 2025"
                data-testid="input-new-team-start"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">End Date</label>
              <Input
                value={newEndDate}
                onChange={e => setNewEndDate(e.target.value)}
                placeholder="e.g. Dec 2025"
                data-testid="input-new-team-end"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                onClick={handleAdd}
                disabled={!newTeamMemberId || addMutation.isPending}
                data-testid="button-submit-team-member"
              >
                {addMutation.isPending ? "Adding..." : "Add"}
              </Button>
              <Button variant="ghost" onClick={resetAddForm} data-testid="button-cancel-add-team">
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {assignments.length === 0 && allTeamMembers.length > 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No team members assigned yet. Click "Add Member" to assign someone.
        </p>
      )}

      <div className="space-y-2">
        {assignments.map(a => (
          <Card key={a.id} className="p-3" data-testid={`team-assignment-${a.id}`}>
            {editingId === a.id ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                    {a.teamMember.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{a.teamMember.name}</p>
                    {a.teamMember.role && <p className="text-xs text-muted-foreground">{a.teamMember.role}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Rate Card</label>
                    <Select value={editRateCardId} onValueChange={(v) => setEditRateCardId(v === "none" ? "" : v)}>
                      <SelectTrigger data-testid={`select-edit-rate-card-${a.id}`}>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {allRateCards.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Monthly Cost ($)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editMonthlyCost}
                      onChange={e => setEditMonthlyCost(e.target.value)}
                      data-testid={`input-edit-monthly-cost-${a.id}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Hourly Cost ($)</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editHourlyCost}
                      onChange={e => setEditHourlyCost(e.target.value)}
                      data-testid={`input-edit-hourly-cost-${a.id}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Allocation (%)</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={editAllocation}
                      onChange={e => setEditAllocation(e.target.value)}
                      data-testid={`input-edit-allocation-${a.id}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Start Date</label>
                    <Input
                      value={editStartDate}
                      onChange={e => setEditStartDate(e.target.value)}
                      placeholder="e.g. Jan 2025"
                      data-testid={`input-edit-team-start-${a.id}`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">End Date</label>
                    <Input
                      value={editEndDate}
                      onChange={e => setEditEndDate(e.target.value)}
                      placeholder="e.g. Dec 2025"
                      data-testid={`input-edit-team-end-${a.id}`}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} data-testid={`button-cancel-edit-team-${a.id}`}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending} data-testid={`button-save-edit-team-${a.id}`}>
                    <Save className="w-3.5 h-3.5 mr-1" />
                    {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                    {a.teamMember.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate" data-testid={`text-team-name-${a.id}`}>{a.teamMember.name}</p>
                      {a.rateCard && (
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{a.rateCard.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {a.teamMember.role && <span>{a.teamMember.role}</span>}
                      {a.allocation !== 100 && <span>{a.allocation}% allocated</span>}
                      {a.startDate && <span>{a.startDate}{a.endDate ? ` — ${a.endDate}` : ""}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm shrink-0">
                    {a.monthlyCost && (
                      <div className="text-right" data-testid={`text-monthly-cost-${a.id}`}>
                        <p className="text-xs text-muted-foreground">Monthly</p>
                        <p className="font-medium">${parseFloat(a.monthlyCost).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                      </div>
                    )}
                    {a.hourlyCost && (
                      <div className="text-right" data-testid={`text-hourly-cost-${a.id}`}>
                        <p className="text-xs text-muted-foreground">Hourly</p>
                        <p className="font-medium">${parseFloat(a.hourlyCost).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => startEditing(a)}
                    data-testid={`button-edit-team-${a.id}`}
                  >
                    <Save className="w-3.5 h-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" data-testid={`button-delete-team-${a.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove team member?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will remove {a.teamMember.name} from this project's team composition.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteMutation.mutate(a.id)} data-testid={`button-confirm-delete-team-${a.id}`}>
                          Remove
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
    </div>
  );
}
