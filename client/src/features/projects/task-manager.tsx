import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Edit3, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { formatDateForProject, parseDateToISO } from "@/lib/date-format";
import type { Task, FieldOption } from "@shared/schema";

interface TaskManagerProps {
  timelineId: string;
  tasks: Task[];
  timelineColor: string;
  projectDateFormat: string;
  taskStatuses: FieldOption[];
  taskHealthOptions: FieldOption[];
  taskItemTypes: FieldOption[];
  showAddForm: boolean;
  setShowAddForm: (v: boolean) => void;
  view: "add" | "phases" | "workstreams";
}

export function TaskManager({
  timelineId,
  tasks,
  timelineColor,
  projectDateFormat,
  taskStatuses,
  taskHealthOptions,
  taskItemTypes,
  showAddForm,
  setShowAddForm,
  view,
}: TaskManagerProps) {
  const { toast } = useToast();

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskStart, setNewTaskStart] = useState("");
  const [newTaskEnd, setNewTaskEnd] = useState("");
  const [newTaskActualStart, setNewTaskActualStart] = useState("");
  const [newTaskActualEnd, setNewTaskActualEnd] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPercent, setNewTaskPercent] = useState(0);
  const [newTaskStatus, setNewTaskStatus] = useState("not_started");
  const [newTaskHealth, setNewTaskHealth] = useState("green");
  const [newTaskItemType, setNewTaskItemType] = useState("workstream");
  const [newTaskParentId, setNewTaskParentId] = useState("");

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTTitle, setEditTTitle] = useState("");
  const [editTStart, setEditTStart] = useState("");
  const [editTEnd, setEditTEnd] = useState("");
  const [editTActualStart, setEditTActualStart] = useState("");
  const [editTActualEnd, setEditTActualEnd] = useState("");
  const [editTDesc, setEditTDesc] = useState("");
  const [editTPercent, setEditTPercent] = useState(0);
  const [editTStatus, setEditTStatus] = useState("not_started");
  const [editTHealth, setEditTHealth] = useState("green");
  const [editTItemType, setEditTItemType] = useState("workstream");
  const [editTParentId, setEditTParentId] = useState("");

  const fmtDate = (isoDate: string) => {
    if (!isoDate || !projectDateFormat) return isoDate;
    return formatDateForProject(isoDate, projectDateFormat);
  };

  const addTaskMutation = useMutation({
    mutationFn: async (data: { title: string; startDate: string; endDate: string; actualStartDate?: string; actualEndDate?: string; description?: string; percentComplete?: number; status?: string; health?: string; itemType?: string; parentTaskId?: string }) => {
      await apiRequest("POST", `/api/timelines/${timelineId}/tasks`, {
        ...data,
        sortOrder: tasks.length,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId] });
      toast({ title: "Task added" });
    },
    onError: (error: Error) => {
      let msg = error.message || "Failed to add task";
      try { const parsed = JSON.parse(msg.replace(/^\d+:\s*/, "")); msg = parsed.message || msg; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: { title?: string; startDate?: string; endDate?: string; actualStartDate?: string | null; actualEndDate?: string | null; description?: string | null; percentComplete?: number; status?: string; health?: string; itemType?: string; parentTaskId?: string | null } }) => {
      await apiRequest("PATCH", `/api/tasks/${taskId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId] });
      toast({ title: "Task updated" });
    },
    onError: (error: Error) => {
      let msg = error.message || "Failed to update task";
      try { const parsed = JSON.parse(msg.replace(/^\d+:\s*/, "")); msg = parsed.message || msg; } catch {}
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest("DELETE", `/api/tasks/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId] });
      toast({ title: "Task deleted" });
    },
  });

  const startEditingTask = (t: Task) => {
    setEditingTaskId(t.id);
    setEditTTitle(t.title);
    setEditTStart(t.startDate || "");
    setEditTEnd(t.endDate || "");
    setEditTActualStart(t.actualStartDate || "");
    setEditTActualEnd(t.actualEndDate || "");
    setEditTDesc(t.description || "");
    setEditTPercent(t.percentComplete ?? 0);
    setEditTStatus(t.status || "not_started");
    setEditTHealth(t.health || "green");
    setEditTItemType(t.itemType || "workstream");
    setEditTParentId(t.parentTaskId || "");
  };

  const saveTaskEdit = () => {
    if (!editingTaskId || !editTTitle.trim() || !editTStart.trim() || !editTEnd.trim()) return;
    updateTaskMutation.mutate(
      {
        taskId: editingTaskId,
        data: {
          title: editTTitle.trim(),
          startDate: fmtDate(editTStart.trim()),
          endDate: fmtDate(editTEnd.trim()),
          actualStartDate: editTActualStart.trim() ? fmtDate(editTActualStart.trim()) : null,
          actualEndDate: editTActualEnd.trim() ? fmtDate(editTActualEnd.trim()) : null,
          description: editTDesc.trim() || null,
          percentComplete: editTPercent,
          status: editTStatus,
          health: editTHealth,
          itemType: editTItemType,
          parentTaskId: editTParentId || null,
        },
      },
      {
        onSuccess: () => {
          setEditingTaskId(null);
        },
      }
    );
  };

  const cancelTaskEdit = () => {
    setEditingTaskId(null);
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim() || !newTaskStart.trim() || !newTaskEnd.trim()) return;
    addTaskMutation.mutate(
      {
        title: newTaskTitle,
        startDate: fmtDate(newTaskStart),
        endDate: fmtDate(newTaskEnd),
        actualStartDate: newTaskActualStart ? fmtDate(newTaskActualStart) : undefined,
        actualEndDate: newTaskActualEnd ? fmtDate(newTaskActualEnd) : undefined,
        description: newTaskDesc || undefined,
        percentComplete: newTaskPercent,
        status: newTaskStatus,
        health: newTaskHealth,
        itemType: newTaskItemType,
        parentTaskId: newTaskParentId || undefined,
      },
      {
        onSuccess: () => {
          setNewTaskTitle("");
          setNewTaskStart("");
          setNewTaskEnd("");
          setNewTaskActualStart("");
          setNewTaskActualEnd("");
          setNewTaskDesc("");
          setNewTaskPercent(0);
          setNewTaskStatus("not_started");
          setNewTaskHealth("green");
          setNewTaskItemType("workstream");
          setNewTaskParentId("");
          setShowAddForm(false);
        },
      }
    );
  };

  const renderTaskCard = (t: Task) => (
    <Card
      key={t.id}
      className="p-3"
      data-testid={`manage-task-${t.id}`}
    >
      {editingTaskId === t.id ? (
        <div className="space-y-2">
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <Input
                value={editTTitle}
                onChange={(e) => setEditTTitle(e.target.value)}
                placeholder="Title"
                data-testid={`input-edit-task-title-${t.id}`}
              />
            </div>
            <div className="w-40">
              <Input
                type={projectDateFormat ? "date" : "text"}
                value={projectDateFormat ? parseDateToISO(editTStart, projectDateFormat) : editTStart}
                onChange={(e) => setEditTStart(e.target.value)}
                placeholder="Planned start"
                data-testid={`input-edit-task-start-${t.id}`}
              />
            </div>
            <div className="w-40">
              <Input
                type={projectDateFormat ? "date" : "text"}
                value={projectDateFormat ? parseDateToISO(editTEnd, projectDateFormat) : editTEnd}
                onChange={(e) => setEditTEnd(e.target.value)}
                placeholder="Planned end"
                data-testid={`input-edit-task-end-${t.id}`}
              />
            </div>
            <div className="w-40">
              <Input
                type={projectDateFormat ? "date" : "text"}
                value={projectDateFormat ? parseDateToISO(editTActualStart, projectDateFormat) : editTActualStart}
                onChange={(e) => setEditTActualStart(e.target.value)}
                placeholder="Actual start"
                data-testid={`input-edit-task-actual-start-${t.id}`}
              />
            </div>
            <div className="w-40">
              <Input
                type={projectDateFormat ? "date" : "text"}
                value={projectDateFormat ? parseDateToISO(editTActualEnd, projectDateFormat) : editTActualEnd}
                onChange={(e) => setEditTActualEnd(e.target.value)}
                placeholder="Actual end"
                data-testid={`input-edit-task-actual-end-${t.id}`}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex-1 min-w-[140px]">
              <Input
                value={editTDesc}
                onChange={(e) => setEditTDesc(e.target.value)}
                placeholder="Description (optional)"
                data-testid={`input-edit-task-desc-${t.id}`}
              />
            </div>
            <div className="flex items-center gap-2 w-56">
              <span className="text-xs text-muted-foreground whitespace-nowrap">% Done</span>
              {t.itemType === "phase" && tasks.some((ct) => ct.parentTaskId === t.id) ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={editTPercent}
                    className="w-20 opacity-60"
                    disabled
                    data-testid={`input-edit-task-percent-${t.id}`}
                  />
                  <span className="text-[10px] text-muted-foreground italic whitespace-nowrap">Auto-calculated</span>
                </div>
              ) : (
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={editTPercent}
                  onChange={(e) => setEditTPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="w-20"
                  data-testid={`input-edit-task-percent-${t.id}`}
                />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-36">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <select
                value={editTStatus}
                onChange={(e) => setEditTStatus(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid={`select-edit-task-status-${t.id}`}
              >
                {taskStatuses.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Health</label>
              <select
                value={editTHealth}
                onChange={(e) => setEditTHealth(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid={`select-edit-task-health-${t.id}`}
              >
                {taskHealthOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="w-36">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
              <select
                value={editTItemType}
                onChange={(e) => {
                  setEditTItemType(e.target.value);
                  if (e.target.value === "phase") setEditTParentId("");
                }}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid={`select-edit-task-type-${t.id}`}
              >
                {taskItemTypes.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            {editTItemType === "workstream" && tasks.filter((pt) => pt.itemType === "phase" && pt.id !== t.id).length > 0 && (
              <div className="w-44">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Parent Phase</label>
                <select
                  value={editTParentId}
                  onChange={(e) => setEditTParentId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  data-testid={`select-edit-task-parent-phase-${t.id}`}
                >
                  <option value="">None</option>
                  {tasks
                    .filter((pt) => pt.itemType === "phase" && pt.id !== t.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                </select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={cancelTaskEdit}
              data-testid={`button-cancel-edit-task-${t.id}`}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={saveTaskEdit}
              disabled={!editTTitle.trim() || !editTStart.trim() || !editTEnd.trim() || updateTaskMutation.isPending}
              data-testid={`button-save-edit-task-${t.id}`}
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              {updateTaskMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-4 h-1.5 rounded-sm shrink-0"
              style={{ backgroundColor: t.color || timelineColor }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium truncate" data-testid={`text-task-title-${t.id}`}>{t.title}</p>
                <span className="text-xs text-muted-foreground" data-testid={`text-task-percent-${t.id}`}>{t.percentComplete}%</span>
                <Badge variant="secondary" className={`text-xs ${
                  t.status === "in_progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                  t.status === "complete" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" : ""
                }`}>{taskStatuses.find((s) => s.value === t.status)?.label || t.status}</Badge>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  t.health === "amber" ? "bg-amber-500 animate-pulse" : t.health === "red" ? "bg-red-500 animate-pulse" : "bg-green-500"
                }`} title={taskHealthOptions.find((h) => h.value === t.health)?.label || t.health} />
                {t.itemType === "phase" && <Badge variant="outline" className="text-xs">{taskItemTypes.find((it) => it.value === "phase")?.label || "Phase"}</Badge>}
                {t.itemType === "phase" && tasks.some((ct) => ct.parentTaskId === t.id) && (
                  <span className="text-[10px] text-muted-foreground italic" data-testid={`text-phase-auto-${t.id}`}>Auto-calculated</span>
                )}
                {t.parentTaskId && (() => {
                  const parent = tasks.find((pt) => pt.id === t.parentTaskId);
                  return parent ? <Badge variant="outline" className="text-xs text-muted-foreground">↳ {parent.title}</Badge> : null;
                })()}
              </div>
              {(t.startDate || t.endDate) && (
              <p className="text-xs text-muted-foreground">
                Planned: {t.startDate || "—"} — {t.endDate || "—"}
              </p>
              )}
              {(t.actualStartDate || t.actualEndDate) && (
                <p className="text-xs text-muted-foreground">
                  Actual: {t.actualStartDate || "—"} — {t.actualEndDate || "—"}
                </p>
              )}
              {t.description && (
                <p className="text-xs text-muted-foreground truncate max-w-md">{t.description}</p>
              )}
              <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden w-full max-w-xs">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${t.percentComplete}%`,
                    backgroundColor: t.color || timelineColor,
                  }}
                  data-testid={`bar-task-progress-${t.id}`}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => startEditingTask(t)}
              data-testid={`button-edit-task-${t.id}`}
            >
              <Edit3 className="w-3.5 h-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  data-testid={`button-delete-task-${t.id}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove "{t.title}" from this project.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteTaskMutation.mutate(t.id)}
                    data-testid={`button-confirm-delete-task-${t.id}`}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </Card>
  );

  if (view === "add") {
    if (!showAddForm) return null;
    const phases = tasks.filter((t) => t.itemType === "phase");
    return (
      <Card className="p-4">
        <h4 className="text-xs font-medium text-muted-foreground mb-3">New Task</h4>
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
            <Input
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Task title"
              data-testid="input-new-task-title"
            />
          </div>
          <div className="w-40">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Planned Start</label>
            <Input
              type={projectDateFormat ? "date" : "text"}
              value={newTaskStart}
              onChange={(e) => setNewTaskStart(e.target.value)}
              placeholder={projectDateFormat || "e.g. Jan 2025"}
              data-testid="input-new-task-start"
            />
          </div>
          <div className="w-40">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Planned End</label>
            <Input
              type={projectDateFormat ? "date" : "text"}
              value={newTaskEnd}
              onChange={(e) => setNewTaskEnd(e.target.value)}
              placeholder={projectDateFormat || "e.g. Mar 2025"}
              data-testid="input-new-task-end"
            />
          </div>
          <div className="w-40">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Actual Start</label>
            <Input
              type={projectDateFormat ? "date" : "text"}
              value={newTaskActualStart}
              onChange={(e) => setNewTaskActualStart(e.target.value)}
              placeholder="Optional"
              data-testid="input-new-task-actual-start"
            />
          </div>
          <div className="w-40">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Actual End</label>
            <Input
              type={projectDateFormat ? "date" : "text"}
              value={newTaskActualEnd}
              onChange={(e) => setNewTaskActualEnd(e.target.value)}
              placeholder="Optional"
              data-testid="input-new-task-actual-end"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
            <Input
              value={newTaskDesc}
              onChange={(e) => setNewTaskDesc(e.target.value)}
              placeholder="Optional"
              data-testid="input-new-task-desc"
            />
          </div>
          <div className="w-24">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">% Done</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={newTaskPercent}
              onChange={(e) => setNewTaskPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
              data-testid="input-new-task-percent"
            />
          </div>
          <div className="w-36">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
            <select
              value={newTaskStatus}
              onChange={(e) => setNewTaskStatus(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              data-testid="select-new-task-status"
            >
              {taskStatuses.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="w-32">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Health</label>
            <select
              value={newTaskHealth}
              onChange={(e) => setNewTaskHealth(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              data-testid="select-new-task-health"
            >
              {taskHealthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="w-36">
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
            <select
              value={newTaskItemType}
              onChange={(e) => {
                setNewTaskItemType(e.target.value);
                if (e.target.value === "phase") setNewTaskParentId("");
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              data-testid="select-new-task-type"
            >
              {taskItemTypes.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          {newTaskItemType === "workstream" && phases.length > 0 && (
            <div className="w-44">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Parent Phase</label>
              <select
                value={newTaskParentId}
                onChange={(e) => setNewTaskParentId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                data-testid="select-new-task-parent-phase"
              >
                <option value="">None</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
          )}
          <Button
            onClick={handleAddTask}
            disabled={!newTaskTitle.trim() || !newTaskStart.trim() || !newTaskEnd.trim() || addTaskMutation.isPending}
            data-testid="button-submit-new-task"
          >
            {addTaskMutation.isPending ? "Adding..." : "Add"}
          </Button>
        </div>
      </Card>
    );
  }

  const filteredTasks = [...tasks]
    .filter((t) => t.itemType === view.slice(0, -1))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (filteredTasks.length === 0) {
    if (view === "phases") {
      return <p className="text-sm text-muted-foreground py-4 text-center">No phases yet. Click "Add" &rarr; "Add Task" and set type to Phase.</p>;
    }
    return <p className="text-sm text-muted-foreground py-4 text-center">No workstreams yet. Click "Add" &rarr; "Add Task" to create one.</p>;
  }

  return (
    <div className="space-y-2">
      {filteredTasks.map((t) => renderTaskCard(t))}
    </div>
  );
}
