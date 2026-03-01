import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, Loader2,
  ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, ArrowRight,
  FolderOpen, FileText, Link2, Unlink, Scan, ExternalLink,
  CloudOff, FolderSync,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Risk, FlightpathStage, FlightpathDeliverable, ProjectCheckpoint, ProjectGate, TimelineWithMilestones } from "@shared/schema";

type StageWithDeliverables = FlightpathStage & { deliverables: FlightpathDeliverable[] };

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  size: string | null;
  modifiedTime: string;
  createdTime: string;
}

interface GovernanceTabProps {
  timelineId: string;
  currentStageId: string | null;
  onStageChange: (stageId: string) => void;
  opportunityMode?: boolean;
}

export function GovernanceTab({ timelineId, currentStageId, onStageChange, opportunityMode = false }: GovernanceTabProps) {
  const { toast } = useToast();
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [expandedRaci, setExpandedRaci] = useState<string | null>(null);
  const [gateNotes, setGateNotes] = useState("");
  const [linkingCheckpointId, setLinkingCheckpointId] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [repoType, setRepoType] = useState<string>("");
  const [showRepoConfig, setShowRepoConfig] = useState(false);

  const { data: timeline } = useQuery<TimelineWithMilestones>({
    queryKey: [opportunityMode ? "/api/opportunities" : "/api/timelines", timelineId],
  });

  const { data: stages = [], isLoading: stagesLoading } = useQuery<StageWithDeliverables[]>({
    queryKey: ["/api/governance-model/stages"],
  });

  const { data: checkpoints = [] } = useQuery<ProjectCheckpoint[]>({
    queryKey: ["/api/timelines", timelineId, "checkpoints"],
  });

  const { data: gates = [] } = useQuery<ProjectGate[]>({
    queryKey: ["/api/timelines", timelineId, "gates"],
  });

  const { data: raidItems = [] } = useQuery<Risk[]>({
    queryKey: ["/api/timelines", timelineId, "risks"],
  });

  const { data: repoFiles = [], isLoading: filesLoading, refetch: refetchFiles } = useQuery<DriveFile[]>({
    queryKey: ["/api/timelines", timelineId, "artifacts"],
    enabled: !!(timeline?.docRepositoryType && timeline?.docRepositoryFolderId),
  });

  const displayStages = opportunityMode ? stages.filter(s => s.stageNumber === 0) : stages;

  useEffect(() => {
    if (!selectedStageId && displayStages.length > 0) {
      if (opportunityMode) {
        const stage0 = displayStages.find(s => s.stageNumber === 0);
        setSelectedStageId(stage0?.id || null);
      } else {
        setSelectedStageId(currentStageId || displayStages[0]?.id || null);
      }
    }
  }, [displayStages, currentStageId, selectedStageId, opportunityMode]);

  useEffect(() => {
    if (timeline) {
      setRepoType(timeline.docRepositoryType || "");
      setRepoUrl(timeline.docRepositoryUrl || "");
    }
  }, [timeline]);

  const selectedStage = stages.find(s => s.id === selectedStageId);
  const stageCheckpoints = checkpoints.filter(c => c.stageId === selectedStageId);
  const stageGate = gates.find(g => g.stageId === selectedStageId);
  const stageRaidItems = raidItems.filter(r => r.relatedStageId === selectedStageId || !r.relatedStageId);
  const openRaidItems = stageRaidItems.filter(r => r.status === "open");

  const initMutation = useMutation({
    mutationFn: async (stageId: string) => {
      const res = await apiRequest("POST", `/api/timelines/${timelineId}/initialize-stage`, { stageId });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "checkpoints"] });
      toast({ title: "Stage initialized with deliverable checkpoints" });
    },
  });

  const toggleCheckpoint = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      await apiRequest("PATCH", `/api/checkpoints/${id}`, {
        completed,
        completedAt: completed ? new Date().toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "checkpoints"] });
    },
  });

  const toggleOptional = useMutation({
    mutationFn: async ({ id, optional }: { id: string; optional: boolean }) => {
      await apiRequest("PATCH", `/api/checkpoints/${id}`, { optional });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "checkpoints"] });
    },
  });

  const evaluateMutation = useMutation({
    mutationFn: async (stageId: string) => {
      const res = await apiRequest("POST", `/api/timelines/${timelineId}/evaluate-gate`, { stageId });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "gates"] });
      const status = data.evaluatorResult?.status;
      toast({
        title: status === "pass" ? "Gate Passed" : "Gate Assessment: Action Required",
        description: status === "pass" ? "All criteria met. You can advance to the next stage." : "Some criteria are not yet met. Review the assessment below.",
      });
    },
    onError: () => {
      toast({ title: "Evaluation failed", description: "Could not evaluate gate. Please try again.", variant: "destructive" });
    },
  });

  const advanceMutation = useMutation({
    mutationFn: async (nextStageId: string) => {
      const res = await apiRequest("POST", `/api/timelines/${timelineId}/advance-stage`, { nextStageId });
      return res.json();
    },
    onSuccess: (_, nextStageId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId] });
      onStageChange(nextStageId);
      setSelectedStageId(nextStageId);
      toast({ title: "Advanced to next stage" });
    },
    onError: (err: Error) => {
      toast({ title: "Cannot advance stage", description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const exceptionMutation = useMutation({
    mutationFn: async ({ gateId, notes }: { gateId: string; notes: string }) => {
      await apiRequest("PATCH", `/api/gates/${gateId}`, { status: "exception", notes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "gates"] });
      toast({ title: "Exception recorded" });
      setGateNotes("");
    },
  });

  const saveRepoMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/timelines/${timelineId}`, {
        docRepositoryType: repoType || null,
        docRepositoryUrl: repoUrl || null,
        docRepositoryFolderId: repoUrl || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId] });
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "artifacts"] });
      toast({ title: "Document repository updated" });
      setShowRepoConfig(false);
    },
    onError: () => {
      toast({ title: "Failed to save repository settings", variant: "destructive" });
    },
  });

  const linkArtifactMutation = useMutation({
    mutationFn: async ({ checkpointId, file }: { checkpointId: string; file: DriveFile }) => {
      await apiRequest("POST", `/api/timelines/${timelineId}/link-artifact`, {
        checkpointId,
        fileId: file.id,
        fileName: file.name,
        fileUrl: file.webViewLink,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "checkpoints"] });
      setLinkingCheckpointId(null);
      toast({ title: "Artifact linked" });
    },
  });

  const unlinkArtifactMutation = useMutation({
    mutationFn: async (checkpointId: string) => {
      await apiRequest("DELETE", `/api/timelines/${timelineId}/unlink-artifact`, { checkpointId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "checkpoints"] });
      toast({ title: "Artifact unlinked" });
    },
  });

  const verifyArtifactsMutation = useMutation({
    mutationFn: async (stageId: string) => {
      const res = await apiRequest("POST", `/api/timelines/${timelineId}/verify-artifacts`, { stageId });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "checkpoints"] });
      toast({
        title: "Artifact verification complete",
        description: `${data.verified} of ${data.withArtifacts} artifacts verified.`,
      });
    },
    onError: () => {
      toast({ title: "Verification failed", variant: "destructive" });
    },
  });

  if (stagesLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  if (stages.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-muted-foreground">No governance stages configured. Go to Settings to set up the governance framework.</p>
      </Card>
    );
  }

  const requiredCheckpoints = stageCheckpoints.filter(c => !c.optional);
  const optionalCheckpoints = stageCheckpoints.filter(c => c.optional);
  const completedCount = requiredCheckpoints.filter(c => c.completed).length;
  const totalCount = requiredCheckpoints.length;
  const completionPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const artifactsLinked = requiredCheckpoints.filter(c => c.artifactFileName).length;
  const artifactsVerified = requiredCheckpoints.filter(c => c.artifactVerified).length;

  const currentStageIndex = stages.findIndex(s => s.id === currentStageId);
  const selectedStageIndex = stages.findIndex(s => s.id === selectedStageId);
  const nextStage = selectedStageIndex >= 0 && selectedStageIndex < stages.length - 1 ? stages[selectedStageIndex + 1] : null;
  const hasRepo = !!(timeline?.docRepositoryType && timeline?.docRepositoryFolderId);

  const gateStatusIcon = (status: string | undefined) => {
    switch (status) {
      case "passed": return <ShieldCheck className="w-5 h-5 text-green-600" />;
      case "failed": return <ShieldX className="w-5 h-5 text-red-600" />;
      case "exception": return <ShieldAlert className="w-5 h-5 text-amber-600" />;
      default: return <Circle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const gateStatusBadge = (status: string | undefined) => {
    switch (status) {
      case "passed": return <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Passed</Badge>;
      case "failed": return <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">Failed</Badge>;
      case "exception": return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">Exception</Badge>;
      default: return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const artifactStatusIcon = (cp: ProjectCheckpoint) => {
    if (cp.artifactVerified) return <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />;
    if (cp.artifactFileName) return <FileText className="w-3.5 h-3.5 text-amber-600" />;
    return <CloudOff className="w-3.5 h-3.5 text-muted-foreground" />;
  };

  const artifactStatusText = (cp: ProjectCheckpoint) => {
    if (cp.artifactVerified) return "Verified";
    if (cp.artifactFileName) return "Linked (unverified)";
    return "No artifact";
  };

  return (
    <div className="space-y-6">
      <Card className="p-4" data-testid="doc-repo-config">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-5 h-5 text-muted-foreground" />
            <div>
              <h4 className="text-sm font-medium">Document Repository</h4>
              {hasRepo ? (
                <p className="text-xs text-muted-foreground">
                  Connected to {timeline?.docRepositoryType === "google_drive" ? "Google Drive" : timeline?.docRepositoryType}
                  {repoFiles.length > 0 && ` — ${repoFiles.length} files found`}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Link a document repository to attach deliverable artifacts
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasRepo && (
              <Button size="sm" variant="ghost" onClick={() => refetchFiles()} data-testid="button-refresh-files">
                <FolderSync className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowRepoConfig(!showRepoConfig)}
              data-testid="button-configure-repo"
            >
              {hasRepo ? "Edit" : "Connect"}
            </Button>
          </div>
        </div>

        {showRepoConfig && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <div>
              <Label className="text-xs">Repository Type</Label>
              <Select value={repoType} onValueChange={setRepoType}>
                <SelectTrigger className="mt-1" data-testid="select-repo-type">
                  <SelectValue placeholder="Select repository type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="google_drive">Google Drive</SelectItem>
                  <SelectItem value="none">None (disconnect)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {repoType && repoType !== "none" && (
              <div>
                <Label className="text-xs">Folder URL or ID</Label>
                <Input
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder={repoType === "google_drive" ? "https://drive.google.com/drive/folders/..." : "Folder URL or ID"}
                  className="mt-1"
                  data-testid="input-repo-url"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Paste the full URL of the folder containing your project deliverables
                </p>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowRepoConfig(false)}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => saveRepoMutation.mutate()}
                disabled={saveRepoMutation.isPending}
                data-testid="button-save-repo"
              >
                {saveRepoMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                Save
              </Button>
            </div>
          </div>
        )}
      </Card>

      {!opportunityMode && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2" data-testid="stage-stepper">
          {stages.map((stage, idx) => {
            const isCompleted = currentStageIndex > idx;
            const isCurrent = stage.id === currentStageId;
            const isSelected = stage.id === selectedStageId;
            const stageGateLocal = gates.find(g => g.stageId === stage.id);

            return (
              <div key={stage.id} className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setSelectedStageId(stage.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-left ${
                    isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" :
                    isCompleted ? "border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-800" :
                    isCurrent ? "border-blue-300 bg-blue-50 dark:bg-blue-950 dark:border-blue-800" :
                    "border-border hover:bg-muted"
                  }`}
                  data-testid={`stage-step-${stage.stageNumber}`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
                  ) : isCurrent ? (
                    <div className="w-5 h-5 rounded-full border-2 border-blue-500 flex items-center justify-center shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    </div>
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground shrink-0" />
                  )}
                  <div>
                    <p className="text-xs font-medium">Stage {stage.stageNumber}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[120px]">{stage.name}</p>
                  </div>
                  {stageGateLocal && <span className="shrink-0">{gateStatusIcon(stageGateLocal.status)}</span>}
                </button>
                {idx < stages.length - 1 && <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />}
              </div>
            );
          })}
        </div>
      )}

      {selectedStage && (
        <>
          <Card className="p-5" data-testid="stage-detail-card">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h3 className="text-lg font-semibold" data-testid="text-stage-name">Stage {selectedStage.stageNumber}: {selectedStage.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{selectedStage.goal}</p>
              </div>
              {selectedStage.id === currentStageId && <Badge variant="default">Current Stage</Badge>}
              {!currentStageId && selectedStage.stageNumber === stages[0]?.stageNumber && (
                <Button
                  size="sm"
                  onClick={() => advanceMutation.mutate(selectedStage.id)}
                  disabled={advanceMutation.isPending}
                  data-testid="button-activate-governance"
                >
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  Activate Governance
                </Button>
              )}
            </div>
            {selectedStage.description && <p className="text-sm mb-3">{selectedStage.description}</p>}
            {selectedStage.playbookPurpose && (
              <div className="text-xs text-muted-foreground mb-2">
                <span className="font-medium text-foreground">Playbook Purpose:</span> {selectedStage.playbookPurpose}
              </div>
            )}
            {selectedStage.playbookExitBundle && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Exit Bundle:</span> {selectedStage.playbookExitBundle}
              </div>
            )}
          </Card>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium flex items-center gap-2">
                Checkpoint List
                {totalCount > 0 && (
                  <Badge variant="secondary" className="text-xs">{completedCount}/{totalCount} ({completionPct}%)</Badge>
                )}
                {optionalCheckpoints.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">{optionalCheckpoints.length} optional</span>
                )}
              </h4>
              <div className="flex items-center gap-2">
                {hasRepo && stageCheckpoints.some(c => c.artifactFileName) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => selectedStageId && verifyArtifactsMutation.mutate(selectedStageId)}
                    disabled={verifyArtifactsMutation.isPending}
                    data-testid="button-verify-artifacts"
                  >
                    {verifyArtifactsMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Scan className="w-3.5 h-3.5 mr-1" />}
                    Verify All Artifacts
                  </Button>
                )}
                {stageCheckpoints.length === 0 && selectedStage.deliverables.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => initMutation.mutate(selectedStage.id)}
                    disabled={initMutation.isPending}
                    data-testid="button-initialize-stage"
                  >
                    {initMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                    Initialize Checkpoints
                  </Button>
                )}
              </div>
            </div>

            {totalCount > 0 && (
              <div className="space-y-1 mb-3">
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${completionPct}%` }} />
                </div>
                {hasRepo && (
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span data-testid="text-artifacts-linked">Artifacts: {artifactsLinked}/{totalCount} linked</span>
                    <span data-testid="text-artifacts-verified">Verified: {artifactsVerified}/{artifactsLinked || 0}</span>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              {stageCheckpoints.map(cp => {
                const deliverable = selectedStage.deliverables.find(d => d.id === cp.deliverableId);
                const raciExpanded = expandedRaci === cp.id;

                return (
                  <Card key={cp.id} className={`p-3 ${cp.optional ? "opacity-60 border border-dashed" : ""}`} data-testid={`checkpoint-${cp.id}`}>
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleCheckpoint.mutate({ id: cp.id, completed: !cp.completed })}
                        className="mt-0.5 shrink-0"
                        data-testid={`checkbox-${cp.id}`}
                      >
                        {cp.completed ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium ${cp.optional ? "italic text-muted-foreground" : ""} ${cp.completed ? "line-through text-muted-foreground" : ""}`}>
                            {cp.checkpointName}
                          </p>
                          {cp.optional && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0" data-testid={`badge-optional-${cp.id}`}>Optional</Badge>
                          )}
                          <button
                            onClick={() => toggleOptional.mutate({ id: cp.id, optional: !cp.optional })}
                            className="shrink-0 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                            title={cp.optional ? "Mark as required" : "Mark as optional"}
                            data-testid={`toggle-optional-${cp.id}`}
                          >
                            {cp.optional ? "Set Required" : "Set Optional"}
                          </button>
                          {hasRepo && (
                            <span className="shrink-0 flex items-center gap-1 text-xs" title={artifactStatusText(cp)}>
                              {artifactStatusIcon(cp)}
                            </span>
                          )}
                        </div>
                        {deliverable?.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{deliverable.description}</p>
                        )}

                        {cp.artifactFileName && (
                          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                            <a
                              href={cp.artifactUrl || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded hover:bg-muted/80 transition-colors"
                              data-testid={`link-artifact-${cp.id}`}
                            >
                              <FileText className="w-3 h-3" />
                              {cp.artifactFileName}
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                            {cp.artifactVerified && (
                              <Badge className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">Verified</Badge>
                            )}
                            {cp.artifactFileName && !cp.artifactVerified && (
                              <Badge className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">Unverified</Badge>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-5 px-1"
                              onClick={() => unlinkArtifactMutation.mutate(cp.id)}
                              disabled={unlinkArtifactMutation.isPending}
                              data-testid={`button-unlink-${cp.id}`}
                            >
                              <Unlink className="w-3 h-3" />
                            </Button>
                          </div>
                        )}

                        {cp.artifactSummary && (
                          <p className="text-xs text-muted-foreground mt-1 italic border-l-2 border-muted pl-2">
                            {cp.artifactSummary}
                          </p>
                        )}

                        {!cp.artifactFileName && hasRepo && (
                          <Dialog open={linkingCheckpointId === cp.id} onOpenChange={(open) => setLinkingCheckpointId(open ? cp.id : null)}>
                            <DialogTrigger asChild>
                              <button
                                className="text-xs text-primary hover:underline mt-1 flex items-center gap-1"
                                data-testid={`button-attach-${cp.id}`}
                              >
                                <Link2 className="w-3 h-3" />
                                Attach Artifact
                              </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle className="text-sm">Select File for: {cp.checkpointName}</DialogTitle>
                              </DialogHeader>
                              <div className="max-h-64 overflow-y-auto space-y-1">
                                {filesLoading && <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>}
                                {!filesLoading && repoFiles.length === 0 && (
                                  <p className="text-xs text-muted-foreground text-center py-4">No files found in the linked folder</p>
                                )}
                                {repoFiles.map(file => (
                                  <button
                                    key={file.id}
                                    onClick={() => linkArtifactMutation.mutate({ checkpointId: cp.id, file })}
                                    className="w-full text-left p-2 rounded hover:bg-muted transition-colors flex items-center gap-2"
                                    disabled={linkArtifactMutation.isPending}
                                    data-testid={`file-option-${file.id}`}
                                  >
                                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <div className="min-w-0 flex-1">
                                      <p className="text-xs font-medium truncate">{file.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {file.modifiedTime ? `Modified: ${new Date(file.modifiedTime).toLocaleDateString()}` : ""}
                                        {file.size ? ` — ${(parseInt(file.size) / 1024).toFixed(0)}KB` : ""}
                                      </p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </DialogContent>
                          </Dialog>
                        )}

                        {cp.completedAt && (
                          <p className="text-xs text-muted-foreground mt-1">Completed: {new Date(cp.completedAt).toLocaleDateString()}</p>
                        )}
                        {deliverable?.raciData && Object.keys(deliverable.raciData).length > 0 && (
                          <button
                            onClick={() => setExpandedRaci(raciExpanded ? null : cp.id)}
                            className="text-xs text-primary hover:underline mt-1 flex items-center gap-1"
                            data-testid={`button-raci-${cp.id}`}
                          >
                            {raciExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {raciExpanded ? "Hide" : "View"} RACI
                          </button>
                        )}
                        {raciExpanded && deliverable?.raciData && (
                          <div className="mt-2 border rounded-md overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-muted">
                                  <th className="text-left px-2 py-1 font-medium">Role</th>
                                  <th className="text-left px-2 py-1 font-medium">Responsibility</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(deliverable.raciData).map(([role, resp]) => (
                                  <tr key={role} className="border-t">
                                    <td className="px-2 py-1">{role}</td>
                                    <td className="px-2 py-1">
                                      <Badge variant="secondary" className="text-xs">{resp}</Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          <Card className="p-4" data-testid="raid-summary">
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              RAID Summary
            </h4>
            <div className="flex gap-4 text-xs">
              <span>Open Risks: <strong>{stageRaidItems.filter(r => r.itemType === "risk" && r.status === "open").length}</strong></span>
              <span>Open Issues: <strong>{stageRaidItems.filter(r => r.itemType === "issue" && r.status === "open").length}</strong></span>
              <span>Unresolved Deps: <strong>{stageRaidItems.filter(r => r.itemType === "dependency" && r.status === "open").length}</strong></span>
              <span>Unvalidated Assumptions: <strong>{stageRaidItems.filter(r => r.itemType === "assumption" && r.status === "open" && !r.validatedDate).length}</strong></span>
            </div>
            {openRaidItems.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {openRaidItems.length} open item(s) may impact gate readiness.
              </p>
            )}
          </Card>

          <Card className="p-5" data-testid="gate-panel">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  {gateStatusIcon(stageGate?.status)}
                  {selectedStage.gateName}
                </h4>
                {selectedStage.gateDescription && (
                  <p className="text-xs text-muted-foreground mt-1 max-w-2xl">{selectedStage.gateDescription}</p>
                )}
              </div>
              {stageGate && gateStatusBadge(stageGate.status)}
            </div>

            {totalCount > 0 && (
              <div className="text-xs text-muted-foreground mb-3 space-y-0.5">
                <p>Checkpoints: {completedCount} of {totalCount} complete ({completionPct}%)</p>
                {hasRepo && (
                  <p>Artifacts: {artifactsLinked} of {totalCount} linked, {artifactsVerified} verified</p>
                )}
              </div>
            )}

            {stageGate?.evaluatorResult && (
              <div className="mb-4 p-3 rounded-md bg-muted text-xs space-y-2" data-testid="evaluator-result">
                <p className="font-medium">AI Evaluator Assessment:</p>
                {(stageGate.evaluatorResult as any).missingItems?.length > 0 && (
                  <div>
                    <p className="font-medium text-red-600 dark:text-red-400">Missing Items:</p>
                    <ul className="list-disc pl-4">
                      {(stageGate.evaluatorResult as any).missingItems.map((item: string, i: number) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(stageGate.evaluatorResult as any).artifactFlags?.length > 0 && (
                  <div>
                    <p className="font-medium text-orange-600 dark:text-orange-400">Artifact Concerns:</p>
                    <ul className="list-disc pl-4">
                      {(stageGate.evaluatorResult as any).artifactFlags.map((flag: string, i: number) => (
                        <li key={i}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(stageGate.evaluatorResult as any).raidFlags?.length > 0 && (
                  <div>
                    <p className="font-medium text-amber-600 dark:text-amber-400">RAID Concerns:</p>
                    <ul className="list-disc pl-4">
                      {(stageGate.evaluatorResult as any).raidFlags.map((flag: string, i: number) => (
                        <li key={i}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(stageGate.evaluatorResult as any).recommendations?.length > 0 && (
                  <div>
                    <p className="font-medium text-blue-600 dark:text-blue-400">Recommendations:</p>
                    <ul className="list-disc pl-4">
                      {(stageGate.evaluatorResult as any).recommendations.map((rec: string, i: number) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={() => evaluateMutation.mutate(selectedStage.id)}
                disabled={evaluateMutation.isPending || stageCheckpoints.length === 0}
                data-testid="button-evaluate-gate"
              >
                {evaluateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1" />}
                {evaluateMutation.isPending ? "Evaluating..." : "Request Gate Evaluation"}
              </Button>

              {!opportunityMode && (stageGate?.status === "passed" || stageGate?.status === "exception") && nextStage && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => advanceMutation.mutate(nextStage.id)}
                  disabled={advanceMutation.isPending}
                  data-testid="button-advance-stage"
                >
                  <ArrowRight className="w-3.5 h-3.5 mr-1" />
                  Advance to Stage {nextStage.stageNumber}: {nextStage.name}
                </Button>
              )}

              {stageGate?.status === "failed" && (
                <div className="flex items-center gap-2 ml-auto">
                  <Textarea
                    value={gateNotes}
                    onChange={(e) => setGateNotes(e.target.value)}
                    placeholder="Justification for exception..."
                    className="h-9 min-h-[36px] text-xs w-64"
                    data-testid="input-exception-notes"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!gateNotes.trim()) {
                        toast({ title: "Justification required", variant: "destructive" });
                        return;
                      }
                      exceptionMutation.mutate({ gateId: stageGate.id, notes: gateNotes.trim() });
                    }}
                    disabled={exceptionMutation.isPending}
                    data-testid="button-request-exception"
                  >
                    Request Exception
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
