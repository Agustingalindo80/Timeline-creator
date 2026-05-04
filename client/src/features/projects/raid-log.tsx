import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus, Edit3, Trash2, X, Check, AlertTriangle, ChevronDown, ChevronUp,
  ShieldAlert, HelpCircle, AlertCircle, Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Risk, AppSettings } from "@shared/schema";
import { getDefaultFieldOptions } from "@shared/schema";

const SCORE_MAP: Record<string, number> = { low: 1, medium: 2, high: 3, very_high: 4 };
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

const ITEM_TYPES = [
  { value: "all", label: "All", icon: AlertTriangle },
  { value: "risk", label: "Risks", icon: ShieldAlert },
  { value: "assumption", label: "Assumptions", icon: HelpCircle },
  { value: "issue", label: "Issues", icon: AlertCircle },
  { value: "dependency", label: "Dependencies", icon: Link2 },
] as const;

const itemTypeLabel = (t: string) => ITEM_TYPES.find(i => i.value === t)?.label || t;

interface RaidLogProps {
  timelineId: string;
}

export function RaidLog({ timelineId }: RaidLogProps) {
  const { toast } = useToast();
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("all");

  const { data: settings } = useQuery<AppSettings>({ queryKey: ["/api/settings"] });
  const riskProbabilities = settings?.riskProbabilities || getDefaultFieldOptions("riskProbabilities", settings?.locale || "en");
  const riskImpacts = settings?.riskImpacts || getDefaultFieldOptions("riskImpacts", settings?.locale || "en");
  const riskStatuses = settings?.riskStatuses || getDefaultFieldOptions("riskStatuses", settings?.locale || "en");
  const probLabel = (v: string) => riskProbabilities.find(o => o.value === v)?.label || v;
  const impactLabel = (v: string) => riskImpacts.find(o => o.value === v)?.label || v;
  const statusLabel = (v: string) => riskStatuses.find(o => o.value === v)?.label || v;

  const [newItemType, setNewItemType] = useState("risk");
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
  const [newRaisedDate, setNewRaisedDate] = useState("");
  const [newValidationCriteria, setNewValidationCriteria] = useState("");
  const [newDependencySource, setNewDependencySource] = useState("");
  const [newRequiredByDate, setNewRequiredByDate] = useState("");

  const [editItemType, setEditItemType] = useState("risk");
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
  const [editRaisedDate, setEditRaisedDate] = useState("");
  const [editValidationCriteria, setEditValidationCriteria] = useState("");
  const [editDependencySource, setEditDependencySource] = useState("");
  const [editRequiredByDate, setEditRequiredByDate] = useState("");

  const { data: allItems = [] } = useQuery<Risk[]>({
    queryKey: ["/api/timelines", timelineId, "risks"],
  });

  const items = filterType === "all" ? allItems : allItems.filter(r => r.itemType === filterType);

  const addMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => { await apiRequest("POST", `/api/timelines/${timelineId}/risks`, data); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "risks"] });
      toast({ title: "Item added" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => { await apiRequest("PATCH", `/api/risks/${id}`, data); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "risks"] });
      toast({ title: "Item updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiRequest("DELETE", `/api/risks/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId, "risks"] });
      toast({ title: "Item deleted" });
    },
  });

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    addMutation.mutate({
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
      itemType: newItemType,
      raisedDate: newRaisedDate.trim() || null,
      validationCriteria: newValidationCriteria.trim() || null,
      dependencySource: newDependencySource.trim() || null,
      requiredByDate: newRequiredByDate.trim() || null,
      sortOrder: allItems.length,
    }, {
      onSuccess: () => {
        setNewTitle(""); setNewDesc(""); setNewCategory(""); setNewOwner("");
        setNewProbability("medium"); setNewImpact("medium"); setNewMitigation("");
        setNewContingency(""); setNewStatus("open"); setNewDueDate("");
        setNewRaisedDate(""); setNewValidationCriteria(""); setNewDependencySource("");
        setNewRequiredByDate(""); setShowAddForm(false);
      },
    });
  };

  const startEditing = (r: Risk) => {
    setEditingId(r.id);
    setEditItemType(r.itemType || "risk");
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
    setEditRaisedDate(r.raisedDate || "");
    setEditValidationCriteria(r.validationCriteria || "");
    setEditDependencySource(r.dependencySource || "");
    setEditRequiredByDate(r.requiredByDate || "");
  };

  const saveEdit = () => {
    if (!editingId || !editTitle.trim()) return;
    updateMutation.mutate({
      id: editingId,
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
        itemType: editItemType,
        raisedDate: editRaisedDate.trim() || null,
        validationCriteria: editValidationCriteria.trim() || null,
        dependencySource: editDependencySource.trim() || null,
        requiredByDate: editRequiredByDate.trim() || null,
      },
    }, { onSuccess: () => setEditingId(null) });
  };

  const selectClass = "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm";

  const typeSpecificFields = (type: string, prefix: "new" | "edit") => {
    const isNew = prefix === "new";
    if (type === "risk") return (
      <div className="flex gap-2 flex-wrap">
        <div className="w-36">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Probability</label>
          <select value={isNew ? newProbability : editProbability} onChange={(e) => isNew ? setNewProbability(e.target.value) : setEditProbability(e.target.value)} className={selectClass} data-testid={`select-${prefix}-probability`}>
            {riskProbabilities.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div className="w-36">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Impact</label>
          <select value={isNew ? newImpact : editImpact} onChange={(e) => isNew ? setNewImpact(e.target.value) : setEditImpact(e.target.value)} className={selectClass} data-testid={`select-${prefix}-impact`}>
            {riskImpacts.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Mitigation</label>
          <Input value={isNew ? newMitigation : editMitigation} onChange={(e) => isNew ? setNewMitigation(e.target.value) : setEditMitigation(e.target.value)} placeholder="Mitigation strategy" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Contingency</label>
          <Input value={isNew ? newContingency : editContingency} onChange={(e) => isNew ? setNewContingency(e.target.value) : setEditContingency(e.target.value)} placeholder="Contingency plan" />
        </div>
      </div>
    );
    if (type === "assumption") return (
      <div className="flex gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Validation Criteria</label>
          <Input value={isNew ? newValidationCriteria : editValidationCriteria} onChange={(e) => isNew ? setNewValidationCriteria(e.target.value) : setEditValidationCriteria(e.target.value)} placeholder="How to validate this assumption" data-testid={`input-${prefix}-validation`} />
        </div>
      </div>
    );
    if (type === "dependency") return (
      <div className="flex gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Dependency Source</label>
          <Input value={isNew ? newDependencySource : editDependencySource} onChange={(e) => isNew ? setNewDependencySource(e.target.value) : setEditDependencySource(e.target.value)} placeholder="Who/what we depend on" data-testid={`input-${prefix}-dep-source`} />
        </div>
        <div className="w-40">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Required By</label>
          <Input value={isNew ? newRequiredByDate : editRequiredByDate} onChange={(e) => isNew ? setNewRequiredByDate(e.target.value) : setEditRequiredByDate(e.target.value)} placeholder="e.g. 2025-03-15" data-testid={`input-${prefix}-required-by`} />
        </div>
      </div>
    );
    return null;
  };

  const itemIcon = (type: string) => {
    const found = ITEM_TYPES.find(i => i.value === type);
    const Icon = found?.icon || AlertTriangle;
    return <Icon className="w-3.5 h-3.5" />;
  };

  const typeBadgeColor = (type: string) => {
    switch (type) {
      case "risk": return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
      case "assumption": return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
      case "issue": return "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300";
      case "dependency": return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
      default: return "";
    }
  };

  const counts = {
    all: allItems.length,
    risk: allItems.filter(r => r.itemType === "risk").length,
    assumption: allItems.filter(r => r.itemType === "assumption").length,
    issue: allItems.filter(r => r.itemType === "issue").length,
    dependency: allItems.filter(r => r.itemType === "dependency").length,
  };

  return (
    <div className="mt-8 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          RAID Log
          {allItems.length > 0 && <Badge variant="secondary" className="text-xs">{allItems.length}</Badge>}
        </h3>
        <Button size="sm" variant="outline" onClick={() => setShowAddForm(!showAddForm)} data-testid="button-add-raid-item">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
        </Button>
      </div>

      <Tabs value={filterType} onValueChange={setFilterType}>
        <TabsList data-testid="raid-type-tabs">
          {ITEM_TYPES.map(t => (
            <TabsTrigger key={t.value} value={t.value} data-testid={`tab-raid-${t.value}`}>
              {t.label} {counts[t.value as keyof typeof counts] > 0 && <Badge variant="secondary" className="ml-1 text-xs px-1.5">{counts[t.value as keyof typeof counts]}</Badge>}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {showAddForm && (
        <Card className="p-4 space-y-3">
          <div className="flex gap-2 flex-wrap">
            <div className="w-44">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Type *</label>
              <select value={newItemType} onChange={(e) => setNewItemType(e.target.value)} className={selectClass} data-testid="select-new-item-type">
                <option value="risk">Risk</option>
                <option value="assumption">Assumption</option>
                <option value="issue">Issue</option>
                <option value="dependency">Dependency</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Title *</label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Item title" data-testid="input-new-raid-title" />
            </div>
            <div className="w-40">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Owner</label>
              <Input value={newOwner} onChange={(e) => setNewOwner(e.target.value)} placeholder="Owner" data-testid="input-new-raid-owner" />
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Describe the item" data-testid="input-new-raid-desc" />
            </div>
            <div className="w-36">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Status</label>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className={selectClass} data-testid="select-new-raid-status">
                {riskStatuses.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div className="w-36">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Raised Date</label>
              <Input type="date" value={newRaisedDate} onChange={(e) => setNewRaisedDate(e.target.value)} data-testid="input-new-raid-raised" />
            </div>
          </div>
          {typeSpecificFields(newItemType, "new")}
          <div className="flex items-center gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)}><X className="w-3.5 h-3.5 mr-1" /> Cancel</Button>
            <Button size="sm" onClick={handleAdd} disabled={!newTitle.trim() || addMutation.isPending} data-testid="button-submit-raid-item">
              {addMutation.isPending ? "Adding..." : `Add ${itemTypeLabel(newItemType).replace(/s$/, "")}`}
            </Button>
          </div>
        </Card>
      )}

      {items.length === 0 && !showAddForm && (
        <Card className="p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No {filterType === "all" ? "RAID items" : itemTypeLabel(filterType).toLowerCase()} registered yet.</p>
        </Card>
      )}

      {items.map(r => {
        const score = r.itemType === "risk" ? riskScore(r.probability, r.impact) : 0;
        const isExpanded = expandedItem === r.id;
        const isEditing = editingId === r.id;

        return (
          <Card key={r.id} className="p-3" data-testid={`raid-card-${r.id}`}>
            {isEditing ? (
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  <div className="w-44">
                    <select value={editItemType} onChange={(e) => setEditItemType(e.target.value)} className={selectClass}>
                      <option value="risk">Risk</option><option value="assumption">Assumption</option>
                      <option value="issue">Issue</option><option value="dependency">Dependency</option>
                    </select>
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title" data-testid={`input-edit-raid-title-${r.id}`} />
                  </div>
                  <div className="w-40"><Input value={editOwner} onChange={(e) => setEditOwner(e.target.value)} placeholder="Owner" /></div>
                </div>
                <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" />
                <div className="flex gap-2 flex-wrap">
                  <div className="w-36">
                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className={selectClass}>
                      {riskStatuses.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div className="w-36"><Input type="date" value={editRaisedDate} onChange={(e) => setEditRaisedDate(e.target.value)} /></div>
                </div>
                {typeSpecificFields(editItemType, "edit")}
                <div className="flex items-center gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="w-3.5 h-3.5 mr-1" /> Cancel</Button>
                  <Button size="sm" onClick={saveEdit} disabled={!editTitle.trim() || updateMutation.isPending}>
                    <Check className="w-3.5 h-3.5 mr-1" /> {updateMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer" onClick={() => setExpandedItem(isExpanded ? null : r.id)}>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 shrink-0 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />}
                    <span className="shrink-0">{itemIcon(r.itemType || "risk")}</span>
                    <p className="text-sm font-medium truncate" data-testid={`text-raid-title-${r.id}`}>{r.title}</p>
                    <Badge variant="secondary" className={`text-xs shrink-0 ${typeBadgeColor(r.itemType || "risk")}`}>
                      {itemTypeLabel(r.itemType || "risk").replace(/s$/, "")}
                    </Badge>
                    {r.itemType === "risk" && (
                      <Badge variant="secondary" className={`text-xs shrink-0 ${riskScoreColor(score)}`}>Score: {score}</Badge>
                    )}
                    <Badge variant="secondary" className={`text-xs shrink-0 ${statusColor(r.status)}`}>{statusLabel(r.status)}</Badge>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => startEditing(r)} data-testid={`button-edit-raid-${r.id}`}><Edit3 className="w-3.5 h-3.5" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" data-testid={`button-delete-raid-${r.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete item?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently remove "{r.title}" from the RAID log.</AlertDialogDescription>
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
                      {r.owner && <p><span className="font-medium text-foreground">Owner:</span> {r.owner}</p>}
                      {r.raisedDate && <p><span className="font-medium text-foreground">Raised:</span> {r.raisedDate}</p>}
                      {r.dueDate && <p><span className="font-medium text-foreground">Due:</span> {r.dueDate}</p>}
                      {r.resolvedDate && <p><span className="font-medium text-foreground">Resolved:</span> {r.resolvedDate}</p>}
                    </div>
                    {r.itemType === "risk" && (
                      <div className="flex gap-4 flex-wrap">
                        <p><span className="font-medium text-foreground">Probability:</span> {probLabel(r.probability)}</p>
                        <p><span className="font-medium text-foreground">Impact:</span> {impactLabel(r.impact)}</p>
                        {r.mitigation && <p><span className="font-medium text-foreground">Mitigation:</span> {r.mitigation}</p>}
                        {r.contingency && <p><span className="font-medium text-foreground">Contingency:</span> {r.contingency}</p>}
                      </div>
                    )}
                    {r.itemType === "assumption" && r.validationCriteria && (
                      <p><span className="font-medium text-foreground">Validation Criteria:</span> {r.validationCriteria}</p>
                    )}
                    {r.itemType === "dependency" && (
                      <div className="flex gap-4 flex-wrap">
                        {r.dependencySource && <p><span className="font-medium text-foreground">Source:</span> {r.dependencySource}</p>}
                        {r.requiredByDate && <p><span className="font-medium text-foreground">Required By:</span> {r.requiredByDate}</p>}
                      </div>
                    )}
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
