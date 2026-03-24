import { useState, useEffect } from "react";
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
  DollarSign,
  TrendingUp,
  Shield,
  Building2,
  MapPin,
  Cloud,
  Briefcase,
  Calendar,
  Plus,
  Check,
  Trash2,
  Milestone as MilestoneIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppTitle } from "@/hooks/use-app-title";
import { useTranslation } from "react-i18next";
import { EstimateTab } from "@/components/estimate-tab";
import { GovernanceTab } from "@/components/governance-tab";
import { RaidLog } from "@/components/raid-log";
import type { TimelineWithMilestones, Client, AppSettings, FlightpathStage, ProjectGate } from "@shared/schema";
import { getDefaultFieldOptions } from "@shared/schema";

const OPP_STATUS_OPTIONS = [
  { value: "qualifying", label: "Qualifying", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  { value: "estimating", label: "Estimating", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  { value: "proposed", label: "Proposed", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" },
  { value: "won", label: "Won", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  { value: "lost", label: "Lost", color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20" },
];

function MarginIndicator({ value }: { value: number }) {
  const color = value >= 30
    ? "text-emerald-600 dark:text-emerald-400"
    : value >= 15
      ? "text-amber-600 dark:text-amber-400"
      : "text-red-600 dark:text-red-400";
  const bgColor = value >= 30
    ? "bg-emerald-500/10"
    : value >= 15
      ? "bg-amber-500/10"
      : "bg-red-500/10";

  return (
    <div className="flex items-center gap-2">
      <span className={`text-2xl font-semibold tracking-tight tabular-nums ${color}`} data-testid="text-opp-margin">
        {value.toFixed(1)}%
      </span>
      <div className={`w-1.5 h-6 rounded-full ${bgColor} ${color}`}>
        <div
          className={`w-full rounded-full ${value >= 30 ? "bg-emerald-500" : value >= 15 ? "bg-amber-500" : "bg-red-500"}`}
          style={{ height: `${Math.min(100, Math.max(10, value * 2))}%`, marginTop: 'auto' }}
        />
      </div>
    </div>
  );
}

function MetadataItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Icon className="w-3.5 h-3.5 shrink-0 opacity-60" />
      <span className="truncate">{value}</span>
    </div>
  );
}

export default function OpportunityDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const appTitle = useAppTitle("Opportunity");
  const [editing, setEditing] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [showAddMilestone, setShowAddMilestone] = useState(false);
  const [newMTitle, setNewMTitle] = useState("");
  const [newMDate, setNewMDate] = useState("");
  const [newMDesc, setNewMDesc] = useState("");
  const [newMIsFinancial, setNewMIsFinancial] = useState(false);
  const [newMAmount, setNewMAmount] = useState("");
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [editMTitle, setEditMTitle] = useState("");
  const [editMDate, setEditMDate] = useState("");
  const [editMDesc, setEditMDesc] = useState("");
  const [editMIsFinancial, setEditMIsFinancial] = useState(false);
  const [editMAmount, setEditMAmount] = useState("");

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
    queryKey: ["/api/governance-model/stages"],
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
      toast({ title: t("opportunities.opportunityCreated") });
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

  const addMilestoneMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/timelines/${id}/milestones`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities", id] });
      toast({ title: t("projects.milestoneAdded") });
      setShowAddMilestone(false);
      setNewMTitle(""); setNewMDate(""); setNewMDesc(""); setNewMIsFinancial(false); setNewMAmount("");
    },
  });

  const updateMilestoneMutation = useMutation({
    mutationFn: async ({ milestoneId, data }: { milestoneId: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/milestones/${milestoneId}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities", id] });
      toast({ title: t("projects.milestoneUpdated") });
      setEditingMilestoneId(null);
    },
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      await apiRequest("DELETE", `/api/milestones/${milestoneId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities", id] });
      toast({ title: t("projects.milestoneDeleted") });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-7 w-72" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-24 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
        </div>
        <Skeleton className="h-10 w-80 rounded-md" />
        <Skeleton className="h-96 w-full rounded-md" />
      </div>
    );
  }

  if (!opp) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px] gap-3">
        <p className="text-muted-foreground">Opportunity not found.</p>
        <Link href="/opportunities">
          <Button variant="outline" data-testid="button-back-opportunities">Back to Opportunities</Button>
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
  const isWon = opp.opportunityStatus === "won";
  const convertedProject = projects.find(p => p.sourceOpportunityId === opp.id);
  const canConvert = isWon && !convertedProject && !opp.convertedAt && stage0Gate && (stage0Gate.status === "passed" || stage0Gate.status === "exception");
  const clientName = clients.find(c => c.id === opp.clientId)?.name;

  const regionOptions = (settings as any)?.regions || getDefaultFieldOptions("regions", settings?.locale || "en");
  const engagementOptions = (settings as any)?.engagementModels || getDefaultFieldOptions("engagementModels", settings?.locale || "en");
  const projectTypeOptions = (settings as any)?.projectTypes || getDefaultFieldOptions("projectTypes", settings?.locale || "en");

  const price = parseFloat(opp.approvedBudget || "0");
  const cost = parseFloat(opp.totalRunningCost || "0");
  const margin = parseFloat(opp.grossMargin || "0");
  const hasFinancials = price > 0 || cost > 0;

  return (
    <>
      <Helmet>
        <title>{opp.title} - {appTitle}</title>
      </Helmet>
      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {editing ? (
          <Card>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t("common.edit")} {t("opportunities.title")}</h2>
                <div className="flex items-center gap-2">
                  <Button onClick={saveEdits} disabled={updateMutation.isPending} data-testid="button-save-opp">
                    <Save className="w-4 h-4 mr-1" /> {t("common.save")}
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(false)} data-testid="button-cancel-edit">
                    <X className="w-4 h-4 mr-1" /> {t("common.cancel")}
                  </Button>
                </div>
              </div>
              <div className="space-y-4">
                <Input
                  value={editTitle}
                  onChange={e => setEditTitle(e.target.value)}
                  className="text-lg font-semibold border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
                  placeholder="Opportunity title"
                  data-testid="input-edit-opp-title"
                />
                <Textarea
                  value={editDescription}
                  onChange={e => setEditDescription(e.target.value)}
                  placeholder="Description"
                  rows={2}
                  className="border-0 border-b rounded-none px-0 resize-none focus-visible:ring-0 focus-visible:border-primary"
                  data-testid="input-edit-opp-description"
                />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{t("common.status")}</label>
                    <Select value={editStatus} onValueChange={setEditStatus}>
                      <SelectTrigger data-testid="select-edit-status"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        {OPP_STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{t("common.client")}</label>
                    <Select value={editClientId} onValueChange={setEditClientId}>
                      <SelectTrigger data-testid="select-edit-client"><SelectValue placeholder={t("common.client")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{t("common.region")}</label>
                    <Select value={editRegion} onValueChange={setEditRegion}>
                      <SelectTrigger data-testid="select-edit-region"><SelectValue placeholder="Region" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No region</SelectItem>
                        {regionOptions.map((r: any) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{t("projects.engagement")}</label>
                    <Select value={editEngagement} onValueChange={setEditEngagement}>
                      <SelectTrigger data-testid="select-edit-engagement"><SelectValue placeholder="Engagement" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {engagementOptions.map((e: any) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{t("projects.projectType")}</label>
                    <Select value={editProjectType} onValueChange={setEditProjectType}>
                      <SelectTrigger data-testid="select-edit-project-type"><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {projectTypeOptions.map((p: any) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{t("opportunities.salesforceClouds")}</label>
                    <Input
                      value={editSalesforceClouds}
                      onChange={e => setEditSalesforceClouds(e.target.value)}
                      placeholder="Salesforce Clouds"
                      data-testid="input-edit-clouds"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{t("common.start")} {t("common.date")}</label>
                    <Input
                      type="date"
                      value={editStartDate}
                      onChange={e => setEditStartDate(e.target.value)}
                      data-testid="input-edit-start-date"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">{t("common.end")} {t("common.date")}</label>
                    <Input
                      type="date"
                      value={editEndDate}
                      onChange={e => setEditEndDate(e.target.value)}
                      data-testid="input-edit-end-date"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <Link href="/opportunities">
                <Button variant="ghost" size="icon" data-testid="button-back-opportunities">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="page-title truncate" data-testid="text-opp-title">{opp.title}</h1>
                  <Badge className={`${statusOption.color} border`} data-testid="badge-opp-status">{statusOption.label}</Badge>
                  {stage0 && opp.flightpathStageId === stage0.id && (
                    <Badge variant="outline" className="gap-1" data-testid="badge-stage-0">
                      <ShieldCheck className="w-3 h-3" /> Stage 0
                    </Badge>
                  )}
                  {isWon && convertedProject && (
                    <Link href={`/timeline/${convertedProject.id}`}>
                      <Badge variant="outline" className="gap-1 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 cursor-pointer" data-testid="badge-converted-project">
                        <ArrowRightCircle className="w-3 h-3" /> View Project
                      </Badge>
                    </Link>
                  )}
                </div>
                {opp.description && (
                  <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl" data-testid="text-opp-description">{opp.description}</p>
                )}
                <div className="flex items-center gap-4 mt-3 flex-wrap">
                  {clientName && <MetadataItem icon={Building2} label={t("common.client")} value={clientName} />}
                  {opp.region && <MetadataItem icon={MapPin} label={t("common.region")} value={opp.region} />}
                  {opp.salesforceClouds && <MetadataItem icon={Cloud} label={t("opportunities.sfClouds")} value={opp.salesforceClouds} />}
                  {opp.engagementModel && <MetadataItem icon={Briefcase} label={t("projects.engagement")} value={opp.engagementModel} />}
                  {opp.startDate && <MetadataItem icon={Calendar} label={t("common.start")} value={opp.startDate} />}
                  {opp.endDate && <MetadataItem icon={Calendar} label={t("common.end")} value={opp.endDate} />}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!isWon && (
                  <Button variant="outline" size="sm" onClick={startEditing} data-testid="button-edit-opp">
                    <Edit3 className="w-4 h-4 mr-1" /> {t("common.edit")}
                  </Button>
                )}
                {isWon && (
                  <>
                    <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1" data-testid="badge-won-status">
                      Won{opp.convertedAt ? " · Converted" : ""}
                    </Badge>
                    {canConvert && (
                      <Button size="sm" onClick={() => setConvertDialogOpen(true)} data-testid="button-convert-to-project">
                        <ArrowRightCircle className="w-4 h-4 mr-1" /> {t("governance.convertToProject")}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {hasFinancials && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10">
                        <DollarSign className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <span className="metric-label">{t("opportunities.bufferedPrice")}</span>
                    </div>
                    <div className="text-2xl font-semibold tracking-tight tabular-nums" data-testid="text-opp-price">
                      ${price.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-muted">
                        <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <span className="metric-label">{t("opportunities.baseCost")}</span>
                    </div>
                    <div className="text-2xl font-semibold tracking-tight tabular-nums" data-testid="text-opp-cost">
                      ${cost.toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-emerald-500/10">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="metric-label">{t("projects.grossMargin")}</span>
                    </div>
                    <MarginIndicator value={margin} />
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-amber-500/10">
                        <Shield className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <span className="metric-label">Risk / Buffer</span>
                    </div>
                    <div className="text-2xl font-semibold tracking-tight tabular-nums" data-testid="text-opp-risk-buffer">
                      {opp.riskFactorPercent || "0"}%
                      <span className="text-muted-foreground mx-1 text-base">/</span>
                      {opp.bufferPercent || "0"}%
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}

        <Tabs defaultValue="estimate" className="space-y-4">
          <TabsList className="bg-muted/50 p-0.5" data-testid="opp-tabs">
            <TabsTrigger value="estimate" className="gap-1.5 data-[state=active]:shadow-sm" data-testid="tab-estimate">
              <Target className="w-3.5 h-3.5" /> Estimate
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-1.5 data-[state=active]:shadow-sm" data-testid="tab-team">
              <Users className="w-3.5 h-3.5" /> Team
            </TabsTrigger>
            <TabsTrigger value="governance" className="gap-1.5 data-[state=active]:shadow-sm" data-testid="tab-governance">
              <ShieldCheck className="w-3.5 h-3.5" /> Governance
            </TabsTrigger>
            <TabsTrigger value="raid" className="gap-1.5 data-[state=active]:shadow-sm" data-testid="tab-raid">
              <AlertTriangle className="w-3.5 h-3.5" /> RAID Log
            </TabsTrigger>
            <TabsTrigger value="milestones" className="gap-1.5 data-[state=active]:shadow-sm" data-testid="tab-milestones">
              <MilestoneIcon className="w-3.5 h-3.5" /> {t("projects.milestones")} ({opp.milestones?.length || 0})
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

          <TabsContent value="milestones">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold">{t("projects.milestones")}</h3>
                  {!showAddMilestone && (
                    <Button size="sm" variant="outline" onClick={() => setShowAddMilestone(true)} data-testid="button-add-opp-milestone">
                      <Plus className="w-3.5 h-3.5 mr-1" /> {t("common.add")}
                    </Button>
                  )}
                </div>

                {showAddMilestone && (
                  <div className="space-y-2 mb-4 p-3 border rounded-md bg-muted/30">
                    <div className="flex gap-2 flex-wrap">
                      <div className="flex-1 min-w-[140px]">
                        <Input value={newMTitle} onChange={(e) => setNewMTitle(e.target.value)} placeholder={t("common.title")} data-testid="input-new-opp-milestone-title" />
                      </div>
                      <div className="w-40">
                        <Input type="date" value={newMDate} onChange={(e) => setNewMDate(e.target.value)} placeholder={t("common.date")} data-testid="input-new-opp-milestone-date" />
                      </div>
                    </div>
                    <Input value={newMDesc} onChange={(e) => setNewMDesc(e.target.value)} placeholder={t("common.description")} data-testid="input-new-opp-milestone-desc" />
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Checkbox id="new-opp-fin-obligation" checked={newMIsFinancial} onCheckedChange={(checked) => setNewMIsFinancial(checked === true)} data-testid="checkbox-new-opp-milestone-financial" />
                        <label htmlFor="new-opp-fin-obligation" className="text-xs font-medium text-muted-foreground cursor-pointer">Financial Obligation</label>
                      </div>
                      {newMIsFinancial && (
                        <div className="w-36">
                          <Input type="number" step="0.01" min="0" value={newMAmount} onChange={(e) => setNewMAmount(e.target.value)} placeholder={`${t("common.amount")} ($)`} data-testid="input-new-opp-milestone-amount" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => { setShowAddMilestone(false); setNewMTitle(""); setNewMDate(""); setNewMDesc(""); setNewMIsFinancial(false); setNewMAmount(""); }} data-testid="button-cancel-add-opp-milestone">
                        <X className="w-3.5 h-3.5 mr-1" /> {t("common.cancel")}
                      </Button>
                      <Button size="sm" disabled={!newMTitle.trim() || !newMDate.trim() || addMilestoneMutation.isPending} onClick={() => addMilestoneMutation.mutate({ title: newMTitle.trim(), date: newMDate, description: newMDesc.trim() || null, sortOrder: (opp.milestones?.length || 0), isFinancialObligation: newMIsFinancial, amount: newMIsFinancial && newMAmount ? newMAmount : null })} data-testid="button-save-add-opp-milestone">
                        <Check className="w-3.5 h-3.5 mr-1" /> {addMilestoneMutation.isPending ? t("common.saving") : t("common.save")}
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {(!opp.milestones || opp.milestones.length === 0) ? (
                    <p className="text-sm text-muted-foreground py-4 text-center" data-testid="text-no-opp-milestones">{t("projects.noMilestonesAdded")}</p>
                  ) : (
                    [...opp.milestones].sort((a, b) => a.sortOrder - b.sortOrder).map((m) => (
                      <Card key={m.id} className="p-3" data-testid={`opp-milestone-${m.id}`}>
                        {editingMilestoneId === m.id ? (
                          <div className="space-y-2">
                            <div className="flex gap-2 flex-wrap">
                              <div className="flex-1 min-w-[140px]">
                                <Input value={editMTitle} onChange={(e) => setEditMTitle(e.target.value)} placeholder={t("common.title")} data-testid={`input-edit-opp-milestone-title-${m.id}`} />
                              </div>
                              <div className="w-40">
                                <Input type="date" value={editMDate} onChange={(e) => setEditMDate(e.target.value)} data-testid={`input-edit-opp-milestone-date-${m.id}`} />
                              </div>
                            </div>
                            <Input value={editMDesc} onChange={(e) => setEditMDesc(e.target.value)} placeholder={t("common.description")} data-testid={`input-edit-opp-milestone-desc-${m.id}`} />
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-2">
                                <Checkbox id={`edit-opp-fin-${m.id}`} checked={editMIsFinancial} onCheckedChange={(checked) => setEditMIsFinancial(checked === true)} data-testid={`checkbox-edit-opp-milestone-financial-${m.id}`} />
                                <label htmlFor={`edit-opp-fin-${m.id}`} className="text-xs font-medium text-muted-foreground cursor-pointer">Financial Obligation</label>
                              </div>
                              {editMIsFinancial && (
                                <div className="w-36">
                                  <Input type="number" step="0.01" min="0" value={editMAmount} onChange={(e) => setEditMAmount(e.target.value)} placeholder={`${t("common.amount")} ($)`} data-testid={`input-edit-opp-milestone-amount-${m.id}`} />
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 justify-end">
                              <Button size="sm" variant="ghost" onClick={() => setEditingMilestoneId(null)} data-testid={`button-cancel-edit-opp-milestone-${m.id}`}>
                                <X className="w-3.5 h-3.5 mr-1" /> {t("common.cancel")}
                              </Button>
                              <Button size="sm" disabled={!editMTitle.trim() || !editMDate.trim() || updateMilestoneMutation.isPending} onClick={() => updateMilestoneMutation.mutate({ milestoneId: m.id, data: { title: editMTitle.trim(), date: editMDate, description: editMDesc.trim() || null, isFinancialObligation: editMIsFinancial, amount: editMIsFinancial && editMAmount ? editMAmount : null } })} data-testid={`button-save-edit-opp-milestone-${m.id}`}>
                                <Check className="w-3.5 h-3.5 mr-1" /> {updateMilestoneMutation.isPending ? t("common.saving") : t("common.save")}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-2 h-2 rounded-full shrink-0 bg-primary" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium truncate" data-testid={`text-opp-milestone-title-${m.id}`}>{m.title}</p>
                                  {m.isFinancialObligation && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-600 dark:text-amber-400" data-testid={`badge-opp-financial-${m.id}`}>
                                      ${m.amount ? parseFloat(m.amount).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">{t("common.date")}: {m.date}</p>
                                {m.description && <p className="text-xs text-muted-foreground truncate max-w-md">{m.description}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="ghost" onClick={() => { setEditingMilestoneId(m.id); setEditMTitle(m.title); setEditMDate(m.date); setEditMDesc(m.description || ""); setEditMIsFinancial(m.isFinancialObligation); setEditMAmount(m.amount || ""); }} data-testid={`button-edit-opp-milestone-${m.id}`}>
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="icon" variant="ghost" data-testid={`button-delete-opp-milestone-${m.id}`}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>{t("common.delete")}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently remove "{m.title}" from this opportunity.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteMilestoneMutation.mutate(m.id)} data-testid={`button-confirm-delete-opp-milestone-${m.id}`}>
                                      {t("common.delete")}
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
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        <AlertDialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Convert to Delivery Project</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  <span>This will create a new Project from this Opportunity. The following data will be copied:</span>
                  <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li>All phases and workstreams (as delivery baseline)</li>
                    <li>Milestones</li>
                    <li>Team composition and rate cards</li>
                    <li>Resource allocations</li>
                    <li>RAID log items</li>
                    <li>Document repository connection</li>
                    <li>Budget and financial estimates</li>
                  </ul>
                  <p className="mt-2 font-medium">The new project will start at Stage 1: Structured Initiation.</p>
                  <p className="mt-1">This opportunity will be marked as "Won".</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => convertMutation.mutate()}
                disabled={convertMutation.isPending}
                data-testid="button-confirm-convert"
              >
                {convertMutation.isPending ? t("governance.converting") : t("governance.convertToProject")}
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

  useEffect(() => {
    import("@/components/team-composition").then(mod => {
      setTeamComp(() => mod.TeamComposition || mod.default);
    });
  }, []);

  if (!TeamComposition) {
    return (
      <div className="p-6 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return <TeamComposition timelineId={timelineId} opportunityMode={true} region={region} />;
}
