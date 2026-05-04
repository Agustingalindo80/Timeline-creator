import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Edit3, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import { formatDateForProject, parseDateToISO } from "@/lib/date-format";
import type { Milestone } from "@shared/schema";

interface MilestoneManagerProps {
  timelineId: string;
  milestones: Milestone[];
  timelineColor: string;
  projectDateFormat: string;
  showAddForm: boolean;
  setShowAddForm: (v: boolean) => void;
  view?: "add" | "list" | "both";
}

export function MilestoneManager({
  timelineId,
  milestones,
  timelineColor,
  projectDateFormat,
  showAddForm,
  setShowAddForm,
  view = "both",
}: MilestoneManagerProps) {
  const { toast } = useToast();

  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newActualDate, setNewActualDate] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newIsFinancialObligation, setNewIsFinancialObligation] = useState(false);
  const [newAmount, setNewAmount] = useState("");

  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [editMTitle, setEditMTitle] = useState("");
  const [editMDate, setEditMDate] = useState("");
  const [editMActualDate, setEditMActualDate] = useState("");
  const [editMDesc, setEditMDesc] = useState("");
  const [editMIsFinancialObligation, setEditMIsFinancialObligation] = useState(false);
  const [editMAmount, setEditMAmount] = useState("");

  const fmtDate = (isoDate: string) => {
    if (!isoDate || !projectDateFormat) return isoDate;
    return formatDateForProject(isoDate, projectDateFormat);
  };

  const addMilestoneMutation = useMutation({
    mutationFn: async (data: { title: string; date: string; actualDate?: string; description?: string; isFinancialObligation?: boolean; amount?: string }) => {
      await apiRequest("POST", `/api/timelines/${timelineId}/milestones`, {
        ...data,
        sortOrder: milestones.length,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId] });
      toast({ title: "Milestone added" });
    },
  });

  const updateMilestoneMutation = useMutation({
    mutationFn: async ({ milestoneId, data }: { milestoneId: string; data: { title?: string; date?: string; actualDate?: string | null; description?: string | null; isFinancialObligation?: boolean; amount?: string | null } }) => {
      await apiRequest("PATCH", `/api/milestones/${milestoneId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId] });
      toast({ title: "Milestone updated" });
    },
  });

  const deleteMilestoneMutation = useMutation({
    mutationFn: async (milestoneId: string) => {
      await apiRequest("DELETE", `/api/milestones/${milestoneId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timelines", timelineId] });
      toast({ title: "Milestone deleted" });
    },
  });

  const startEditingMilestone = (m: Milestone) => {
    setEditingMilestoneId(m.id);
    setEditMTitle(m.title);
    setEditMDate(m.date);
    setEditMActualDate(m.actualDate || "");
    setEditMDesc(m.description || "");
    setEditMIsFinancialObligation(m.isFinancialObligation);
    setEditMAmount(m.amount || "");
  };

  const saveMilestoneEdit = () => {
    if (!editingMilestoneId || !editMTitle.trim() || !editMDate.trim()) return;
    updateMilestoneMutation.mutate(
      {
        milestoneId: editingMilestoneId,
        data: {
          title: editMTitle.trim(),
          date: fmtDate(editMDate.trim()),
          actualDate: editMActualDate.trim() ? fmtDate(editMActualDate.trim()) : null,
          description: editMDesc.trim() || null,
          isFinancialObligation: editMIsFinancialObligation,
          amount: editMIsFinancialObligation ? (editMAmount || null) : null,
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
      {
        title: newTitle,
        date: fmtDate(newDate),
        actualDate: newActualDate ? fmtDate(newActualDate) : undefined,
        description: newDesc || undefined,
        isFinancialObligation: newIsFinancialObligation,
        amount: newIsFinancialObligation ? (newAmount || undefined) : undefined,
      },
      {
        onSuccess: () => {
          setNewTitle("");
          setNewDate("");
          setNewActualDate("");
          setNewDesc("");
          setNewIsFinancialObligation(false);
          setNewAmount("");
          setShowAddForm(false);
        },
      }
    );
  };

  const showAddSection = view !== "list";
  const showListSection = view !== "add";

  return (
    <>
      {showAddSection && showAddForm && (
        <Card className="p-4">
          <h4 className="text-xs font-medium text-muted-foreground mb-3">New Milestone</h4>
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
            <div className="w-40">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Planned Date</label>
              <Input
                type={projectDateFormat ? "date" : "text"}
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                placeholder={projectDateFormat || "e.g. Mar 2025"}
                data-testid="input-new-milestone-date"
              />
            </div>
            <div className="w-40">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Actual Date</label>
              <Input
                type={projectDateFormat ? "date" : "text"}
                value={newActualDate}
                onChange={(e) => setNewActualDate(e.target.value)}
                placeholder="Optional"
                data-testid="input-new-milestone-actual-date"
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
            <div className="flex items-center gap-2">
              <Checkbox
                id="new-fin-obligation"
                checked={newIsFinancialObligation}
                onCheckedChange={(checked) => setNewIsFinancialObligation(checked === true)}
                data-testid="checkbox-new-milestone-financial"
              />
              <label htmlFor="new-fin-obligation" className="text-xs font-medium text-muted-foreground cursor-pointer">Financial Obligation</label>
            </div>
            {newIsFinancialObligation && (
              <div className="w-36">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount ($)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="0.00"
                  data-testid="input-new-milestone-amount"
                />
              </div>
            )}
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

      {showListSection && (
      <div className="space-y-2">
        {milestones.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No milestones yet. Click "Add" to create one.</p>
        ) : (
          [...milestones]
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
                      <div className="w-40">
                        <Input
                          type={projectDateFormat ? "date" : "text"}
                          value={projectDateFormat ? parseDateToISO(editMDate, projectDateFormat) : editMDate}
                          onChange={(e) => setEditMDate(e.target.value)}
                          placeholder="Planned date"
                          data-testid={`input-edit-milestone-date-${m.id}`}
                        />
                      </div>
                      <div className="w-40">
                        <Input
                          type={projectDateFormat ? "date" : "text"}
                          value={projectDateFormat ? parseDateToISO(editMActualDate, projectDateFormat) : editMActualDate}
                          onChange={(e) => setEditMActualDate(e.target.value)}
                          placeholder="Actual date"
                          data-testid={`input-edit-milestone-actual-date-${m.id}`}
                        />
                      </div>
                    </div>
                    <Input
                      value={editMDesc}
                      onChange={(e) => setEditMDesc(e.target.value)}
                      placeholder="Description (optional)"
                      data-testid={`input-edit-milestone-desc-${m.id}`}
                    />
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`edit-fin-obligation-${m.id}`}
                          checked={editMIsFinancialObligation}
                          onCheckedChange={(checked) => setEditMIsFinancialObligation(checked === true)}
                          data-testid={`checkbox-edit-milestone-financial-${m.id}`}
                        />
                        <label htmlFor={`edit-fin-obligation-${m.id}`} className="text-xs font-medium text-muted-foreground cursor-pointer">Financial Obligation</label>
                      </div>
                      {editMIsFinancialObligation && (
                        <div className="w-36">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editMAmount}
                            onChange={(e) => setEditMAmount(e.target.value)}
                            placeholder="Amount ($)"
                            data-testid={`input-edit-milestone-amount-${m.id}`}
                          />
                        </div>
                      )}
                    </div>
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
                        style={{ backgroundColor: m.color || timelineColor }}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate" data-testid={`text-milestone-title-${m.id}`}>{m.title}</p>
                          {m.isFinancialObligation && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-500 text-amber-600 dark:text-amber-400" data-testid={`badge-financial-${m.id}`}>
                              ${m.amount ? parseFloat(m.amount).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "0.00"}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Planned: {m.date}
                          {m.actualDate && <span className="ml-2">Actual: {m.actualDate}</span>}
                        </p>
                        {m.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-md">{m.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startEditingMilestone(m)}
                        data-testid={`button-edit-milestone-${m.id}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            data-testid={`button-delete-milestone-${m.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete milestone?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently remove "{m.title}" from this timeline.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMilestoneMutation.mutate(m.id)}
                              data-testid={`button-confirm-delete-milestone-${m.id}`}
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
            ))
        )}
      </div>
      )}
    </>
  );
}
