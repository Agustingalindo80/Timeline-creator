import { useState, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Upload,
  GripVertical,
  FileSpreadsheet,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { TimelineView } from "@/components/timeline-view";
import { ThemePicker } from "@/components/theme-picker";
import { formatDateForProject } from "@/lib/date-format";
import type { Milestone, AppSettings } from "@shared/schema";
import { DEFAULT_DATE_FORMATS } from "@shared/schema";

interface MilestoneForm {
  tempId: string;
  title: string;
  description: string;
  date: string;
  color: string;
}

export default function CreateTimeline() {
  const [, navigate] = useLocation();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const initialMode = params.get("mode") === "upload" ? "upload" : "manual";
  const { toast } = useToast();

  const { data: settings } = useQuery<AppSettings>({ queryKey: ["/api/settings"] });
  const dateFormats = settings?.dateFormats || DEFAULT_DATE_FORMATS;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#2563eb");
  const [dateFormat, setDateFormat] = useState("");
  const [milestones, setMilestones] = useState<MilestoneForm[]>([]);
  const [activeTab, setActiveTab] = useState(initialMode);
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const addMilestone = () => {
    setMilestones((prev) => [
      ...prev,
      {
        tempId: crypto.randomUUID(),
        title: "",
        description: "",
        date: "",
        color: "",
      },
    ]);
  };

  const updateMilestone = (tempId: string, field: keyof MilestoneForm, value: string) => {
    setMilestones((prev) =>
      prev.map((m) => (m.tempId === tempId ? { ...m, [field]: value } : m))
    );
  };

  const removeMilestone = (tempId: string) => {
    setMilestones((prev) => prev.filter((m) => m.tempId !== tempId));
  };

  const moveMilestone = (index: number, direction: "up" | "down") => {
    setMilestones((prev) => {
      const next = [...prev];
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= next.length) return prev;
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
  };

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!file) return;
      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv",
      ];
      if (!validTypes.includes(file.type) && !file.name.endsWith(".csv") && !file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
        toast({
          title: "Invalid file type",
          description: "Please upload an Excel (.xlsx, .xls) or CSV file.",
          variant: "destructive",
        });
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/parse-excel", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new Error(errText || "Failed to parse file");
        }
        const data = await res.json();
        if (data.milestones && data.milestones.length > 0) {
          setMilestones(
            data.milestones.map((m: any, i: number) => ({
              tempId: crypto.randomUUID(),
              title: m.title || "",
              description: m.description || "",
              date: m.date || "",
              color: "",
            }))
          );
          if (data.title) setTitle(data.title);
          toast({
            title: "File imported",
            description: `${data.milestones.length} milestones loaded from spreadsheet.`,
          });
          setActiveTab("manual");
        } else {
          toast({
            title: "No data found",
            description: "Could not find milestones in the spreadsheet. Ensure columns include Title and Date.",
            variant: "destructive",
          });
        }
      } catch (err: any) {
        toast({
          title: "Import failed",
          description: err.message || "Failed to parse the uploaded file.",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    },
    [toast]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setUploadDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/timelines", {
        title,
        description: description || null,
        color,
        dateFormat,
        milestones: milestones.map((m, i) => ({
          title: m.title,
          description: m.description || null,
          date: dateFormat ? formatDateForProject(m.date, dateFormat) : m.date,
          color: m.color || null,
          sortOrder: i,
        })),
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
      toast({ title: "Project created" });
      navigate(`/timeline/${data.id}`);
    },
    onError: (err: any) => {
      toast({
        title: "Error creating project",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const canSubmit =
    title.trim().length > 0 &&
    dateFormat.length > 0 &&
    milestones.length > 0 &&
    milestones.every((m) => m.title.trim() && m.date.trim());

  const previewMilestones: Milestone[] = milestones
    .filter((m) => m.title.trim() && m.date.trim())
    .map((m, i) => ({
      id: m.tempId,
      timelineId: "",
      title: m.title,
      description: m.description || null,
      date: dateFormat ? formatDateForProject(m.date, dateFormat) : m.date,
      actualDate: null,
      color: m.color || null,
      icon: null,
      sortOrder: i,
      isFinancialObligation: false,
      amount: null,
    }));

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Create Project | Project High Level Planning</title>
        <meta name="description" content="Create a new project by adding milestones manually or importing from an Excel spreadsheet." />
      </Helmet>
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => navigate("/projects")}
              data-testid="button-back-home"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-lg font-semibold">Create Project</h1>
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            data-testid="button-save-timeline"
          >
            {createMutation.isPending ? "Saving..." : "Save Project"}
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Left: Form */}
          <div className="lg:col-span-3 space-y-6">
            {/* Timeline info */}
            <Card className="p-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Project Title</Label>
                <Input
                  id="title"
                  placeholder="e.g. Product Launch Roadmap"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  data-testid="input-title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of this project..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="resize-none"
                  rows={2}
                  data-testid="input-description"
                />
              </div>
              <div className="space-y-2">
                <Label>Theme</Label>
                <ThemePicker value={color} onChange={setColor} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateFormat">Date Format *</Label>
                <select
                  id="dateFormat"
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={dateFormat}
                  onChange={(e) => setDateFormat(e.target.value)}
                  data-testid="select-date-format"
                >
                  <option value="">Select date format...</option>
                  {dateFormats.map((df) => (
                    <option key={df.value} value={df.value}>{df.label}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  This format will be used for all dates in this project and cannot be changed later.
                </p>
              </div>
            </Card>

            {/* Milestones input */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="manual" className="flex-1" data-testid="tab-manual">
                  <Pencil className="w-3.5 h-3.5 mr-1.5" />
                  Manual Entry
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex-1" data-testid="tab-upload">
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
                  Excel Import
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="mt-4">
                <div
                  className={`border-2 border-dashed rounded-md p-10 text-center transition-colors ${
                    uploadDragOver
                      ? "border-primary bg-primary/5"
                      : "border-border"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setUploadDragOver(true);
                  }}
                  onDragLeave={() => setUploadDragOver(false)}
                  onDrop={handleDrop}
                  data-testid="dropzone"
                >
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm font-medium mb-1">
                    {uploading ? "Processing file..." : "Drag & drop your spreadsheet here"}
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Supports .xlsx, .xls, and .csv files
                  </p>
                  <label>
                    <input
                      type="file"
                      className="hidden"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                      data-testid="input-file-upload"
                    />
                    <Button variant="outline" asChild disabled={uploading}>
                      <span>Browse Files</span>
                    </Button>
                  </label>
                  <div className="mt-6 border-t pt-4">
                    <p className="text-xs text-muted-foreground">
                      Expected columns: <strong>Title</strong>, <strong>Date</strong>, and optionally <strong>Description</strong>
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="manual" className="mt-4 space-y-3">
                {milestones.length === 0 ? (
                  <div className="border border-dashed rounded-md p-8 text-center">
                    <p className="text-sm text-muted-foreground mb-3">
                      No milestones added yet. Start by adding your first milestone.
                    </p>
                    <Button variant="outline" onClick={addMilestone} data-testid="button-add-first-milestone">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Milestone
                    </Button>
                  </div>
                ) : (
                  <>
                    {milestones.map((m, index) => (
                      <Card key={m.tempId} className="p-4" data-testid={`card-milestone-form-${index}`}>
                        <div className="flex items-start gap-3">
                          <div className="flex flex-col gap-1 pt-1">
                            <button
                              onClick={() => moveMilestone(index, "up")}
                              disabled={index === 0}
                              className="text-muted-foreground disabled:opacity-30"
                              data-testid={`button-move-up-${index}`}
                            >
                              <GripVertical className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex-1 space-y-3">
                            <div className="flex gap-3">
                              <div className="flex-1">
                                <Input
                                  placeholder="Milestone title"
                                  value={m.title}
                                  onChange={(e) =>
                                    updateMilestone(m.tempId, "title", e.target.value)
                                  }
                                  data-testid={`input-milestone-title-${index}`}
                                />
                              </div>
                              <div className="w-40">
                                <Input
                                  type="date"
                                  value={m.date}
                                  onChange={(e) =>
                                    updateMilestone(m.tempId, "date", e.target.value)
                                  }
                                  data-testid={`input-milestone-date-${index}`}
                                />
                              </div>
                            </div>
                            <Input
                              placeholder="Description (optional)"
                              value={m.description}
                              onChange={(e) =>
                                updateMilestone(m.tempId, "description", e.target.value)
                              }
                              data-testid={`input-milestone-desc-${index}`}
                            />
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeMilestone(m.tempId)}
                            data-testid={`button-remove-milestone-${index}`}
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                    <Button variant="outline" onClick={addMilestone} className="w-full" data-testid="button-add-milestone">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Milestone
                    </Button>
                  </>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Right: Live Preview */}
          <div className="lg:col-span-2">
            <div className="sticky top-20">
              <h2 className="text-sm font-medium text-muted-foreground mb-3">Live Preview</h2>
              <Card className="p-4 min-h-[300px]">
                {previewMilestones.length > 0 ? (
                  <TimelineView
                    milestones={previewMilestones}
                    tasks={[]}
                    timelineColor={color}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add milestones to see a preview
                    </p>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
