import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Building2, Phone, Globe, MapPin, Save, FolderKanban, ExternalLink, Plus, Pencil, Trash2, Users, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ClientWithProjects, Task, Contact, AppSettings } from "@shared/schema";
import { DEFAULT_CONTACT_ROLES, DEFAULT_INDUSTRIES } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
  jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function dateToMonths(dateStr: string): number {
  const s = dateStr.trim().toLowerCase();
  const isoMatch = s.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (isoMatch) return parseInt(isoMatch[1]) * 12 + (parseInt(isoMatch[2]) - 1);
  const yearOnly = s.match(/^(\d{4})$/);
  if (yearOnly) return parseInt(yearOnly[1]) * 12;
  for (const [name, idx] of Object.entries(MONTHS)) {
    if (s.includes(name)) {
      const yearMatch = s.match(/(\d{4})/);
      const year = yearMatch ? parseInt(yearMatch[1]) : 2000;
      return year * 12 + idx;
    }
  }
  return 0;
}

function getWeightedCompletion(tasks: Task[]): number | null {
  if (tasks.length === 0) return null;
  let totalWeight = 0;
  let weightedSum = 0;
  for (const task of tasks) {
    const start = dateToMonths(task.startDate);
    const end = dateToMonths(task.endDate);
    const duration = Math.max(end - start, 1);
    totalWeight += duration;
    weightedSum += duration * (task.percentComplete ?? 0);
  }
  if (totalWeight === 0) return null;
  return Math.round(weightedSum / totalWeight);
}

const HEALTH_COLORS: Record<string, string> = {
  green: "#22c55e",
  amber: "#f59e0b",
  red: "#ef4444",
};

