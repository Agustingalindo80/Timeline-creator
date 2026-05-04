import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { Link, useParams } from "wouter";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Pencil, Save, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAppTitle } from "@/hooks/use-app-title";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { BusinessOutcome, Client, TeamMember, TimelineWithMilestones, FlightpathStage } from "@shared/schema";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  active: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  achieved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  at_risk: "bg-red-500/15 text-red-700 dark:text-red-300",
  cancelled: "bg-gray-500/15 text-gray-700 dark:text-gray-300",
};

export default function BusinessOutcomeDetail() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const params = useParams<{ id: string }>();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<BusinessOutcome>>({});

  const { data: outcome, isLoading, isError, refetch } = useQuery<BusinessOutcome>({
    queryKey: ["/api/business-outcomes", params.id],
  });

  const { data: clients = [] } = useQuery<Client[]>({ queryKey: ["/api/clients"] });
  const { data: projects = [] } = useQuery<TimelineWithMilestones[]>({ queryKey: ["/api/timelines"] });
  const { data: opportunities = [] } = useQuery<TimelineWithMilestones[]>({ queryKey: ["/api/opportunities"] });
  const { data: teamMembers = [] } = useQuery<TeamMember[]>({ queryKey: ["/api/team-members"] });
  const { data: stages = [] } = useQuery<FlightpathStage[]>({ queryKey: ["/api/governance/stages"] });

  const appTitle = useAppTitle(outcome?.title || t("businessOutcomes.title"));

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<BusinessOutcome>) => {
      return apiRequest("PATCH", `/api/business-outcomes/${params.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/business-outcomes", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/business-outcomes"] });
      toast({ title: t("businessOutcomes.outcomeUpdated") });
      setEditing(false);
    },
    onError: () => {
      toast({ title: t("businessOutcomes.failedToUpdate"), variant: "destructive" });
    },
  });

  const startEdit = () => {
    if (outcome) {
      setForm({
        title: outcome.title,
        strategicObjective: outcome.strategicObjective,
        successMetric: outcome.successMetric,
        baseline: outcome.baseline,
        target: outcome.target,
        currentValue: outcome.currentValue,
        status: outcome.status,
        evidence: outcome.evidence,
        valueNotes: outcome.valueNotes,
        clientId: outcome.clientId,
        opportunityId: outcome.opportunityId,
        projectId: outcome.projectId,
        stageId: outcome.stageId,
        ownerId: outcome.ownerId,
        targetDate: outcome.targetDate,
      });
      setEditing(true);
    }
  };

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

  if (isLoading) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-4">
        <Link href="/business-outcomes">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> {t("businessOutcomes.backToList")}</Button>
        </Link>
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <p className="text-sm text-destructive">{t("common.error")}</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-detail">{t("common.retry")}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!outcome) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-muted-foreground">{t("common.notFound")}</p>
      </div>
    );
  }

  const clientName = clients.find(c => c.id === outcome.clientId)?.name;
  const projectName = projects.find(p => p.id === outcome.projectId)?.title;
  const oppName = opportunities.find(o => o.id === outcome.opportunityId)?.title;
  const ownerName = teamMembers.find(m => m.id === outcome.ownerId)?.name;
  const stageName = stages.find(s => s.id === outcome.stageId)?.name;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Helmet>
        <title>{appTitle}</title>
      </Helmet>

      <div className="flex items-center gap-3">
        <Link href="/business-outcomes">
          <Button variant="ghost" size="sm" data-testid="button-back-outcomes">
            <ArrowLeft className="w-4 h-4 mr-1" /> {t("businessOutcomes.backToList")}
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-outcome-title">
            {editing ? (
              <Input
                value={form.title || ""}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="text-2xl font-bold h-auto py-0 px-1"
                data-testid="input-edit-title"
              />
            ) : outcome.title}
          </h1>
          {!editing && (
            <Badge className={`${STATUS_STYLES[outcome.status]} border-0`} variant="secondary">
              {statusLabel(outcome.status)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setEditing(false)} data-testid="button-cancel-edit">
                <X className="w-4 h-4 mr-1" /> {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={() => updateMutation.mutate(form)}
                disabled={updateMutation.isPending}
                data-testid="button-save-outcome"
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                {t("common.save")}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={startEdit} data-testid="button-edit-outcome">
              <Pencil className="w-4 h-4 mr-1" /> {t("common.edit")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-outcome-details">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t("businessOutcomes.details")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label={t("common.status")} editing={editing}>
              {editing ? (
                <Select value={form.status || "draft"} onValueChange={(v: "draft" | "active" | "achieved" | "at_risk" | "cancelled") => setForm({ ...form, status: v })}>
                  <SelectTrigger data-testid="select-edit-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">{t("businessOutcomes.draft")}</SelectItem>
                    <SelectItem value="active">{t("businessOutcomes.active")}</SelectItem>
                    <SelectItem value="achieved">{t("businessOutcomes.achieved")}</SelectItem>
                    <SelectItem value="at_risk">{t("businessOutcomes.atRisk")}</SelectItem>
                    <SelectItem value="cancelled">{t("businessOutcomes.cancelledStatus")}</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <span>{statusLabel(outcome.status)}</span>
              )}
            </Field>

            <Field label={t("businessOutcomes.strategicObjective")} editing={editing}>
              {editing ? (
                <Textarea value={form.strategicObjective || ""} onChange={(e) => setForm({ ...form, strategicObjective: e.target.value })} rows={2} data-testid="input-edit-objective" />
              ) : (
                <span className="text-sm">{outcome.strategicObjective || "-"}</span>
              )}
            </Field>

            <Field label={t("businessOutcomes.successMetric")} editing={editing}>
              {editing ? (
                <Input value={form.successMetric || ""} onChange={(e) => setForm({ ...form, successMetric: e.target.value })} data-testid="input-edit-metric" />
              ) : (
                <span className="text-sm">{outcome.successMetric || "-"}</span>
              )}
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label={t("businessOutcomes.baseline")} editing={editing}>
                {editing ? (
                  <Input value={form.baseline || ""} onChange={(e) => setForm({ ...form, baseline: e.target.value })} data-testid="input-edit-baseline" />
                ) : (
                  <span className="text-sm font-medium tabular-nums">{outcome.baseline || "-"}</span>
                )}
              </Field>
              <Field label={t("businessOutcomes.targetValue")} editing={editing}>
                {editing ? (
                  <Input value={form.target || ""} onChange={(e) => setForm({ ...form, target: e.target.value })} data-testid="input-edit-target" />
                ) : (
                  <span className="text-sm font-medium tabular-nums">{outcome.target || "-"}</span>
                )}
              </Field>
              <Field label={t("businessOutcomes.currentValue")} editing={editing}>
                {editing ? (
                  <Input value={form.currentValue || ""} onChange={(e) => setForm({ ...form, currentValue: e.target.value })} data-testid="input-edit-current" />
                ) : (
                  <span className="text-sm font-medium tabular-nums">{outcome.currentValue || "-"}</span>
                )}
              </Field>
            </div>

            <Field label={t("businessOutcomes.targetDate")} editing={editing}>
              {editing ? (
                <Input type="date" value={form.targetDate || ""} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} data-testid="input-edit-date" />
              ) : (
                <span className="text-sm">{outcome.targetDate || "-"}</span>
              )}
            </Field>

            <Field label={t("businessOutcomes.evidence")} editing={editing}>
              {editing ? (
                <Textarea value={form.evidence || ""} onChange={(e) => setForm({ ...form, evidence: e.target.value })} rows={2} data-testid="input-edit-evidence" />
              ) : (
                <span className="text-sm">{outcome.evidence || "-"}</span>
              )}
            </Field>

            <Field label={t("businessOutcomes.valueNotes")} editing={editing}>
              {editing ? (
                <Textarea value={form.valueNotes || ""} onChange={(e) => setForm({ ...form, valueNotes: e.target.value })} rows={2} data-testid="input-edit-notes" />
              ) : (
                <span className="text-sm">{outcome.valueNotes || "-"}</span>
              )}
            </Field>
          </CardContent>
        </Card>

        <Card data-testid="card-outcome-links">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              {t("businessOutcomes.links")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label={t("businessOutcomes.linkedCompany")} editing={editing}>
              {editing ? (
                <Select value={form.clientId || "_none"} onValueChange={(v) => setForm({ ...form, clientId: v === "_none" ? null : v })}>
                  <SelectTrigger data-testid="select-edit-client"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">-</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : clientName ? (
                <Link href={`/clients/${outcome.clientId}`}><span className="text-sm text-primary hover:underline cursor-pointer">{clientName}</span></Link>
              ) : <span className="text-sm text-muted-foreground">-</span>}
            </Field>

            <Field label={t("businessOutcomes.linkedProject")} editing={editing}>
              {editing ? (
                <Select value={form.projectId || "_none"} onValueChange={(v) => setForm({ ...form, projectId: v === "_none" ? null : v })}>
                  <SelectTrigger data-testid="select-edit-project"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">-</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : projectName ? (
                <Link href={`/timeline/${outcome.projectId}`}><span className="text-sm text-primary hover:underline cursor-pointer">{projectName}</span></Link>
              ) : <span className="text-sm text-muted-foreground">-</span>}
            </Field>

            <Field label={t("businessOutcomes.linkedOpportunity")} editing={editing}>
              {editing ? (
                <Select value={form.opportunityId || "_none"} onValueChange={(v) => setForm({ ...form, opportunityId: v === "_none" ? null : v })}>
                  <SelectTrigger data-testid="select-edit-opp"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">-</SelectItem>
                    {opportunities.map(o => <SelectItem key={o.id} value={o.id}>{o.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : oppName ? (
                <Link href={`/opportunities/${outcome.opportunityId}`}><span className="text-sm text-primary hover:underline cursor-pointer">{oppName}</span></Link>
              ) : <span className="text-sm text-muted-foreground">-</span>}
            </Field>

            <Field label={t("businessOutcomes.linkedStage")} editing={editing}>
              {editing ? (
                <Select value={form.stageId || "_none"} onValueChange={(v) => setForm({ ...form, stageId: v === "_none" ? null : v })}>
                  <SelectTrigger data-testid="select-edit-stage"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">-</SelectItem>
                    {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : <span className="text-sm">{stageName || "-"}</span>}
            </Field>

            <Field label={t("businessOutcomes.owner")} editing={editing}>
              {editing ? (
                <Select value={form.ownerId || "_none"} onValueChange={(v) => setForm({ ...form, ownerId: v === "_none" ? null : v })}>
                  <SelectTrigger data-testid="select-edit-owner"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">-</SelectItem>
                    {teamMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : <span className="text-sm">{ownerName || "-"}</span>}
            </Field>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, editing, children }: { label: string; editing: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
