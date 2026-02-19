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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import type { TimelineWithMilestones } from "@shared/schema";

type ViewMode = "vertical" | "horizontal";

export default function TimelineDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("vertical");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState("");
  const timelineRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const { data: timeline, isLoading } = useQuery<TimelineWithMilestones>({
    queryKey: ["/api/timelines", id],
  });

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
    mutationFn: async (data: { title: string; date: string; description?: string }) => {
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
    mutationFn: async ({ milestoneId, data }: { milestoneId: string; data: { title?: string; date?: string; description?: string | null } }) => {
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
  const [newDesc, setNewDesc] = useState("");

  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [editMTitle, setEditMTitle] = useState("");
  const [editMDate, setEditMDate] = useState("");
  const [editMDesc, setEditMDesc] = useState("");

  const startEditingMilestone = (m: { id: string; title: string; date: string; description: string | null }) => {
    setEditingMilestoneId(m.id);
    setEditMTitle(m.title);
    setEditMDate(m.date);
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

  const handleAddMilestone = () => {
    if (!newTitle.trim() || !newDate.trim()) return;
    addMilestoneMutation.mutate(
      { title: newTitle, date: newDate, description: newDesc || undefined },
      {
        onSuccess: () => {
          setNewTitle("");
          setNewDate("");
          setNewDesc("");
          setShowAddForm(false);
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

        const sourceEls = source.querySelectorAll<HTMLElement>("*");
        const computedStyles: {
          color: string;
          bg: string;
          borderColor: string;
          boxShadow: string;
        }[] = [];
        sourceEls.forEach((el) => {
          const cs = getComputedStyle(el);
          computedStyles.push({
            color: cs.color,
            bg: cs.backgroundColor,
            borderColor: cs.borderColor,
            boxShadow: cs.boxShadow,
          });
        });
        const rootCs = getComputedStyle(source);
        const rootColor = rootCs.color;
        const rootBg = rootCs.backgroundColor;

        const clone = source.cloneNode(true) as HTMLElement;

        clone.style.position = "absolute";
        clone.style.left = "-9999px";
        clone.style.top = "0";
        clone.style.overflow = "visible";
        clone.style.padding = "32px";
        clone.style.width = source.scrollWidth + 64 + "px";
        clone.style.backgroundColor = "#ffffff";
        clone.style.color = rootColor;

        const cloneEls = clone.querySelectorAll<HTMLElement>("*");
        cloneEls.forEach((child, i) => {
          const styles = computedStyles[i];
          if (styles) {
            child.style.color = styles.color;
            if (styles.bg && styles.bg !== "rgba(0, 0, 0, 0)") {
              child.style.backgroundColor = styles.bg;
            }
            if (styles.borderColor) {
              child.style.borderColor = styles.borderColor;
            }
            if (styles.boxShadow && styles.boxShadow !== "none") {
              child.style.boxShadow = styles.boxShadow;
            }
          }
          child.style.overflow = "visible";
        });

        document.body.appendChild(clone);

        await new Promise((r) => setTimeout(r, 50));

        const canvas = await html2canvas(clone, {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          logging: false,
          scrollX: 0,
          scrollY: 0,
          width: clone.scrollWidth,
          height: clone.scrollHeight,
          windowWidth: clone.scrollWidth + 200,
          windowHeight: clone.scrollHeight + 200,
        });

        document.body.removeChild(clone);

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
          <div className="flex items-center gap-2">
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
            <Button
              variant="outline"
              onClick={() => setShowAddForm(!showAddForm)}
              data-testid="button-toggle-add"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Milestone
            </Button>
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
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Date</label>
                <Input
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  placeholder="e.g. Mar 2025"
                  data-testid="input-new-milestone-date"
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

        <div className="mb-4 flex items-center justify-between gap-2">
          <Badge variant="secondary">
            {timeline.milestones.length} milestone{timeline.milestones.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Timeline visualization - wrapped in ref for export */}
        <div ref={timelineRef} className="bg-background rounded-md">
          {viewMode === "vertical" ? (
            <TimelineView milestones={timeline.milestones} timelineColor={timeline.color} />
          ) : (
            <TimelineViewHorizontal milestones={timeline.milestones} timelineColor={timeline.color} />
          )}
        </div>

        {/* Milestone management list */}
        {timeline.milestones.length > 0 && (
          <div className="mt-8 space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Manage Milestones
            </h3>
            {[...timeline.milestones]
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
                            placeholder="Date"
                            data-testid={`input-edit-milestone-date-${m.id}`}
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
                          <p className="text-xs text-muted-foreground">{m.date}</p>
                          {m.description && (
                            <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{m.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => startEditingMilestone(m)}
                          data-testid={`button-edit-milestone-${m.id}`}
                        >
                          <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              data-testid={`button-delete-milestone-${m.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete milestone?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove "{m.title}" from the timeline.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMilestoneMutation.mutate(m.id)}
                                data-testid="button-confirm-delete-milestone"
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
              ))}
          </div>
        )}
      </main>
    </div>
  );
}
