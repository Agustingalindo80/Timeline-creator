import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Plus, Crosshair, ChevronRight, Trash2, LinkIcon, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { BusinessOutcome } from "@shared/schema";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  active: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  achieved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  at_risk: "bg-red-500/15 text-red-700 dark:text-red-300",
  cancelled: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
};

interface BusinessOutcomesTabProps {
  timelineId: string;
  linkField: "projectId" | "opportunityId";
}

export function BusinessOutcomesTab({ timelineId, linkField }: BusinessOutcomesTabProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<BusinessOutcome | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newObjective, setNewObjective] = useState("");
  const [newStatus, setNewStatus] = useState("draft");
  const [selectedLinkId, setSelectedLinkId] = useState("");

  const filterParam = linkField === "projectId" ? "projectId" : "opportunityId";
  const linkedQueryKey = ["/api/business-outcomes", { [filterParam]: timelineId }];

  const { data: linkedOutcomes = [], isLoading, isError } = useQuery<BusinessOutcome[]>({
    queryKey: linkedQueryKey,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/business-outcomes?${filterParam}=${timelineId}`);
      return res.json();
    },
    retry: false,
  });

  const { data: allOutcomes = [] } = useQuery<BusinessOutcome[]>({
    queryKey: ["/api/business-outcomes"],
  });

  const linkFieldKey = linkField === "projectId" ? "projectId" : "opportunityId";
  const unlinkedOutcomes = allOutcomes.filter(
    (o) => !o[linkFieldKey] && !linkedOutcomes.some((lo) => lo.id === o.id)
  );

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/business-outcomes"] });
  };

  const createMutation = useMutation({
    mutationFn: async (data: { title: string; strategicObjective: string; status: string; [key: string]: string }) => {
      return apiRequest("POST", "/api/business-outcomes", data);
    },
    onSuccess: () => {
      invalidateAll();
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

  const linkMutation = useMutation({
    mutationFn: async (outcomeId: string) => {
      return apiRequest("PATCH", `/api/business-outcomes/${outcomeId}`, { [linkField]: timelineId });
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: t("businessOutcomes.outcomeLinked") });
      setShowLinkDialog(false);
      setSelectedLinkId("");
    },
    onError: () => {
      toast({ title: t("businessOutcomes.failedToLink"), variant: "destructive" });
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: async (outcomeId: string) => {
      return apiRequest("PATCH", `/api/business-outcomes/${outcomeId}`, { [linkField]: null });
    },
    onSuccess: () => {
      invalidateAll();
      toast({ title: t("businessOutcomes.outcomeUnlinked") });
      setUnlinkTarget(null);
    },
    onError: () => {
      toast({ title: t("businessOutcomes.failedToUnlink"), variant: "destructive" });
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

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold" data-testid="text-bo-tab-title">{t("businessOutcomes.title")}</h3>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowLinkDialog(true)}
              data-testid="button-link-outcome"
            >
              <LinkIcon className="w-3.5 h-3.5 mr-1" /> {t("businessOutcomes.linkExisting")}
            </Button>
            <Button
              size="sm"
              onClick={() => setShowCreate(true)}
              data-testid="button-create-outcome"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> {t("businessOutcomes.newOutcome")}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Crosshair className="w-10 h-10 text-destructive/40 mb-3" />
            <p className="text-sm font-medium text-destructive" data-testid="text-outcomes-load-error">
              {t("businessOutcomes.failedToLoad")}
            </p>
            <p className="text-xs text-muted-foreground mt-1 text-center max-w-sm">
              {t("businessOutcomes.failedToLoadDescription")}
            </p>
          </div>
        ) : linkedOutcomes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Crosshair className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground" data-testid="text-no-linked-outcomes">
              {t("businessOutcomes.noLinkedOutcomes")}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {t("businessOutcomes.noLinkedOutcomesDescription")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {linkedOutcomes.map((o) => (
              <Card key={o.id} className="group" data-testid={`card-linked-outcome-${o.id}`}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold truncate" data-testid={`text-outcome-title-${o.id}`}>
                          {o.title}
                        </span>
                        <Badge
                          className={`${STATUS_STYLES[o.status] || ""} border-0 text-[10px]`}
                          variant="secondary"
                          data-testid={`badge-outcome-status-${o.id}`}
                        >
                          {statusLabel(o.status)}
                        </Badge>
                      </div>
                      {o.strategicObjective && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{o.strategicObjective}</p>
                      )}
                      {(o.successMetric || o.targetDate) && (
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          {o.successMetric && <span>{o.successMetric}</span>}
                          {o.targetDate && <span>{o.targetDate}</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100"
                        onClick={() => setUnlinkTarget(o)}
                        data-testid={`button-unlink-outcome-${o.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <Link href={`/business-outcomes/${o.id}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          data-testid={`button-view-outcome-${o.id}`}
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      </Link>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50 invisible group-hover:visible" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent data-testid="dialog-create-linked-outcome">
            <DialogHeader>
              <DialogTitle>{t("businessOutcomes.createOutcome")}</DialogTitle>
              <DialogDescription>
                {t("businessOutcomes.noLinkedOutcomesDescription")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{t("common.title")} *</Label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  data-testid="input-linked-outcome-title"
                />
              </div>
              <div>
                <Label>{t("businessOutcomes.strategicObjective")}</Label>
                <Textarea
                  value={newObjective}
                  onChange={(e) => setNewObjective(e.target.value)}
                  rows={3}
                  data-testid="input-linked-outcome-objective"
                />
              </div>
              <div>
                <Label>{t("common.status")}</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger data-testid="select-linked-outcome-status">
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
                onClick={() =>
                  createMutation.mutate({
                    title: newTitle,
                    strategicObjective: newObjective,
                    status: newStatus,
                    [linkField]: timelineId,
                  })
                }
                disabled={!newTitle.trim() || createMutation.isPending}
                data-testid="button-submit-linked-outcome"
              >
                {createMutation.isPending ? t("common.creating") : t("common.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
          <DialogContent data-testid="dialog-link-outcome">
            <DialogHeader>
              <DialogTitle>{t("businessOutcomes.linkExisting")}</DialogTitle>
              <DialogDescription>
                {t("businessOutcomes.selectOutcome")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {unlinkedOutcomes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-unlinked">
                  {t("businessOutcomes.noUnlinkedOutcomes")}
                </p>
              ) : (
                <Select value={selectedLinkId} onValueChange={setSelectedLinkId}>
                  <SelectTrigger data-testid="select-link-outcome">
                    <SelectValue placeholder={t("businessOutcomes.selectOutcome")} />
                  </SelectTrigger>
                  <SelectContent>
                    {unlinkedOutcomes.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowLinkDialog(false); setSelectedLinkId(""); }}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => linkMutation.mutate(selectedLinkId)}
                disabled={!selectedLinkId || linkMutation.isPending}
                data-testid="button-confirm-link-outcome"
              >
                {linkMutation.isPending ? t("common.saving") : t("businessOutcomes.linkExisting")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!unlinkTarget} onOpenChange={() => setUnlinkTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("businessOutcomes.unlinkOutcome")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("businessOutcomes.unlinkDescription", { name: unlinkTarget?.title })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => unlinkTarget && unlinkMutation.mutate(unlinkTarget.id)}
                data-testid="button-confirm-unlink-outcome"
              >
                {t("businessOutcomes.unlink")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
