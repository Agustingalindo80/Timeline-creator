import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import {
  ArrowLeft,
  Edit3,
  Plus,
  Trash2,
  Download,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { TimelineView, TimelineViewHorizontal } from "@/components/timeline-view";
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

  const { data: timeline, isLoading } = useQuery<TimelineWithMilestones>({
    queryKey: ["/api/timelines", id],
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/timelines/${id}`, {
        title: editTitle,
        description: editDescription || null,
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
      setEditing(true);
    }
  };

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newDesc, setNewDesc] = useState("");

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
            {editing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-52"
                  data-testid="input-edit-title"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                  data-testid="button-save-edit"
                >
                  <Save className="w-4 h-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditing(false)}
                  data-testid="button-cancel-edit"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: timeline.color }}
                />
                <h1 className="text-lg font-semibold" data-testid="text-timeline-title">
                  {timeline.title}
                </h1>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={startEditing}
                  data-testid="button-edit-title"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
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

        {viewMode === "vertical" ? (
          <TimelineView milestones={timeline.milestones} timelineColor={timeline.color} />
        ) : (
          <TimelineViewHorizontal milestones={timeline.milestones} timelineColor={timeline.color} />
        )}

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
                  className="p-3 flex items-center justify-between gap-3"
                  data-testid={`manage-milestone-${m.id}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: m.color || timeline.color }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.title}</p>
                      <p className="text-xs text-muted-foreground">{m.date}</p>
                    </div>
                  </div>
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
                </Card>
              ))}
          </div>
        )}
      </main>
    </div>
  );
}
