import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, Link } from "wouter";
import { Helmet } from "react-helmet-async";
import {
  ArrowLeft,
  Edit3,
  Save,
  X,
  Target,
  ShieldCheck,
  Users,
  AlertTriangle,
  ArrowRightCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppTitle } from "@/hooks/use-app-title";
import { EstimateTab } from "@/components/estimate-tab";
import { GovernanceTab } from "@/components/governance-tab";
import { RaidLog } from "@/components/raid-log";
import type { TimelineWithMilestones, Client, AppSettings, FlightpathStage, ProjectGate } from "@shared/schema";
import { DEFAULT_REGIONS, DEFAULT_ENGAGEMENT_MODELS, DEFAULT_PROJECT_TYPES } from "@shared/schema";

const OPP_STATUS_OPTIONS = [
  { value: "qualifying", label: "Qualifying", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "estimating", label: "Estimating", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { value: "proposed", label: "Proposed", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "won", label: "Won", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "lost", label: "Lost", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const appTitle = useAppTitle("Opportunity");
  const [editing, setEditing] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const [editSalesforceClouds, setEditSalesforceClouds] = useState("");
  const [editCurrency, setEditCurrency] = useState("USD");
  const [editEngagement, setEditEngagement] = useState("");
  const [editProjectType, setEditProjectType] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");

  const { data: opp, isLoading } = useQuery<TimelineWithMilestones>({
    queryKey: ["/api/opportunities", id],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: stages = [] } = useQuery<FlightpathStage[]>({
    queryKey: ["/api/flightpath-stages"],
  });

  const { data: gates = [] } = useQuery<ProjectGate[]>({
    queryKey: ["/api/timelines", id, "gates"],
    enabled: !!id,
  });

  const { data: projects = [] } = useQuery<TimelineWithMilestones[]>({
    queryKey: ["/api/timelines"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/opportunities/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities", id] });
      setEditing(false);
      toast({ title: "Opportunity updated" });
    },
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/opportunities/${id}/convert`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/timelines"] });
      toast({ title: "Project created successfully", description: `${data.summary.tasksCreated} tasks, ${data.summary.teamMembersCopied} team members copied` });
      navigate(`/timeline/${data.project.id}`);
    },
    onError: (err: Error) => {
      toast({ title: "Conversion failed", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!opp) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Opportunity not found.</p>
        <Link href="/opportunities">
          <Button variant="link" className="mt-2">Back to Opportunities</Button>
        </Link>
      </div>
    );
  }

  const startEditing = () => {
    setEditTitle(opp.title);
    setEditDescription(opp.description || "");
    setEditRegion(opp.region || "");
    setEditClientId(opp.clientId || "");
    setEditSalesforceClouds(opp.salesforceClouds || "");
    setEditCurrency(opp.currency || "USD");
    setEditEngagement(opp.engagementModel || "");
    setEditProjectType(opp.projectType || "");
    setEditStatus(opp.opportunityStatus || "qualifying");
    setEditStartDate(opp.startDate || "");
    setEditEndDate(opp.endDate || "");
    setEditing(true);
  };

  const saveEdits = () => {
    updateMutation.mutate({
      title: editTitle,
      description: editDescription || null,
      region: editRegion || null,
      clientId: editClientId || null,
      salesforceClouds: editSalesforceClouds || null,
      currency: editCurrency || "USD",
      engagementModel: editEngagement || null,
      projectType: editProjectType || null,
      opportunityStatus: editStatus,
      startDate: editStartDate || null,
      endDate: editEndDate || null,
    });
  };

  const statusOption = OPP_STATUS_OPTIONS.find(s => s.value === opp.opportunityStatus) || OPP_STATUS_OPTIONS[0];
  const stage0 = stages.find(s => s.stageNumber === 0);
  const stage0Gate = stage0 ? gates.find(g => g.stageId === stage0.id) : null;
  const canConvert = stage0Gate && (stage0Gate.status === "passed" || stage0Gate.status === "exception");
  const isWon = opp.opportunityStatus === "won";
  const clientName = clients.find(c => c.id === opp.clientId)?.name;
  const convertedProject = projects.find(p => p.sourceOpportunityId === opp.id);

  const regionOptions = (settings as any)?.regions || DEFAULT_REGIONS;
  const engagementOptions = (settings as any)?.engagementModels || DEFAULT_ENGAGEMENT_MODELS;
  const projectTypeOptions = (settings as any)?.projectTypes || DEFAULT_PROJECT_TYPES;

  return (
    <>
      <Helmet>
        <title>{opp.title} - {appTitle}</title>
      </Helmet>
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        <div className="flex items-start gap-4">
          <Link href="/opportunities">
            <Button variant="ghost" size="icon" data-testid="button-back-opportunities">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-4">
                <Input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="text-xl font-bold"
                  data-testid="input-edit-opp-title"
                />
                <Textarea
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  placeholder="Description"
                  rows={2}
                  data-testid="input-edit-opp-description"
                />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger data-testid="select-edit-status"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      {OPP_STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={editClientId} onValueChange={setEditClientId}>
                    <SelectTrigger data-testid="select-edit-client"><SelectValue placeholder="Client" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No client</SelectItem>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={editRegion} onValueChange={setEditRegion}>
                    <SelectTrigger data-testid="select-edit-region"><SelectValue placeholder="Region" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No region</SelectItem>
                      {regionOptions.map((r: any) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={editEngagement} onValueChange={setEditEngagement}>
                    <SelectTrigger data-testid="select-edit-engagement"><SelectValue placeholder="Engagement" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {engagementOptions.map((e: any) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Select value={editProjectType} onValueChange={setEditProjectType}>
                    <SelectTrigger data-testid="select-edit-project-type"><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {projectTypeOptions.map((p: any) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Input
                    value={editSalesforceClouds}
                    onChange={e => setEditSalesforceClouds(e.target.value)}
                    placeholder="Salesforce Clouds"
                    data-testid="input-edit-clouds"
                  />
                  <Input
                    type="date"
                    value={editStartDate}
                    onChange={e => setEditStartDate(e.target.value)}
                    data-testid="input-edit-start-date"
                  />
                  <Input
                    type="date"
                    value={editEndDate}
                    onChange={e => setEditEndDate(e.target.value)}
                    data-testid="input-edit-end-date"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveEdits} disabled={updateMutation.isPending} data-testid="button-save-opp">
                    <Save className="w-4 h-4 mr-1" /> Save
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(false)} data-testid="button-cancel-edit">
                    <X className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold truncate" data-testid="text-opp-title">{opp.title}</h1>
                  <Badge className={`${statusOption.color} border-0`} data-testid="badge-opp-status">{statusOption.label}</Badge>
                  {stage0 && opp.flightpathStageId === stage0.id && (
                    <Badge variant="outline" className="gap-1" data-testid="badge-stage-0">
                      <ShieldCheck className="w-3 h-3" /> Stage 0
                    </Badge>
                  )}
                  {isWon && convertedProject && (
                    <Link href={`/timeline/${convertedProject.id}`}>
                      <Badge variant="outline" className="gap-1 text-green-600 border-green-300 cursor-pointer hover:bg-green-50 dark:hover:bg-green-950" data-testid="badge-converted-project">
                        <ArrowRightCircle className="w-3 h-3" /> View Project
                      </Badge>
                    </Link>
                  )}
                </div>
                {opp.description && <p className="text-sm text-muted-foreground mt-1" data-testid="text-opp-description">{opp.description}</p>}
                <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                  {clientName && <span data-testid="text-opp-client">{clientName}</span>}
                  {opp.region && <span data-testid="text-opp-region">{opp.region}</span>}
                  {opp.salesforceClouds && <span data-testid="text-opp-clouds">{opp.salesforceClouds}</span>}
                  {opp.engagementModel && <span>{opp.engagementModel}</span>}
                  {opp.currency && opp.currency !== "USD" && <span>{opp.currency}</span>}
                </div>
              </>
            )}
          </div>
          {!editing && !isWon && (
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={startEditing} data-testid="button-edit-opp">
                <Edit3 className="w-4 h-4 mr-1" /> Edit
              </Button>
              {canConvert && (
                <Button size="sm" onClick={() => setConvertDialogOpen(true)} data-testid="button-convert-to-project">
                  <ArrowRightCircle className="w-4 h-4 mr-1" /> Convert to Project
                </Button>
              )}
            </div>
          )}
          {isWon && (
            <div className="shrink-0">
              <Badge variant="outline" className="text-green-600 border-green-300 gap-1" data-testid="badge-won-status">Won{opp.convertedAt ? " · Converted" : ""}</Badge>
            </div>
          )}
        </div>

        {opp.approvedBudget && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-3 pb-3">
                <div className="text-xs text-muted-foreground">Estimated Cost</div>
                <div className="text-lg font-semibold" data-testid="text-opp-cost">${parseFloat(opp.approvedBudget || "0").toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3">
                <div className="text-xs text-muted-foreground">Revenue</div>
                <div className="text-lg font-semibold" data-testid="text-opp-revenue">${parseFloat(opp.estimatedRevenue || "0").toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3">
                <div className="text-xs text-muted-foreground">Margin</div>
                <div className={`text-lg font-semibold ${parseFloat(opp.grossMargin || "0") >= 30 ? "text-green-600" : parseFloat(opp.grossMargin || "0") >= 15 ? "text-amber-600" : "text-red-600"}`} data-testid="text-opp-margin">
                  {parseFloat(opp.grossMargin || "0").toFixed(1)}%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-3 pb-3">
                <div className="text-xs text-muted-foreground">Risk / Buffer</div>
                <div className="text-lg font-semibold" data-testid="text-opp-risk-buffer">
                  {opp.riskFactorPercent || "0"}% / {opp.bufferPercent || "0"}%
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="estimate">
          <TabsList data-testid="opp-tabs">
            <TabsTrigger value="estimate" data-testid="tab-estimate">
              <Target className="w-4 h-4 mr-1" /> Estimate
            </TabsTrigger>
            <TabsTrigger value="team" data-testid="tab-team">
              <Users className="w-4 h-4 mr-1" /> Team
            </TabsTrigger>
            <TabsTrigger value="governance" data-testid="tab-governance">
              <ShieldCheck className="w-4 h-4 mr-1" /> Governance
            </TabsTrigger>
            <TabsTrigger value="raid" data-testid="tab-raid">
              <AlertTriangle className="w-4 h-4 mr-1" /> RAID Log
            </TabsTrigger>
          </TabsList>

          <TabsContent value="estimate">
            <EstimateTab timeline={opp} />
          </TabsContent>

          <TabsContent value="team">
            <TeamCompositionWrapper timelineId={opp.id} region={opp.region || undefined} />
          </TabsContent>

          <TabsContent value="governance">
            <GovernanceTab timelineId={opp.id} currentStageId={opp.flightpathStageId || null} onStageChange={() => {}} opportunityMode={true} />
          </TabsContent>

          <TabsContent value="raid">
            <RaidLog timelineId={opp.id} />
          </TabsContent>
        </Tabs>

        <AlertDialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Convert to Delivery Project</AlertDialogTitle>
              <AlertDialogDescription>
                This will create a new Project from this Opportunity. The following data will be copied:
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>All phases and workstreams (as delivery baseline)</li>
                  <li>Team composition and rate cards</li>
                  <li>Resource allocations</li>
                  <li>RAID log items</li>
                  <li>Document repository connection</li>
                  <li>Budget and financial estimates</li>
                </ul>
                <p className="mt-2 font-medium">The new project will start at Stage 1: Structured Initiation.</p>
                <p className="mt-1">This opportunity will be marked as "Won".</p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => convertMutation.mutate()}
                disabled={convertMutation.isPending}
                data-testid="button-confirm-convert"
              >
                {convertMutation.isPending ? "Converting..." : "Convert to Project"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}

function TeamCompositionWrapper({ timelineId, region }: { timelineId: string; region?: string }) {
  const [TeamComposition, setTeamComp] = useState<any>(null);

  if (!TeamComposition) {
    import("@/components/team-composition").then(mod => {
      setTeamComp(() => mod.TeamComposition || mod.default);
    });
    return <div className="p-4 text-muted-foreground">Loading team composition...</div>;
  }

  return <TeamComposition timelineId={timelineId} opportunityMode={true} region={region} />;
}
