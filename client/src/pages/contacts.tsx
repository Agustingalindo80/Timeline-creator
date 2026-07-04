import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { Search, Save, ArrowUpDown, ArrowUp, ArrowDown, X, Filter, Trash2, Users, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
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
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Contact, Client, AppSettings } from "@shared/schema";
import { getDefaultFieldOptions } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAppTitle } from "@/hooks/use-app-title";

interface RowEdits {
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  isLegalRepresentative?: boolean;
}

type SortField = "name" | "client" | "role" | "email" | "phone" | "legalRep";
type SortDir = "asc" | "desc";

interface ColumnFilters {
  clientId?: string;
  role?: string;
  stakeholderType?: string;
  legalRep?: string;
}

export default function ContactsList() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const appTitle = useAppTitle(t("contacts.title"));
  const [searchQuery, setSearchQuery] = useState("");
  const [edits, setEdits] = useState<Record<string, RowEdits>>({});
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const { data: contacts, isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: settings } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const { data: clientsList } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const contactRoleOptions = settings?.contactRoles || getDefaultFieldOptions("contactRoles", settings?.locale || "en");
  const stakeholderTypeOptions = getDefaultFieldOptions("stakeholderTypes", settings?.locale || "en");
  const stakeholderLabel = (value: string) => stakeholderTypeOptions.find((o) => o.value === value)?.label || value;

  const getClientName = useCallback((clientId: string | null | undefined): string => {
    if (!clientId || !clientsList) return "";
    const c = clientsList.find((cl) => cl.id === clientId);
    return c ? c.name : "";
  }, [clientsList]);

  const activeFilterCount = Object.values(columnFilters).filter(Boolean).length;

  const processedContacts = useMemo(() => {
    if (!contacts) return [];

    let result = contacts.filter((ct) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = `${ct.firstName} ${ct.lastName}`.toLowerCase();
        const clientName = getClientName(ct.clientId).toLowerCase();
        const email = (ct.email || "").toLowerCase();
        if (!fullName.includes(q) && !clientName.includes(q) && !email.includes(q)) return false;
      }

      if (columnFilters.clientId && ct.clientId !== columnFilters.clientId) return false;
      if (columnFilters.role && (ct.role || "") !== columnFilters.role) return false;
      if (columnFilters.stakeholderType && !(ct.stakeholderType || []).includes(columnFilters.stakeholderType)) return false;
      if (columnFilters.legalRep) {
        const isLegal = ct.isLegalRepresentative ? "yes" : "no";
        if (isLegal !== columnFilters.legalRep) return false;
      }

      return true;
    });

    if (sortField) {
      result = [...result].sort((a, b) => {
        let aVal: string | number = "";
        let bVal: string | number = "";

        switch (sortField) {
          case "name":
            aVal = `${a.firstName} ${a.lastName}`.toLowerCase();
            bVal = `${b.firstName} ${b.lastName}`.toLowerCase();
            break;
          case "client":
            aVal = getClientName(a.clientId).toLowerCase();
            bVal = getClientName(b.clientId).toLowerCase();
            break;
          case "role": {
            const aLabel = a.role ? (contactRoleOptions.find((o) => o.value === a.role)?.label || a.role) : "";
            const bLabel = b.role ? (contactRoleOptions.find((o) => o.value === b.role)?.label || b.role) : "";
            aVal = aLabel.toLowerCase();
            bVal = bLabel.toLowerCase();
            break;
          }
          case "email":
            aVal = (a.email || "").toLowerCase();
            bVal = (b.email || "").toLowerCase();
            break;
          case "phone":
            aVal = (a.phone || "").toLowerCase();
            bVal = (b.phone || "").toLowerCase();
            break;
          case "legalRep":
            aVal = a.isLegalRepresentative ? 1 : 0;
            bVal = b.isLegalRepresentative ? 1 : 0;
            break;
        }

        if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [contacts, searchQuery, columnFilters, sortField, sortDir, getClientName, contactRoleOptions]);

  const getOriginal = useCallback((contact: Contact, field: keyof RowEdits): string | boolean => {
    if (field === "isLegalRepresentative") return contact.isLegalRepresentative;
    const raw = (contact as any)[field];
    return raw != null ? String(raw) : "";
  }, []);

  const updateField = useCallback((id: string, field: keyof RowEdits, value: string | boolean | null, contact: Contact) => {
    const original = getOriginal(contact, field);
    const newVal = value;
    setEdits((prev) => {
      const existing = { ...prev[id] };
      const isEqual = field === "isLegalRepresentative"
        ? newVal === original
        : (newVal ?? "") === (original as string);
      if (isEqual) {
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

  const getVal = useCallback((contact: Contact, field: keyof RowEdits): string | boolean => {
    const edit = edits[contact.id];
    if (edit && field in edit) {
      if (field === "isLegalRepresentative") return (edit[field] as boolean) ?? false;
      return (edit[field] as string) ?? "";
    }
    return getOriginal(contact, field);
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
        if (key === "isLegalRepresentative") {
          payload[key] = val;
        } else {
          payload[key] = val && val !== "" ? val : null;
        }
      }
      await apiRequest("PATCH", `/api/contacts/${id}`, payload);
      setEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: t("contacts.contactUpdated") });
    } catch {
      toast({ title: t("contacts.failedToSave"), variant: "destructive" });
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

  const deleteContact = useCallback(async (id: string) => {
    try {
      await apiRequest("DELETE", `/api/contacts/${id}`);
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: t("contacts.contactDeleted") });
    } catch {
      toast({ title: t("contacts.failedToDelete"), variant: "destructive" });
    }
  }, [toast]);

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

  const selectClass = "h-7 text-xs border rounded px-1.5 py-0 bg-background w-full appearance-none cursor-pointer";
  const inputClass = "h-7 text-xs border rounded px-1.5 py-0 bg-background w-full";
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

  return (
    <div className="p-6">
      <Helmet>
        <title>{appTitle}</title>
        <meta name="description" content="Manage your contacts across all clients." />
      </Helmet>

      <div className="flex items-center justify-between gap-2 mb-4">
        <h1 className="text-xl font-semibold" data-testid="text-page-title">{t("contacts.title")}</h1>
        <div className="flex items-center gap-2">
          {hasAnyEdits && (
            <Button onClick={saveAll} size="sm" disabled={isSaving} data-testid="button-save-all">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? t("common.saving") : t("common.saveAllChanges")}
            </Button>
          )}
        </div>
      </div>

      {contacts && contacts.length > 0 && (
        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("contacts.searchPlaceholder")}
              className="pl-9 h-8 text-sm"
              data-testid="input-search-contacts"
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
            {t("common.filters")}
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
              {t("common.clearAll")}
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
      ) : !contacts || contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mb-5">
            <Users className="w-7 h-7 text-muted-foreground/70" />
          </div>
          <h2 className="text-lg font-semibold mb-1.5" data-testid="text-empty-title">{t("contacts.noContactsYet")}</h2>
          <p className="text-sm text-muted-foreground mb-5 max-w-sm" data-testid="text-empty-description">
            {t("contacts.noContactsDescription")}
          </p>
        </div>
      ) : processedContacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="empty-search-results">
          <Search className="w-8 h-8 text-muted-foreground/60 mb-3" />
          <h2 className="text-base font-semibold mb-1">{t("contacts.noMatchingContacts")}</h2>
          <p className="text-xs text-muted-foreground mb-3">
            {t("contacts.noMatchingDescription")}
          </p>
          <Button variant="outline" size="sm" onClick={clearAllFilters} data-testid="button-clear-filters-empty">
            {t("common.clearAllFilters")}
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden" data-testid="table-contacts">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <SortHeader field="name" label={t("common.name")} />
                  <SortHeader field="client" label={t("common.client")} />
                  <SortHeader field="role" label={t("common.role")} />
                  <SortHeader field="email" label={t("common.email")} />
                  <SortHeader field="phone" label={t("common.phone")} />
                  <th className="text-left font-medium text-muted-foreground px-3 py-2 whitespace-nowrap">{t("contacts.stakeholderType")}</th>
                  <SortHeader field="legalRep" label={t("contacts.legalRep")} align="center" />
                  <th className="text-center font-medium text-muted-foreground px-3 py-2 whitespace-nowrap w-[80px]">{t("common.actions")}</th>
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
                        <option value="">{t("common.all")}</option>
                        {(clientsList || []).map((cl) => (
                          <option key={cl.id} value={cl.id}>{cl.name}</option>
                        ))}
                      </select>
                    </th>
                    <th className="px-3 py-1.5">
                      <select
                        className={filterSelectClass}
                        value={columnFilters.role || ""}
                        onChange={(e) => setFilter("role", e.target.value)}
                        data-testid="filter-role"
                      >
                        <option value="">{t("common.all")}</option>
                        {contactRoleOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </th>
                    <th className="px-3 py-1.5" />
                    <th className="px-3 py-1.5" />
                    <th className="px-3 py-1.5">
                      <select
                        className={filterSelectClass}
                        value={columnFilters.stakeholderType || ""}
                        onChange={(e) => setFilter("stakeholderType", e.target.value)}
                        data-testid="filter-stakeholderType"
                      >
                        <option value="">{t("common.all")}</option>
                        {stakeholderTypeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </th>
                    <th className="px-3 py-1.5">
                      <select
                        className={filterSelectClass}
                        value={columnFilters.legalRep || ""}
                        onChange={(e) => setFilter("legalRep", e.target.value)}
                        data-testid="filter-legalRep"
                      >
                        <option value="">{t("common.all")}</option>
                        <option value="yes">{t("common.yes")}</option>
                        <option value="no">{t("common.no")}</option>
                      </select>
                    </th>
                    <th className="px-3 py-1.5" />
                  </tr>
                )}
              </thead>
              <tbody>
                {processedContacts.map((contact) => {
                  const dirty = hasEdits(contact.id);
                  const saving = savingIds.has(contact.id);
                  return (
                    <tr
                      key={contact.id}
                      className={`border-b last:border-b-0 table-row-hover ${dirty ? "bg-yellow-50 dark:bg-yellow-950" : ""}`}
                      data-testid={`row-contact-${contact.id}`}
                    >
                      <td className="px-3 py-1.5">
                        <Link
                          href={`/contacts/${contact.id}`}
                          className="text-primary hover:underline inline-flex items-center gap-1"
                          data-testid={`link-contact-${contact.id}`}
                        >
                          {contact.firstName} {contact.lastName}
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground" data-testid={`text-client-name-${contact.id}`}>
                        {getClientName(contact.clientId)}
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          className={selectClass}
                          value={getVal(contact, "role") as string}
                          onChange={(e) => updateField(contact.id, "role", e.target.value || null, contact)}
                          data-testid={`select-role-${contact.id}`}
                        >
                          <option value="">—</option>
                          {contactRoleOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          className={inputClass}
                          value={getVal(contact, "email") as string}
                          onChange={(e) => updateField(contact.id, "email", e.target.value || null, contact)}
                          placeholder={t("common.email")}
                          data-testid={`input-email-${contact.id}`}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          className={inputClass}
                          value={getVal(contact, "phone") as string}
                          onChange={(e) => updateField(contact.id, "phone", e.target.value || null, contact)}
                          placeholder={t("common.phone")}
                          data-testid={`input-phone-${contact.id}`}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        {contact.stakeholderType && contact.stakeholderType.length > 0 ? (
                          <div className="flex flex-wrap gap-1" data-testid={`text-stakeholder-${contact.id}`}>
                            {contact.stakeholderType.map((s) => (
                              <Badge key={s} variant="secondary" className="text-[10px]">
                                {stakeholderLabel(s)}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <div className="flex justify-center">
                          <Checkbox
                            checked={getVal(contact, "isLegalRepresentative") as boolean}
                            onCheckedChange={(checked) => updateField(contact.id, "isLegalRepresentative", !!checked, contact)}
                            data-testid={`checkbox-legal-rep-${contact.id}`}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-center gap-1">
                          {dirty && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => saveRow(contact.id)}
                              disabled={saving}
                              data-testid={`button-save-row-${contact.id}`}
                            >
                              <Save className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                data-testid={`button-delete-contact-${contact.id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t("contacts.deleteContact")}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t("contacts.deleteDescription", { name: `${contact.firstName} ${contact.lastName}` })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel data-testid="button-cancel-delete">{t("common.cancel")}</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteContact(contact.id)}
                                  data-testid="button-confirm-delete"
                                >
                                  {t("common.delete")}
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
