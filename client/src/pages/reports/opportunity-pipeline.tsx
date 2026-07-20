import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { ReportLayout } from "@/components/reports/report-layout";
import { DropdownFilter, ClientFilter, ToggleFilter } from "@/components/reports/report-filters";
import { ReportStatCard, ReportBarChart } from "@/components/reports/report-charts";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Briefcase, DollarSign, TrendingUp, Trophy, ArrowUpDown, ExternalLink, X } from "lucide-react";
import type { AppSettings, Client } from "@shared/schema";
import { getDefaultFieldOptions } from "@shared/schema";
import { COUNTRIES, getCountryLabel } from "@shared/countries";

interface PipelineItem {
  id: string;
  title: string;
  clientId: string | null;
  clientName: string | null;
  industry: string | null;
  segment: string | null;
  country: string | null;
  region: string | null;
  status: string;
  confidencePercent: number | null;
  bufferedPrice: number | null;
  weightedValue: number | null;
  clouds: string[];
  strategicAccount: boolean;
}

interface PipelineReport {
  items: PipelineItem[];
  summary: {
    total: number;
    openCount: number;
    totalPipeline: number;
    weightedPipeline: number;
    wonValue: number;
    wonCount: number;
  };
  cloudOptions: string[];
}

const STATUS_ORDER = ["qualifying", "estimating", "proposed", "won", "lost"];

const STATUS_COLORS: Record<string, string> = {
  qualifying: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  estimating: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  proposed: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  won: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  lost: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
};

type SortField = "title" | "clientName" | "region" | "status" | "confidencePercent" | "bufferedPrice" | "weightedValue";
type SortDirection = "asc" | "desc";
type Measure = "count" | "bufferedPrice" | "weightedValue";
type Grouping = "status" | "region" | "industry" | "cloud";

