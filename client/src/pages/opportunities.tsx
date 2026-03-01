import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { Plus, Target, Search, X, Filter, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TimelineWithMilestones, AppSettings, Client } from "@shared/schema";
import { DEFAULT_REGIONS } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAppTitle } from "@/hooks/use-app-title";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  qualifying: { label: "Qualifying", variant: "default" },
  estimating: { label: "Estimating", variant: "secondary" },
  proposed: { label: "Proposed", variant: "outline" },
  won: { label: "Won", variant: "default" },
  lost: { label: "Lost", variant: "destructive" },
};

const STATUS_COLORS: Record<string, string> = {
  qualifying: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  estimating: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
  proposed: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  won: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  lost: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
};

const createOpportunitySchema = z.object({
  title: z.string().min(1, "Name is required"),
  clientId: z.string().optional(),
  region: z.string().optional(),
  description: z.string().optional(),
  salesforceClouds: z.string().optional(),
});

type CreateOpportunityForm = z.infer<typeof createOpportunitySchema>;

type SortField = "title" | "client" | "region" | "status" | "approvedBudget" | "totalRunningCost" | "grossMargin" | "salesforceClouds";
type SortDir = "asc" | "desc";

interface ColumnFilters {
  clientId?: string;
  region?: string;
  opportunityStatus?: string;
}

