import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Plus, Search, Crosshair, ChevronRight, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAppTitle } from "@/hooks/use-app-title";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { BusinessOutcome, Client, TeamMember } from "@shared/schema";
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
type OutcomeWithMetrics = BusinessOutcome & { metrics?: Array<{ currentValue: string; currentUnit: string; expectedValue: string; expectedUnit: string }> };

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  active: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  achieved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  at_risk: "bg-red-500/15 text-red-700 dark:text-red-300",
  cancelled: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
};

export default function BusinessOutcomesPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const appTitle = useAppTitle(t("businessOutcomes.title"));
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BusinessOutcome | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newObjective, setNewObjective] = useState("");
  const [newStatus, setNewStatus] = useState("draft");

  const { data: outcomes = [], isLoading, isError, refetch } = useQuery<BusinessOutcome[]>({
    queryKey: ["/api/business-outcomes"],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const { data: teamMembers = [] } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; strategicObjective: string; status: string }) => {
      return apiRequest("POST", "/api/business-outcomes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-outcomes"] });
      toast({ title: t("businessOutcomes.outcomeCreated") });
      setShowCreate(false);
      setNewTitle("");
      setNewObjective("");
      setNewStatus("draft");
    },
    onError: () => {
      toast({ title: t("businessOutcomes.failedToCreate"), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/business-outcomes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-outcomes"] });
      toast({ title: t("businessOutcomes.outcomeDeleted") });
      setDeleteTarget(null);
    },
    onError: () => {
      toast({ title: t("businessOutcomes.failedToDelete"), variant: "destructive" });
    },
  });

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      draft: t("businessOutcomes.draft"),
      active: t("businessOutcomes.active"),
      achieved: t("businessOutcomes.achieved"),
      at_risk: t("businessOutcomes.atRisk"),
      cancelled: t("businessOutcomes.cancelledStatus"),
    };
    return map[s] || s;
  };

  const filtered = outcomes.filter(o =>
    o.title.toLowerCase().includes(search.toLowerCase()) ||
    (o.strategicObjective || "").toLowerCase().includes(search.toLowerCase())
  );

  const getClientName = (clientId: string | null) => {
    if (!clientId) return null;
    return clients.find(c => c.id === clientId)?.name;
  };

  const getOwnerName = (ownerId: string | null) => {
    if (!ownerId) return null;
    return teamMembers.find(m => m.id === ownerId)?.name;
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <Helmet>
        <title>{appTitle}</title>
      </Helmet>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title" data-testid="text-bo-title">{t("businessOutcomes.title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("businessOutcomes.subtitle")}</p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-new-outcome">
          <Plus className="w-4 h-4 mr-1.5" /> {t("businessOutcomes.newOutcome")}
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder={t("businessOutcomes.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search-outcomes"
        />
      </div>

      {isError && (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-destructive">{t("common.error")}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-outcomes">{t("common.retry")}</Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Crosshair className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">{outcomes.length === 0 ? t("businessOutcomes.noOutcomesYet") : t("common.noData")}</p>
            {outcomes.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">{t("businessOutcomes.noOutcomesDescription")}</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
           {filtered.map(o => {
             const metrics = (o as OutcomeWithMetrics).metrics || [];
             const firstMetric = metrics[0];
             return (
            <Link key={o.id} href={`/business-outcomes/${o.id}`}>
              <Card className="hover-elevate cursor-pointer group" data-testid={`card-outcome-${o.id}`}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold truncate">{o.title}</span>
                        <Badge className={`${STATUS_STYLES[o.status] || ""} border-0 text-[10px]`} variant="secondary">
                          {statusLabel(o.status)}
                        </Badge>
                      </div>
                      {o.strategicObjective && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{o.strategicObjective}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        {getClientName(o.clientId) && <span>{getClientName(o.clientId)}</span>}
                        {getOwnerName(o.ownerId) && <span>{getOwnerName(o.ownerId)}</span>}
                         {o.targetDate && <span>{o.targetDate}</span>}
                          {firstMetric ? (
                            <>
                              <span className="font-medium text-primary/80">{t("businessOutcomes.metricCount", { count: metrics.length })}</span>
                              <span className="tabular-nums">{firstMetric.currentValue} {firstMetric.currentUnit} → {firstMetric.expectedValue} {firstMetric.expectedUnit}</span>
                            </>
                          ) : o.successMetric ? (
                            <span>{t("businessOutcomes.legacyMetric")}: {o.successMetric}</span>
                          ) : (
                            <span className="font-medium text-primary/80">{t("businessOutcomes.metricCount", { count: 0 })}</span>
                          )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(o); }}
                        data-testid={`button-delete-outcome-${o.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50 invisible group-hover:visible" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
           ); })}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent data-testid="dialog-create-outcome">
          <DialogHeader>
            <DialogTitle>{t("businessOutcomes.createOutcome")}</DialogTitle>
            <DialogDescription>{t("businessOutcomes.subtitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t("common.title")} *</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                data-testid="input-outcome-title"
              />
            </div>
            <div>
              <Label>{t("businessOutcomes.strategicObjective")}</Label>
              <Textarea
                value={newObjective}
                onChange={(e) => setNewObjective(e.target.value)}
                rows={3}
                data-testid="input-outcome-objective"
              />
            </div>
            <div>
              <Label>{t("common.status")}</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger data-testid="select-outcome-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t("businessOutcomes.draft")}</SelectItem>
                  <SelectItem value="active">{t("businessOutcomes.active")}</SelectItem>
                  <SelectItem value="achieved">{t("businessOutcomes.achieved")}</SelectItem>
                  <SelectItem value="at_risk">{t("businessOutcomes.atRisk")}</SelectItem>
                  <SelectItem value="cancelled">{t("businessOutcomes.cancelledStatus")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>{t("common.cancel")}</Button>
            <Button
              onClick={() => createMutation.mutate({ title: newTitle, strategicObjective: newObjective, status: newStatus })}
              disabled={!newTitle.trim() || createMutation.isPending}
              data-testid="button-submit-outcome"
            >
              {createMutation.isPending ? t("common.creating") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("businessOutcomes.deleteOutcome")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("businessOutcomes.deleteDescription", { name: deleteTarget?.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
