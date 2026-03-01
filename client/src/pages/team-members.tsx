import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { Plus, Search, Users, Trash2, ExternalLink, Save, ArrowUpDown, ArrowUp, ArrowDown, X, Filter } from "lucide-react";
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
import type { TeamMember, AppSettings } from "@shared/schema";
import { DEFAULT_TEAM_MEMBER_ROLES } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface RowEdits {
  role?: string | null;
  department?: string | null;
  monthlyCost?: string | null;
  hourlyCost?: string | null;
}

type SortField = "name" | "role" | "department" | "email" | "monthlyCost" | "hourlyCost";
type SortDir = "asc" | "desc";

interface ColumnFilters {
  role?: string;
  department?: string;
}

export default function TeamMembers() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [dirtyRows, setDirtyRows] = useState<Record<string, RowEdits>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newDept, setNewDept] = useState("");
  const [newMonthlyCost, setNewMonthlyCost] = useState("");
  const [newHourlyCost, setNewHourlyCost] = useState("");

  const { data: members = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ["/api/team-members"],
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });
  const roleOptions = settings?.teamMemberRoles || DEFAULT_TEAM_MEMBER_ROLES;

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/team-members", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "Team member created" });
      setCreateOpen(false);
      setNewName(""); setNewEmail(""); setNewRole(""); setNewDept("");
      setNewMonthlyCost(""); setNewHourlyCost("");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      await apiRequest("PATCH", `/api/team-members/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/team-members/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/team-members"] });
      toast({ title: "Team member deleted" });
    },
  });

  const getRoleLabel = useCallback((value: string | null) => {
    if (!value) return "";
    return roleOptions.find(r => r.value === value)?.label || value;
  }, [roleOptions]);

  const uniqueDepartments = useMemo(() => {
    const depts = new Set(members.map(m => m.department).filter(Boolean));
    return Array.from(depts).sort();
  }, [members]);

  const setFieldEdit = useCallback((id: string, field: keyof RowEdits, value: string | null) => {
    setDirtyRows(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }, []);

  const getDisplayValue = useCallback((member: TeamMember, field: keyof RowEdits) => {
    if (dirtyRows[member.id]?.[field] !== undefined) return dirtyRows[member.id][field];
    return (member as any)[field];
  }, [dirtyRows]);

  const saveAll = useCallback(async () => {
    const entries = Object.entries(dirtyRows);
    if (entries.length === 0) return;
    for (const [id, edits] of entries) {
      await updateMutation.mutateAsync({ id, data: edits });
    }
    setDirtyRows({});
    toast({ title: `${entries.length} member(s) updated` });
  }, [dirtyRows, updateMutation, toast]);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }, [sortField]);

  const filteredMembers = useMemo(() => {
    let list = [...members];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        m.name.toLowerCase().includes(q) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        (m.department && m.department.toLowerCase().includes(q))
      );
    }
    if (columnFilters.role) {
      list = list.filter(m => (getDisplayValue(m, "role") || "") === columnFilters.role);
    }
    if (columnFilters.department) {
      list = list.filter(m => (getDisplayValue(m, "department") || "") === columnFilters.department);
    }
    list.sort((a, b) => {
      let av: any, bv: any;
      if (sortField === "monthlyCost" || sortField === "hourlyCost") {
        av = parseFloat(getDisplayValue(a, sortField) || "0") || 0;
        bv = parseFloat(getDisplayValue(b, sortField) || "0") || 0;
      } else if (sortField === "role") {
        av = getRoleLabel(getDisplayValue(a, "role") as string | null).toLowerCase();
        bv = getRoleLabel(getDisplayValue(b, "role") as string | null).toLowerCase();
      } else {
        av = ((a as any)[sortField] || "").toString().toLowerCase();
        bv = ((b as any)[sortField] || "").toString().toLowerCase();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [members, search, columnFilters, sortField, sortDir, getDisplayValue, getRoleLabel]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const dirtyCount = Object.keys(dirtyRows).length;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <Helmet><title>Team Members | Project Planning</title></Helmet>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2" data-testid="text-page-title">
            <Users className="w-5 h-5" />
            Team Members
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{members.length} member{members.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          {dirtyCount > 0 && (
            <Button size="sm" onClick={saveAll} disabled={updateMutation.isPending} data-testid="button-save-all-members">
              <Save className="w-3.5 h-3.5 mr-1" />
              Save All Changes ({dirtyCount})
            </Button>
          )}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-create-member">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
                <DialogDescription>Create a new team member.</DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name *</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name" data-testid="input-create-member-name" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email" data-testid="input-create-member-email" />
                </div>
                <div>
                  <Label>Role</Label>
                  <select className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm" value={newRole} onChange={e => setNewRole(e.target.value)} data-testid="select-create-member-role">
                    <option value="">Select role...</option>
                    {roleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Department</Label>
                  <Input value={newDept} onChange={e => setNewDept(e.target.value)} placeholder="e.g. Engineering" data-testid="input-create-member-dept" />
                </div>
                <div>
                  <Label>Monthly Cost ($)</Label>
                  <Input type="number" step="0.01" min="0" value={newMonthlyCost} onChange={e => setNewMonthlyCost(e.target.value)} placeholder="0.00" data-testid="input-create-member-monthly" />
                </div>
                <div>
                  <Label>Hourly Cost ($)</Label>
                  <Input type="number" step="0.01" min="0" value={newHourlyCost} onChange={e => setNewHourlyCost(e.target.value)} placeholder="0.00" data-testid="input-create-member-hourly" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={() => createMutation.mutate({ name: newName, email: newEmail || null, role: newRole || null, department: newDept || null, monthlyCost: newMonthlyCost || null, hourlyCost: newHourlyCost || null })} disabled={!newName.trim() || createMutation.isPending} data-testid="button-confirm-create-member">
                  {createMutation.isPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-sm" placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-members" />
        </div>
        <Button variant="outline" size="sm" className="h-8" onClick={() => setShowFilters(!showFilters)} data-testid="button-toggle-filters">
          <Filter className="w-3.5 h-3.5 mr-1" />
          Filters
          {Object.values(columnFilters).filter(Boolean).length > 0 && (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{Object.values(columnFilters).filter(Boolean).length}</Badge>
          )}
        </Button>
        {Object.values(columnFilters).some(Boolean) && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setColumnFilters({})} data-testid="button-clear-filters">
            <X className="w-3 h-3 mr-1" />Clear
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-3 py-2 table-header-cell">
                  <button className="flex items-center" onClick={() => toggleSort("name")}>
                    Name <SortIcon field="name" />
                  </button>
                </th>
                <th className="text-left px-3 py-2 table-header-cell">
                  <button className="flex items-center" onClick={() => toggleSort("role")}>
                    Role <SortIcon field="role" />
                  </button>
                </th>
                <th className="text-left px-3 py-2 table-header-cell">
                  <button className="flex items-center" onClick={() => toggleSort("department")}>
                    Department <SortIcon field="department" />
                  </button>
                </th>
                <th className="text-left px-3 py-2 table-header-cell">
                  <button className="flex items-center" onClick={() => toggleSort("email")}>
                    Email <SortIcon field="email" />
                  </button>
                </th>
                <th className="text-right px-3 py-2 table-header-cell">
                  <button className="flex items-center justify-end" onClick={() => toggleSort("monthlyCost")}>
                    Monthly ($) <SortIcon field="monthlyCost" />
                  </button>
                </th>
                <th className="text-right px-3 py-2 table-header-cell">
                  <button className="flex items-center justify-end" onClick={() => toggleSort("hourlyCost")}>
                    Hourly ($) <SortIcon field="hourlyCost" />
                  </button>
                </th>
                <th className="w-20 px-3 py-2"></th>
              </tr>
              {showFilters && (
                <tr className="border-b bg-muted/30">
                  <td className="p-1.5"></td>
                  <td className="p-1.5">
                    <select className="w-full h-7 rounded border border-input bg-background px-2 text-xs" value={columnFilters.role || ""} onChange={e => setColumnFilters(f => ({ ...f, role: e.target.value || undefined }))} data-testid="filter-role">
                      <option value="">All</option>
                      {roleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  </td>
                  <td className="p-1.5">
                    <select className="w-full h-7 rounded border border-input bg-background px-2 text-xs" value={columnFilters.department || ""} onChange={e => setColumnFilters(f => ({ ...f, department: e.target.value || undefined }))} data-testid="filter-department">
                      <option value="">All</option>
                      {uniqueDepartments.map(d => <option key={d} value={d!}>{d}</option>)}
                    </select>
                  </td>
                  <td className="p-1.5"></td>
                  <td className="p-1.5"></td>
                  <td className="p-1.5"></td>
                  <td className="p-1.5"></td>
                </tr>
              )}
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    {members.length === 0 ? (
                      <span className="flex flex-col items-center gap-2">
                        <Users className="w-7 h-7 text-muted-foreground/50" />
                        <span className="text-sm font-medium">No team members yet</span>
                        <span className="text-xs">Add your first member to get started.</span>
                      </span>
                    ) : (
                      <span className="flex flex-col items-center gap-2">
                        <Search className="w-7 h-7 text-muted-foreground/50" />
                        <span className="text-sm font-medium">No members match filters</span>
                        <span className="text-xs">Try adjusting your search or filters.</span>
                      </span>
                    )}
                  </td>
                </tr>
              ) : (
                filteredMembers.map(m => {
                  const isDirty = !!dirtyRows[m.id];
                  return (
                    <tr key={m.id} className={`border-b table-row-hover ${isDirty ? "bg-yellow-50 dark:bg-yellow-950" : ""}`} data-testid={`row-member-${m.id}`}>
                      <td className="px-3 py-1.5">
                        <Link href={`/team-members/${m.id}`}>
                          <span className="flex items-center gap-2 text-xs font-medium hover:underline cursor-pointer" data-testid={`link-member-${m.id}`}>
                            <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                              {m.name.charAt(0).toUpperCase()}
                            </span>
                            {m.name}
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          className="h-7 rounded border border-input bg-background px-2 text-xs w-full max-w-[180px]"
                          value={(getDisplayValue(m, "role") as string) || ""}
                          onChange={e => setFieldEdit(m.id, "role", e.target.value || null)}
                          data-testid={`select-role-${m.id}`}
                        >
                          <option value="">—</option>
                          {roleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <Input
                          className="h-7 text-xs max-w-[140px]"
                          value={(getDisplayValue(m, "department") as string) || ""}
                          onChange={e => setFieldEdit(m.id, "department", e.target.value || null)}
                          data-testid={`input-department-${m.id}`}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-xs text-muted-foreground">{m.email || <span className="text-muted-foreground/40">—</span>}</td>
                      <td className="px-3 py-1.5 table-financial">
                        <Input
                          className="h-7 text-xs w-24 ml-auto text-right"
                          type="number"
                          step="0.01"
                          min="0"
                          value={(getDisplayValue(m, "monthlyCost") as string) || ""}
                          onChange={e => setFieldEdit(m.id, "monthlyCost", e.target.value || null)}
                          data-testid={`input-monthly-${m.id}`}
                        />
                      </td>
                      <td className="px-3 py-1.5 table-financial">
                        <Input
                          className="h-7 text-xs w-24 ml-auto text-right"
                          type="number"
                          step="0.01"
                          min="0"
                          value={(getDisplayValue(m, "hourlyCost") as string) || ""}
                          onChange={e => setFieldEdit(m.id, "hourlyCost", e.target.value || null)}
                          data-testid={`input-hourly-${m.id}`}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1 justify-end">
                          <Link href={`/team-members/${m.id}`}>
                            <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`button-view-member-${m.id}`}>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7" data-testid={`button-delete-member-${m.id}`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete team member?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete "{m.name}" and remove them from all project assignments and allocations.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(m.id)} data-testid={`button-confirm-delete-member-${m.id}`}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
