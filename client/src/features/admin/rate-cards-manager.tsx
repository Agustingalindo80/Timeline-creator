import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, CreditCard, Edit3, Trash2, Save } from "lucide-react";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import type { AppSettings, RateCard } from "@shared/schema";
import { getDefaultFieldOptions } from "@shared/schema";

export function RateCardsManager() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [addingForRegion, setAddingForRegion] = useState<string | null>(null);
  const [newRole, setNewRole] = useState("");
  const [newCostRate, setNewCostRate] = useState("");
  const [newBillRate, setNewBillRate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editCostRate, setEditCostRate] = useState("");
  const [editBillRate, setEditBillRate] = useState("");
  const [collapsedRegions, setCollapsedRegions] = useState<Set<string>>(new Set());

  const { data: cards = [], isLoading } = useQuery<RateCard[]>({
    queryKey: ["/api/rate-cards"],
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });
  const roleOptions = settings?.teamMemberRoles || getDefaultFieldOptions("teamMemberRoles", settings?.locale || "en");
  const regionOptions = settings?.regions || getDefaultFieldOptions("regions", settings?.locale || "en");

  const cardsByRegion = useMemo(() => {
    const grouped: Record<string, RateCard[]> = {};
    for (const region of regionOptions) {
      grouped[region.value] = cards.filter(c => c.region === region.value);
    }
    const unassigned = cards.filter(c => !c.region || !regionOptions.some(r => r.value === c.region));
    if (unassigned.length > 0) {
      grouped["_unassigned"] = unassigned;
    }
    return grouped;
  }, [cards, regionOptions]);

  const toggleRegion = (regionValue: string) => {
    setCollapsedRegions(prev => {
      const next = new Set(prev);
      if (next.has(regionValue)) next.delete(regionValue);
      else next.add(regionValue);
      return next;
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/rate-cards", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rate-cards"] });
      toast({ title: "Rate card created" });
      resetAddForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/rate-cards/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rate-cards"] });
      toast({ title: "Rate card updated" });
      setEditingId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/rate-cards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rate-cards"] });
      toast({ title: "Rate card deleted" });
    },
  });

  const resetAddForm = () => {
    setAddingForRegion(null);
    setNewRole("");
    setNewCostRate("");
    setNewBillRate("");
  };

  const getRoleLabel = (value: string) => roleOptions.find(r => r.value === value)?.label || value;
  const getRegionLabel = (value: string) => regionOptions.find(r => r.value === value)?.label || value;
  const autoName = (role: string, region: string) => {
    const parts = [];
    if (region) parts.push(getRegionLabel(region));
    if (role) parts.push(getRoleLabel(role));
    return parts.length > 0 ? parts.join(" - ") : "Rate Card";
  };

  const startEditing = (c: RateCard) => {
    setEditingId(c.id);
    setEditRole(c.role || "");
    setEditCostRate(c.costRate ?? "");
    setEditBillRate(c.billRate ?? "");
  };

  if (isLoading) return <Skeleton className="h-32 w-full" />;

  const renderCard = (c: RateCard) => (
    <div key={c.id} className="border rounded-md p-2.5 bg-background" data-testid={`rate-card-${c.id}`}>
      {editingId === c.id ? (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Role *</label>
              <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={editRole} onChange={e => setEditRole(e.target.value)} data-testid={`select-edit-card-role-${c.id}`}>
                <option value="">Select role...</option>
                {roleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Cost Rate ($/hr)</label>
              <Input type="number" step="0.01" min="0" value={editCostRate} onChange={e => setEditCostRate(e.target.value)} data-testid={`input-edit-card-cost-${c.id}`} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Bill Rate ($/hr)</label>
              <Input type="number" step="0.01" min="0" value={editBillRate} onChange={e => setEditBillRate(e.target.value)} data-testid={`input-edit-card-bill-${c.id}`} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setEditingId(null)} data-testid={`button-cancel-edit-card-${c.id}`}>Cancel</Button>
            <Button size="sm" onClick={() => updateMutation.mutate({ id: c.id, data: { name: autoName(editRole, c.region || ""), role: editRole || null, costRate: editCostRate || null, billRate: editBillRate || null } })} disabled={!editRole.trim() || updateMutation.isPending} data-testid={`button-save-edit-card-${c.id}`}>
              <Save className="w-3.5 h-3.5 mr-1" />
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" data-testid={`text-card-name-${c.id}`}>
              {c.role ? getRoleLabel(c.role) : c.name}
            </p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {c.costRate && <span>Cost: ${parseFloat(c.costRate).toFixed(2)}/hr</span>}
              {c.billRate && <span>Bill: ${parseFloat(c.billRate).toFixed(2)}/hr</span>}
              {c.costRate && c.billRate && (
                <span className="text-green-600 dark:text-green-400">
                  Margin: {((1 - parseFloat(c.costRate) / parseFloat(c.billRate)) * 100).toFixed(0)}%
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => startEditing(c)} data-testid={`button-edit-card-${c.id}`}>
              <Edit3 className="w-3.5 h-3.5" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" data-testid={`button-delete-card-${c.id}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete rate card?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this rate card. Project assignments using this card will have the rate card unlinked.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => deleteMutation.mutate(c.id)} data-testid={`button-confirm-delete-card-${c.id}`}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </div>
  );

  const renderAddForm = (regionValue: string) => (
    <div className="border rounded-md p-3 bg-muted/30 mt-2" data-testid={`form-add-rate-card-${regionValue}`}>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Role *</label>
          <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={newRole} onChange={e => setNewRole(e.target.value)} data-testid="select-new-card-role">
            <option value="">Select role...</option>
            {roleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Cost Rate ($/hr)</label>
          <Input type="number" step="0.01" min="0" value={newCostRate} onChange={e => setNewCostRate(e.target.value)} placeholder="0.00" data-testid="input-new-card-cost" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Bill Rate ($/hr)</label>
          <Input type="number" step="0.01" min="0" value={newBillRate} onChange={e => setNewBillRate(e.target.value)} placeholder="0.00" data-testid="input-new-card-bill" />
        </div>
      </div>
      <div className="flex gap-2 mt-3 justify-end">
        <Button variant="ghost" size="sm" onClick={resetAddForm} data-testid="button-cancel-add-card">Cancel</Button>
        <Button size="sm" onClick={() => createMutation.mutate({ name: autoName(newRole, regionValue), role: newRole || null, region: regionValue, costRate: newCostRate || null, billRate: newBillRate || null })} disabled={!newRole.trim() || createMutation.isPending} data-testid="button-save-new-card">
          {createMutation.isPending ? "Creating..." : "Create"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          Regional Rate Cards
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Each region has its own rate cards with different roles, cost rates, and bill rates.
        </p>
      </div>

      {regionOptions.map(region => {
        const regionCards = cardsByRegion[region.value] || [];
        const isCollapsed = collapsedRegions.has(region.value);
        return (
          <Card key={region.value} className="overflow-hidden" data-testid={`region-card-${region.value}`}>
            <div
              className="flex items-center justify-between px-4 py-2.5 bg-muted/50 cursor-pointer select-none"
              onClick={() => toggleRegion(region.value)}
              data-testid={`region-header-${region.value}`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs transition-transform ${isCollapsed ? "" : "rotate-90"}`}>&#9654;</span>
                <h4 className="text-sm font-semibold">{region.label}</h4>
                <span className="text-xs text-muted-foreground">({regionCards.length} {regionCards.length === 1 ? "card" : "cards"})</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => { e.stopPropagation(); setAddingForRegion(addingForRegion === region.value ? null : region.value); }}
                data-testid={`button-add-card-${region.value}`}
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add
              </Button>
            </div>
            {!isCollapsed && (
              <div className="p-3 space-y-2">
                {regionCards.length === 0 && addingForRegion !== region.value && (
                  <p className="text-xs text-muted-foreground text-center py-3">No rate cards for this region yet.</p>
                )}
                {regionCards.map(renderCard)}
                {addingForRegion === region.value && renderAddForm(region.value)}
              </div>
            )}
          </Card>
        );
      })}

      {cardsByRegion["_unassigned"] && cardsByRegion["_unassigned"].length > 0 && (
        <Card className="overflow-hidden" data-testid="region-card-unassigned">
          <div
            className="flex items-center justify-between px-4 py-2.5 bg-muted/50 cursor-pointer select-none"
            onClick={() => toggleRegion("_unassigned")}
          >
            <div className="flex items-center gap-2">
              <span className={`text-xs transition-transform ${collapsedRegions.has("_unassigned") ? "" : "rotate-90"}`}>&#9654;</span>
              <h4 className="text-sm font-semibold">Unassigned Region</h4>
              <span className="text-xs text-muted-foreground">({cardsByRegion["_unassigned"].length} {cardsByRegion["_unassigned"].length === 1 ? "card" : "cards"})</span>
            </div>
          </div>
          {!collapsedRegions.has("_unassigned") && (
            <div className="p-3 space-y-2">
              {cardsByRegion["_unassigned"].map(renderCard)}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
