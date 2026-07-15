import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, X, Edit3, Trash2, Save, ChevronDown, Compass, ChevronUp, ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useGovernanceLabel } from "@/hooks/use-governance-label";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Layers, Power } from "lucide-react";
import type { FlightpathStage, FlightpathDeliverable, OperatingModel } from "@shared/schema";

type StageWithDeliverables = FlightpathStage & { deliverables: FlightpathDeliverable[] };

export const RACI_OPTIONS = [
  { value: "R", label: "R" },
  { value: "A", label: "A" },
  { value: "C", label: "C" },
  { value: "I", label: "I" },
  { value: "A/R", label: "A/R" },
];

export function FlightPathManager() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { label: govLabel } = useGovernanceLabel();
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [editingStage, setEditingStage] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<FlightpathStage>>({});
  const [addStageOpen, setAddStageOpen] = useState(false);
  const [newStageData, setNewStageData] = useState({ name: "", goal: "", description: "", gateName: "", gateDescription: "", playbookPurpose: "", playbookExitBundle: "" });
  const [addDeliverableStageId, setAddDeliverableStageId] = useState<string | null>(null);
  const [newDelName, setNewDelName] = useState("");
  const [newDelDescription, setNewDelDescription] = useState("");
  const [editingDeliverable, setEditingDeliverable] = useState<string | null>(null);
  const [editDelData, setEditDelData] = useState<{ name: string; description: string }>({ name: "", description: "" });
  const [editingRaci, setEditingRaci] = useState<string | null>(null);
  const [raciDraft, setRaciDraft] = useState<Record<string, string>>({});
  const [newRaciRole, setNewRaciRole] = useState("");
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [addModelOpen, setAddModelOpen] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [newModelDescription, setNewModelDescription] = useState("");
  const [editingModel, setEditingModel] = useState(false);
  const [editModelName, setEditModelName] = useState("");
  const [editModelDescription, setEditModelDescription] = useState("");

  const { data: models = [], isLoading: modelsLoading } = useQuery<OperatingModel[]>({
    queryKey: ["/api/operating-models"],
  });

  const { data: allStages = [], isLoading } = useQuery<StageWithDeliverables[]>({
    queryKey: ["/api/governance-model/stages"],
  });

  const activeModelId = selectedModelId ?? models[0]?.id ?? null;
  const activeModel = models.find(m => m.id === activeModelId) || null;
  const stages = activeModelId ? allStages.filter(s => s.operatingModelId === activeModelId) : allStages;

  const createModelMutation = useMutation({
    mutationFn: async (data: { name: string; description: string | null }) => {
      const res = await apiRequest("POST", "/api/operating-models", data);
      return res.json();
    },
    onSuccess: (created: OperatingModel) => {
      queryClient.invalidateQueries({ queryKey: ["/api/operating-models"] });
      toast({ title: t("governance.modelCreated") });
      setAddModelOpen(false);
      setNewModelName("");
      setNewModelDescription("");
      if (created?.id) setSelectedModelId(created.id);
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const updateModelMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/operating-models/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operating-models"] });
      toast({ title: t("governance.modelUpdated") });
      setEditingModel(false);
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const deleteModelMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/operating-models/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/operating-models"] });
      queryClient.invalidateQueries({ queryKey: ["/api/governance-model/stages"] });
      toast({ title: t("governance.modelDeleted") });
      setSelectedModelId(null);
    },
    onError: (err: Error) => {
      toast({ title: t("governance.modelDeleteBlocked"), description: err.message.replace(/^\d+:\s*/, ""), variant: "destructive" });
    },
  });

  const createStageMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiRequest("POST", "/api/governance-model/stages", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance-model/stages"] });
      toast({ title: t("governance.stageCreated") });
      setAddStageOpen(false);
      setNewStageData({ name: "", goal: "", description: "", gateName: "", gateDescription: "", playbookPurpose: "", playbookExitBundle: "" });
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      await apiRequest("PATCH", `/api/governance-model/stages/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance-model/stages"] });
      toast({ title: t("governance.stageUpdated") });
      setEditingStage(null);
    },
  });

  const deleteStageMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/governance-model/stages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance-model/stages"] });
      toast({ title: t("governance.stageDeleted") });
      setExpandedStage(null);
    },
  });

  const createDeliverableMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      await apiRequest("POST", `/api/flightpath-stages/${data.stageId}/deliverables`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance-model/stages"] });
      toast({ title: t("governance.deliverableCreated") });
      setAddDeliverableStageId(null);
      setNewDelName("");
      setNewDelDescription("");
    },
  });

  const updateDeliverableMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      await apiRequest("PATCH", `/api/governance-model/deliverables/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance-model/stages"] });
      toast({ title: t("governance.deliverableUpdated") });
      setEditingDeliverable(null);
      setEditingRaci(null);
    },
  });

  const deleteDeliverableMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/governance-model/deliverables/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance-model/stages"] });
      toast({ title: t("governance.deliverableDeleted") });
    },
  });

  const sortedStages = [...stages].sort((a, b) => a.sortOrder - b.sortOrder);

  const handleMoveStage = async (stageId: string, direction: "up" | "down") => {
    const idx = sortedStages.findIndex(s => s.id === stageId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sortedStages.length) return;
    const current = sortedStages[idx];
    const swap = sortedStages[swapIdx];
    try {
      await apiRequest("PATCH", `/api/governance-model/stages/${current.id}`, { sortOrder: swap.sortOrder, stageNumber: swap.stageNumber });
      await apiRequest("PATCH", `/api/governance-model/stages/${swap.id}`, { sortOrder: current.sortOrder, stageNumber: current.stageNumber });
    } catch {
      toast({ title: "Failed to reorder stages", variant: "destructive" });
    }
    queryClient.invalidateQueries({ queryKey: ["/api/governance-model/stages"] });
  };

  const handleMoveDeliverable = async (deliverableId: string, stageDeliverables: FlightpathDeliverable[], direction: "up" | "down") => {
    const sorted = [...stageDeliverables].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex(d => d.id === deliverableId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const current = sorted[idx];
    const swap = sorted[swapIdx];
    try {
      await apiRequest("PATCH", `/api/governance-model/deliverables/${current.id}`, { sortOrder: swap.sortOrder });
      await apiRequest("PATCH", `/api/governance-model/deliverables/${swap.id}`, { sortOrder: current.sortOrder });
    } catch {
      toast({ title: "Failed to reorder deliverables", variant: "destructive" });
    }
    queryClient.invalidateQueries({ queryKey: ["/api/governance-model/stages"] });
  };

  if (isLoading || modelsLoading) return <Skeleton className="h-40 w-full" />;

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-base font-semibold mb-1 flex items-center gap-2">
          <Compass className="w-4 h-4" />
          {govLabel} {t("governance.frameworkTitle")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("governance.frameworkDescription")}
        </p>
      </div>

      <Card className="p-4 mb-4" data-testid="operating-model-manager">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t("governance.operatingModel")}</span>
          </div>
          <Select value={activeModelId || ""} onValueChange={v => { setSelectedModelId(v); setEditingModel(false); }}>
            <SelectTrigger className="w-64" data-testid="select-manage-operating-model">
              <SelectValue placeholder={t("governance.selectOperatingModel")} />
            </SelectTrigger>
            <SelectContent>
              {models.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}{m.status !== "active" ? ` (${t("common.inactive")})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activeModel && (
            <Badge variant={activeModel.status === "active" ? "default" : "secondary"} data-testid="badge-model-status">
              {activeModel.status === "active" ? t("common.active") : t("common.inactive")}
            </Badge>
          )}
          <div className="flex items-center gap-1 ml-auto">
            <Button size="sm" variant="outline" onClick={() => { setAddModelOpen(true); setNewModelName(""); setNewModelDescription(""); }} data-testid="button-add-operating-model">
              <Plus className="w-3.5 h-3.5 mr-1" /> {t("governance.addModel")}
            </Button>
            {activeModel && (
              <>
                <Button size="icon" variant="ghost" onClick={() => { setEditingModel(true); setEditModelName(activeModel.name); setEditModelDescription(activeModel.description || ""); }} data-testid="button-edit-operating-model">
                  <Edit3 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  title={activeModel.status === "active" ? t("governance.deactivateModel") : t("governance.activateModel")}
                  onClick={() => updateModelMutation.mutate({ id: activeModel.id, data: { status: activeModel.status === "active" ? "inactive" : "active" } })}
                  data-testid="button-toggle-model-status"
                >
                  <Power className="w-3.5 h-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="text-destructive" data-testid="button-delete-operating-model">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("governance.deleteModel")}</AlertDialogTitle>
                      <AlertDialogDescription>{t("governance.deleteModelConfirm", { name: activeModel.name, count: stages.length })}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteModelMutation.mutate(activeModel.id)}>{t("common.delete")}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
        {activeModel?.description && !editingModel && (
          <p className="text-xs text-muted-foreground mt-2" data-testid="text-model-description">{activeModel.description}</p>
        )}
        {addModelOpen && (
          <div className="mt-3 pt-3 border-t space-y-2" data-testid="form-add-model">
            <div>
              <Label className="text-xs">{t("governance.modelName")}</Label>
              <Input value={newModelName} onChange={e => setNewModelName(e.target.value)} data-testid="input-new-model-name" />
            </div>
            <div>
              <Label className="text-xs">{t("governance.modelDescription")}</Label>
              <Textarea rows={2} value={newModelDescription} onChange={e => setNewModelDescription(e.target.value)} data-testid="input-new-model-description" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setAddModelOpen(false)}>{t("common.cancel")}</Button>
              <Button size="sm" disabled={!newModelName.trim() || createModelMutation.isPending} onClick={() => createModelMutation.mutate({ name: newModelName.trim(), description: newModelDescription.trim() || null })} data-testid="button-save-new-model">
                <Save className="w-3.5 h-3.5 mr-1" /> {t("common.save")}
              </Button>
            </div>
          </div>
        )}
        {editingModel && activeModel && (
          <div className="mt-3 pt-3 border-t space-y-2" data-testid="form-edit-model">
            <div>
              <Label className="text-xs">{t("governance.modelName")}</Label>
              <Input value={editModelName} onChange={e => setEditModelName(e.target.value)} data-testid="input-edit-model-name" />
            </div>
            <div>
              <Label className="text-xs">{t("governance.modelDescription")}</Label>
              <Textarea rows={2} value={editModelDescription} onChange={e => setEditModelDescription(e.target.value)} data-testid="input-edit-model-description" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setEditingModel(false)}>{t("common.cancel")}</Button>
              <Button size="sm" disabled={!editModelName.trim() || updateModelMutation.isPending} onClick={() => updateModelMutation.mutate({ id: activeModel.id, data: { name: editModelName.trim(), description: editModelDescription.trim() || null } })} data-testid="button-save-edit-model">
                <Save className="w-3.5 h-3.5 mr-1" /> {t("common.save")}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {stages.length === 0 && !addStageOpen ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">{t("governance.noStages")}</p>
          <Button size="sm" onClick={() => setAddStageOpen(true)} data-testid="button-add-first-stage">
            <Plus className="w-3.5 h-3.5 mr-1" /> {t("governance.addStage")}
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {sortedStages.map((stage, stageIdx) => {
            const isExpanded = expandedStage === stage.id;
            const isEditing = editingStage === stage.id;
            const sortedDeliverables = [...stage.deliverables].sort((a, b) => a.sortOrder - b.sortOrder);

            return (
              <Card key={stage.id} className="overflow-hidden" data-testid={`flightpath-stage-${stage.stageNumber}`}>
                <div
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => !isEditing && setExpandedStage(isExpanded ? null : stage.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      <div>
                        <h3 className="text-sm font-semibold" data-testid={`text-stage-name-${stage.stageNumber}`}>
                          Stage {stage.stageNumber}: {stage.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">{stage.goal}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs mr-1">{stage.deliverables.length} {t("governance.deliverables")}</Badge>
                      <Button size="icon" variant="ghost" onClick={e => { e.stopPropagation(); handleMoveStage(stage.id, "up"); }} disabled={stageIdx === 0} data-testid={`button-move-stage-up-${stage.stageNumber}`}>
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={e => { e.stopPropagation(); handleMoveStage(stage.id, "down"); }} disabled={stageIdx === sortedStages.length - 1} data-testid={`button-move-stage-down-${stage.stageNumber}`}>
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingStage(stage.id);
                          setEditData({
                            name: stage.name,
                            goal: stage.goal,
                            description: stage.description || "",
                            gateName: stage.gateName,
                            gateDescription: stage.gateDescription || "",
                            playbookPurpose: stage.playbookPurpose || "",
                            playbookExitBundle: stage.playbookExitBundle || "",
                          });
                          setExpandedStage(stage.id);
                        }}
                        data-testid={`button-edit-stage-${stage.stageNumber}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={e => e.stopPropagation()} data-testid={`button-delete-stage-${stage.stageNumber}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("governance.deleteStage")}</AlertDialogTitle>
                            <AlertDialogDescription>{t("governance.deleteStageConfirm", { name: stage.name, count: stage.deliverables.length })}</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteStageMutation.mutate(stage.id)}>{t("common.delete")}</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t px-4 pb-4">
                    {isEditing ? (
                      <div className="pt-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">{t("governance.stageName")}</Label>
                            <Input value={editData.name || ""} onChange={e => setEditData(d => ({...d, name: e.target.value}))} />
                          </div>
                          <div>
                            <Label className="text-xs">{t("governance.stageGoal")}</Label>
                            <Input value={editData.goal || ""} onChange={e => setEditData(d => ({...d, goal: e.target.value}))} />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">{t("governance.stageDescription")}</Label>
                          <Input value={editData.description || ""} onChange={e => setEditData(d => ({...d, description: e.target.value}))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs">{t("governance.gateName")}</Label>
                            <Input value={editData.gateName || ""} onChange={e => setEditData(d => ({...d, gateName: e.target.value}))} />
                          </div>
                          <div>
                            <Label className="text-xs">{t("governance.gateDescription")}</Label>
                            <Input value={editData.gateDescription || ""} onChange={e => setEditData(d => ({...d, gateDescription: e.target.value}))} />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">{t("governance.playbookPurpose")}</Label>
                          <Input value={editData.playbookPurpose || ""} onChange={e => setEditData(d => ({...d, playbookPurpose: e.target.value}))} />
                        </div>
                        <div>
                          <Label className="text-xs">{t("governance.exitBundle")}</Label>
                          <Input value={editData.playbookExitBundle || ""} onChange={e => setEditData(d => ({...d, playbookExitBundle: e.target.value}))} />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button size="sm" variant="ghost" onClick={() => setEditingStage(null)}><X className="w-3.5 h-3.5 mr-1" /> {t("common.cancel")}</Button>
                          <Button size="sm" onClick={() => updateStageMutation.mutate({ id: stage.id, data: editData })} disabled={updateStageMutation.isPending}>
                            <Save className="w-3.5 h-3.5 mr-1" /> {t("common.save")}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-4 space-y-4">
                        {stage.description && (
                          <div className="text-xs"><span className="font-medium">{t("governance.stageDescription")}:</span> {stage.description}</div>
                        )}
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div><span className="font-medium">{t("governance.gateName")}:</span> {stage.gateName}</div>
                          {stage.gateDescription && <div><span className="font-medium">{t("governance.gateCriteria")}:</span> {stage.gateDescription}</div>}
                        </div>
                        {stage.playbookPurpose && (
                          <div className="text-xs"><span className="font-medium">{t("governance.playbookPurpose")}:</span> {stage.playbookPurpose}</div>
                        )}
                        {stage.playbookExitBundle && (
                          <div className="text-xs"><span className="font-medium">{t("governance.exitBundle")}:</span> {stage.playbookExitBundle}</div>
                        )}

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-semibold">{t("governance.deliverables")} ({stage.deliverables.length})</h4>
                            <Button size="sm" variant="outline" onClick={() => { setAddDeliverableStageId(stage.id); setNewDelName(""); setNewDelDescription(""); }} data-testid={`button-add-deliverable-${stage.stageNumber}`}>
                              <Plus className="w-3 h-3 mr-1" /> {t("governance.addDeliverable")}
                            </Button>
                          </div>

                          {addDeliverableStageId === stage.id && (
                            <Card className="p-3 mb-3 border-dashed" data-testid="form-add-deliverable">
                              <div className="space-y-2">
                                <div>
                                  <Label className="text-xs">{t("governance.deliverableName")}</Label>
                                  <Input value={newDelName} onChange={e => setNewDelName(e.target.value)} placeholder={t("governance.deliverableNamePlaceholder")} data-testid="input-new-deliverable-name" />
                                </div>
                                <div>
                                  <Label className="text-xs">{t("governance.deliverableDescription")}</Label>
                                  <Input value={newDelDescription} onChange={e => setNewDelDescription(e.target.value)} placeholder={t("governance.deliverableDescriptionPlaceholder")} data-testid="input-new-deliverable-description" />
                                </div>
                                <div className="flex gap-2 justify-end">
                                  <Button size="sm" variant="ghost" onClick={() => setAddDeliverableStageId(null)}>{t("common.cancel")}</Button>
                                  <Button size="sm" disabled={!newDelName.trim() || createDeliverableMutation.isPending} onClick={() => {
                                    const maxSort = stage.deliverables.reduce((max, d) => Math.max(max, d.sortOrder), -1);
                                    createDeliverableMutation.mutate({ stageId: stage.id, name: newDelName.trim(), description: newDelDescription.trim() || null, sortOrder: maxSort + 1 });
                                  }} data-testid="button-save-deliverable">
                                    <Save className="w-3 h-3 mr-1" /> {t("common.save")}
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          )}

                          <div className="space-y-2">
                            {sortedDeliverables.map((del, idx) => {
                              const isEditingDel = editingDeliverable === del.id;
                              const isEditingDelRaci = editingRaci === del.id;

                              return (
                                <Card key={del.id} className="p-3" data-testid={`deliverable-${del.id}`}>
                                  {isEditingDel ? (
                                    <div className="space-y-2">
                                      <div>
                                        <Label className="text-xs">{t("governance.deliverableName")}</Label>
                                        <Input value={editDelData.name} onChange={e => setEditDelData(d => ({...d, name: e.target.value}))} data-testid={`input-edit-deliverable-name-${del.id}`} />
                                      </div>
                                      <div>
                                        <Label className="text-xs">{t("governance.deliverableDescription")}</Label>
                                        <Input value={editDelData.description} onChange={e => setEditDelData(d => ({...d, description: e.target.value}))} data-testid={`input-edit-deliverable-desc-${del.id}`} />
                                      </div>
                                      <div className="flex gap-2 justify-end">
                                        <Button size="sm" variant="ghost" onClick={() => setEditingDeliverable(null)}>{t("common.cancel")}</Button>
                                        <Button size="sm" disabled={!editDelData.name.trim()} onClick={() => updateDeliverableMutation.mutate({ id: del.id, data: { name: editDelData.name.trim(), description: editDelData.description.trim() || null } })} data-testid={`button-save-edit-deliverable-${del.id}`}>
                                          <Save className="w-3 h-3 mr-1" /> {t("common.save")}
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium">{idx + 1}. {del.name}</p>
                                        {del.description && <p className="text-xs text-muted-foreground mt-0.5">{del.description}</p>}

                                        {isEditingDelRaci ? (
                                          <div className="mt-2 border rounded p-2 space-y-2 bg-muted/20">
                                            <div className="flex items-center justify-between">
                                              <Label className="text-xs font-semibold">{t("governance.editRaci")}</Label>
                                            </div>
                                            {Object.entries(raciDraft).map(([role, resp]) => (
                                              <div key={role} className="flex items-center gap-2">
                                                <span className="text-xs flex-1 min-w-0 truncate">{role}</span>
                                                <Select value={resp} onValueChange={v => setRaciDraft(d => ({...d, [role]: v}))}>
                                                  <SelectTrigger className="w-24 h-7 text-xs" data-testid={`select-raci-${del.id}-${role}`}>
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {RACI_OPTIONS.map(o => (
                                                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => {
                                                  const next = {...raciDraft};
                                                  delete next[role];
                                                  setRaciDraft(next);
                                                }} data-testid={`button-remove-raci-role-${del.id}-${role}`}>
                                                  <X className="w-3 h-3" />
                                                </Button>
                                              </div>
                                            ))}
                                            <div className="flex items-center gap-2 pt-1 border-t">
                                              <Input value={newRaciRole} onChange={e => setNewRaciRole(e.target.value)} placeholder={t("governance.newRolePlaceholder")} className="h-7 text-xs flex-1" data-testid={`input-new-raci-role-${del.id}`} />
                                              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!newRaciRole.trim() || newRaciRole.trim() in raciDraft} onClick={() => {
                                                setRaciDraft(d => ({...d, [newRaciRole.trim()]: "R"}));
                                                setNewRaciRole("");
                                              }} data-testid={`button-add-raci-role-${del.id}`}>
                                                <Plus className="w-3 h-3 mr-1" /> {t("governance.addRole")}
                                              </Button>
                                            </div>
                                            <div className="flex gap-2 justify-end pt-1">
                                              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingRaci(null)}>{t("common.cancel")}</Button>
                                              <Button size="sm" className="h-7 text-xs" onClick={() => updateDeliverableMutation.mutate({ id: del.id, data: { raciData: raciDraft } })} data-testid={`button-save-raci-${del.id}`}>
                                                <Save className="w-3 h-3 mr-1" /> {t("common.save")}
                                              </Button>
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            {del.raciData && Object.keys(del.raciData).length > 0 && (
                                              <div className="mt-2 border rounded overflow-hidden">
                                                <table className="w-full text-xs">
                                                  <thead>
                                                    <tr className="bg-muted">
                                                      <th className="text-left px-2 py-1 font-medium">{t("governance.raciRole")}</th>
                                                      <th className="text-left px-2 py-1 font-medium">{t("governance.raciAssignment")}</th>
                                                    </tr>
                                                  </thead>
                                                  <tbody>
                                                    {Object.entries(del.raciData).map(([role, resp]) => (
                                                      <tr key={role} className="border-t">
                                                        <td className="px-2 py-0.5 text-xs">{role}</td>
                                                        <td className="px-2 py-0.5"><Badge variant="secondary" className="text-xs">{resp}</Badge></td>
                                                      </tr>
                                                    ))}
                                                  </tbody>
                                                </table>
                                              </div>
                                            )}
                                            <Button size="sm" variant="link" className="text-xs mt-1 h-auto p-0" onClick={() => {
                                              setEditingRaci(del.id);
                                              setRaciDraft(del.raciData ? {...del.raciData} : {});
                                              setNewRaciRole("");
                                            }} data-testid={`button-edit-raci-${del.id}`}>
                                              <Edit3 className="w-3 h-3 mr-1" /> {t("governance.editRaci")}
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                      <div className="flex flex-col gap-0.5">
                                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleMoveDeliverable(del.id, stage.deliverables, "up")} disabled={idx === 0} data-testid={`button-move-del-up-${del.id}`}>
                                          <ArrowUp className="w-3 h-3" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleMoveDeliverable(del.id, stage.deliverables, "down")} disabled={idx === sortedDeliverables.length - 1} data-testid={`button-move-del-down-${del.id}`}>
                                          <ArrowDown className="w-3 h-3" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditingDeliverable(del.id); setEditDelData({ name: del.name, description: del.description || "" }); }} data-testid={`button-edit-deliverable-${del.id}`}>
                                          <Edit3 className="w-3 h-3" />
                                        </Button>
                                        <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" data-testid={`button-delete-deliverable-${del.id}`}>
                                              <Trash2 className="w-3 h-3" />
                                            </Button>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                            <AlertDialogHeader>
                                              <AlertDialogTitle>{t("governance.deleteDeliverable")}</AlertDialogTitle>
                                              <AlertDialogDescription>{t("governance.deleteDeliverableConfirm", { name: del.name })}</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                              <AlertDialogAction onClick={() => deleteDeliverableMutation.mutate(del.id)}>{t("common.delete")}</AlertDialogAction>
                                            </AlertDialogFooter>
                                          </AlertDialogContent>
                                        </AlertDialog>
                                      </div>
                                    </div>
                                  )}
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}

          {!addStageOpen && (
            <Button variant="outline" className="w-full" onClick={() => setAddStageOpen(true)} data-testid="button-add-stage">
              <Plus className="w-4 h-4 mr-2" /> {t("governance.addStage")}
            </Button>
          )}
        </div>
      )}

      {addStageOpen && (
        <Card className="p-4 mt-3 border-dashed" data-testid="form-add-stage">
          <h4 className="text-sm font-semibold mb-3">{t("governance.addStage")}</h4>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t("governance.stageName")}</Label>
                <Input value={newStageData.name} onChange={e => setNewStageData(d => ({...d, name: e.target.value}))} data-testid="input-new-stage-name" />
              </div>
              <div>
                <Label className="text-xs">{t("governance.stageGoal")}</Label>
                <Input value={newStageData.goal} onChange={e => setNewStageData(d => ({...d, goal: e.target.value}))} data-testid="input-new-stage-goal" />
              </div>
            </div>
            <div>
              <Label className="text-xs">{t("governance.stageDescription")}</Label>
              <Input value={newStageData.description} onChange={e => setNewStageData(d => ({...d, description: e.target.value}))} data-testid="input-new-stage-description" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t("governance.gateName")}</Label>
                <Input value={newStageData.gateName} onChange={e => setNewStageData(d => ({...d, gateName: e.target.value}))} data-testid="input-new-stage-gate-name" />
              </div>
              <div>
                <Label className="text-xs">{t("governance.gateDescription")}</Label>
                <Input value={newStageData.gateDescription} onChange={e => setNewStageData(d => ({...d, gateDescription: e.target.value}))} data-testid="input-new-stage-gate-description" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t("governance.playbookPurpose")}</Label>
                <Input value={newStageData.playbookPurpose} onChange={e => setNewStageData(d => ({...d, playbookPurpose: e.target.value}))} data-testid="input-new-stage-playbook" />
              </div>
              <div>
                <Label className="text-xs">{t("governance.exitBundle")}</Label>
                <Input value={newStageData.playbookExitBundle} onChange={e => setNewStageData(d => ({...d, playbookExitBundle: e.target.value}))} data-testid="input-new-stage-exit-bundle" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setAddStageOpen(false)}>{t("common.cancel")}</Button>
              <Button size="sm" disabled={!newStageData.name.trim() || !newStageData.goal.trim() || !newStageData.gateName.trim() || createStageMutation.isPending} onClick={() => {
                const maxNumber = stages.reduce((max, s) => Math.max(max, s.stageNumber), -1);
                const maxSort = stages.reduce((max, s) => Math.max(max, s.sortOrder), -1);
                createStageMutation.mutate({ ...newStageData, operatingModelId: activeModelId, stageNumber: maxNumber + 1, sortOrder: maxSort + 1 });
              }} data-testid="button-save-new-stage">
                <Save className="w-3.5 h-3.5 mr-1" /> {t("common.save")}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
