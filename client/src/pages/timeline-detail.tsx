import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import {
  ArrowLeft,
  Edit3,
  Plus,
  Download,
  Image,
  FileText,
  ListFilter,
  Calendar,
  ClipboardList,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppTitle } from "@/hooks/use-app-title";
import { TimelineView } from "@/components/timeline-view";
import { RaidLog } from "@/features/projects/raid-log";
import { GovernanceTab } from "@/features/governance/governance-tab";
import type { TimelineWithMilestones, AppSettings, Client, AllocationWithTeamMember, FlightpathStage, OperatingModel } from "@shared/schema";
import { getDefaultFieldOptions } from "@shared/schema";
import { ProjectTimesheetsTab } from "@/features/projects/timesheets-tab";
import { ProgressTrackingTab } from "@/features/projects/progress-tracking-tab";
import { EVMTab } from "@/features/projects/evm-tab";
import { ProjectTeamMembersTab } from "@/features/projects/team-members-tab";
import { ProjectKPI } from "@/features/projects/project-kpi";
import { ProjectEditForm } from "@/features/projects/project-edit-form";
import { MilestoneManager } from "@/features/projects/milestone-manager";
import { TaskManager } from "@/features/projects/task-manager";
import { useTimelineExport } from "@/features/projects/use-timeline-export";
import { BusinessOutcomesTab } from "@/features/business-outcomes/business-outcomes-tab";

type FilterMode = "all" | "milestones";