export default function OpportunitiesPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const appTitle = useAppTitle("Opportunities");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: opportunities, isLoading } = useQuery<TimelineWithMilestones[]>({
    queryKey: ["/api/opportunities"],
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: clientsList } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const regionOptions = settings?.regions || DEFAULT_REGIONS;

  const form = useForm<CreateOpportunityForm>({
    resolver: zodResolver(createOpportunitySchema),
    defaultValues: {
      title: "",
      clientId: "",
      region: "",
      description: "",
      salesforceClouds: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateOpportunityForm) => {
      const payload: Record<string, any> = {
        title: data.title,
        description: data.description || null,
        salesforceClouds: data.salesforceClouds || null,
      };
      if (data.clientId) payload.clientId = data.clientId;
      if (data.region) payload.region = data.region;
      const res = await apiRequest("POST", "/api/opportunities", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      toast({ title: "Opportunity created" });
      setCreateDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to create opportunity", variant: "destructive" });
    },
  });

  const getClientName = useCallback((clientId: string | null | undefined): string => {
    if (!clientId || !clientsList) return "";
    const c = clientsList.find((cl) => cl.id === clientId);
    return c ? c.name : "";
  }, [clientsList]);

  const activeFilterCount = Object.values(columnFilters).filter(Boolean).length;

  const processedOpportunities = useMemo(() => {
    if (!opportunities) return [];

    let result = opportunities.filter((t) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const clientName = getClientName(t.clientId).toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !clientName.includes(q)) return false;
      }

      if (columnFilters.clientId && (t.clientId || "") !== columnFilters.clientId) return false;
      if (columnFilters.region && (t.region || "") !== columnFilters.region) return false;
      if (columnFilters.opportunityStatus && (t.opportunityStatus || "qualifying") !== columnFilters.opportunityStatus) return false;

      return true;
    });

    if (sortField) {
      result = [...result].sort((a, b) => {
        let aVal: string | number | null = null;
        let bVal: string | number | null = null;

        switch (sortField) {
          case "title":
            aVal = a.title.toLowerCase();
            bVal = b.title.toLowerCase();
            break;
          case "client":
            aVal = getClientName(a.clientId).toLowerCase();
            bVal = getClientName(b.clientId).toLowerCase();
            break;
          case "region": {
            const aRegion = a.region ? (regionOptions.find((o) => o.value === a.region)?.label || a.region) : "";
            const bRegion = b.region ? (regionOptions.find((o) => o.value === b.region)?.label || b.region) : "";
            aVal = aRegion.toLowerCase();
            bVal = bRegion.toLowerCase();
            break;
          }
          case "status": {
            const order: Record<string, number> = { qualifying: 0, estimating: 1, proposed: 2, won: 3, lost: 4 };
            aVal = order[a.opportunityStatus || "qualifying"] ?? 99;
            bVal = order[b.opportunityStatus || "qualifying"] ?? 99;
            break;
          }
          case "approvedBudget":
            aVal = a.approvedBudget ? parseFloat(a.approvedBudget) : -1;
            bVal = b.approvedBudget ? parseFloat(b.approvedBudget) : -1;
            break;
          case "totalRunningCost":
            aVal = a.totalRunningCost ? parseFloat(a.totalRunningCost) : -1;
            bVal = b.totalRunningCost ? parseFloat(b.totalRunningCost) : -1;
            break;
          case "grossMargin":
            aVal = a.grossMargin ? parseFloat(a.grossMargin) : -1;
            bVal = b.grossMargin ? parseFloat(b.grossMargin) : -1;
            break;
          case "salesforceClouds":
            aVal = (a.salesforceClouds || "").toLowerCase();
            bVal = (b.salesforceClouds || "").toLowerCase();
            break;
        }

        if (aVal === null || bVal === null) return 0;
        if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [opportunities, searchQuery, columnFilters, sortField, sortDir, getClientName, regionOptions]);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        setSortField(null);
        setSortDir("asc");
      }
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }, [sortField, sortDir]);

  const setFilter = useCallback((field: keyof ColumnFilters, value: string) => {
    setColumnFilters((prev) => {
      if (!value) {
        const next = { ...prev };
        delete next[field];
        return next;
      }
      return { ...prev, [field]: value };
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setColumnFilters({});
    setSearchQuery("");
  }, []);

  const formatCurrency = (val: string | null | undefined) => {
    if (!val) return "-";
    const num = parseFloat(val);
    if (isNaN(num)) return "-";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(num);
  };

  const formatMargin = (val: string | null | undefined) => {
    if (!val) return "-";
    const num = parseFloat(val);
    if (isNaN(num)) return "-";
    return `${num.toFixed(1)}%`;
  };

  const filterSelectClass = "h-6 text-[10px] border rounded px-1 py-0 bg-background w-full appearance-none cursor-pointer text-muted-foreground";

  const SortHeader = ({ field, label, align = "left" }: { field: SortField; label: string; align?: "left" | "center" }) => {
    const active = sortField === field;
    return (
      <th
        className={`table-header-cell px-3 py-2 cursor-pointer hover:text-foreground transition-colors ${align === "center" ? "text-center" : "text-left"}`}
        onClick={() => toggleSort(field)}
        data-testid={`sort-${field}`}
      >
        <div className={`inline-flex items-center gap-1 ${align === "center" ? "justify-center" : ""}`}>
          {label}
          {active ? (
            sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
          ) : (
            <ArrowUpDown className="w-3 h-3 opacity-20" />
          )}
        </div>
      </th>
    );
  };

  const onSubmitCreate = (data: CreateOpportunityForm) => {
    createMutation.mutate(data);
  };

  return (
    <div className="p-6">
      <Helmet>
        <title>{appTitle}</title>
        <meta name="description" content="Manage your pre-sales opportunities pipeline." />
      </Helmet>

      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h1 className="text-xl font-semibold" data-testid="text-page-title">Opportunities</h1>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-new-opportunity">
              <Plus className="w-4 h-4 mr-2" />
              New Opportunity
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Opportunity</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitCreate)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Opportunity name" data-testid="input-opportunity-title" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="clientId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-opportunity-client">
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(clientsList || []).map((cl) => (
                            <SelectItem key={cl.id} value={cl.id}>{cl.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="region"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Region</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-opportunity-region">
                            <SelectValue placeholder="Select region" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {regionOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Brief description" data-testid="input-opportunity-description" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="salesforceClouds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Salesforce Clouds</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g. Sales Cloud, Service Cloud" data-testid="input-opportunity-salesforce" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)} data-testid="button-cancel-create">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-create">
                    {createMutation.isPending ? "Creating..." : "Create"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {opportunities && opportunities.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or client..."
              className="pl-9 h-8 text-sm"
              data-testid="input-search-opportunities"
            />
          </div>
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="h-8 shrink-0"
            data-testid="button-toggle-filters"
          >
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 bg-primary text-primary-foreground rounded-full w-4 h-4 text-[10px] flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
          {(activeFilterCount > 0 || searchQuery.trim()) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-8 text-xs text-muted-foreground shrink-0"
              data-testid="button-clear-filters"
            >
              <X className="w-3.5 h-3.5 mr-1" />
              Clear all
            </Button>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border rounded-lg p-4">
              <Skeleton className="h-5 w-1/3 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : !opportunities || opportunities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-5">
            <Target className="w-7 h-7 text-muted-foreground/70" />
          </div>
          <h2 className="text-lg font-semibold mb-1.5" data-testid="text-empty-title">No opportunities yet</h2>
          <p className="text-sm text-muted-foreground mb-5 max-w-sm">
            Create your first opportunity to start tracking your pre-sales pipeline.
          </p>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)} data-testid="button-empty-create">
            <Plus className="w-4 h-4 mr-2" />
            New Opportunity
          </Button>
        </div>
      ) : processedOpportunities.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-search-results">
          <Search className="w-8 h-8 text-muted-foreground/60 mb-3" />
          <h2 className="text-base font-semibold mb-1">No matching opportunities</h2>
          <p className="text-xs text-muted-foreground mb-3">
            No opportunities match your current filters. Try adjusting your search or filters.
          </p>
          <Button variant="outline" size="sm" onClick={clearAllFilters} data-testid="button-clear-filters-empty">
            Clear all filters
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden" data-testid="table-opportunities">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <SortHeader field="title" label="Name" />
                  <SortHeader field="client" label="Client" />
                  <SortHeader field="region" label="Region" />
                  <SortHeader field="status" label="Status" align="center" />
                  <SortHeader field="approvedBudget" label="Buffered Price" />
                  <SortHeader field="totalRunningCost" label="Base Cost" />
                  <SortHeader field="grossMargin" label="Margin" />
                  <SortHeader field="salesforceClouds" label="SF Clouds" />
                </tr>
                {showFilters && (
                  <tr className="bg-muted/30 border-b">
                    <th className="px-3 py-1.5" />
                    <th className="px-3 py-1.5">
                      <select
                        className={filterSelectClass}
                        value={columnFilters.clientId || ""}
                        onChange={(e) => setFilter("clientId", e.target.value)}
                        data-testid="filter-client"
                      >
                        <option value="">All</option>
                        {(clientsList || []).map((cl) => (
                          <option key={cl.id} value={cl.id}>{cl.name}</option>
                        ))}
                      </select>
                    </th>
                    <th className="px-3 py-1.5">
                      <select
                        className={filterSelectClass}
                        value={columnFilters.region || ""}
                        onChange={(e) => setFilter("region", e.target.value)}
                        data-testid="filter-region"
                      >
                        <option value="">All</option>
                        {regionOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </th>
                    <th className="px-3 py-1.5">
                      <select
                        className={filterSelectClass}
                        value={columnFilters.opportunityStatus || ""}
                        onChange={(e) => setFilter("opportunityStatus", e.target.value)}
                        data-testid="filter-status"
                      >
                        <option value="">All</option>
                        <option value="qualifying">Qualifying</option>
                        <option value="estimating">Estimating</option>
                        <option value="proposed">Proposed</option>
                        <option value="won">Won</option>
                        <option value="lost">Lost</option>
                      </select>
                    </th>
                    <th className="px-3 py-1.5" />
                    <th className="px-3 py-1.5" />
                    <th className="px-3 py-1.5" />
                    <th className="px-3 py-1.5" />
                  </tr>
                )}
              </thead>
              <tbody>
                {processedOpportunities.map((opp) => {
                  const status = opp.opportunityStatus || "qualifying";
                  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.qualifying;
                  const statusLabel = STATUS_BADGES[status]?.label || status;

                  return (
                    <tr
                      key={opp.id}
                      className="border-b table-row-hover cursor-pointer"
                      onClick={() => navigate(`/opportunities/${opp.id}`)}
                      data-testid={`row-opportunity-${opp.id}`}
                    >
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground" data-testid={`text-opportunity-name-${opp.id}`}>
                            {opp.title}
                          </span>
                          {status === "won" && opp.sourceOpportunityId && (
                            <Link
                              href={`/timeline/${opp.sourceOpportunityId}`}
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`link-project-${opp.id}`}
                            >
                              <ExternalLink className="w-3 h-3 text-muted-foreground" />
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground" data-testid={`text-opportunity-client-${opp.id}`}>
                        {getClientName(opp.clientId) || <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground" data-testid={`text-opportunity-region-${opp.id}`}>
                        {opp.region ? (regionOptions.find((o) => o.value === opp.region)?.label || opp.region) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${statusColor}`}
                          data-testid={`badge-status-${opp.id}`}
                        >
                          {statusLabel}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 table-financial text-muted-foreground" data-testid={`text-price-${opp.id}`}>
                        {formatCurrency(opp.approvedBudget)}
                      </td>
                      <td className="px-3 py-2 table-financial text-muted-foreground" data-testid={`text-cost-${opp.id}`}>
                        {formatCurrency(opp.totalRunningCost)}
                      </td>
                      <td className="px-3 py-2 table-financial text-muted-foreground" data-testid={`text-margin-${opp.id}`}>
                        {formatMargin(opp.grossMargin)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground" data-testid={`text-clouds-${opp.id}`}>
                        {opp.salesforceClouds || <span className="text-muted-foreground/40">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