export default function ClientDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: client, isLoading } = useQuery<ClientWithProjects>({
    queryKey: ["/api/clients", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${params.id}`);
      if (!res.ok) throw new Error("Client not found");
      return res.json();
    },
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const roleOptions = settings?.contactRoles || DEFAULT_CONTACT_ROLES;
  const industryOptions = settings?.industries || DEFAULT_INDUSTRIES;

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    industry: "",
    contactPhone: "",
    website: "",
    address: "",
    notes: "",
    status: "active",
  });

  const startEditing = () => {
    if (!client) return;
    setForm({
      name: client.name,
      industry: client.industry || "",
      contactPhone: client.contactPhone || "",
      website: client.website || "",
      address: client.address || "",
      notes: client.notes || "",
      status: client.status,
    });
    setEditing(true);
  };

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/clients/${params.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "Client updated" });
      setEditing(false);
    },
    onError: () => {
      toast({ title: "Failed to update client", variant: "destructive" });
    },
  });

  const saveForm = () => {
    updateMutation.mutate({
      name: form.name.trim(),
      industry: form.industry || null,
      contactPhone: form.contactPhone || null,
      website: form.website || null,
      address: form.address || null,
      notes: form.notes || null,
      status: form.status,
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6">
        <div className="text-center py-16">
          <h2 className="text-lg font-semibold mb-2">Client not found</h2>
          <Button variant="outline" onClick={() => navigate("/clients")} data-testid="button-back-clients">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Clients
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Helmet>
        <title>{client.name} | Clients</title>
      </Helmet>

      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/clients")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold" data-testid="text-client-name">{client.name}</h1>
            <Badge
              variant={client.status === "active" ? "default" : "secondary"}
              className="text-[10px]"
            >
              {client.status === "active" ? "Active" : client.status}
            </Badge>
          </div>
        </div>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={startEditing} data-testid="button-edit-client">
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button size="sm" onClick={saveForm} disabled={!form.name.trim() || updateMutation.isPending} data-testid="button-save-client">
              <Save className="w-4 h-4 mr-1" />
              {updateMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="details" data-testid="client-tabs">
        <TabsList className="mb-4" data-testid="client-tabs-list">
          <TabsTrigger value="details" data-testid="tab-details">Details</TabsTrigger>
          <TabsTrigger value="contacts" data-testid="tab-contacts">
            Contacts ({client.contacts.length})
          </TabsTrigger>
          <TabsTrigger value="projects" data-testid="tab-projects">
            Projects ({client.projects.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          {editing ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
              <div>
                <Label>Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  data-testid="edit-client-name"
                />
              </div>
              <div>
                <Label>Industry</Label>
                <select
                  className="h-9 text-sm border rounded px-2 bg-background w-full"
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  data-testid="edit-client-industry"
                >
                  <option value="">Select industry...</option>
                  {industryOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={form.contactPhone}
                  onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  data-testid="edit-client-phone"
                />
              </div>
              <div>
                <Label>Website</Label>
                <Input
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://"
                  data-testid="edit-client-website"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Address</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  data-testid="edit-client-address"
                />
              </div>
              <div className="md:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  data-testid="edit-client-notes"
                />
              </div>
              <div>
                <Label>Status</Label>
                <select
                  className="h-9 text-sm border rounded px-2 bg-background w-full"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  data-testid="edit-client-status"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InfoRow icon={Building2} label="Industry" value={client.industry ? (industryOptions.find((o) => o.value === client.industry)?.label || client.industry) : null} />
                <InfoRow icon={Phone} label="Phone" value={client.contactPhone} />
                <InfoRow icon={Globe} label="Website" value={client.website} />
                <InfoRow icon={MapPin} label="Address" value={client.address} />
              </div>
              {client.notes && (
                <div className="pt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{client.notes}</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="contacts">
          <ContactsSection clientId={params.id!} contacts={client.contacts} roleOptions={roleOptions} />
        </TabsContent>

        <TabsContent value="projects">
          {client.projects.length === 0 ? (
            <div className="text-center py-12" data-testid="empty-projects">
              <FolderKanban className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-sm font-semibold mb-1">No projects yet</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Assign projects to this client from the Projects page.
              </p>
              <Button size="sm" variant="outline" onClick={() => navigate("/projects")} data-testid="button-go-projects">
                Go to Projects
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden" data-testid="client-projects-table">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left font-medium text-muted-foreground px-3 py-2">Project Name</th>
                    <th className="text-center font-medium text-muted-foreground px-3 py-2">Milestones</th>
                    <th className="text-center font-medium text-muted-foreground px-3 py-2">Tasks</th>
                    <th className="text-center font-medium text-muted-foreground px-3 py-2">Health</th>
                    <th className="text-center font-medium text-muted-foreground px-3 py-2">Progress</th>
                    <th className="text-center font-medium text-muted-foreground px-3 py-2 w-[60px]">Open</th>
                  </tr>
                </thead>
                <tbody>
                  {client.projects.map((project) => {
                    const pct = getWeightedCompletion(project.tasks);
                    return (
                      <tr
                        key={project.id}
                        className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                        data-testid={`row-project-${project.id}`}
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: project.color }}
                            />
                            <Link
                              href={`/timeline/${project.id}`}
                              className="font-medium text-xs hover:underline"
                              data-testid={`link-project-${project.id}`}
                            >
                              {project.title}
                            </Link>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground">
                          {project.milestones.length}
                        </td>
                        <td className="px-3 py-2 text-center text-muted-foreground">
                          {project.tasks.length}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {["healthOverall", "scopeHealth", "budgetHealth", "teamHealth"].map((field) => (
                              <div
                                key={field}
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: HEALTH_COLORS[(project as any)[field] || "green"] || "#22c55e" }}
                                title={field.replace("Health", "").replace("health", "")}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {pct !== null ? (
                            <div className="flex items-center gap-1.5 justify-center">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary min-w-[40px] max-w-[60px]">
                                <div className="h-full bg-primary transition-all rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-xs font-medium w-7 text-right">{pct}%</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-center block">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Link href={`/timeline/${project.id}`}>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              data-testid={`button-open-project-${project.id}`}
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ContactsSection({ clientId, contacts, roleOptions }: { clientId: string; contacts: Contact[]; roleOptions: { value: string; label: string }[] }) {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactForm, setContactForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "",
    isLegalRepresentative: false,
  });

  const resetForm = () => {
    setContactForm({ firstName: "", lastName: "", email: "", phone: "", role: "", isLegalRepresentative: false });
    setEditingContact(null);
  };

  const openCreate = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEdit = (contact: Contact) => {
    setEditingContact(contact);
    setContactForm({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email || "",
      phone: contact.phone || "",
      role: contact.role || "",
      isLegalRepresentative: contact.isLegalRepresentative,
    });
    setShowDialog(true);
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/clients/${clientId}/contacts`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      toast({ title: "Contact added" });
      setShowDialog(false);
      resetForm();
    },
    onError: () => toast({ title: "Failed to add contact", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/contacts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      toast({ title: "Contact updated" });
      setShowDialog(false);
      resetForm();
    },
    onError: () => toast({ title: "Failed to update contact", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      toast({ title: "Contact deleted" });
    },
    onError: () => toast({ title: "Failed to delete contact", variant: "destructive" }),
  });

  const handleSave = () => {
    const payload = {
      firstName: contactForm.firstName.trim(),
      lastName: contactForm.lastName.trim(),
      email: contactForm.email || null,
      phone: contactForm.phone || null,
      role: contactForm.role || null,
      isLegalRepresentative: contactForm.isLegalRepresentative,
    };
    if (editingContact) {
      updateMutation.mutate({ id: editingContact.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {contacts.length === 0 ? "No contacts yet" : `${contacts.length} contact${contacts.length !== 1 ? "s" : ""}`}
        </p>
        <Button size="sm" onClick={openCreate} data-testid="button-add-contact">
          <Plus className="w-4 h-4 mr-1" /> Add Contact
        </Button>
      </div>

      {contacts.length === 0 ? (
        <div className="text-center py-12" data-testid="empty-contacts">
          <Users className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-semibold mb-1">No contacts yet</h3>
          <p className="text-xs text-muted-foreground">Add contacts associated with this client.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden" data-testid="contacts-table">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left font-medium text-muted-foreground px-3 py-2">Name</th>
                <th className="text-left font-medium text-muted-foreground px-3 py-2">Role</th>
                <th className="text-left font-medium text-muted-foreground px-3 py-2">Email</th>
                <th className="text-left font-medium text-muted-foreground px-3 py-2">Phone</th>
                <th className="text-center font-medium text-muted-foreground px-3 py-2">Legal Rep</th>
                <th className="text-center font-medium text-muted-foreground px-3 py-2 w-[80px]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr
                  key={contact.id}
                  className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                  data-testid={`row-contact-${contact.id}`}
                >
                  <td className="px-3 py-2 font-medium">
                    {contact.firstName} {contact.lastName}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{contact.role ? (roleOptions.find((o) => o.value === contact.role)?.label || contact.role) : "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{contact.email || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{contact.phone || "—"}</td>
                  <td className="px-3 py-2 text-center">
                    {contact.isLegalRepresentative && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Shield className="w-3 h-3" /> Yes
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => openEdit(contact)}
                        data-testid={`button-edit-contact-${contact.id}`}
                      >
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(contact.id)}
                        data-testid={`button-delete-contact-${contact.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); resetForm(); } else setShowDialog(true); }}>
        <DialogContent data-testid="contact-dialog">
          <DialogHeader>
            <DialogTitle>{editingContact ? "Edit Contact" : "Add Contact"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First Name *</Label>
              <Input
                value={contactForm.firstName}
                onChange={(e) => setContactForm({ ...contactForm, firstName: e.target.value })}
                data-testid="input-contact-first-name"
              />
            </div>
            <div>
              <Label>Last Name *</Label>
              <Input
                value={contactForm.lastName}
                onChange={(e) => setContactForm({ ...contactForm, lastName: e.target.value })}
                data-testid="input-contact-last-name"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                data-testid="input-contact-email"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                data-testid="input-contact-phone"
              />
            </div>
            <div className="col-span-2">
              <Label>Role</Label>
              <select
                className="h-9 text-sm border rounded px-2 bg-background w-full"
                value={contactForm.role}
                onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })}
                data-testid="select-contact-role"
              >
                <option value="">Select role...</option>
                {roleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Checkbox
                id="isLegalRep"
                checked={contactForm.isLegalRepresentative}
                onCheckedChange={(checked) => setContactForm({ ...contactForm, isLegalRepresentative: checked === true })}
                data-testid="checkbox-legal-rep"
              />
              <Label htmlFor="isLegalRep" className="cursor-pointer text-sm">
                Legal Representative (authorized to sign SOWs)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowDialog(false); resetForm(); }} data-testid="button-cancel-contact">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!contactForm.firstName.trim() || !contactForm.lastName.trim() || isPending}
              data-testid="button-save-contact"
            >
              {isPending ? "Saving..." : editingContact ? "Save Changes" : "Add Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm" data-testid={`text-${label.toLowerCase()}`}>{value || "—"}</p>
      </div>
    </div>
  );
}
