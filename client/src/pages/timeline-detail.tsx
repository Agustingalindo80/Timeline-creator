import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import {
  ArrowLeft,
  Edit3,
  Plus,
  Trash2,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Save,
  X,
  Download,
  Image,
  FileText,
  Check,
  ListFilter,
  Calendar,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { TimelineView, TimelineViewHorizontal } from "@/components/timeline-view";
import { ThemePicker } from "@/components/theme-picker";
import { RiskRegister } from "@/components/risk-register";
import type { TimelineWithMilestones, AppSettings, FieldOption } from "@shared/schema";
import {
  DEFAULT_TASK_STATUSES,
  DEFAULT_TASK_HEALTH,
  DEFAULT_TASK_ITEM_TYPES,
} from "@shared/schema";

type ViewMode = "vertical" | "horizontal";
type FilterMode = "all" | "milestones";

export default function TimelineDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("vertical");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState("");
  const timelineRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const { data: timeline, isLoading } = useQuery<TimelineWithMilestones>({
    queryKey: ["/api/timelines", id],
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const taskStatuses = settings?.taskStatuses || DEFAULT_TASK_STATUSES;
  const taskHealthOptions = settings?.taskHealthOptions || DEFAULT_TASK_HEALTH;
  const taskItemTypes = settings?.taskItemTypes || DEFAULT_TASK_ITEM_TYPES;

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/timelines/${id}`, {
        title: editTitle,
        description: editDescription || null,
        color: editColor,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
      setEditing(false);
      toast({ title: "Timeline updated" });
    },
  });

  const addMilestoneMutation = useMutation({
    mutationFn: async (data: { title: string; date: string; actualDate?: string; description?: string }) => {
      await apiRequest("POST", `/api/timelines/${id}/milestones`, {
        ...data,
        sortOrder: (timeline?.milestones.length || 0),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
      toast({ title: "Milestone added" });
    },
  });

  const updateMilestoneMutation = useMutation({
    mutationFn: async ({ milestoneId, data }: { milestoneId: string; data: { title?: string; date?: string; actualDate?: string | null; description?: string | null } }) => {
      await apiRequest("PATCH", `/api/milestones/${milestoneId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
      toast({ title: "Milestone updated" });
    },
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      await apiRequest("DELETE", `/api/milestones/${milestoneId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
      toast({ title: "Milestone deleted" });
    },
  });

  const addTaskMutation = useMutation({
    mutationFn: async (data: { title: string; startDate: string; endDate: string; actualStartDate?: string; actualEndDate?: string; description?: string; percentComplete?: number; status?: string; health?: string; itemType?: string; parentTaskId?: string }) => {
      await apiRequest("POST", `/api/timelines/${id}/tasks`, {
        ...data,
        sortOrder: (timeline?.tasks.length || 0),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
      toast({ title: "Task added" });
    },
    onError: (error: any) => {
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
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
      toast({ title: "Task updated" });
    },
    onError: (error: any) => {
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
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", id] });
      toast({ title: "Task deleted" });
    },
  });

  const startEditing = () => {
    if (timeline) {
      setEditTitle(timeline.title);
      setEditDescription(timeline.description || "");
      setEditColor(timeline.color);
      setEditing(true);
    }
  };

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newActualDate, setNewActualDate] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskStart, setNewTaskStart] = useState("");
  const [newTaskEnd, setNewTaskEnd] = useState("");
  const [newTaskActualStart, setNewTaskActualStart] = useState("");
  const [newTaskActualEnd, setNewTaskActualEnd] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPercent, setNewTaskPercent] = useState(0);

  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [editMTitle, setEditMTitle] = useState("");
  const [editMDate, setEditMDate] = useState("");
  const [editMActualDate, setEditMActualDate] = useState("");
  const [editMDesc, setEditMDesc] = useState("");

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTTitle, setEditTTitle] = useState("");
  const [editTStart, setEditTStart] = useState("");
  const [editTEnd, setEditTEnd] = useState("");
  const [editTActualStart, setEditTActualStart] = useState("");
  const [editTActualEnd, setEditTActualEnd] = useState("");
  const [editTDesc, setEditTDesc] = useState("");
  const [editTPercent, setEditTPercent] = useState(0);

  const [newTaskStatus, setNewTaskStatus] = useState("not_started");
  const [newTaskHealth, setNewTaskHealth] = useState("green");
  const [newTaskItemType, setNewTaskItemType] = useState("workstream");
  const [newTaskParentId, setNewTaskParentId] = useState("");

  const [editTStatus, setEditTStatus] = useState("not_started");
  const [editTHealth, setEditTHealth] = useState("green");
  const [editTItemType, setEditTItemType] = useState("workstream");
  const [editTParentId, setEditTParentId] = useState("");

  const startEditingMilestone = (m: { id: string; title: string; date: string; actualDate: string | null; description: string | null }) => {
    setEditingMilestoneId(m.id);
    setEditMTitle(m.title);
    setEditMDate(m.date);
    setEditMActualDate(m.actualDate || "");
    setEditMDesc(m.description || "");
  };

  const saveMilestoneEdit = () => {
    if (!editingMilestoneId || !editMTitle.trim() || !editMDate.trim()) return;
    updateMilestoneMutation.mutate(
      {
        milestoneId: editingMilestoneId,
        data: {
          title: editMTitle.trim(),
          date: editMDate.trim(),
          actualDate: editMActualDate.trim() || null,
          description: editMDesc.trim() || null,
        },
      },
      {
        onSuccess: () => {
          setEditingMilestoneId(null);
        },
      }
    );
  };

  const cancelMilestoneEdit = () => {
    setEditingMilestoneId(null);
  };

  const startEditingTask = (t: { id: string; title: string; startDate: string; endDate: string; actualStartDate: string | null; actualEndDate: string | null; description: string | null; percentComplete: number; status: string; health: string; itemType: string; parentTaskId: string | null }) => {
    setEditingTaskId(t.id);
    setEditTTitle(t.title);
    setEditTStart(t.startDate);
    setEditTEnd(t.endDate);
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
          startDate: editTStart.trim(),
          endDate: editTEnd.trim(),
          actualStartDate: editTActualStart.trim() || null,
          actualEndDate: editTActualEnd.trim() || null,
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

  const handleAddMilestone = () => {
    if (!newTitle.trim() || !newDate.trim()) return;
    addMilestoneMutation.mutate(
      { title: newTitle, date: newDate, actualDate: newActualDate || undefined, description: newDesc || undefined },
      {
        onSuccess: () => {
          setNewTitle("");
          setNewDate("");
          setNewActualDate("");
          setNewDesc("");
          setShowAddForm(false);
        },
      }
    );
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim() || !newTaskStart.trim() || !newTaskEnd.trim()) return;
    addTaskMutation.mutate(
      {
        title: newTaskTitle,
        startDate: newTaskStart,
        endDate: newTaskEnd,
        actualStartDate: newTaskActualStart || undefined,
        actualEndDate: newTaskActualEnd || undefined,
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
          setShowAddTaskForm(false);
        },
      }
    );
  };

  const handleExport = useCallback(
    async (format: "png" | "pdf") => {
      if (!timelineRef.current || !timeline) return;
      setExporting(true);

      try {
        const html2canvas = (await import("html2canvas")).default;

        const source = timelineRef.current;

        const extraPadding = 48;
        const canvas = await html2canvas(source, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false,
          scrollX: 0,
          scrollY: -window.scrollY,
          width: source.scrollWidth,
          height: source.scrollHeight + extraPadding,
          windowWidth: Math.max(source.scrollWidth + 200, 1400),
          windowHeight: source.scrollHeight + extraPadding + 200,
          onclone: (clonedDoc: Document) => {
            clonedDoc.documentElement.classList.remove("dark");
            clonedDoc.documentElement.setAttribute("style", "color-scheme: light !important;");

            const style = clonedDoc.createElement("style");
            style.textContent = `
              :root, html, *, *::before, *::after {
                --background: 0 0% 100% !important;
                --foreground: 222 15% 12% !important;
                --card: 0 0% 98% !important;
                --card-foreground: 222 15% 12% !important;
                --card-border: 220 13% 94% !important;
                --muted: 220 14% 94% !important;
                --muted-foreground: 222 13% 38% !important;
                --border: 220 13% 91% !important;
                --ring: 217 91% 48% !important;
                --popover: 0 0% 96% !important;
                --popover-foreground: 222 15% 12% !important;
                --primary: 217 91% 48% !important;
                --primary-foreground: 210 40% 98% !important;
                --secondary: 220 14% 93% !important;
                --secondary-foreground: 222 15% 12% !important;
                --accent: 220 15% 95% !important;
                --accent-foreground: 222 15% 12% !important;
                --input: 220 13% 85% !important;
                color-scheme: light !important;
              }
              .dark {
                --background: 0 0% 100% !important;
                --foreground: 222 15% 12% !important;
                --card: 0 0% 98% !important;
                --card-foreground: 222 15% 12% !important;
                --card-border: 220 13% 94% !important;
                --muted: 220 14% 94% !important;
                --muted-foreground: 222 13% 38% !important;
                --border: 220 13% 91% !important;
                --ring: 217 91% 48% !important;
                --popover: 0 0% 96% !important;
                --popover-foreground: 222 15% 12% !important;
                --primary: 217 91% 48% !important;
                --primary-foreground: 210 40% 98% !important;
                --secondary: 220 14% 93% !important;
                --secondary-foreground: 222 15% 12% !important;
                --accent: 220 15% 95% !important;
                --accent-foreground: 222 15% 12% !important;
                --input: 220 13% 85% !important;
                color-scheme: light !important;
              }
            `;
            clonedDoc.head.appendChild(style);

            const targetEl = clonedDoc.querySelector("[data-export-timeline]") as HTMLElement;
            if (targetEl) {
              targetEl.style.padding = "32px";
              targetEl.style.paddingBottom = "48px";
              targetEl.style.backgroundColor = "hsl(0 0% 100%)";
              const allEls = targetEl.querySelectorAll<HTMLElement>("*");
              allEls.forEach((el) => {
                el.style.overflow = "visible";
              });
            }
          },
        });

        if (format === "png") {
          const link = document.createElement("a");
          link.download = `${timeline.title.replace(/[^a-zA-Z0-9]/g, "_")}_timeline.png`;
          link.href = canvas.toDataURL("image/png");
          link.click();
          toast({ title: "PNG downloaded" });
        } else {
          const { jsPDF } = await import("jspdf");
          const imgData = canvas.toDataURL("image/png");
          const imgWidth = canvas.width;
          const imgHeight = canvas.height;
          const isLandscape = imgWidth > imgHeight;
          const pdf = new jsPDF({
            orientation: isLandscape ? "landscape" : "portrait",
            unit: "px",
            format: [imgWidth, imgHeight],
          });
          pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
          pdf.save(`${timeline.title.replace(/[^a-zA-Z0-9]/g, "_")}_timeline.pdf`);
          toast({ title: "PDF downloaded" });
        }
      } catch (err: any) {
        toast({
          title: "Export failed",
          description: err.message || "Something went wrong during export.",
          variant: "destructive",
        });
      } finally {
        setExporting(false);
      }
    },
    [timeline, toast]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
            <Skeleton className="w-9 h-9 rounded-md" />
            <Skeleton className="h-5 w-48" />
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <Skeleton className="h-64 w-full rounded-md" />
        </main>
      </div>
    );
  }

  if (!timeline) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">Timeline not found</h2>
          <Button variant="outline" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const showTasks = filterMode === "all";

  const renderTaskCard = (t: typeof timeline.tasks[number], tl: typeof timeline) => (
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
            <div className="w-36">
              <Input
                value={editTStart}
                onChange={(e) => setEditTStart(e.target.value)}
                placeholder="Planned start"
                data-testid={`input-edit-task-start-${t.id}`}
              />
            </div>
            <div className="w-36">
              <Input
                value={editTEnd}
                onChange={(e) => setEditTEnd(e.target.value)}
                placeholder="Planned end"
                data-testid={`input-edit-task-end-${t.id}`}
              />
            </div>
            <div className="w-36">
              <Input
                value={editTActualStart}
                onChange={(e) => setEditTActualStart(e.target.value)}
                placeholder="Actual start"
                data-testid={`input-edit-task-actual-start-${t.id}`}
              />
            </div>
            <div className="w-36">
              <Input
                value={editTActualEnd}
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
            <div className="flex items-center gap-2 w-44">
              <span className="text-xs text-muted-foreground whitespace-nowrap">% Done</span>
              <Input
                type="number"
                min={0}
                max={100}
                value={editTPercent}
                onChange={(e) => setEditTPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-20"
                data-testid={`input-edit-task-percent-${t.id}`}
              />
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
            {editTItemType === "workstream" && tl.tasks.filter((pt) => pt.itemType === "phase" && pt.id !== t.id).length > 0 && (
              <div className="w-44">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Parent Phase</label>
                <select
                  value={editTParentId}
                  onChange={(e) => setEditTParentId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  data-testid={`select-edit-task-parent-phase-${t.id}`}
                >
                  <option value="">None</option>
                  {tl.tasks
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
              style={{ backgroundColor: t.color || tl.color }}
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
                  t.health === "amber" ? "bg-amber-500" : t.health === "red" ? "bg-red-500" : "bg-green-500"
                }`} title={taskHealthOptions.find((h) => h.value === t.health)?.label || t.health} />
                {t.itemType === "phase" && <Badge variant="outline" className="text-xs">{taskItemTypes.find((it) => it.value === "phase")?.label || "Phase"}</Badge>}
                {t.parentTaskId && (() => {
                  const parent = tl.tasks.find((pt) => pt.id === t.parentTaskId);
                  return parent ? <Badge variant="outline" className="text-xs text-muted-foreground">↳ {parent.title}</Badge> : null;
                })()}
              </div>
              <p className="text-xs text-muted-foreground">
                Planned: {t.startDate} — {t.endDate}
              </p>
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
                    backgroundColor: t.color || tl.color,
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
                    This will permanently remove "{t.title}" from this timeline.
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

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{timeline.title} | Timeline Studio</title>
        <meta name="description" content={timeline.description || `View the ${timeline.title} timeline with ${timeline.milestones.length} milestones.`} />
        <meta property="og:title" content={`${timeline.title} | Timeline Studio`} />
      </Helmet>
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => navigate("/")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: timeline.color }}
              />
              <h1 className="text-lg font-semibold" data-testid="text-timeline-title">
                {timeline.title}
              </h1>
              {!editing && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={startEditing}
                  data-testid="button-edit-title"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="icon"
              variant={viewMode === "vertical" ? "secondary" : "ghost"}
              onClick={() => setViewMode("vertical")}
              data-testid="button-view-vertical"
            >
              <AlignVerticalDistributeCenter className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant={viewMode === "horizontal" ? "secondary" : "ghost"}
              onClick={() => setViewMode("horizontal")}
              data-testid="button-view-horizontal"
            >
              <AlignHorizontalDistributeCenter className="w-4 h-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={filterMode === "milestones" ? "secondary" : "outline"}
                  data-testid="button-filter"
                >
                  <ListFilter className="w-4 h-4 mr-2" />
                  {filterMode === "all" ? "All" : "Milestones Only"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setFilterMode("all")} data-testid="filter-all">
                  <Calendar className="w-4 h-4 mr-2" />
                  All (Milestones + Tasks)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterMode("milestones")} data-testid="filter-milestones">
                  <ClipboardList className="w-4 h-4 mr-2" />
                  Milestones Only
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={exporting} data-testid="button-export">
                  <Download className="w-4 h-4 mr-2" />
                  {exporting ? "Exporting..." : "Export"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("png")} data-testid="button-export-png">
                  <Image className="w-4 h-4 mr-2" />
                  Download as PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")} data-testid="button-export-pdf">
                  <FileText className="w-4 h-4 mr-2" />
                  Download as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" data-testid="button-add-item">
                  <Plus className="w-4 h-4 mr-2" />
                  Add
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => { setShowAddForm(!showAddForm); setShowAddTaskForm(false); }}
                  data-testid="button-add-milestone"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Add Milestone
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => { setShowAddTaskForm(!showAddTaskForm); setShowAddForm(false); }}
                  data-testid="button-add-task"
                >
                  <ClipboardList className="w-4 h-4 mr-2" />
                  Add Task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {editing && (
          <Card className="p-5 mb-6 space-y-4">
            <div className="space-y-3">
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px] space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Title</label>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    data-testid="input-edit-title"
                  />
                </div>
                <div className="flex-1 min-w-[200px] space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Description</label>
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Optional description"
                    data-testid="input-edit-description"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Theme</label>
                <ThemePicker value={editColor} onChange={setEditColor} compact />
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="ghost"
                onClick={() => setEditing(false)}
                data-testid="button-cancel-edit"
              >
                Cancel
              </Button>
              <Button
                onClick={() => updateMutation.mutate()}
                disabled={!editTitle.trim() || updateMutation.isPending}
                data-testid="button-save-edit"
              >
                <Save className="w-4 h-4 mr-2" />
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </Card>
        )}

        {timeline.description && !editing && (
          <p className="text-sm text-muted-foreground mb-6">{timeline.description}</p>
        )}

        {showAddForm && (
          <Card className="p-4 mb-6">
            <h4 className="text-xs font-medium text-muted-foreground mb-3">New Milestone</h4>
            <div className="flex items-end gap-3 flex-wrap">
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Milestone title"
                  data-testid="input-new-milestone-title"
                />
              </div>
              <div className="w-36">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Planned Date</label>
                <Input
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  placeholder="e.g. Mar 2025"
                  data-testid="input-new-milestone-date"
                />
              </div>
              <div className="w-36">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Actual Date</label>
                <Input
                  value={newActualDate}
                  onChange={(e) => setNewActualDate(e.target.value)}
                  placeholder="Optional"
                  data-testid="input-new-milestone-actual-date"
                />
              </div>
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
                <Input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Optional"
                  data-testid="input-new-milestone-desc"
                />
              </div>
              <Button
                onClick={handleAddMilestone}
                disabled={!newTitle.trim() || !newDate.trim() || addMilestoneMutation.isPending}
                data-testid="button-submit-new-milestone"
              >
                {addMilestoneMutation.isPending ? "Adding..." : "Add"}
              </Button>
            </div>
          </Card>
        )}

        {showAddTaskForm && (
          <Card className="p-4 mb-6">
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
              <div className="w-36">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Planned Start</label>
                <Input
                  value={newTaskStart}
                  onChange={(e) => setNewTaskStart(e.target.value)}
                  placeholder="e.g. Jan 2025"
                  data-testid="input-new-task-start"
                />
              </div>
              <div className="w-36">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Planned End</label>
                <Input
                  value={newTaskEnd}
                  onChange={(e) => setNewTaskEnd(e.target.value)}
                  placeholder="e.g. Mar 2025"
                  data-testid="input-new-task-end"
                />
              </div>
              <div className="w-36">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Actual Start</label>
                <Input
                  value={newTaskActualStart}
                  onChange={(e) => setNewTaskActualStart(e.target.value)}
                  placeholder="Optional"
                  data-testid="input-new-task-actual-start"
                />
              </div>
              <div className="w-36">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Actual End</label>
                <Input
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
              {newTaskItemType === "workstream" && timeline.tasks.filter((t) => t.itemType === "phase").length > 0 && (
                <div className="w-44">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Parent Phase</label>
                  <select
                    value={newTaskParentId}
                    onChange={(e) => setNewTaskParentId(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    data-testid="select-new-task-parent-phase"
                  >
                    <option value="">None</option>
                    {timeline.tasks
                      .filter((t) => t.itemType === "phase")
                      .map((p) => (
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
        )}

        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">
            {timeline.milestones.length} milestone{timeline.milestones.length !== 1 ? "s" : ""}
          </Badge>
          <Badge variant="secondary">
            {timeline.tasks.length} task{timeline.tasks.length !== 1 ? "s" : ""}
          </Badge>
          {filterMode === "milestones" && (
            <Badge variant="outline">
              Showing milestones only
            </Badge>
          )}
        </div>

        <div ref={timelineRef} data-export-timeline className="bg-background rounded-md">
          {viewMode === "vertical" ? (
            <TimelineView
              milestones={timeline.milestones}
              tasks={timeline.tasks}
              timelineColor={timeline.color}
              showTasks={showTasks}
            />
          ) : (
            <TimelineViewHorizontal
              milestones={timeline.milestones}
              tasks={timeline.tasks}
              timelineColor={timeline.color}
              showTasks={showTasks}
            />
          )}
        </div>

        <Tabs defaultValue="milestones" className="mt-8" data-testid="manage-tabs">
          <TabsList className="mb-4">
            <TabsTrigger value="milestones" data-testid="tab-milestones">
              Milestones ({timeline.milestones.length})
            </TabsTrigger>
            <TabsTrigger value="phases" data-testid="tab-phases">
              Phases ({timeline.tasks.filter((t) => t.itemType === "phase").length})
            </TabsTrigger>
            <TabsTrigger value="workstreams" data-testid="tab-workstreams">
              Workstreams ({timeline.tasks.filter((t) => t.itemType === "workstream").length})
            </TabsTrigger>
            {settings?.riskRegisterEnabled && (
              <TabsTrigger value="risks" data-testid="tab-risks">
                Risks
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="milestones">
            <div className="space-y-2">
              {timeline.milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No milestones yet. Click "Add" to create one.</p>
              ) : (
                [...timeline.milestones]
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((m) => (
                    <Card
                      key={m.id}
                      className="p-3"
                      data-testid={`manage-milestone-${m.id}`}
                    >
                      {editingMilestoneId === m.id ? (
                        <div className="space-y-2">
                          <div className="flex gap-2 flex-wrap">
                            <div className="flex-1 min-w-[140px]">
                              <Input
                                value={editMTitle}
                                onChange={(e) => setEditMTitle(e.target.value)}
                                placeholder="Title"
                                data-testid={`input-edit-milestone-title-${m.id}`}
                              />
                            </div>
                            <div className="w-36">
                              <Input
                                value={editMDate}
                                onChange={(e) => setEditMDate(e.target.value)}
                                placeholder="Planned date"
                                data-testid={`input-edit-milestone-date-${m.id}`}
                              />
                            </div>
                            <div className="w-36">
                              <Input
                                value={editMActualDate}
                                onChange={(e) => setEditMActualDate(e.target.value)}
                                placeholder="Actual date"
                                data-testid={`input-edit-milestone-actual-date-${m.id}`}
                              />
                            </div>
                          </div>
                          <Input
                            value={editMDesc}
                            onChange={(e) => setEditMDesc(e.target.value)}
                            placeholder="Description (optional)"
                            data-testid={`input-edit-milestone-desc-${m.id}`}
                          />
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={cancelMilestoneEdit}
                              data-testid={`button-cancel-edit-milestone-${m.id}`}
                            >
                              <X className="w-3.5 h-3.5 mr-1" />
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={saveMilestoneEdit}
                              disabled={!editMTitle.trim() || !editMDate.trim() || updateMilestoneMutation.isPending}
                              data-testid={`button-save-edit-milestone-${m.id}`}
                            >
                              <Check className="w-3.5 h-3.5 mr-1" />
                              {updateMilestoneMutation.isPending ? "Saving..." : "Save"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: m.color || timeline.color }}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate" data-testid={`text-milestone-title-${m.id}`}>{m.title}</p>
                              <p className="text-xs text-muted-foreground">
                                Planned: {m.date}
                                {m.actualDate && <span className="ml-2">Actual: {m.actualDate}</span>}
                              </p>
                              {m.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-md">{m.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => startEditingMilestone(m)}
                              data-testid={`button-edit-milestone-${m.id}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  data-testid={`button-delete-milestone-${m.id}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete milestone?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently remove "{m.title}" from this timeline.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteMilestoneMutation.mutate(m.id)}
                                    data-testid={`button-confirm-delete-milestone-${m.id}`}
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
                  ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="phases">
            <div className="space-y-2">
              {timeline.tasks.filter((t) => t.itemType === "phase").length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No phases yet. Click "Add" &rarr; "Add Task" and set type to Phase.</p>
              ) : (
                [...timeline.tasks]
                  .filter((t) => t.itemType === "phase")
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((t) => renderTaskCard(t, timeline))
              )}
            </div>
          </TabsContent>

          <TabsContent value="workstreams">
            <div className="space-y-2">
              {timeline.tasks.filter((t) => t.itemType === "workstream").length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No workstreams yet. Click "Add" &rarr; "Add Task" to create one.</p>
              ) : (
                [...timeline.tasks]
                  .filter((t) => t.itemType === "workstream")
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map((t) => renderTaskCard(t, timeline))
              )}
            </div>
          </TabsContent>

          {settings?.riskRegisterEnabled && (
            <TabsContent value="risks">
              <RiskRegister timelineId={timeline.id} />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
