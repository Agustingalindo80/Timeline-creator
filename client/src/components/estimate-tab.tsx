import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Plus, Trash2, ChevronDown, ChevronRight, Edit3, Calculator, TrendingUp, Clock, DollarSign, Users, Download, Upload, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { TimelineWithMilestones, Task, RateCard, WorkstreamResource, TeamMember } from "@shared/schema";

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
  const [expandedWorkstreams, setExpandedWorkstreams] = useState<Set<string>>(new Set());
  const [addPhaseOpen, setAddPhaseOpen] = useState(false);
  const [addWorkstreamOpen, setAddWorkstreamOpen] = useState(false);
  const [editTaskOpen, setEditTaskOpen] = useState(false);
  const [addResourceOpen, setAddResourceOpen] = useState(false);
  const [editResourceOpen, setEditResourceOpen] = useState(false);
  const [selectedParentPhase, setSelectedParentPhase] = useState<string | null>(null);
  const [selectedWorkstreamId, setSelectedWorkstreamId] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingResource, setEditingResource] = useState<WorkstreamResource | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDuration, setNewTaskDuration] = useState("");
  const [newTaskConfidence, setNewTaskConfidence] = useState("medium");
  const [newResRoleId, setNewResRoleId] = useState("");
  const [newResHoursPerWeek, setNewResHoursPerWeek] = useState("");
  const [newResTaskType, setNewResTaskType] = useState("technical");
  const [newResTeamMemberId, setNewResTeamMemberId] = useState("");
  const [newResNotes, setNewResNotes] = useState("");
  const [localRiskPercent, setLocalRiskPercent] = useState(0);
  const [localBufferPercent, setLocalBufferPercent] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: allRateCards = [] } = useQuery<RateCard[]>({
    queryKey: ["/api/rate-cards"],
  });

  const { data: allResources = [] } = useQuery<WorkstreamResource[]>({
    queryKey: ["/api/timelines", timeline.id, "workstream-resources"],
    queryFn: async () => {
      const res = await fetch(`/api/timelines/${timeline.id}/workstream-resources`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });

  const rateCards = allRateCards;

  const rateCardsByRegion = rateCards.reduce<Record<string, RateCard[]>>((groups, rc) => {
    const region = rc.region || "Global";
    if (!groups[region]) groups[region] = [];
    groups[region].push(rc);
    return groups;
  }, {});
  const sortedRegions = Object.keys(rateCardsByRegion).sort((a, b) => {
    if (a === "Global") return -1;
    if (b === "Global") return 1;
    return a.localeCompare(b);
  });

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

  const toggleWorkstream = (id: string) => {
    setExpandedWorkstreams(prev => {
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
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timeline.id, "workstream-resources"] });
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

  const createResourceMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: any }) => {
      const res = await apiRequest("POST", `/api/tasks/${taskId}/resources`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timeline.id, "workstream-resources"] });
      toast({ title: "Resource added" });
    },
    onError: (err: Error) => {
      toast({ title: "Error adding resource", description: err.message, variant: "destructive" });
    },
  });

  const updateResourceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/workstream-resources/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timeline.id, "workstream-resources"] });
      toast({ title: "Resource updated" });
    },
  });

  const deleteResourceMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/workstream-resources/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timeline.id, "workstream-resources"] });
      toast({ title: "Resource removed" });
    },
  });

  const handleAddPhase = () => {
    if (!newTaskTitle.trim()) return;
    createTaskMutation.mutate({
      title: newTaskTitle.trim(),
      itemType: "phase",
      sortOrder: phases.length,
    });
    setNewTaskTitle("");
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
      durationWeeks: newTaskDuration ? parseFloat(newTaskDuration) : null,
      confidenceLevel: newTaskConfidence,
    });
    setNewTaskTitle("");
    setNewTaskDuration("");
    setNewTaskConfidence("medium");
    setAddWorkstreamOpen(false);
  };

  const handleEditTask = () => {
    if (!editingTask || !newTaskTitle.trim()) return;
    const data: any = { title: newTaskTitle.trim() };
    if (editingTask.itemType === "workstream") {
      data.durationWeeks = newTaskDuration ? newTaskDuration : null;
      data.confidenceLevel = newTaskConfidence || null;
    }
    updateTaskMutation.mutate({ id: editingTask.id, data });
    setEditingTask(null);
    setEditTaskOpen(false);
  };

  const openEditDialog = (task: Task) => {
    setEditingTask(task);
    setNewTaskTitle(task.title);
    setNewTaskDuration(task.durationWeeks?.toString() || "");
    setNewTaskConfidence(task.confidenceLevel || "medium");
    setEditTaskOpen(true);
  };

  const openAddResourceDialog = (workstreamId: string) => {
    setSelectedWorkstreamId(workstreamId);
    setNewResRoleId("");
    setNewResHoursPerWeek("");
    setNewResTaskType("technical");
    setNewResTeamMemberId("");
    setNewResNotes("");
    setAddResourceOpen(true);
  };

  const openEditResourceDialog = (resource: WorkstreamResource) => {
    setEditingResource(resource);
    setNewResRoleId(resource.rateCardId);
    setNewResHoursPerWeek(resource.hoursPerWeek?.toString() || "");
    setNewResTaskType(resource.taskType || "technical");
    setNewResTeamMemberId(resource.teamMemberId || "");
    setNewResNotes(resource.notes || "");
    setEditResourceOpen(true);
  };

  const handleAddResource = () => {
    if (!selectedWorkstreamId || !newResRoleId || !newResHoursPerWeek) return;
    createResourceMutation.mutate({
      taskId: selectedWorkstreamId,
      data: {
        taskId: selectedWorkstreamId,
        rateCardId: newResRoleId,
        hoursPerWeek: newResHoursPerWeek,
        taskType: newResTaskType,
        teamMemberId: newResTeamMemberId === "none" || !newResTeamMemberId ? null : newResTeamMemberId,
        notes: newResNotes || null,
      },
    });
    setAddResourceOpen(false);
  };

  const handleEditResource = () => {
    if (!editingResource) return;
    updateResourceMutation.mutate({
      id: editingResource.id,
      data: {
        rateCardId: newResRoleId,
        hoursPerWeek: newResHoursPerWeek,
        taskType: newResTaskType,
        teamMemberId: newResTeamMemberId === "none" || !newResTeamMemberId ? null : newResTeamMemberId,
        notes: newResNotes || null,
      },
    });
    setEditingResource(null);
    setEditResourceOpen(false);
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch("/api/estimate-template");
      if (!res.ok) throw new Error("Failed to download template");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "estimate-template.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleImportTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/timelines/${timeline.id}/import-estimate`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Import failed");
      }
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timeline.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timeline.id, "workstream-resources"] });
      toast({
        title: "Import Complete",
        description: `${result.phasesCreated} phase(s), ${result.workstreamsCreated} workstream(s), ${result.resourcesCreated} resource(s) created. ${result.rowsSkipped > 0 ? `${result.rowsSkipped} row(s) skipped.` : ""}`,
      });
    } catch (err: any) {
      toast({ title: "Import Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getRateCard = (roleId: string | null | undefined): RateCard | undefined => {
    if (!roleId) return undefined;
    return allRateCards.find(r => r.id === roleId);
  };

  const getResourcesForWorkstream = (wsId: string): WorkstreamResource[] => {
    return allResources.filter(r => r.taskId === wsId);
  };

  const getWorkstreamHours = (ws: Task): number => {
    const duration = parseFloat(ws.durationWeeks || "0") || 0;
    const resources = getResourcesForWorkstream(ws.id);
    if (resources.length > 0) {
      return resources.reduce((sum, r) => {
        const hpw = parseFloat(r.hoursPerWeek || "0") || 0;
        return sum + (hpw * duration);
      }, 0);
    }
    return parseFloat(ws.estimatedHours || "0") || 0;
  };

  const getWorkstreamCost = (ws: Task): number => {
    const duration = parseFloat(ws.durationWeeks || "0") || 0;
    const resources = getResourcesForWorkstream(ws.id);
    if (resources.length > 0) {
      return resources.reduce((sum, r) => {
        const hpw = parseFloat(r.hoursPerWeek || "0") || 0;
        const rc = getRateCard(r.rateCardId);
        const rate = parseFloat(rc?.costRate || "0") || 0;
        return sum + (hpw * duration * rate);
      }, 0);
    }
    const hours = parseFloat(ws.estimatedHours || "0") || 0;
    const rc = getRateCard(ws.assignedRoleId);
    const rate = parseFloat(rc?.costRate || "0") || 0;
    return hours * rate;
  };

  const getWorkstreamRevenue = (ws: Task): number => {
    const duration = parseFloat(ws.durationWeeks || "0") || 0;
    const resources = getResourcesForWorkstream(ws.id);
    if (resources.length > 0) {
      return resources.reduce((sum, r) => {
        const hpw = parseFloat(r.hoursPerWeek || "0") || 0;
        const rc = getRateCard(r.rateCardId);
        const rate = parseFloat(rc?.billRate || "0") || 0;
        return sum + (hpw * duration * rate);
      }, 0);
    }
    const hours = parseFloat(ws.estimatedHours || "0") || 0;
    const rc = getRateCard(ws.assignedRoleId);
    const rate = parseFloat(rc?.billRate || "0") || 0;
    return hours * rate;
  };

  const totalHours = workstreams.reduce((sum, ws) => sum + getWorkstreamHours(ws), 0);
  const baseCost = workstreams.reduce((sum, ws) => sum + getWorkstreamCost(ws), 0);
  const baseRevenue = workstreams.reduce((sum, ws) => sum + getWorkstreamRevenue(ws), 0);
  const serverRiskPercent = parseFloat(timeline.riskFactorPercent || "0") || 0;
  const serverBufferPercent = parseFloat(timeline.bufferPercent || "0") || 0;

  useEffect(() => {
    setLocalRiskPercent(serverRiskPercent);
  }, [serverRiskPercent]);

  useEffect(() => {
    setLocalBufferPercent(serverBufferPercent);
  }, [serverBufferPercent]);

  const basePrice = baseRevenue;
  const riskAdjustedPrice = basePrice * (1 + localRiskPercent / 100);
  const bufferedPrice = riskAdjustedPrice * (1 + localBufferPercent / 100);
  const expectedGM = basePrice > 0 ? ((basePrice - baseCost) / basePrice) * 100 : 0;
  const grossMargin = bufferedPrice > 0 ? ((bufferedPrice - baseCost) / bufferedPrice) * 100 : 0;

  const hoursByRole: Record<string, number> = {};
  workstreams.forEach(ws => {
    const duration = parseFloat(ws.durationWeeks || "0") || 0;
    const resources = getResourcesForWorkstream(ws.id);
    if (resources.length > 0) {
      resources.forEach(r => {
        const rc = getRateCard(r.rateCardId);
        const role = rc?.name || rc?.role || "Unassigned";
        const hpw = parseFloat(r.hoursPerWeek || "0") || 0;
        hoursByRole[role] = (hoursByRole[role] || 0) + (hpw * duration);
      });
    } else {
      const rc = getRateCard(ws.assignedRoleId);
      const role = rc?.name || rc?.role || "Unassigned";
      const hours = parseFloat(ws.estimatedHours || "0") || 0;
      hoursByRole[role] = (hoursByRole[role] || 0) + hours;
    }
  });

  const confidenceCounts = workstreams.reduce((acc, ws) => {
    const level = ws.confidenceLevel || "unset";
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const syncFinancials = () => {
    updateOppMutation.mutate({
      approvedBudget: bufferedPrice.toFixed(2),
      estimatedRevenue: bufferedPrice.toFixed(2),
      totalRunningCost: baseCost.toFixed(2),
      grossMargin: grossMargin.toFixed(2),
    });
    toast({ title: "Financials synced to opportunity" });
  };

  const getPhaseHours = (phaseId: string): number => {
    return workstreams
      .filter(ws => ws.parentTaskId === phaseId)
      .reduce((sum, ws) => sum + getWorkstreamHours(ws), 0);
  };

  const getPhaseCost = (phaseId: string): number => {
    return workstreams
      .filter(ws => ws.parentTaskId === phaseId)
      .reduce((sum, ws) => sum + getWorkstreamCost(ws), 0);
  };

  const getPhaseRevenue = (phaseId: string): number => {
    return workstreams
      .filter(ws => ws.parentTaskId === phaseId)
      .reduce((sum, ws) => sum + getWorkstreamRevenue(ws), 0);
  };

  const renderResourceRow = (resource: WorkstreamResource, ws: Task) => {
    const rc = getRateCard(resource.rateCardId);
    const hpw = parseFloat(resource.hoursPerWeek || "0") || 0;
    const duration = parseFloat(ws.durationWeeks || "0") || 0;
    const totalHrs = hpw * duration;
    const billRate = parseFloat(rc?.billRate || "0") || 0;
    const totalPrice = totalHrs * billRate;
    const taskTypeLabel = TASK_TYPES.find(t => t.value === resource.taskType)?.label;
    const tm = resource.teamMemberId ? teamMembers.find(m => m.id === resource.teamMemberId) : null;

    return (
      <div key={resource.id} className="flex items-center gap-3 px-4 py-2 border-t bg-muted/5 table-row-hover" data-testid={`resource-row-${resource.id}`}>
        <div className="w-8" />
        <Users className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">
            {rc?.name || rc?.role || "Unknown Role"}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {rc?.region && <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400">{rc.region}</Badge>}
            {taskTypeLabel && <Badge variant="outline" className="text-[10px]">{taskTypeLabel}</Badge>}
            <span className="text-[10px] text-muted-foreground tabular-nums">{hpw}h/wk × {duration} wks</span>
            {tm && <Badge variant="secondary" className="text-[10px]">{tm.name}</Badge>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-semibold tabular-nums">{totalHrs.toLocaleString()}h</div>
          <div className="text-xs text-muted-foreground tabular-nums">${totalPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEditResourceDialog(resource)} data-testid={`button-edit-resource-${resource.id}`}>
            <Edit3 className="w-3 h-3" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="text-destructive" data-testid={`button-delete-resource-${resource.id}`}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Resource</AlertDialogTitle>
                <AlertDialogDescription>Remove this resource assignment? This cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteResourceMutation.mutate(resource.id)}>Remove</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    );
  };

  const renderResourceDialog = (isEdit: boolean) => {
    const open = isEdit ? editResourceOpen : addResourceOpen;
    const setOpen = isEdit ? setEditResourceOpen : setAddResourceOpen;
    const handleSave = isEdit ? handleEditResource : handleAddResource;
    const title = isEdit ? "Edit Resource" : "Add Resource";

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Role (Rate Card)</label>
              {rateCards.length === 0 ? (
                <div className="text-xs text-muted-foreground border rounded-md p-2.5 bg-muted/30">
                  No rate cards found. Add rate cards in <a href="/settings" className="underline text-primary">Settings → Rate Cards</a>.
                </div>
              ) : (
                <Select value={newResRoleId} onValueChange={setNewResRoleId}>
                  <SelectTrigger data-testid="select-resource-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedRegions.map(region => (
                      <SelectGroup key={region}>
                        <SelectLabel className="text-xs font-semibold text-muted-foreground">{region}</SelectLabel>
                        {rateCardsByRegion[region].map(rc => (
                          <SelectItem key={rc.id} value={rc.id}>
                            {rc.name || rc.role || rc.id}
                            {rc.costRate ? ` · $${rc.costRate}/hr` : ""}
                            {rc.billRate ? ` → $${rc.billRate}/hr` : ""}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Hours per Week</label>
                <Input
                  type="number"
                  placeholder="e.g., 40"
                  value={newResHoursPerWeek}
                  onChange={e => setNewResHoursPerWeek(e.target.value)}
                  data-testid="input-resource-hours"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Task Type</label>
                <Select value={newResTaskType} onValueChange={setNewResTaskType}>
                  <SelectTrigger data-testid="select-resource-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Team Member (Optional)</label>
              <Select value={newResTeamMemberId || "none"} onValueChange={setNewResTeamMemberId}>
                <SelectTrigger data-testid="select-resource-member">
                  <SelectValue placeholder="Assign later" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Assign later</SelectItem>
                  {teamMembers.map(tm => (
                    <SelectItem key={tm.id} value={tm.id}>{tm.name}{tm.role ? ` (${tm.role})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Notes</label>
              <Input
                placeholder="Optional notes"
                value={newResNotes}
                onChange={e => setNewResNotes(e.target.value)}
                data-testid="input-resource-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={!newResRoleId || !newResHoursPerWeek} data-testid="button-save-resource">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="space-y-6" data-testid="estimate-tab">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="card-elevated" data-testid="card-total-hours">
          <CardContent className="pt-5 pb-5">
            <div className="metric-label flex items-center gap-1.5 mb-2">
              <Clock className="w-3.5 h-3.5" />
              Total Hours
            </div>
            <div className="metric-value text-3xl">{totalHours.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="card-elevated" data-testid="card-base-price">
          <CardContent className="pt-5 pb-5">
            <div className="metric-label flex items-center gap-1.5 mb-2">
              <DollarSign className="w-3.5 h-3.5" />
              Base Price
            </div>
            <div className="metric-value text-3xl">${basePrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          </CardContent>
        </Card>
        <Card className="card-elevated" data-testid="card-base-cost">
          <CardContent className="pt-5 pb-5">
            <div className="metric-label flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5" />
              Base Cost
            </div>
            <div className="metric-value text-3xl">${baseCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          </CardContent>
        </Card>
        <Card className="card-elevated" data-testid="card-margin">
          <CardContent className="pt-5 pb-5">
            <div className="metric-label flex items-center gap-1.5 mb-2">
              <Calculator className="w-3.5 h-3.5" />
              Expected GM
            </div>
            <div className={`metric-value text-3xl ${expectedGM >= 30 ? "text-green-600 dark:text-green-400" : expectedGM >= 15 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
              {expectedGM.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="section-title">Planned Effort / Scope</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={handleDownloadTemplate} data-testid="button-download-template">
                <Download className="w-4 h-4 mr-1" /> Template
              </Button>
              <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isImporting} data-testid="button-import-template">
                {isImporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                {isImporting ? "Importing..." : "Import"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={handleImportTemplate}
                data-testid="input-import-file"
              />
              <Button size="sm" onClick={() => { setNewTaskTitle(""); setAddPhaseOpen(true); }} data-testid="button-add-phase">
                <Plus className="w-4 h-4 mr-1" /> Add Phase
              </Button>
            </div>
          </div>

          {phases.length === 0 && (
            <Card className="border-dashed" data-testid="text-empty-backlog">
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Calculator className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-sm">No phases yet. Add a phase to start building your estimate.</p>
              </CardContent>
            </Card>
          )}

          {phases.map(phase => {
            const children = workstreams.filter(ws => ws.parentTaskId === phase.id);
            const expanded = expandedPhases.has(phase.id);
            const phaseHours = getPhaseHours(phase.id);
            const phasePrice = getPhaseRevenue(phase.id);
            const phaseCost = getPhaseCost(phase.id);
            const phaseMargin = phasePrice > 0 ? ((phasePrice - phaseCost) / phasePrice) * 100 : 0;

            return (
              <Card key={phase.id} className="card-elevated" data-testid={`card-phase-${phase.id}`}>
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer transition-smooth"
                  onClick={() => togglePhase(phase.id)}
                  data-testid={`phase-header-${phase.id}`}
                >
                  <div className="transition-transform duration-200" style={{ transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                    <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate tracking-tight">{phase.title}</div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span>{children.length} workstream{children.length !== 1 ? "s" : ""}</span>
                      <span className="tabular-nums">{phaseHours.toLocaleString()} hrs</span>
                      <span className="tabular-nums font-medium text-foreground/70">${phasePrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); openEditDialog(phase); }} data-testid={`button-edit-phase-${phase.id}`}>
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={e => { e.stopPropagation(); setSelectedParentPhase(phase.id); setNewTaskTitle(""); setNewTaskDuration(""); setAddWorkstreamOpen(true); }}
                      data-testid={`button-add-workstream-${phase.id}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={e => e.stopPropagation()} data-testid={`button-delete-phase-${phase.id}`}>
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
                      const wsResources = getResourcesForWorkstream(ws.id);
                      const wsHours = getWorkstreamHours(ws);
                      const wsPrice = getWorkstreamRevenue(ws);
                      const confLevel = CONFIDENCE_LEVELS.find(c => c.value === ws.confidenceLevel);
                      const duration = parseFloat(ws.durationWeeks || "0") || 0;
                      const wsExpanded = expandedWorkstreams.has(ws.id);

                      return (
                        <div key={ws.id}>
                          <div
                            className="flex items-center gap-3 px-4 py-2.5 border-t table-row-hover cursor-pointer"
                            onClick={() => toggleWorkstream(ws.id)}
                            data-testid={`workstream-row-${ws.id}`}
                          >
                            <div className="w-4 transition-transform duration-200" style={{ transform: wsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
                              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{ws.title}</div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {duration > 0 && <Badge variant="outline" className="text-[10px]">{duration} wks</Badge>}
                                <Badge variant="secondary" className="text-[10px]">{wsResources.length} resource{wsResources.length !== 1 ? "s" : ""}</Badge>
                                {confLevel && <Badge className={`text-[10px] ${confLevel.color} border-0`}>{confLevel.label}</Badge>}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-sm font-semibold tabular-nums">{wsHours.toLocaleString()}h</div>
                              <div className="text-xs text-muted-foreground tabular-nums">${wsPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); openAddResourceDialog(ws.id); }} data-testid={`button-add-resource-${ws.id}`}>
                                <Plus className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); openEditDialog(ws); }} data-testid={`button-edit-workstream-${ws.id}`}>
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive" onClick={e => e.stopPropagation()} data-testid={`button-delete-workstream-${ws.id}`}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Workstream</AlertDialogTitle>
                                    <AlertDialogDescription>Delete "{ws.title}" and all its resource assignments? This cannot be undone.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteTaskMutation.mutate(ws.id)}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                          {wsExpanded && (
                            <div className="transition-smooth">
                              {wsResources.length === 0 && (
                                <div className="px-4 py-3 border-t bg-muted/10 text-sm text-muted-foreground text-center">
                                  No resources assigned. Click + on the workstream to add a resource.
                                </div>
                              )}
                              {wsResources.map(r => renderResourceRow(r, ws))}
                            </div>
                          )}
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
          <Card className="card-elevated" data-testid="card-financial-summary">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                Financial Summary
                <Button size="sm" variant="outline" onClick={syncFinancials} data-testid="button-sync-financials">
                  Sync
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <div className="metric-label mb-1">Price</div>
                <div className="space-y-2">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Base Price</span>
                    <span className="font-medium tabular-nums">${basePrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-foreground">Risk Factor</span>
                      <span className="font-medium tabular-nums">{localRiskPercent}%</span>
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
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Risk-Adjusted</span>
                    <span className="font-medium tabular-nums">${riskAdjustedPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-muted-foreground">Buffer</span>
                      <span className="font-medium tabular-nums">{localBufferPercent}%</span>
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
                </div>
              </div>

              <Separator />

              <div>
                <div className="metric-label mb-1">Revenue</div>
                <div className="flex justify-between gap-2 items-baseline">
                  <span className="text-sm font-semibold">Buffered Price</span>
                  <span className="text-lg font-bold tabular-nums">${bufferedPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <Separator />

              <div>
                <div className="metric-label mb-1">Cost & Margin</div>
                <div className="space-y-2">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Base Cost</span>
                    <span className="font-medium tabular-nums">${baseCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className={`flex justify-between gap-2 items-baseline ${grossMargin >= 30 ? "text-green-600 dark:text-green-400" : grossMargin >= 15 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                    <span className="text-sm font-semibold">Gross Margin</span>
                    <span className="text-lg font-bold tabular-nums">{grossMargin.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-elevated" data-testid="card-hours-by-role">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Hours by Role</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {Object.entries(hoursByRole).length === 0 && (
                <div className="text-muted-foreground text-center py-2">No resources assigned</div>
              )}
              {Object.entries(hoursByRole).sort((a, b) => b[1] - a[1]).map(([role, hours]) => {
                const pct = totalHours > 0 ? (hours / totalHours) * 100 : 0;
                return (
                  <div key={role} className="space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground truncate">{role}</span>
                      <span className="font-medium shrink-0 tabular-nums">{hours.toLocaleString()}h</span>
                    </div>
                    <div className="h-1 rounded-full bg-muted">
                      <div
                        className="h-1 rounded-full bg-primary/60 transition-all duration-300"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="card-elevated" data-testid="card-confidence">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Confidence Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {CONFIDENCE_LEVELS.map(level => (
                <div key={level.value} className="flex justify-between items-center gap-2">
                  <Badge className={`${level.color} border-0`}>{level.label}</Badge>
                  <span className="font-semibold tabular-nums">{confidenceCounts[level.value] || 0}</span>
                </div>
              ))}
              {confidenceCounts["unset"] > 0 && (
                <div className="flex justify-between items-center gap-2">
                  <Badge variant="outline">Unset</Badge>
                  <span className="font-semibold tabular-nums">{confidenceCounts["unset"]}</span>
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
                <label className="text-sm font-medium mb-1 block">Duration (Weeks)</label>
                <Input
                  type="number"
                  placeholder="e.g., 4"
                  value={newTaskDuration}
                  onChange={e => setNewTaskDuration(e.target.value)}
                  data-testid="input-workstream-duration"
                />
              </div>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Duration (Weeks)</label>
                  <Input
                    type="number"
                    placeholder="e.g., 4"
                    value={newTaskDuration}
                    onChange={e => setNewTaskDuration(e.target.value)}
                    data-testid="input-edit-duration"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Confidence</label>
                  <Select value={newTaskConfidence} onValueChange={setNewTaskConfidence}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONFIDENCE_LEVELS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTaskOpen(false)}>Cancel</Button>
            <Button onClick={handleEditTask} disabled={!newTaskTitle.trim()} data-testid="button-save-edit-task">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {renderResourceDialog(false)}
      {renderResourceDialog(true)}
    </div>
  );
}
