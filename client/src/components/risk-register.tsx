import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus,
  Edit3,
  Trash2,
  X,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
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
import type { Risk, AppSettings, FieldOption } from "@shared/schema";
import {
  DEFAULT_RISK_PROBABILITIES,
  DEFAULT_RISK_IMPACTS,
  DEFAULT_RISK_STATUSES,
} from "@shared/schema";

const SCORE_MAP: Record<string, number> = {
  low: 1,
  medium: 2,
  high: 3,
  very_high: 4,
};

function riskScore(probability: string, impact: string): number {
  return (SCORE_MAP[probability] || 2) * (SCORE_MAP[impact] || 2);
}

function riskScoreColor(score: number): string {
  if (score <= 2) return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
  if (score <= 6) return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
  return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
}

function statusColor(status: string): string {
  if (status === "closed") return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
  if (status === "mitigated") return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
  if (status === "accepted") return "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300";
  return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
}

interface RiskRegisterProps {
  timelineId: string;
}

export function RiskRegister({ timelineId }: RiskRegisterProps) {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null);
  const [editingRiskId, setEditingRiskId] = useState<string | null>(null);

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });
  const riskProbabilities = settings?.riskProbabilities || DEFAULT_RISK_PROBABILITIES;
  const riskImpacts = settings?.riskImpacts || DEFAULT_RISK_IMPACTS;
  const riskStatuses = settings?.riskStatuses || DEFAULT_RISK_STATUSES;
  const probLabel = (v: string) => riskProbabilities.find((o) => o.value === v)?.label || v;
  const impactLabel = (v: string) => riskImpacts.find((o) => o.value === v)?.label || v;
  const statusLabel = (v: string) => riskStatuses.find((o) => o.value === v)?.label || v;

  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [newProbability, setNewProbability] = useState("medium");
  const [newImpact, setNewImpact] = useState("medium");
  const [newMitigation, setNewMitigation] = useState("");
  const [newContingency, setNewContingency] = useState("");
  const [newStatus, setNewStatus] = useState("open");
  const [newDueDate, setNewDueDate] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editProbability, setEditProbability] = useState("medium");
  const [editImpact, setEditImpact] = useState("medium");
  const [editMitigation, setEditMitigation] = useState("");
  const [editContingency, setEditContingency] = useState("");
  const [editStatus, setEditStatus] = useState("open");
  const [editDueDate, setEditDueDate] = useState("");

  const { data: risks = [] } = useQuery<Risk[]>({
    queryKey: ["/api/timelines", timelineId, "risks"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", `/api/timelines/${timelineId}/risks`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "risks"] });
      toast({ title: "Risk added" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ riskId, data }: { riskId: string; data: any }) => {
      await apiRequest("PATCH", `/api/risks/${riskId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "risks"] });
      toast({ title: "Risk updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (riskId: string) => {
      await apiRequest("DELETE", `/api/risks/${riskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "risks"] });
      toast({ title: "Risk deleted" });
    },
  });

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    addMutation.mutate(
      {
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        category: newCategory.trim() || null,
        owner: newOwner.trim() || null,
        probability: newProbability,
        impact: newImpact,
        mitigation: newMitigation.trim() || null,
        contingency: newContingency.trim() || null,
        status: newStatus,
        dueDate: newDueDate.trim() || null,
        sortOrder: risks.length,
      },
      {
        onSuccess: () => {
          setNewTitle("");
          setNewDesc("");
          setNewCategory("");
          setNewOwner("");
          setNewProbability("medium");
          setNewImpact("medium");
          setNewMitigation("");
          setNewContingency("");
          setNewStatus("open");
          setNewDueDate("");
          setShowAddForm(false);
        },
      }
    );
  };

  const startEditing = (r: Risk) => {
    setEditingRiskId(r.id);
    setEditTitle(r.title);
    setEditDesc(r.description || "");
    setEditCategory(r.category || "");
    setEditOwner(r.owner || "");
    setEditProbability(r.probability);
    setEditImpact(r.impact);
    setEditMitigation(r.mitigation || "");
    setEditContingency(r.contingency || "");
    setEditStatus(r.status);
    setEditDueDate(r.dueDate || "");
  };

  const saveEdit = () => {
    if (!editingRiskId || !editTitle.trim()) return;
    updateMutation.mutate(
      {
        riskId: editingRiskId,
        data: {
          title: editTitle.trim(),
          description: editDesc.trim() || null,
          category: editCategory.trim() || null,
          owner: editOwner.trim() || null,
          probability: editProbability,
          impact: editImpact,
          mitigation: editMitigation.trim() || null,
          contingency: editContingency.trim() || null,
          status: editStatus,
          dueDate: editDueDate.trim() || null,
        },
      },
      { onSuccess: () => setEditingRiskId(null) }
    );
  };

  const selectClass = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm";

  return (
    <div className="mt-8 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Risk Register
          {risks.length > 0 && (
            <Badge variant="secondary" className="text-xs">{risks.length}</Badge>
          )}
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowAddForm(!showAddForm)}
          data-testid="button-add-risk"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Risk
        </Button>
      </div>

      {showAddForm && (
        <Card className="p-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Title *</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Risk title"
                data-testid="input-new-risk-title"
              />
            </div>
            <div className="w-40">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
              <Input
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g. Technical"
                data-testid="input-new-risk-category"
              />
            </div>
            <div className="w-40">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Owner</label>
              <Input
                value={newOwner}
                onChange={(e) => setNewOwner(e.target.value)}
                placeholder="Risk owner"
                data-testid="input-new-risk-owner"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <Input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Describe the risk"
                data-testid="input-new-risk-desc"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="w-36">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Probability</label>
              <select value={newProbability} onChange={(e) => setNewProbability(e.target.value)} className={selectClass} data-testid="select-new-risk-probability">
                {riskProbabilities.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="w-36">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Impact</label>
              <select value={newImpact} onChange={(e) => setNewImpact(e.target.value)} className={selectClass} data-testid="select-new-risk-impact">
                {riskImpacts.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="w-36">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className={selectClass} data-testid="select-new-risk-status">
                {riskStatuses.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="w-36">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Due Date</label>
              <Input
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                placeholder="e.g. Mar 2025"
                data-testid="input-new-risk-due"
              />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Mitigation Strategy</label>
              <Input
                value={newMitigation}
                onChange={(e) => setNewMitigation(e.target.value)}
                placeholder="How to reduce this risk"
                data-testid="input-new-risk-mitigation"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Contingency Plan</label>
              <Input
                value={newContingency}
                onChange={(e) => setNewContingency(e.target.value)}
                placeholder="Fallback if risk occurs"
                data-testid="input-new-risk-contingency"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}>
              <X className="w-3.5 h-3.5 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newTitle.trim() || addMutation.isPending}
              data-testid="button-submit-risk"
            >
              {addMutation.isPending ? "Adding..." : "Add Risk"}
            </Button>
          </div>
        </Card>
      )}

      {risks.length === 0 && !showAddForm && (
        <Card className="p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No risks registered yet. Add a risk to start tracking.</p>
        </Card>
      )}

      {risks.map((r) => {
        const score = riskScore(r.probability, r.impact);
        const isExpanded = expandedRisk === r.id;
        const isEditing = editingRiskId === r.id;

        return (
          <Card key={r.id} className="p-3" data-testid={`risk-card-${r.id}`}>
            {isEditing ? (
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title" data-testid={`input-edit-risk-title-${r.id}`} />
                  </div>
                  <div className="w-40">
                    <Input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} placeholder="Category" />
                  </div>
                  <div className="w-40">
                    <Input value={editOwner} onChange={(e) => setEditOwner(e.target.value)} placeholder="Owner" />
                  </div>
                </div>
                <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" />
                <div className="flex gap-2 flex-wrap">
                  <div className="w-36">
                    <select value={editProbability} onChange={(e) => setEditProbability(e.target.value)} className={selectClass}>
                      {riskProbabilities.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-36">
                    <select value={editImpact} onChange={(e) => setEditImpact(e.target.value)} className={selectClass}>
                      {riskImpacts.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-36">
                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className={selectClass}>
                      {riskStatuses.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-36">
                    <Input value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} placeholder="Due date" />
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <Input value={editMitigation} onChange={(e) => setEditMitigation(e.target.value)} placeholder="Mitigation strategy" />
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <Input value={editContingency} onChange={(e) => setEditContingency(e.target.value)} placeholder="Contingency plan" />
                  </div>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setEditingRiskId(null)}>
                    <X className="w-3.5 h-3.5 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" onClick={saveEdit} disabled={!editTitle.trim() || updateMutation.isPending}>
                    <Check className="w-3.5 h-3.5 mr-1" /> {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer" onClick={() => setExpandedRisk(isExpanded ? null : r.id)}>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
                    <p className="text-sm font-medium truncate" data-testid={`text-risk-title-${r.id}`}>{r.title}</p>
                    <Badge variant="secondary" className={`text-xs shrink-0 ${riskScoreColor(score)}`}>
                      Score: {score}
                    </Badge>
                    <Badge variant="secondary" className={`text-xs shrink-0 ${statusColor(r.status)}`}>
                      {statusLabel(r.status)}
                    </Badge>
                    {r.category && <Badge variant="outline" className="text-xs shrink-0">{r.category}</Badge>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => startEditing(r)} data-testid={`button-edit-risk-${r.id}`}>
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" data-testid={`button-delete-risk-${r.id}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete risk?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently remove "{r.title}" from the risk register.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(r.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {isExpanded && (
                  <div className="mt-3 pl-6 space-y-2 text-xs text-muted-foreground">
                    {r.description && <p><span className="font-medium text-foreground">Description:</span> {r.description}</p>}
                    <div className="flex gap-4 flex-wrap">
                      <p><span className="font-medium text-foreground">Probability:</span> {probLabel(r.probability)}</p>
                      <p><span className="font-medium text-foreground">Impact:</span> {impactLabel(r.impact)}</p>
                      {r.owner && <p><span className="font-medium text-foreground">Owner:</span> {r.owner}</p>}
                      {r.dueDate && <p><span className="font-medium text-foreground">Due:</span> {r.dueDate}</p>}
                    </div>
                    {r.mitigation && <p><span className="font-medium text-foreground">Mitigation:</span> {r.mitigation}</p>}
                    {r.contingency && <p><span className="font-medium text-foreground">Contingency:</span> {r.contingency}</p>}
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