export default function TimelineDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const appTitleOnly = useAppTitle();
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showAddTaskForm, setShowAddTaskForm] = useState(false);
  const timelineRef = useRef<HTMLDivElement>(null);

  const { t } = useTranslation();

  const { data: myModules } = useQuery<{ modules: string[] }>({
    queryKey: ["/api/rbac/my-modules"],
  });
  const canViewOutcomes = myModules?.modules?.includes("module.business_outcomes") ?? false;

  const { data: timeline, isLoading } = useQuery<TimelineWithMilestones>({
    queryKey: ["/api/timelines", id],
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const taskStatuses = settings?.taskStatuses || getDefaultFieldOptions("taskStatuses", settings?.locale || "en");
  const taskHealthOptions = settings?.taskHealthOptions || getDefaultFieldOptions("taskHealthOptions", settings?.locale || "en");
  const taskItemTypes = settings?.taskItemTypes || getDefaultFieldOptions("taskItemTypes", settings?.locale || "en");
  const projectTypes = settings?.projectTypes || getDefaultFieldOptions("projectTypes", settings?.locale || "en");
  const engagementModels = settings?.engagementModels || getDefaultFieldOptions("engagementModels", settings?.locale || "en");
  const projectStatuses = settings?.projectStatuses || getDefaultFieldOptions("projectStatuses", settings?.locale || "en");
  const regionOptions = settings?.regions || getDefaultFieldOptions("regions", settings?.locale || "en");

  const { data: clientsList } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: governanceStages = [] } = useQuery<FlightpathStage[]>({
    queryKey: ["/api/governance-model/stages"],
  });

  const { data: operatingModelsList = [] } = useQuery<OperatingModel[]>({
    queryKey: ["/api/operating-models"],
  });

  const { data: projectAllocs = [] } = useQuery<AllocationWithTeamMember[]>({
    queryKey: ["/api/timelines", id, "allocations"],
    queryFn: async () => {
      const res = await fetch(`/api/timelines/${id}/allocations`);
      if (!res.ok) throw new Error("Failed to fetch allocations");
      return res.json();
    },
    enabled: !!id,
  });
  const uniqueTeamMemberCount = new Set(projectAllocs.map(a => a.teamMemberId)).size;

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
      toast({ title: "Project updated" });
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

  const { handleExport, exporting } = useTimelineExport(timeline, timelineRef, toast);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="w-9 h-9 rounded-md" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-20 rounded-md" />
          <Skeleton className="h-20 rounded-md" />
          <Skeleton className="h-20 rounded-md" />
          <Skeleton className="h-20 rounded-md" />
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
    );
  }

  if (!timeline) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Project not found.</p>
        <Button variant="ghost" className="mt-2" onClick={() => navigate("/projects")}>
          Back to Projects
        </Button>
      </div>
    );
  }

  const showTasks = filterMode === "all";
  const projectStatus = projectStatuses.find(s => s.value === (timeline.projectStatus || "not_started"));
  const statusColor = timeline.projectStatus === "in_progress" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" :
    timeline.projectStatus === "complete" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
    timeline.projectStatus === "on_hold" ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" :
    "";

  const projectDateFormat = timeline.dateFormat || "";

  return (
    <>
      <Helmet>
        <title>{`${timeline.title} | ${appTitleOnly}`}</title>
        <meta name="description" content={timeline.description || `View the ${timeline.title} project with ${timeline.milestones.length} milestones.`} />
        <meta property="og:title" content={`${timeline.title} | ${appTitleOnly}`} />
      </Helmet>
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        <div className="flex items-start gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/projects")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            {!editing && (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: timeline.color }}
                  />
                  <h1 className="text-2xl font-bold truncate" data-testid="text-timeline-title">
                    {timeline.title}
                  </h1>
                  <Badge className={`${statusColor} border-0`} data-testid="badge-project-status">
                    {projectStatus?.label || "Not Started"}
                  </Badge>
                  {timeline.sourceOpportunityId && (
                    <Link href={`/opportunities/${timeline.sourceOpportunityId}`}>
                      <Badge variant="outline" className="gap-1 text-xs cursor-pointer hover:bg-muted" data-testid="badge-source-opportunity">
                        From Opportunity
                      </Badge>
                    </Link>
                  )}
                  {(() => {
                    const sorted = [...governanceStages].sort((a, b) => a.stageNumber - b.stageNumber);
                    const current = sorted.find(s => s.id === timeline.flightpathStageId);
                    const model = operatingModelsList.find(m => m.id === timeline.operatingModelId);
                    if (current) {
                      return (
                        <Badge variant="outline" className="gap-1 text-xs" data-testid="badge-governance-stage">
                          <ShieldCheck className="w-3 h-3" />
                          {model ? `${model.name} · ` : ""}Stage {current.stageNumber}: {current.name}
                        </Badge>
                      );
                    }
                    if (model) {
                      return (
                        <Badge variant="outline" className="gap-1 text-xs" data-testid="badge-governance-stage">
                          <ShieldCheck className="w-3 h-3" />
                          {model.name}
                        </Badge>
                      );
                    }
                    return null;
                  })()}
                </div>
                {timeline.description && <p className="text-sm text-muted-foreground mt-1" data-testid="text-project-description">{timeline.description}</p>}
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                  {(() => {
                    const client = (clientsList || []).find(c => c.id === timeline.clientId);
                    return client ? <span data-testid="text-project-client">{client.name}</span> : null;
                  })()}
                  {timeline.region && <span data-testid="text-project-region">{timeline.region}</span>}
                  {timeline.projectType && <span>{projectTypes.find(p => p.value === timeline.projectType)?.label || timeline.projectType}</span>}
                  {timeline.engagementModel && <span>{engagementModels.find(e => e.value === timeline.engagementModel)?.label || timeline.engagementModel}</span>}
                  {timeline.dateFormat && <span data-testid="badge-date-format">{timeline.dateFormat}</span>}
                  {timeline.startDate && <span>Start: {timeline.startDate}</span>}
                  {timeline.endDate && <span>End: {timeline.endDate}</span>}
                </div>
              </>
            )}
          </div>
          {!editing && (
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <Button variant="outline" size="sm" onClick={startEditing} data-testid="button-edit-title">
                <Edit3 className="w-4 h-4 mr-1" /> Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={filterMode === "milestones" ? "secondary" : "outline"}
                    size="sm"
                    data-testid="button-filter"
                  >
                    <ListFilter className="w-4 h-4 mr-1" />
                    {filterMode === "all" ? "All" : "Milestones"}
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
                  <Button variant="outline" size="sm" disabled={exporting} data-testid="button-export">
                    <Download className="w-4 h-4 mr-1" />
                    {exporting ? "..." : "Export"}
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
                  <Button variant="outline" size="sm" data-testid="button-add-item">
                    <Plus className="w-4 h-4 mr-1" />
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
          )}
        </div>

        {!editing && (
          <ProjectKPI
            timeline={timeline}
            taskHealthOptions={taskHealthOptions}
            id={id!}
            uniqueTeamMemberCount={uniqueTeamMemberCount}
          />
        )}

        <div className="space-y-6">
        {editing && (
          <ProjectEditForm
            timeline={timeline}
            id={id!}
            projectTypes={projectTypes}
            engagementModels={engagementModels}
            projectStatuses={projectStatuses}
            regionOptions={regionOptions}
            clientsList={clientsList}
            taskHealthOptions={taskHealthOptions}
            editTitle={editTitle}
            editDescription={editDescription}
            editColor={editColor}
            setEditTitle={setEditTitle}
            setEditDescription={setEditDescription}
            setEditColor={setEditColor}
            onSave={() => updateMutation.mutate()}
            onCancel={() => setEditing(false)}
            isSaving={updateMutation.isPending}
          />
        )}

        <MilestoneManager
          timelineId={timeline.id}
          milestones={timeline.milestones}
          timelineColor={timeline.color}
          projectDateFormat={projectDateFormat}
          showAddForm={showAddForm}
          setShowAddForm={setShowAddForm}
          view="add"
        />

        <TaskManager
          timelineId={timeline.id}
          tasks={timeline.tasks}
          timelineColor={timeline.color}
          projectDateFormat={projectDateFormat}
          taskStatuses={taskStatuses}
          taskHealthOptions={taskHealthOptions}
          taskItemTypes={taskItemTypes}
          showAddForm={showAddTaskForm}
          setShowAddForm={setShowAddTaskForm}
          view="add"
        />

        <div className="flex items-center gap-2 flex-wrap">
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
          <TimelineView
            milestones={timeline.milestones}
            tasks={timeline.tasks}
            timelineColor={timeline.color}
            showTasks={showTasks}
          />
        </div>

        <Tabs defaultValue="milestones" data-testid="manage-tabs">
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
            <TabsTrigger value="team-members" data-testid="tab-team-members">
              Team Members ({uniqueTeamMemberCount})
            </TabsTrigger>
            <TabsTrigger value="timesheets" data-testid="tab-timesheets">
              Timesheets
            </TabsTrigger>
            <TabsTrigger value="progress" data-testid="tab-progress">
              Progress
            </TabsTrigger>
            <TabsTrigger value="evm" data-testid="tab-evm">
              EVM
            </TabsTrigger>
            <TabsTrigger value="governance" data-testid="tab-governance">
              Governance
            </TabsTrigger>
            <TabsTrigger value="raid-log" data-testid="tab-raid-log">
              RAID Log
            </TabsTrigger>
            {canViewOutcomes && (
              <TabsTrigger value="business-outcomes" data-testid="tab-business-outcomes">
                {t("businessOutcomes.title")}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="milestones">
            <MilestoneManager
              timelineId={timeline.id}
              milestones={timeline.milestones}
              timelineColor={timeline.color}
              projectDateFormat={projectDateFormat}
              showAddForm={showAddForm}
              setShowAddForm={setShowAddForm}
              view="list"
            />
          </TabsContent>

          <TabsContent value="phases">
            <TaskManager
              timelineId={timeline.id}
              tasks={timeline.tasks}
              timelineColor={timeline.color}
              projectDateFormat={projectDateFormat}
              taskStatuses={taskStatuses}
              taskHealthOptions={taskHealthOptions}
              taskItemTypes={taskItemTypes}
              showAddForm={showAddTaskForm}
              setShowAddForm={setShowAddTaskForm}
              view="phases"
            />
          </TabsContent>

          <TabsContent value="workstreams">
            <TaskManager
              timelineId={timeline.id}
              tasks={timeline.tasks}
              timelineColor={timeline.color}
              projectDateFormat={projectDateFormat}
              taskStatuses={taskStatuses}
              taskHealthOptions={taskHealthOptions}
              taskItemTypes={taskItemTypes}
              showAddForm={showAddTaskForm}
              setShowAddForm={setShowAddTaskForm}
              view="workstreams"
            />
          </TabsContent>

          <TabsContent value="team-members">
            <ProjectTeamMembersTab timelineId={timeline.id} />
          </TabsContent>

          <TabsContent value="timesheets">
            <ProjectTimesheetsTab
              timelineId={timeline.id}
              tasks={timeline.tasks}
            />
          </TabsContent>

          <TabsContent value="progress">
            <ProgressTrackingTab
              timelineId={timeline.id}
              tasks={timeline.tasks}
              approvedBudget={timeline.approvedBudget}
            />
          </TabsContent>

          <TabsContent value="evm">
            <EVMTab
              timelineId={timeline.id}
              tasks={timeline.tasks}
              approvedBudget={timeline.approvedBudget}
            />
          </TabsContent>

          <TabsContent value="governance">
            <GovernanceTab
              timelineId={timeline.id}
              currentStageId={timeline.flightpathStageId || null}
              onStageChange={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/timelines", timeline.id] });
              }}
            />
          </TabsContent>

          <TabsContent value="raid-log">
            <RaidLog timelineId={timeline.id} />
          </TabsContent>

          {canViewOutcomes && (
            <TabsContent value="business-outcomes">
              <BusinessOutcomesTab timelineId={timeline.id} linkField="projectId" />
            </TabsContent>
          )}

        </Tabs>
        </div>
      </div>
    </>
  );
}