function formatCurrency(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

export default function OpportunityPipelineReport() {
  const { t } = useTranslation();
  const [clientFilter, setClientFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [cloudFilter, setCloudFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [strategicOnly, setStrategicOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [measure, setMeasure] = useState<Measure>("bufferedPrice");
  const [grouping, setGrouping] = useState<Grouping>("status");

  const queryParams = new URLSearchParams();
  if (clientFilter !== "all") queryParams.set("clientId", clientFilter);
  if (regionFilter !== "all") queryParams.set("region", regionFilter);
  if (industryFilter !== "all") queryParams.set("industry", industryFilter);
  if (cloudFilter !== "all") queryParams.set("cloud", cloudFilter);
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (segmentFilter !== "all") queryParams.set("segment", segmentFilter);
  if (countryFilter !== "all") queryParams.set("country", countryFilter);
  if (strategicOnly) queryParams.set("strategicAccount", "true");
  const queryString = queryParams.toString();

  const { data: report, isLoading } = useQuery<PipelineReport>({
    queryKey: ["/api/reports/opportunity-pipeline", queryString],
    queryFn: async () => {
      const url = `/api/reports/opportunity-pipeline${queryString ? `?${queryString}` : ""}`;
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const { data: settings } = useQuery<AppSettings>({ queryKey: ["/api/settings"] });
  const { data: clientsList } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const locale = settings?.locale || "en";
  const regionOptions = settings?.regions || getDefaultFieldOptions("regions", locale);
  const industryOptions = settings?.industries || getDefaultFieldOptions("industries", locale);
  const segmentOptions = getDefaultFieldOptions("segments", locale);
  const countryOptions = useMemo(
    () => COUNTRIES.map((c) => ({ value: c.value, label: c.label })),
    [],
  );

  const statusLabel = (s: string) => t(`opportunities.${s}`, s);

  const items = report?.items ?? [];
  const summary = report?.summary;

  const activeFilterCount =
    [clientFilter, regionFilter, industryFilter, cloudFilter, statusFilter, segmentFilter, countryFilter].filter(v => v !== "all").length +
    (strategicOnly ? 1 : 0);

  const clearAllFilters = () => {
    setClientFilter("all");
    setRegionFilter("all");
    setIndustryFilter("all");
    setCloudFilter("all");
    setStatusFilter("all");
    setSegmentFilter("all");
    setCountryFilter("all");
    setStrategicOnly(false);
  };

  const regionLabel = (value: string | null) => {
    if (!value) return "-";
    return regionOptions.find((o) => o.value === value)?.label || value;
  };
  const industryLabel = (value: string | null) => {
    if (!value) return "-";
    return industryOptions.find((o) => o.value === value)?.label || value;
  };

  const sortedItems = useMemo(() => {
    const sorted = [...items];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "title":
          cmp = (a.title || "").localeCompare(b.title || "");
          break;
        case "clientName":
          cmp = (a.clientName || "").localeCompare(b.clientName || "");
          break;
        case "region":
          cmp = (a.region || "").localeCompare(b.region || "");
          break;
        case "status":
          cmp = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
          break;
        case "confidencePercent":
          cmp = (a.confidencePercent ?? -1) - (b.confidencePercent ?? -1);
          break;
        case "bufferedPrice":
          cmp = (a.bufferedPrice ?? -1) - (b.bufferedPrice ?? -1);
          break;
        case "weightedValue":
          cmp = (a.weightedValue ?? -1) - (b.weightedValue ?? -1);
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [items, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const chartData = useMemo(() => {
    const buckets = new Map<string, { name: string; value: number }>();
    const addTo = (key: string, name: string, item: PipelineItem) => {
      const existing = buckets.get(key) || { name, value: 0 };
      if (measure === "count") existing.value += 1;
      else if (measure === "bufferedPrice") existing.value += item.bufferedPrice || 0;
      else existing.value += item.weightedValue || 0;
      buckets.set(key, existing);
    };
    for (const item of items) {
      if (grouping === "status") {
        addTo(item.status, statusLabel(item.status), item);
      } else if (grouping === "region") {
        addTo(item.region || "__none", item.region ? regionLabel(item.region) : t("common.notSet"), item);
      } else if (grouping === "industry") {
        addTo(item.industry || "__none", item.industry ? industryLabel(item.industry) : t("common.notSet"), item);
      } else {
        if (item.clouds.length === 0) {
          addTo("__none", t("common.notSet"), item);
        } else {
          for (const cloud of item.clouds) addTo(cloud.toLowerCase(), cloud, item);
        }
      }
    }
    let entries = Array.from(buckets.entries());
    if (grouping === "status") {
      entries = entries.sort((a, b) => STATUS_ORDER.indexOf(a[0]) - STATUS_ORDER.indexOf(b[0]));
    } else {
      entries = entries.sort((a, b) => b[1].value - a[1].value);
    }
    return entries.map(([, v]) => ({ ...v, value: measure === "count" ? v.value : Math.round(v.value) }));
  }, [items, measure, grouping, regionOptions, industryOptions, t]);

  const csvColumns = [
    { key: "title", label: t("reportPipeline.colOpportunity") },
    { key: "clientName", label: t("common.client") },
    { key: "region", label: t("common.region") },
    { key: "industry", label: t("clients.industry") },
    { key: "segment", label: t("clients.segment") },
    { key: "country", label: t("clients.country") },
    { key: "clouds", label: t("opportunities.salesforceClouds") },
    { key: "status", label: t("common.status") },
    { key: "confidencePercent", label: t("opportunities.confidence") },
    { key: "bufferedPrice", label: t("opportunities.bufferedPrice") },
    { key: "weightedValue", label: t("opportunities.weightedValue") },
    { key: "strategicAccount", label: t("reportPipeline.strategicAccount") },
  ];

  const csvData = useMemo(() => {
    return sortedItems.map((item) => ({
      title: item.title,
      clientName: item.clientName || "",
      region: item.region ? regionLabel(item.region) : "",
      industry: item.industry ? industryLabel(item.industry) : "",
      segment: item.segment ? (segmentOptions.find((o) => o.value === item.segment)?.label || item.segment) : "",
      country: item.country ? getCountryLabel(item.country) : "",
      clouds: item.clouds.join(", "),
      status: statusLabel(item.status),
      confidencePercent: item.confidencePercent != null ? `${item.confidencePercent}%` : "",
      bufferedPrice: item.bufferedPrice != null ? item.bufferedPrice.toFixed(2) : "",
      weightedValue: item.weightedValue != null ? item.weightedValue.toFixed(2) : "",
      strategicAccount: item.strategicAccount ? t("common.yes") : t("common.no"),
    }));
  }, [sortedItems, regionOptions, industryOptions, segmentOptions, t]);

  const SortableHeader = ({ field, children, align }: { field: SortField; children: string; align?: "right" }) => (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <Button
        variant="ghost"
        size="sm"
        className="no-default-hover-elevate no-default-active-elevate -ml-2 gap-1"
        onClick={() => handleSort(field)}
        data-testid={`button-sort-${field}`}
      >
        {children}
        <ArrowUpDown className="w-3 h-3 text-muted-foreground" />
      </Button>
    </TableHead>
  );

  return (
    <ReportLayout
      title={t("reports.opportunityPipeline")}
      description={t("reportPipeline.description")}
      csvData={csvData}
      csvColumns={csvColumns}
      csvFilename="opportunity-pipeline"
      filters={
        <>
          <ClientFilter
            value={clientFilter}
            onValueChange={setClientFilter}
            clients={(clientsList || []).map((c) => ({ id: c.id, name: c.name }))}
          />
          <DropdownFilter
            label={t("common.region")}
            value={regionFilter}
            onValueChange={setRegionFilter}
            options={regionOptions.map((o) => ({ value: o.value, label: o.label }))}
            placeholder={t("reportPipeline.allRegions")}
            testId="select-filter-region"
          />
          <DropdownFilter
            label={t("clients.industry")}
            value={industryFilter}
            onValueChange={setIndustryFilter}
            options={industryOptions.map((o) => ({ value: o.value, label: o.label }))}
            placeholder={t("reportPipeline.allIndustries")}
            testId="select-filter-industry"
          />
          <DropdownFilter
            label={t("opportunities.sfClouds")}
            value={cloudFilter}
            onValueChange={setCloudFilter}
            options={(report?.cloudOptions || []).map((c) => ({ value: c, label: c }))}
            placeholder={t("reportPipeline.allClouds")}
            testId="select-filter-cloud"
          />
          <DropdownFilter
            label={t("common.status")}
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STATUS_ORDER.map((s) => ({ value: s, label: statusLabel(s) }))}
            placeholder={t("reportPipeline.allStatuses")}
            testId="select-filter-status"
          />
          <DropdownFilter
            label={t("clients.segment")}
            value={segmentFilter}
            onValueChange={setSegmentFilter}
            options={segmentOptions.map((o) => ({ value: o.value, label: o.label }))}
            placeholder={t("reportPipeline.allSegments")}
            testId="select-filter-segment"
          />
          <DropdownFilter
            label={t("clients.country")}
            value={countryFilter}
            onValueChange={setCountryFilter}
            options={countryOptions.map((o) => ({ value: o.value, label: o.label }))}
            placeholder={t("reportPipeline.allCountries")}
            testId="select-filter-country"
          />
          <div className="pb-2">
            <ToggleFilter
              label={t("reportPipeline.strategicOnly")}
              checked={strategicOnly}
              onCheckedChange={setStrategicOnly}
              testId="switch-filter-strategic"
            />
          </div>
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-xs text-muted-foreground"
              data-testid="button-clear-filters"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              {t("common.clearAll")}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ReportStatCard
            title={t("reportPipeline.totalOpportunities")}
            value={isLoading ? "-" : summary?.total ?? 0}
            subtitle={isLoading ? undefined : t("reportPipeline.openCount", { count: summary?.openCount ?? 0 })}
            icon={<Briefcase className="w-5 h-5 text-primary" />}
            testId="stat-total-opportunities"
          />
          <ReportStatCard
            title={t("reportPipeline.totalPipeline")}
            value={isLoading ? "-" : formatCurrency(summary?.totalPipeline ?? 0)}
            icon={<DollarSign className="w-5 h-5 text-blue-500" />}
            testId="stat-total-pipeline"
          />
          <ReportStatCard
            title={t("reportPipeline.weightedPipeline")}
            value={isLoading ? "-" : formatCurrency(summary?.weightedPipeline ?? 0)}
            icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
            testId="stat-weighted-pipeline"
          />
          <ReportStatCard
            title={t("reportPipeline.wonValue")}
            value={isLoading ? "-" : formatCurrency(summary?.wonValue ?? 0)}
            subtitle={isLoading ? undefined : t("reportPipeline.wonCount", { count: summary?.wonCount ?? 0 })}
            icon={<Trophy className="w-5 h-5 text-green-500" />}
            testId="stat-won-value"
          />
        </div>

        <Card data-testid="card-pipeline-chart">
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-3 flex-wrap space-y-0">
            <CardTitle className="text-sm font-semibold">{t("reportPipeline.chartTitle")}</CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={measure} onValueChange={(v) => setMeasure(v as Measure)}>
                <SelectTrigger className="w-44 h-8 text-xs" data-testid="select-chart-measure">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">{t("reportPipeline.measureCount")}</SelectItem>
                  <SelectItem value="bufferedPrice">{t("opportunities.bufferedPrice")}</SelectItem>
                  <SelectItem value="weightedValue">{t("opportunities.weightedValue")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={grouping} onValueChange={(v) => setGrouping(v as Grouping)}>
                <SelectTrigger className="w-44 h-8 text-xs" data-testid="select-chart-grouping">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">{t("reportPipeline.groupByStatus")}</SelectItem>
                  <SelectItem value="region">{t("reportPipeline.groupByRegion")}</SelectItem>
                  <SelectItem value="industry">{t("reportPipeline.groupByIndustry")}</SelectItem>
                  <SelectItem value="cloud">{t("reportPipeline.groupByCloud")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : (
              <ReportBarChart data={chartData} />
            )}
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-3" data-testid="pipeline-loading">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground" data-testid="pipeline-empty">
            {t("reportPipeline.noResults")}
          </div>
        ) : (
          <div className="border rounded-md" data-testid="pipeline-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader field="title">{t("reportPipeline.colOpportunity")}</SortableHeader>
                  <SortableHeader field="clientName">{t("common.client")}</SortableHeader>
                  <SortableHeader field="region">{t("common.region")}</SortableHeader>
                  <SortableHeader field="status">{t("common.status")}</SortableHeader>
                  <SortableHeader field="confidencePercent">{t("opportunities.confidence")}</SortableHeader>
                  <SortableHeader field="bufferedPrice">{t("opportunities.bufferedPrice")}</SortableHeader>
                  <SortableHeader field="weightedValue">{t("opportunities.weightedValue")}</SortableHeader>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.map((item) => (
                  <TableRow key={item.id} className="table-row-hover" data-testid={`row-opp-${item.id}`}>
                    <TableCell className="font-medium max-w-[240px] truncate" data-testid={`text-title-${item.id}`}>
                      {item.title}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate" data-testid={`text-client-${item.id}`}>
                      {item.clientName || "-"}
                    </TableCell>
                    <TableCell data-testid={`text-region-${item.id}`}>{regionLabel(item.region)}</TableCell>
                    <TableCell data-testid={`badge-status-${item.id}`}>
                      <Badge variant="outline" className={`${STATUS_COLORS[item.status] || ""} text-xs`}>
                        {statusLabel(item.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums" data-testid={`text-confidence-${item.id}`}>
                      {item.status === "won" || item.status === "lost"
                        ? "-"
                        : `${item.confidencePercent ?? 100}%`}
                    </TableCell>
                    <TableCell className="tabular-nums" data-testid={`text-buffered-${item.id}`}>
                      {formatCurrency(item.bufferedPrice)}
                    </TableCell>
                    <TableCell className="tabular-nums" data-testid={`text-weighted-${item.id}`}>
                      {formatCurrency(item.weightedValue)}
                    </TableCell>
                    <TableCell>
                      <Link href={`/opportunities/${item.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          data-testid={`link-opportunity-${item.id}`}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="text-xs text-muted-foreground" data-testid="text-pipeline-count">
          {t("reportPipeline.shownCount", { count: sortedItems.length })}
        </div>
      </div>
    </ReportLayout>
  );
}
