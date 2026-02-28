import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
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
import { Plus, Trash2, ChevronDown, ChevronRight, Edit3, Calculator, TrendingUp, Clock, DollarSign } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TimelineWithMilestones, Task, RateCard } from "@shared/schema";

interface EstimateTabProps {
  timeline: TimelineWithMilestones;
}

const TASK_TYPES = [
  { value: "pm", label: "PM" },
  { value: "functional", label: "Functional" },
  { value: "technical", label: "Technical" },
  { value: "qa", label: "QA" },
];

const CONFIDENCE_LEVELS = [
  { value: "high", label: "High", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "medium", label: "Medium", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { value: "low", label: "Low", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

export function EstimateTab({ timeline }: EstimateTabProps) {
  const { toast } = useToast();
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [addPhaseOpen, setAddPhaseOpen] = useState(false);
  const [addWorkstreamOpen, setAddWorkstreamOpen] = useState(false);
  const [editTaskOpen, setEditTaskOpen] = useState(false);
  const [selectedParentPhase, setSelectedParentPhase] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskHours, setNewTaskHours] = useState("");
  const [newTaskType, setNewTaskType] = useState("technical");
  const [newTaskConfidence, setNewTaskConfidence] = useState("medium");
  const [newTaskRoleId, setNewTaskRoleId] = useState<string>("");
  const [localRiskPercent, setLocalRiskPercent] = useState(0);
  const [localBufferPercent, setLocalBufferPercent] = useState(0);

  const { data: allRateCards = [] } = useQuery<RateCard[]>({
    queryKey: ["/api/rate-cards"],
  });

  const rateCards = timeline.region
    ? allRateCards.filter(rc => rc.region === timeline.region)
    : allRateCards;

  const tasks = timeline.tasks || [];
  const phases = tasks.filter(t => t.itemType === "phase").sort((a, b) => a.sortOrder - b.sortOrder);
  const workstreams = tasks.filter(t => t.itemType === "workstream").sort((a, b) => a.sortOrder - b.sortOrder);

  const togglePhase = (id: string) => {
    setExpandedPhases(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/timelines/${timeline.id}/tasks`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities", timeline.id] });
      toast({ title: "Task created" });
    },
    onError: (err: Error) => {
      toast({ title: "Error creating task", description: err.message, variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/tasks/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities", timeline.id] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities", timeline.id] });
      toast({ title: "Task deleted" });
    },
  });

  const updateOppMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/opportunities/${timeline.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities", timeline.id] });
    },
  });

  const handleAddPhase = () => {
    if (!newTaskTitle.trim()) return;
    createTaskMutation.mutate({
      title: newTaskTitle.trim(),
      itemType: "phase",
      sortOrder: phases.length,
      estimatedHours: newTaskHours ? parseFloat(newTaskHours) : null,
    });
    setNewTaskTitle("");
    setNewTaskHours("");
    setAddPhaseOpen(false);
  };

  const handleAddWorkstream = () => {
    if (!newTaskTitle.trim() || !selectedParentPhase) return;
    const childCount = workstreams.filter(w => w.parentTaskId === selectedParentPhase).length;
    createTaskMutation.mutate({
      title: newTaskTitle.trim(),
      itemType: "workstream",
      parentTaskId: selectedParentPhase,
      sortOrder: childCount,
      estimatedHours: newTaskHours ? parseFloat(newTaskHours) : null,
      taskType: newTaskType,
      confidenceLevel: newTaskConfidence,
      assignedRoleId: newTaskRoleId === "none" ? null : newTaskRoleId || null,
    });
    setNewTaskTitle("");
    setNewTaskHours("");
    setNewTaskType("technical");
    setNewTaskConfidence("medium");
    setNewTaskRoleId("");
    setAddWorkstreamOpen(false);
  };

  const handleEditTask = () => {
    if (!editingTask || !newTaskTitle.trim()) return;
    updateTaskMutation.mutate({
      id: editingTask.id,
      data: {
        title: newTaskTitle.trim(),
        estimatedHours: newTaskHours ? newTaskHours : null,
        taskType: newTaskType || null,
        confidenceLevel: newTaskConfidence || null,
        assignedRoleId: newTaskRoleId === "none" ? null : newTaskRoleId || null,
      },
    });
    setEditingTask(null);
    setEditTaskOpen(false);
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setNewTaskTitle(task.title);
    setNewTaskHours(task.estimatedHours?.toString() || "");
    setNewTaskType(task.taskType || "technical");
    setNewTaskConfidence(task.confidenceLevel || "medium");
    setNewTaskRoleId(task.assignedRoleId || "");
    setEditTaskOpen(true);
  };

  const getRateCard = (roleId: string | null | undefined): RateCard | undefined => {
    if (!roleId) return undefined;
    return allRateCards.find(r => r.id === roleId);
  };

  const getTaskCost = (task: Task): number => {
    const hours = parseFloat(task.estimatedHours || "0") || 0;
    const rc = getRateCard(task.assignedRoleId);
    const rate = parseFloat(rc?.costRate || "0") || 0;
    return hours * rate;
  };

  const getTaskRevenue = (task: Task): number => {
    const hours = parseFloat(task.estimatedHours || "0") || 0;
    const rc = getRateCard(task.assignedRoleId);
    const rate = parseFloat(rc?.billRate || "0") || 0;
    return hours * rate;
  };

  const totalHours = workstreams.reduce((sum, ws) => sum + (parseFloat(ws.estimatedHours || "0") || 0), 0);
  const baseCost = workstreams.reduce((sum, ws) => sum + getTaskCost(ws), 0);
  const baseRevenue = workstreams.reduce((sum, ws) => sum + getTaskRevenue(ws), 0);
  const serverRiskPercent = parseFloat(timeline.riskFactorPercent || "0") || 0;
  const serverBufferPercent = parseFloat(timeline.bufferPercent || "0") || 0;

  useEffect(() => {
    setLocalRiskPercent(serverRiskPercent);
  }, [serverRiskPercent]);

  useEffect(() => {
    setLocalBufferPercent(serverBufferPercent);
  }, [serverBufferPercent]);

  const riskAdjustedCost = baseCost * (1 + localRiskPercent / 100);
  const bufferedCost = riskAdjustedCost * (1 + localBufferPercent / 100);
  const grossMargin = baseRevenue > 0 ? ((baseRevenue - bufferedCost) / baseRevenue) * 100 : 0;

  const hoursByRole = workstreams.reduce((acc, ws) => {
    const rc = getRateCard(ws.assignedRoleId);
    const role = rc?.name || rc?.role || "Unassigned";
    const hours = parseFloat(ws.estimatedHours || "0") || 0;
    acc[role] = (acc[role] || 0) + hours;
    return acc;
  }, {} as Record<string, number>);

  const confidenceCounts = workstreams.reduce((acc, ws) => {
    const level = ws.confidenceLevel || "unset";
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const syncFinancials = () => {
    updateOppMutation.mutate({
      approvedBudget: bufferedCost.toFixed(2),
      estimatedRevenue: baseRevenue.toFixed(2),
    });
    toast({ title: "Financials synced to opportunity" });
  };

  const getPhaseHours = (phaseId: string): number => {
    return workstreams
      .filter(ws => ws.parentTaskId === phaseId)
      .reduce((sum, ws) => sum + (parseFloat(ws.estimatedHours || "0") || 0), 0);
  };

  const getPhaseCost = (phaseId: string): number => {
    return workstreams
      .filter(ws => ws.parentTaskId === phaseId)
      .reduce((sum, ws) => sum + getTaskCost(ws), 0);
  };

  return (
    <div className="space-y-6" data-testid="estimate-tab">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-hours">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="w-4 h-4" />
              Total Hours
            </div>
            <div className="text-2xl font-bold">{totalHours.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-base-cost">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="w-4 h-4" />
              Base Cost
            </div>
            <div className="text-2xl font-bold">${baseCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-revenue">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              Revenue
            </div>
            <div className="text-2xl font-bold">${baseRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-margin">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calculator className="w-4 h-4" />
              Gross Margin
            </div>
            <div className={`text-2xl font-bold ${grossMargin >= 30 ? "text-green-600" : grossMargin >= 15 ? "text-amber-600" : "text-red-600"}`}>
              {grossMargin.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Backlog</h3>
            <Button size="sm" onClick={() => { setNewTaskTitle(""); setAddPhaseOpen(true); }} data-testid="button-add-phase">
              <Plus className="w-4 h-4 mr-1" /> Add Phase
            </Button>
          </div>

          {phases.length === 0 && (
            <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg" data-testid="text-empty-backlog">
              No phases yet. Add a phase to start building your estimate.
            </div>
          )}

          {phases.map(phase => {
            const children = workstreams.filter(ws => ws.parentTaskId === phase.id);
            const expanded = expandedPhases.has(phase.id);
            const phaseHours = getPhaseHours(phase.id);
            const phaseCost = getPhaseCost(phase.id);

            return (
              <Card key={phase.id} data-testid={`card-phase-${phase.id}`}>
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => togglePhase(phase.id)}
                  data-testid={`phase-header-${phase.id}`}
                >
                  {expanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{phase.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {children.length} workstream{children.length !== 1 ? "s" : ""} · {phaseHours.toLocaleString()} hrs · ${phaseCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); openEditDialog(phase); }} data-testid={`button-edit-phase-${phase.id}`}>
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={e => { e.stopPropagation(); setSelectedParentPhase(phase.id); setNewTaskTitle(""); setNewTaskHours(""); setAddWorkstreamOpen(true); }}
                      data-testid={`button-add-workstream-${phase.id}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={e => e.stopPropagation()} data-testid={`button-delete-phase-${phase.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Phase</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will delete "{phase.title}" and all its workstreams. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => {
                            children.forEach(c => deleteTaskMutation.mutate(c.id));
                            deleteTaskMutation.mutate(phase.id);
                          }}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {expanded && (
                  <div className="border-t">
                    {children.length === 0 && (
                      <div className="p-4 text-sm text-muted-foreground text-center">
                        No workstreams. Click + to add one.
                      </div>
                    )}
                    {children.map(ws => {
                      const rc = getRateCard(ws.assignedRoleId);
                      const wsHours = parseFloat(ws.estimatedHours || "0") || 0;
                      const wsCost = getTaskCost(ws);
                      const confLevel = CONFIDENCE_LEVELS.find(c => c.value === ws.confidenceLevel);
                      const taskTypeLabel = TASK_TYPES.find(t => t.value === ws.taskType)?.label;

                      return (
                        <div key={ws.id} className="flex items-center gap-3 px-4 py-3 border-t hover:bg-muted/30 transition-colors" data-testid={`workstream-row-${ws.id}`}>
                          <div className="w-4" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{ws.title}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {taskTypeLabel && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{taskTypeLabel}</Badge>}
                              {rc && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{rc.name || rc.role}</Badge>}
                              {confLevel && <Badge className={`text-[10px] px-1.5 py-0 ${confLevel.color} border-0`}>{confLevel.label}</Badge>}
                            </div>
                          </div>
                          <div className="text-right text-sm shrink-0">
                            <div className="font-medium">{wsHours}h</div>
                            <div className="text-xs text-muted-foreground">${wsCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(ws)} data-testid={`button-edit-workstream-${ws.id}`}>
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" data-testid={`button-delete-workstream-${ws.id}`}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Workstream</AlertDialogTitle>
                                  <AlertDialogDescription>Delete "{ws.title}"? This cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteTaskMutation.mutate(ws.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>

        <div className="space-y-4">
          <Card data-testid="card-financial-summary">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                Financial Summary
                <Button size="sm" variant="outline" onClick={syncFinancials} data-testid="button-sync-financials">
                  Sync
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base Cost</span>
                <span className="font-medium">${baseCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Risk Factor</span>
                  <span className="font-medium">{localRiskPercent}%</span>
                </div>
                <Slider
                  value={[localRiskPercent]}
                  max={50}
                  step={1}
                  onValueChange={(v) => setLocalRiskPercent(v[0])}
                  onValueCommit={(v) => updateOppMutation.mutate({ riskFactorPercent: v[0].toString() })}
                  data-testid="slider-risk-factor"
                />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Risk-Adjusted Cost</span>
                <span className="font-medium">${riskAdjustedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Buffer</span>
                  <span className="font-medium">{localBufferPercent}%</span>
                </div>
                <Slider
                  value={[localBufferPercent]}
                  max={30}
                  step={1}
                  onValueChange={(v) => setLocalBufferPercent(v[0])}
                  onValueCommit={(v) => updateOppMutation.mutate({ bufferPercent: v[0].toString() })}
                  data-testid="slider-buffer"
                />
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Buffered Cost</span>
                <span>${bufferedCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Revenue</span>
                <span>${baseRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className={`flex justify-between font-semibold ${grossMargin >= 30 ? "text-green-600" : grossMargin >= 15 ? "text-amber-600" : "text-red-600"}`}>
                <span>Gross Margin</span>
                <span>{grossMargin.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-hours-by-role">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Hours by Role</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {Object.entries(hoursByRole).length === 0 && (
                <div className="text-muted-foreground text-center py-2">No workstreams with roles assigned</div>
              )}
              {Object.entries(hoursByRole).sort((a, b) => b[1] - a[1]).map(([role, hours]) => (
                <div key={role} className="flex justify-between">
                  <span className="text-muted-foreground truncate mr-2">{role}</span>
                  <span className="font-medium shrink-0">{hours.toLocaleString()}h</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card data-testid="card-confidence">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Confidence Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {CONFIDENCE_LEVELS.map(level => (
                <div key={level.value} className="flex justify-between items-center">
                  <Badge className={`${level.color} border-0`}>{level.label}</Badge>
                  <span className="font-medium">{confidenceCounts[level.value] || 0}</span>
                </div>
              ))}
              {confidenceCounts["unset"] > 0 && (
                <div className="flex justify-between items-center">
                  <Badge variant="outline">Unset</Badge>
                  <span className="font-medium">{confidenceCounts["unset"]}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={addPhaseOpen} onOpenChange={setAddPhaseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Phase</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Phase name (e.g., Discovery, Build, UAT)"
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              data-testid="input-phase-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPhaseOpen(false)}>Cancel</Button>
            <Button onClick={handleAddPhase} disabled={!newTaskTitle.trim()} data-testid="button-save-phase">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addWorkstreamOpen} onOpenChange={setAddWorkstreamOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Workstream (Epic)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Workstream name"
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              data-testid="input-workstream-name"
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Estimated Hours</label>
                <Input
                  type="number"
                  placeholder="Hours"
                  value={newTaskHours}
                  onChange={e => setNewTaskHours(e.target.value)}
                  data-testid="input-workstream-hours"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Task Type</label>
                <Select value={newTaskType} onValueChange={setNewTaskType}>
                  <SelectTrigger data-testid="select-task-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Confidence</label>
                <Select value={newTaskConfidence} onValueChange={setNewTaskConfidence}>
                  <SelectTrigger data-testid="select-confidence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONFIDENCE_LEVELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Role (Rate Card)</label>
                {rateCards.length === 0 ? (
                  <div className="text-xs text-muted-foreground border rounded-md p-2.5 bg-muted/30">
                    No rate cards found{timeline.region ? ` for region "${timeline.region}"` : ""}. Add rate cards in <a href="/settings" className="underline text-primary">Settings → Rate Cards</a>.
                  </div>
                ) : (
                  <Select value={newTaskRoleId} onValueChange={setNewTaskRoleId}>
                    <SelectTrigger data-testid="select-role">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No role</SelectItem>
                      {rateCards.map(rc => (
                        <SelectItem key={rc.id} value={rc.id}>
                          {rc.name || rc.role || rc.id}
                          {rc.costRate ? ` · $${rc.costRate}/hr` : ""}
                          {rc.billRate ? ` → $${rc.billRate}/hr` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddWorkstreamOpen(false)}>Cancel</Button>
            <Button onClick={handleAddWorkstream} disabled={!newTaskTitle.trim()} data-testid="button-save-workstream">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editTaskOpen} onOpenChange={setEditTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editingTask?.itemType === "phase" ? "Phase" : "Workstream"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Name"
              value={newTaskTitle}
              onChange={e => setNewTaskTitle(e.target.value)}
              data-testid="input-edit-task-name"
            />
            {editingTask?.itemType === "workstream" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Estimated Hours</label>
                    <Input
                      type="number"
                      placeholder="Hours"
                      value={newTaskHours}
                      onChange={e => setNewTaskHours(e.target.value)}
                      data-testid="input-edit-hours"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Task Type</label>
                    <Select value={newTaskType} onValueChange={setNewTaskType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TASK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Confidence</label>
                    <Select value={newTaskConfidence} onValueChange={setNewTaskConfidence}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CONFIDENCE_LEVELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Role (Rate Card)</label>
                    {rateCards.length === 0 ? (
                      <div className="text-xs text-muted-foreground border rounded-md p-2.5 bg-muted/30">
                        No rate cards found{timeline.region ? ` for region "${timeline.region}"` : ""}. Add rate cards in <a href="/settings" className="underline text-primary">Settings → Rate Cards</a>.
                      </div>
                    ) : (
                      <Select value={newTaskRoleId} onValueChange={setNewTaskRoleId}>
                        <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No role</SelectItem>
                          {rateCards.map(rc => (
                            <SelectItem key={rc.id} value={rc.id}>
                              {rc.name || rc.role || rc.id}
                              {rc.costRate ? ` · $${rc.costRate}/hr` : ""}
                              {rc.billRate ? ` → $${rc.billRate}/hr` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTaskOpen(false)}>Cancel</Button>
            <Button onClick={handleEditTask} disabled={!newTaskTitle.trim()} data-testid="button-save-edit-task">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
