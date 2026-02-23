import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { Plus, Search, Building2, Trash2, ExternalLink, Save, ArrowUpDown, ArrowUp, ArrowDown, X, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Client } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface RowEdits {
  industry?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status?: string;
}

type SortField = "name" | "industry" | "contactName" | "contactEmail" | "contactPhone" | "status";
type SortDir = "asc" | "desc";

interface ColumnFilters {
  industry?: string;
  status?: string;
}

export default function Clients() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [edits, setEdits] = useState<Record<string, RowEdits>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const { data: clients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; industry?: string; contactName?: string; contactEmail?: string }) => {
      const res = await apiRequest("POST", "/api/clients", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client created" });
      setCreateOpen(false);
      setNewName("");
      setNewIndustry("");
      setNewContactName("");
      setNewContactEmail("");
    },
    onError: () => {
      toast({ title: "Failed to create client", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client deleted" });
    },
  });

  const activeFilterCount = Object.values(columnFilters).filter(Boolean).length;

  const uniqueIndustries = useMemo(() => {
    if (!clients) return [];
    const set = new Set<string>();
    clients.forEach((c) => { if (c.industry) set.add(c.industry); });
    return Array.from(set).sort();
  }, [clients]);

  const getOriginal = useCallback((client: Client, field: keyof RowEdits): string => {
    const raw = (client as any)[field];
    return raw != null ? String(raw) : "";
  }, []);

  const updateField = useCallback((id: string, field: keyof RowEdits, value: string | null, client: Client) => {
    const original = getOriginal(client, field);
    const newVal = value ?? "";
    setEdits((prev) => {
      const existing = { ...prev[id] };
      if (newVal === original) {
        delete existing[field];
        if (Object.keys(existing).length === 0) {
          const next = { ...prev };
          delete next[id];
          return next;
        }
        return { ...prev, [id]: existing };
      }
      return { ...prev, [id]: { ...existing, [field]: value } };
    });
  }, [getOriginal]);

  const getVal = useCallback((client: Client, field: keyof RowEdits): string => {
    const edit = edits[client.id];
    if (edit && field in edit) return (edit[field] as string) ?? "";
    return getOriginal(client, field);
  }, [edits, getOriginal]);

  const hasEdits = useCallback((id: string) => {
    return edits[id] && Object.keys(edits[id]).length > 0;
  }, [edits]);

  const hasAnyEdits = Object.keys(edits).some((id) => hasEdits(id));
  const isSaving = savingIds.size > 0;

  const saveRow = useCallback(async (id: string) => {
    const rowEdits = edits[id];
    if (!rowEdits || Object.keys(rowEdits).length === 0) return;
    setSavingIds((prev) => new Set(prev).add(id));
    try {
      const payload: Record<string, any> = {};
      for (const [key, val] of Object.entries(rowEdits)) {
        payload[key] = val && val !== "" ? val : null;
      }
      await apiRequest("PATCH", `/api/clients/${id}`, payload);
      setEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client updated" });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [edits, toast]);

  const saveAll = useCallback(async () => {
    const ids = Object.keys(edits).filter((id) => hasEdits(id));
    for (const id of ids) {
      await saveRow(id);
    }
  }, [edits, hasEdits, saveRow]);

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

  const processedClients = useMemo(() => {
    if (!clients) return [];

    let result = clients.filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (
          !c.name.toLowerCase().includes(q) &&
          !(c.industry || "").toLowerCase().includes(q) &&
          !(c.contactName || "").toLowerCase().includes(q)
        ) return false;
      }

      if (columnFilters.industry && (c.industry || "") !== columnFilters.industry) return false;
      if (columnFilters.status && (c.status || "active") !== columnFilters.status) return false;

      return true;
    });

    if (sortField) {
      result = [...result].sort((a, b) => {
        let aVal: string = "";
        let bVal: string = "";

        switch (sortField) {
          case "name":
            aVal = a.name.toLowerCase();
            bVal = b.name.toLowerCase();
            break;
          case "industry":
            aVal = (a.industry || "").toLowerCase();
            bVal = (b.industry || "").toLowerCase();
            break;
          case "contactName":
            aVal = (a.contactName || "").toLowerCase();
            bVal = (b.contactName || "").toLowerCase();
            break;
          case "contactEmail":
            aVal = (a.contactEmail || "").toLowerCase();
            bVal = (b.contactEmail || "").toLowerCase();
            break;
          case "contactPhone":
            aVal = (a.contactPhone || "").toLowerCase();
            bVal = (b.contactPhone || "").toLowerCase();
            break;
          case "status":
            aVal = (a.status || "active").toLowerCase();
            bVal = (b.status || "active").toLowerCase();
            break;
        }

        if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [clients, searchQuery, columnFilters, sortField, sortDir]);

  const inputClass = "h-7 text-xs border rounded px-1.5 py-0 bg-background w-full";
  const selectClass = "h-7 text-xs border rounded px-1.5 py-0 bg-background w-full appearance-none cursor-pointer";
  const filterSelectClass = "h-6 text-[10px] border rounded px-1 py-0 bg-background w-full appearance-none cursor-pointer text-muted-foreground";

  const SortHeader = ({ field, label, align = "left" }: { field: SortField; label: string; align?: "left" | "center" }) => {
    const active = sortField === field;
    return (
      <th
        className={`font-medium text-muted-foreground px-3 py-2 whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors ${align === "center" ? "text-center" : "text-left"}`}
        onClick={() => toggleSort(field)}
        data-testid={`sort-${field}`}
      >
        <div className={`inline-flex items-center gap-1 ${align === "center" ? "justify-center" : ""}`}>
          {label}
          {active ? (
            sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
          ) : (
            <ArrowUpDown className="w-3 h-3 opacity-30" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="p-6">
      <Helmet>
        <title>Clients | Project High Level Planning</title>
        <meta name="description" content="Manage your clients with inline editing and bulk save." />
      </Helmet>

      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <h1 className="text-xl font-semibold" data-testid="text-page-title">Clients</h1>
        <div className="flex items-center gap-2">
          {hasAnyEdits && (
            <Button onClick={saveAll} size="sm" disabled={isSaving} data-testid="button-save-all">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save All Changes"}
            </Button>
          )}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-create-client">
                <Plus className="w-4 h-4 mr-2" />
                New Client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Client</DialogTitle>
                <DialogDescription>Add a new client to your organization.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <Label htmlFor="client-name">Name *</Label>
                  <Input
                    id="client-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Client name"
                    data-testid="input-client-name"
                  />
                </div>
                <div>
                  <Label htmlFor="client-industry">Industry</Label>
                  <Input
                    id="client-industry"
                    value={newIndustry}
                    onChange={(e) => setNewIndustry(e.target.value)}
                    placeholder="e.g. Technology, Healthcare"
                    data-testid="input-client-industry"
                  />
                </div>
                <div>
                  <Label htmlFor="client-contact">Contact Name</Label>
                  <Input
                    id="client-contact"
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="Primary contact"
                    data-testid="input-client-contact-name"
                  />
                </div>
                <div>
                  <Label htmlFor="client-email">Contact Email</Label>
                  <Input
                    id="client-email"
                    type="email"
                    value={newContactEmail}
                    onChange={(e) => setNewContactEmail(e.target.value)}
                    placeholder="email@example.com"
                    data-testid="input-client-contact-email"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => {
                    if (!newName.trim()) return;
                    createMutation.mutate({
                      name: newName.trim(),
                      industry: newIndustry || undefined,
                      contactName: newContactName || undefined,
                      contactEmail: newContactEmail || undefined,
                    });
                  }}
                  disabled={!newName.trim() || createMutation.isPending}
                  data-testid="button-submit-client"
                >
                  {createMutation.isPending ? "Creating..." : "Create Client"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {clients && clients.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, industry, or contact..."
              className="pl-9 h-8 text-sm"
              data-testid="input-search-clients"
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
      ) : !clients || clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-6">
            <Building2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">No clients yet</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            Add your first client to start organizing projects by client.
          </p>
          <Button onClick={() => setCreateOpen(true)} data-testid="button-empty-create-client">
            <Plus className="w-4 h-4 mr-2" />
            Create Client
          </Button>
        </div>
      ) : processedClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-search-results">
          <Search className="w-10 h-10 text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold mb-1">No matching clients</h2>
          <p className="text-sm text-muted-foreground mb-3">
            No clients match your current filters. Try adjusting your search or filters.
          </p>
          <Button variant="outline" size="sm" onClick={clearAllFilters} data-testid="button-clear-filters-empty">
            Clear all filters
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden" data-testid="table-clients">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <SortHeader field="name" label="Name" />
                  <SortHeader field="industry" label="Industry" />
                  <SortHeader field="contactName" label="Contact Name" />
                  <SortHeader field="contactEmail" label="Contact Email" />
                  <SortHeader field="contactPhone" label="Phone" />
                  <SortHeader field="status" label="Status" align="center" />
                  <th className="text-center font-medium text-muted-foreground px-3 py-2 whitespace-nowrap w-[80px]">Actions</th>
                </tr>
                {showFilters && (
                  <tr className="bg-muted/30 border-b">
                    <th className="px-3 py-1.5" />
                    <th className="px-3 py-1.5">
                      <select
                        className={filterSelectClass}
                        value={columnFilters.industry || ""}
                        onChange={(e) => setFilter("industry", e.target.value)}
                        data-testid="filter-industry"
                      >
                        <option value="">All</option>
                        {uniqueIndustries.map((ind) => (
                          <option key={ind} value={ind}>{ind}</option>
                        ))}
                      </select>
                    </th>
                    <th className="px-3 py-1.5" />
                    <th className="px-3 py-1.5" />
                    <th className="px-3 py-1.5" />
                    <th className="px-3 py-1.5">
                      <select
                        className={filterSelectClass}
                        value={columnFilters.status || ""}
                        onChange={(e) => setFilter("status", e.target.value)}
                        data-testid="filter-status"
                      >
                        <option value="">All</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </th>
                    <th className="px-3 py-1.5" />
                  </tr>
                )}
              </thead>
              <tbody>
                {processedClients.map((client) => {
                  const dirty = hasEdits(client.id);
                  return (
                    <tr
                      key={client.id}
                      className={`border-b last:border-b-0 transition-colors ${dirty ? "bg-yellow-50 dark:bg-yellow-950/30" : "hover:bg-muted/30"}`}
                      data-testid={`row-client-${client.id}`}
                    >
                      <td className="px-3 py-2 min-w-[180px]">
                        <Link
                          href={`/clients/${client.id}`}
                          className="font-medium text-xs hover:underline"
                          data-testid={`link-client-${client.id}`}
                        >
                          {client.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 min-w-[130px]">
                        <input
                          type="text"
                          className={inputClass}
                          value={getVal(client, "industry")}
                          onChange={(e) => updateField(client.id, "industry", e.target.value, client)}
                          placeholder="Industry"
                          data-testid={`input-industry-${client.id}`}
                        />
                      </td>
                      <td className="px-3 py-2 min-w-[140px]">
                        <input
                          type="text"
                          className={inputClass}
                          value={getVal(client, "contactName")}
                          onChange={(e) => updateField(client.id, "contactName", e.target.value, client)}
                          placeholder="Contact name"
                          data-testid={`input-contactName-${client.id}`}
                        />
                      </td>
                      <td className="px-3 py-2 min-w-[180px]">
                        <input
                          type="text"
                          className={inputClass}
                          value={getVal(client, "contactEmail")}
                          onChange={(e) => updateField(client.id, "contactEmail", e.target.value, client)}
                          placeholder="Email"
                          data-testid={`input-contactEmail-${client.id}`}
                        />
                      </td>
                      <td className="px-3 py-2 min-w-[130px]">
                        <input
                          type="text"
                          className={inputClass}
                          value={getVal(client, "contactPhone")}
                          onChange={(e) => updateField(client.id, "contactPhone", e.target.value, client)}
                          placeholder="Phone"
                          data-testid={`input-contactPhone-${client.id}`}
                        />
                      </td>
                      <td className="px-3 py-2 min-w-[100px]">
                        <select
                          className={selectClass}
                          value={getVal(client, "status") || "active"}
                          onChange={(e) => updateField(client.id, "status", e.target.value, client)}
                          data-testid={`select-status-${client.id}`}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <Link href={`/clients/${client.id}`}>
                            <Button
                              size="icon"
                              variant="ghost"
                              title="View client"
                              data-testid={`button-open-client-${client.id}`}
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Delete client"
                                data-testid={`button-delete-client-${client.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete client?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete "{client.name}". Projects assigned to this client will be unlinked but not deleted.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteMutation.mutate(client.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
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
