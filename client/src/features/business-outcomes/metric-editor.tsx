import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export type Metric = {
  id: string;
  businessOutcomeId: string;
  description: string;
  currentValue: string;
  currentValueType: "quantity" | "magnitude" | "percentage";
  currentUnit: string;
  expectedValue: string;
  expectedValueType: "quantity" | "magnitude" | "percentage";
  expectedUnit: string;
  evaluationPeriod: number;
  evaluationPeriodUnit: "days" | "months";
  sortOrder: number;
};

type Draft = Omit<Metric, "id" | "businessOutcomeId" | "sortOrder">;
const emptyDraft: Draft = { description: "", currentValue: "", currentValueType: "quantity", currentUnit: "count", expectedValue: "", expectedValueType: "quantity", expectedUnit: "count", evaluationPeriod: 30, evaluationPeriodUnit: "days" };
const currencies = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];
const timeUnits = ["minutes", "hours", "days", "weeks", "months"];

function UnitSelect({ type, value, onChange, id }: { type: Draft["currentValueType"]; value: string; onChange: (v: string) => void; id: string }) {
  const { t } = useTranslation();
  if (type === "percentage") return <Input id={id} value="%" readOnly aria-label={t("businessOutcomes.metricUnit")} />;
  const options = type === "quantity" ? ["count", "custom"] : [...currencies, ...timeUnits, "custom"];
  const isCustom = !options.includes(value) || value === "custom";
  return (
    <div className="space-y-2">
      <Select value={isCustom ? "custom" : value} onValueChange={(v) => onChange(v === "custom" ? "" : v)}>
        <SelectTrigger data-testid={`${id}-select`} id={id}><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((unit) => <SelectItem key={unit} value={unit}>{unit === "count" ? t("businessOutcomes.count") : unit === "custom" ? t("businessOutcomes.customUnit") : unit}</SelectItem>)}</SelectContent>
      </Select>
      {isCustom && <Input data-testid={`${id}-custom`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={t("businessOutcomes.customUnitPlaceholder")} aria-label={t("businessOutcomes.customUnit")} />}
    </div>
  );
}

