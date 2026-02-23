import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Helmet } from "react-helmet-async";
import { Plus, Search, Building2, Trash2, ExternalLink, Mail, Phone, Globe } from "lucide-react";
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

export default function Clients() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");

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

  const filtered = clients?.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) ||
      (c.industry || "").toLowerCase().includes(q) ||
      (c.contactName || "").toLowerCase().includes(q);
  });

  return (
    <div className="p-6">
      <Helmet>
        <title>Clients | Project High Level Planning</title>
      </Helmet>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold" data-testid="text-page-title">Clients</h1>
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

      {clients && clients.length > 0 && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clients..."
            className="pl-9 h-8 text-sm"
            data-testid="input-search-clients"
          />
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
      ) : !filtered || filtered.length === 0 ? (
        !clients || clients.length === 0 ? (
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
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-search-results">
            <Search className="w-10 h-10 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-1">No matching clients</h2>
            <p className="text-sm text-muted-foreground">
              No clients match "{searchQuery}".
            </p>
          </div>
        )
      ) : (
        <div className="border rounded-lg overflow-hidden" data-testid="table-clients">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="text-left font-medium text-muted-foreground px-3 py-2 whitespace-nowrap min-w-[180px]">Name</th>
                  <th className="text-left font-medium text-muted-foreground px-3 py-2 whitespace-nowrap min-w-[130px]">Industry</th>
                  <th className="text-left font-medium text-muted-foreground px-3 py-2 whitespace-nowrap min-w-[140px]">Contact</th>
                  <th className="text-left font-medium text-muted-foreground px-3 py-2 whitespace-nowrap min-w-[180px]">Email</th>
                  <th className="text-center font-medium text-muted-foreground px-3 py-2 whitespace-nowrap">Status</th>
                  <th className="text-center font-medium text-muted-foreground px-3 py-2 whitespace-nowrap w-[80px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((client) => (
                  <tr
                    key={client.id}
                    className="border-b last:border-b-0 hover:bg-muted/30 transition-colors"
                    data-testid={`row-client-${client.id}`}
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/clients/${client.id}`}
                        className="font-medium text-xs hover:underline"
                        data-testid={`link-client-${client.id}`}
                      >
                        {client.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {client.industry || "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {client.contactName || "—"}
                    </td>
                    <td className="px-3 py-2">
                      {client.contactEmail ? (
                        <span className="text-muted-foreground">{client.contactEmail}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Badge
                        variant={client.status === "active" ? "default" : "secondary"}
                        className="text-[10px] px-1.5 py-0"
                        data-testid={`badge-status-${client.id}`}
                      >
                        {client.status === "active" ? "Active" : client.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <Link href={`/clients/${client.id}`}>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
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
                              className="h-6 w-6"
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
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
