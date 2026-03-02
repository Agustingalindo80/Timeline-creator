import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Building2, Users, FolderKanban, Target, Plus, Settings, BarChart3, Pencil, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  maxUsers: number;
  maxProjects: number;
  storageLimit: number;
  billingEmail: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  userCount?: number;
  projectCount?: number;
  opportunityCount?: number;
};

type SystemStats = {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  totalProjects: number;
  totalOpportunities: number;
};

function StatCard({ title, value, icon: Icon, subtitle }: { title: string; value: number | string; icon: any; subtitle?: string }) {
  return (
    <Card data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function statusBadge(status: string) {
  const variants: Record<string, string> = {
    active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    suspended: "bg-red-500/10 text-red-600 border-red-500/20",
    trial: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  };
  return (
    <Badge variant="outline" className={variants[status] || ""} data-testid={`badge-status-${status}`}>
      {status}
    </Badge>
  );
}

function planBadge(plan: string) {
  const variants: Record<string, string> = {
    free: "bg-slate-500/10 text-slate-600 border-slate-500/20",
    pro: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    enterprise: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  };
  return (
    <Badge variant="outline" className={variants[plan] || ""} data-testid={`badge-plan-${plan}`}>
      {plan}
    </Badge>
  );
}

function CreateTenantDialog({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [plan, setPlan] = useState("free");
  const [maxUsers, setMaxUsers] = useState("10");
  const [maxProjects, setMaxProjects] = useState("25");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");

  const computedSlug = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/global-admin/tenants", {
        name,
        slug: computedSlug,
        plan,
        maxUsers: parseInt(maxUsers) || 10,
        maxProjects: parseInt(maxProjects) || 25,
        adminEmail,
        adminFirstName,
        adminLastName,
      });
    },
    onSuccess: () => {
      toast({ title: "Tenant created", description: `Tenant Admin: ${adminEmail}` });
      queryClient.invalidateQueries({ queryKey: ["/api/global-admin/tenants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/global-admin/stats"] });
      setOpen(false);
      setName("");
      setSlug("");
      setPlan("free");
      setMaxUsers("10");
      setMaxProjects("25");
      setAdminEmail("");
      setAdminFirstName("");
      setAdminLastName("");
      onCreated();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const canSubmit = name && adminEmail && adminFirstName && adminLastName;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-create-tenant">
          <Plus className="w-4 h-4 mr-2" /> New Tenant
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Tenant</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Separator />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Organization</p>
          <div className="space-y-2">
            <Label htmlFor="tenant-name">Organization Name</Label>
            <Input
              id="tenant-name"
              data-testid="input-tenant-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug) setSlug("");
              }}
              placeholder="Acme Corp"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenant-slug">Slug</Label>
            <Input
              id="tenant-slug"
              data-testid="input-tenant-slug"
              value={slug || computedSlug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="acme-corp"
            />
            {computedSlug && (
              <p className="text-xs text-muted-foreground" data-testid="text-tenant-url">
                Tenant URL: {window.location.origin}/t/{computedSlug}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="tenant-plan">Plan</Label>
            <Select value={plan} onValueChange={setPlan}>
              <SelectTrigger data-testid="select-tenant-plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="enterprise">Enterprise</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max-users">Max Users</Label>
              <Input
                id="max-users"
                data-testid="input-max-users"
                type="number"
                value={maxUsers}
                onChange={(e) => setMaxUsers(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-projects">Max Projects</Label>
              <Input
                id="max-projects"
                data-testid="input-max-projects"
                type="number"
                value={maxProjects}
                onChange={(e) => setMaxProjects(e.target.value)}
              />
            </div>
          </div>

          <Separator />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tenant Administrator</p>
          <p className="text-xs text-muted-foreground">This person will be the first user and Global Admin of the new tenant.</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="admin-first-name">First Name</Label>
              <Input
                id="admin-first-name"
                data-testid="input-admin-first-name"
                value={adminFirstName}
                onChange={(e) => setAdminFirstName(e.target.value)}
                placeholder="Jane"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-last-name">Last Name</Label>
              <Input
                id="admin-last-name"
                data-testid="input-admin-last-name"
                value={adminLastName}
                onChange={(e) => setAdminLastName(e.target.value)}
                placeholder="Doe"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-email">Email</Label>
            <Input
              id="admin-email"
              data-testid="input-admin-email"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              placeholder="jane@acmecorp.com"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="button-cancel-tenant">Cancel</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!canSubmit || createMutation.isPending}
            data-testid="button-save-tenant"
          >
            {createMutation.isPending ? "Creating..." : "Create Tenant"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TenantDetailView({ tenantId, onBack }: { tenantId: string; onBack: () => void }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<Partial<Tenant>>({});

  const { data: tenant, isLoading } = useQuery<Tenant>({
    queryKey: ["/api/global-admin/tenants", tenantId],
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("PATCH", `/api/global-admin/tenants/${tenantId}`, editData);
    },
    onSuccess: () => {
      toast({ title: "Tenant updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/global-admin/tenants", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/global-admin/tenants"] });
      setEditing(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", `/api/global-admin/tenants/${tenantId}`);
    },
    onSuccess: () => {
      toast({ title: "Tenant suspended" });
      queryClient.invalidateQueries({ queryKey: ["/api/global-admin/tenants", tenantId] });
      queryClient.invalidateQueries({ queryKey: ["/api/global-admin/tenants"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading || !tenant) {
    return <div className="p-6 text-muted-foreground">Loading...</div>;
  }

  const startEdit = () => {
    setEditData({
      name: tenant.name,
      plan: tenant.plan,
      status: tenant.status,
      maxUsers: tenant.maxUsers,
      maxProjects: tenant.maxProjects,
      storageLimit: tenant.storageLimit,
      billingEmail: tenant.billingEmail,
    });
    setEditing(true);
  };

  return (
    <div className="space-y-6" data-testid="tenant-detail-view">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-tenants">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">{tenant.name}</h2>
            <p className="text-sm text-muted-foreground">Slug: {tenant.slug}</p>
          </div>
          {statusBadge(tenant.status)}
          {planBadge(tenant.plan)}
        </div>
        <div className="flex gap-2">
          {!editing && (
            <>
              <Button variant="outline" size="sm" onClick={startEdit} data-testid="button-edit-tenant">
                <Pencil className="w-4 h-4 mr-1" /> Edit
              </Button>
              {tenant.status === "active" && tenant.id !== "default" && (
                <Button variant="destructive" size="sm" onClick={() => suspendMutation.mutate()} data-testid="button-suspend-tenant">
                  <Ban className="w-4 h-4 mr-1" /> Suspend
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="border rounded-md p-4 bg-muted/30 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                data-testid="input-edit-tenant-name"
                value={editData.name || ""}
                onChange={(e) => setEditData(d => ({ ...d, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={editData.plan || "free"} onValueChange={(v) => setEditData(d => ({ ...d, plan: v }))}>
                <SelectTrigger data-testid="select-edit-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editData.status || "active"} onValueChange={(v) => setEditData(d => ({ ...d, status: v }))}>
                <SelectTrigger data-testid="select-edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Billing Email</Label>
              <Input
                data-testid="input-edit-billing-email"
                value={editData.billingEmail || ""}
                onChange={(e) => setEditData(d => ({ ...d, billingEmail: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Users</Label>
              <Input
                data-testid="input-edit-max-users"
                type="number"
                value={editData.maxUsers || 10}
                onChange={(e) => setEditData(d => ({ ...d, maxUsers: parseInt(e.target.value) || 10 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Projects</Label>
              <Input
                data-testid="input-edit-max-projects"
                type="number"
                value={editData.maxProjects || 25}
                onChange={(e) => setEditData(d => ({ ...d, maxProjects: parseInt(e.target.value) || 25 }))}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)} data-testid="button-cancel-edit">Cancel</Button>
            <Button size="sm" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} data-testid="button-save-edit">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <StatCard
            title="Users"
            value={`${tenant.userCount ?? 0} / ${tenant.maxUsers}`}
            icon={Users}
            subtitle="Active users vs limit"
          />
          <StatCard
            title="Projects"
            value={`${tenant.projectCount ?? 0} / ${tenant.maxProjects}`}
            icon={FolderKanban}
            subtitle="Active projects vs limit"
          />
          <StatCard
            title="Opportunities"
            value={tenant.opportunityCount ?? 0}
            icon={Target}
          />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Tenant Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <div>
                <span className="text-muted-foreground">Slug</span>
                <p className="font-medium" data-testid="text-tenant-slug">{tenant.slug}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tenant URL</span>
                <p className="font-medium font-mono text-xs" data-testid="text-tenant-url">
                  {window.location.origin}/t/{tenant.slug}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Billing Email</span>
                <p className="font-medium" data-testid="text-billing-email">{tenant.billingEmail || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Created</span>
                <p className="font-medium" data-testid="text-created-at">
                  {tenant.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function GlobalAdminPage() {
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("tenants");

  const { data: tenants, isLoading: tenantsLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/global-admin/tenants"],
  });

  const { data: stats } = useQuery<SystemStats>({
    queryKey: ["/api/global-admin/stats"],
  });

  if (selectedTenantId) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <TenantDetailView
          tenantId={selectedTenantId}
          onBack={() => setSelectedTenantId(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="global-admin-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Global Admin</h1>
          <p className="text-sm text-muted-foreground mt-1">System-wide tenant and usage management</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="tenants" data-testid="tab-tenants">
            <Building2 className="w-4 h-4 mr-1.5" /> Tenants
          </TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">
            <BarChart3 className="w-4 h-4 mr-1.5" /> System
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <CreateTenantDialog onCreated={() => {}} />
          </div>

          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm" data-testid="table-tenants">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Organization</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Plan</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Users</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Projects</th>
                  <th className="text-left p-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Opps</th>
                </tr>
              </thead>
              <tbody>
                {tenantsLoading ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Loading...</td></tr>
                ) : tenants?.length === 0 ? (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No tenants</td></tr>
                ) : (
                  tenants?.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                      onClick={() => setSelectedTenantId(t.id)}
                      data-testid={`row-tenant-${t.id}`}
                    >
                      <td className="p-3">
                        <div>
                          <span className="font-medium">{t.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">{t.slug}</span>
                        </div>
                      </td>
                      <td className="p-3">{planBadge(t.plan)}</td>
                      <td className="p-3">{statusBadge(t.status)}</td>
                      <td className="p-3 tabular-nums">{t.userCount ?? 0} / {t.maxUsers}</td>
                      <td className="p-3 tabular-nums">{t.projectCount ?? 0} / {t.maxProjects}</td>
                      <td className="p-3 tabular-nums">{t.opportunityCount ?? 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="system" className="space-y-4 mt-4">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <StatCard title="Total Tenants" value={stats?.totalTenants ?? 0} icon={Building2} />
            <StatCard title="Active Tenants" value={stats?.activeTenants ?? 0} icon={Building2} subtitle="Currently active" />
            <StatCard title="Total Users" value={stats?.totalUsers ?? 0} icon={Users} subtitle="Across all tenants" />
            <StatCard title="Total Projects" value={stats?.totalProjects ?? 0} icon={FolderKanban} />
            <StatCard title="Total Opportunities" value={stats?.totalOpportunities ?? 0} icon={Target} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