function ValueField({ prefix, draft, setDraft }: { prefix: "current" | "expected"; draft: Draft; setDraft: (d: Draft) => void }) {
  const { t } = useTranslation();
  const typeKey = `${prefix}ValueType` as "currentValueType" | "expectedValueType";
  const unitKey = `${prefix}Unit` as "currentUnit" | "expectedUnit";
  const valueKey = `${prefix}Value` as "currentValue" | "expectedValue";
  return (
    <div className="space-y-2">
      <Label>{t(`businessOutcomes.${prefix === "current" ? "currentValue" : "expectedValue"}`)} *</Label>
      <div className="grid grid-cols-[1fr_1.1fr] gap-2">
        <Input data-testid={`input-metric-${prefix}-value`} type="number" min="0" max={draft[typeKey] === "percentage" ? 100 : undefined} step="any" value={draft[valueKey]} onChange={(e) => setDraft({ ...draft, [valueKey]: e.target.value })} />
        <Select value={draft[typeKey]} onValueChange={(v: Draft["currentValueType"]) => {
          const unit = v === "percentage" ? "%" : v === "quantity" ? "count" : "";
          setDraft({ ...draft, [typeKey]: v, [unitKey]: unit });
        }}>
          <SelectTrigger data-testid={`select-metric-${prefix}-type`}><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="quantity">{t("businessOutcomes.quantity")}</SelectItem>
            <SelectItem value="magnitude">{t("businessOutcomes.magnitude")}</SelectItem>
            <SelectItem value="percentage">{t("businessOutcomes.percentage")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <UnitSelect type={draft[typeKey]} value={draft[unitKey]} onChange={(v) => setDraft({ ...draft, [unitKey]: v })} id={`${prefix}-unit`} />
    </div>
  );
}

export function MetricEditor({ outcomeId, metrics = [], legacyMetric }: { outcomeId: string; metrics?: Metric[]; legacyMetric?: { description?: string | null; baseline?: string | null; currentValue?: string | null; target?: string | null } }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Metric | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const ordered = useMemo(() => [...metrics].sort((a, b) => a.sortOrder - b.sortOrder), [metrics]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/business-outcomes", outcomeId] });
  const mutation = useMutation({
    mutationFn: async () => {
      const payload = { ...draft, evaluationPeriod: Number(draft.evaluationPeriod), currentValue: String(draft.currentValue), expectedValue: String(draft.expectedValue) };
      return editing ? apiRequest("PATCH", `/api/business-outcomes/${outcomeId}/metrics/${editing.id}`, payload) : apiRequest("POST", `/api/business-outcomes/${outcomeId}/metrics`, payload);
    },
    onSuccess: () => { refresh(); setOpen(false); toast({ title: t(editing ? "businessOutcomes.metricUpdated" : "businessOutcomes.metricAdded") }); },
    onError: () => toast({ title: t("businessOutcomes.metricSaveFailed"), variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/business-outcomes/${outcomeId}/metrics/${deleteId}`),
    onSuccess: () => { refresh(); setDeleteId(null); toast({ title: t("businessOutcomes.metricDeleted") }); },
    onError: () => toast({ title: t("businessOutcomes.metricDeleteFailed"), variant: "destructive" }),
  });
  const reorderMutation = useMutation({
    mutationFn: (metricIds: string[]) => apiRequest("POST", `/api/business-outcomes/${outcomeId}/metrics/reorder`, { metricIds }),
    onSuccess: refresh,
  });
  const openMetric = (metric?: Metric) => {
    setEditing(metric || null);
    setDraft(metric ? { description: metric.description, currentValue: metric.currentValue, currentValueType: metric.currentValueType, currentUnit: metric.currentUnit, expectedValue: metric.expectedValue, expectedValueType: metric.expectedValueType, expectedUnit: metric.expectedUnit, evaluationPeriod: metric.evaluationPeriod, evaluationPeriodUnit: metric.evaluationPeriodUnit } : emptyDraft);
    setOpen(true);
  };
  const move = (index: number, direction: -1 | 1) => {
    const next = [...ordered]; const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorderMutation.mutate(next.map((m) => m.id));
  };
  const valueValid = (value: string, type: Draft["currentValueType"]) => {
    const number = Number(value);
    return value.trim() !== "" && Number.isFinite(number) && number >= 0 && (type !== "percentage" || number <= 100);
  };
  const valid = Boolean(draft.description.trim() && valueValid(draft.currentValue, draft.currentValueType) && valueValid(draft.expectedValue, draft.expectedValueType) && Number.isInteger(Number(draft.evaluationPeriod)) && Number(draft.evaluationPeriod) > 0 && draft.currentUnit.trim() && draft.expectedUnit.trim());
  return (
    <Card data-testid="card-success-metrics">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div><CardTitle className="text-base">{t("businessOutcomes.successMetrics")}</CardTitle><p className="text-xs text-muted-foreground mt-1">{t("businessOutcomes.successMetricsDescription")}</p></div>
        <Button data-testid="button-add-metric" size="sm" onClick={() => openMetric()}><Plus className="w-4 h-4 mr-1" />{t("businessOutcomes.addMetric")}</Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {ordered.length === 0 && legacyMetric && (legacyMetric.description || legacyMetric.baseline || legacyMetric.currentValue || legacyMetric.target) ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-3" data-testid="legacy-metric-summary">
            <p className="text-xs font-medium text-muted-foreground">{t("businessOutcomes.legacyMetric")}</p>
            <p className="mt-1 text-sm font-medium">{legacyMetric.description || t("businessOutcomes.successMetric")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {[legacyMetric.currentValue || legacyMetric.baseline, legacyMetric.target].filter(Boolean).join(" → ")}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{t("businessOutcomes.legacyMetricDescription")}</p>
          </div>
        ) : ordered.length === 0 ? <p className="text-sm text-muted-foreground py-5 text-center">{t("businessOutcomes.noMetrics")}</p> : ordered.map((metric, i) => (
          <div key={metric.id} data-testid={`metric-row-${metric.id}`} className="rounded-lg border bg-muted/20 p-3 flex gap-3 items-start">
            <div className="flex flex-col gap-1 pt-0.5"><Button data-testid={`button-metric-up-${metric.id}`} variant="ghost" size="icon" className="h-6 w-6" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("businessOutcomes.moveMetricUp")}><ArrowUp className="w-3.5 h-3.5" /></Button><Button data-testid={`button-metric-down-${metric.id}`} variant="ghost" size="icon" className="h-6 w-6" disabled={i === ordered.length - 1} onClick={() => move(i, 1)} aria-label={t("businessOutcomes.moveMetricDown")}><ArrowDown className="w-3.5 h-3.5" /></Button></div>
            <div className="min-w-0 flex-1"><p className="font-medium text-sm">{metric.description}</p><p className="text-xs text-muted-foreground mt-1 tabular-nums">{metric.currentValue} {metric.currentUnit} <span className="mx-1">→</span> {metric.expectedValue} {metric.expectedUnit} · {metric.evaluationPeriod} {t(`businessOutcomes.${metric.evaluationPeriodUnit}`)}</p></div>
            <div className="flex gap-1"><Button data-testid={`button-edit-metric-${metric.id}`} variant="ghost" size="icon" className="h-8 w-8" onClick={() => openMetric(metric)} aria-label={t("common.edit")}><Pencil className="w-3.5 h-3.5" /></Button><Button data-testid={`button-delete-metric-${metric.id}`} variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(metric.id)} aria-label={t("common.delete")}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button></div>
          </div>
        ))}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t(editing ? "businessOutcomes.editMetric" : "businessOutcomes.addMetric")}</DialogTitle><DialogDescription>{t("businessOutcomes.metricDescription")}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="metric-description">{t("businessOutcomes.metricDescriptionLabel")} *</Label><Input data-testid="input-metric-description" id="metric-description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
            <div className="grid sm:grid-cols-2 gap-4"><ValueField prefix="current" draft={draft} setDraft={setDraft} /><ValueField prefix="expected" draft={draft} setDraft={setDraft} /></div>
            <div><Label>{t("businessOutcomes.evaluationPeriod")} *</Label><div className="grid grid-cols-2 gap-2"><Input data-testid="input-metric-period" type="number" min="1" step="1" value={draft.evaluationPeriod} onChange={(e) => setDraft({ ...draft, evaluationPeriod: Number(e.target.value) })} /><Select value={draft.evaluationPeriodUnit} onValueChange={(v: "days" | "months") => setDraft({ ...draft, evaluationPeriodUnit: v })}><SelectTrigger data-testid="select-metric-period-unit"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="days">{t("businessOutcomes.days")}</SelectItem><SelectItem value="months">{t("businessOutcomes.months")}</SelectItem></SelectContent></Select></div></div>
            {!valid && <p className="text-xs text-destructive">{t("businessOutcomes.metricValidation")}</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button><Button data-testid="button-save-metric" onClick={() => mutation.mutate()} disabled={!valid || mutation.isPending}>{t("common.save")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}><DialogContent><DialogHeader><DialogTitle>{t("businessOutcomes.deleteMetric")}</DialogTitle><DialogDescription>{t("businessOutcomes.deleteMetricDescription")}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteId(null)}>{t("common.cancel")}</Button><Button data-testid="button-confirm-delete-metric" variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>{t("common.delete")}</Button></DialogFooter></DialogContent></Dialog>
    </Card>
  );
}