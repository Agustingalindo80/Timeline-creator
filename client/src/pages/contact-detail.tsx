import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "wouter";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { ArrowLeft, User, Mail, Phone, Building2, Save, Shield, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Contact, Client, AppSettings } from "@shared/schema";
import { getDefaultFieldOptions } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAppTitle } from "@/hooks/use-app-title";

export default function ContactDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const { data: contact, isLoading } = useQuery<Contact>({
    queryKey: ["/api/contacts", params.id],
    queryFn: async () => {
      const res = await fetch(`/api/contacts/${params.id}`);
      if (!res.ok) throw new Error("Contact not found");
      return res.json();
    },
  });

  const { data: settings } = useQuery<AppSettings>({ queryKey: ["/api/settings"] });
  const { data: clientsList } = useQuery<Client[]>({ queryKey: ["/api/clients"] });

  const roleOptions = settings?.contactRoles || getDefaultFieldOptions("contactRoles", settings?.locale || "en");
  const stakeholderOptions = getDefaultFieldOptions("stakeholderTypes", settings?.locale || "en");

  const company = clientsList?.find((c) => c.id === contact?.clientId);
  const appTitle = useAppTitle(
    contact ? `${contact.firstName} ${contact.lastName}` : t("contacts.contactDetails"),
  );

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    role: "",
    stakeholderType: [] as string[],
    isLegalRepresentative: false,
  });

  const startEditing = () => {
    if (!contact) return;
    setForm({
      firstName: contact.firstName,
      lastName: contact.lastName,
      email: contact.email || "",
      phone: contact.phone || "",
      role: contact.role || "",
      stakeholderType: contact.stakeholderType || [],
      isLegalRepresentative: contact.isLegalRepresentative,
    });
    setEditing(true);
  };

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const res = await apiRequest("PATCH", `/api/contacts/${params.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", params.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: t("contacts.contactUpdated") });
      setEditing(false);
    },
    onError: () => toast({ title: t("contacts.failedToSave"), variant: "destructive" }),
  });

  const toggleStakeholder = (value: string) => {
    setForm((prev) => ({
      ...prev,
      stakeholderType: prev.stakeholderType.includes(value)
        ? prev.stakeholderType.filter((v) => v !== value)
        : [...prev.stakeholderType, value],
    }));
  };

  const saveForm = () => {
    updateMutation.mutate({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email || null,
      phone: form.phone || null,
      role: form.role || null,
      stakeholderType: form.stakeholderType,
      isLegalRepresentative: form.isLegalRepresentative,
    });
  };

  const stakeholderLabel = (value: string) =>
    stakeholderOptions.find((o) => o.value === value)?.label || value;
  const roleLabel = (value: string | null | undefined) =>
    value ? roleOptions.find((o) => o.value === value)?.label || value : null;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-6">
        <div className="text-center py-16">
          <h2 className="text-lg font-semibold mb-2">{t("contacts.notFound")}</h2>
          <Button variant="outline" onClick={() => navigate("/contacts")} data-testid="button-back-contacts">
            <ArrowLeft className="w-4 h-4 mr-2" /> {t("contacts.backToContacts")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Helmet>
        <title>{appTitle}</title>
      </Helmet>

      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/contacts")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold" data-testid="text-contact-name">
              {contact.firstName} {contact.lastName}
            </h1>
            {contact.isLegalRepresentative && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Shield className="w-3 h-3" /> {t("contacts.legalRep")}
              </Badge>
            )}
          </div>
        </div>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={startEditing} data-testid="button-edit-contact">
            {t("common.edit")}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} data-testid="button-cancel-edit">
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              onClick={saveForm}
              disabled={!form.firstName.trim() || !form.lastName.trim() || updateMutation.isPending}
              data-testid="button-save-contact"
            >
              <Save className="w-4 h-4 mr-1" />
              {updateMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <div>
            <Label>{t("common.firstName", "First Name")} *</Label>
            <Input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              data-testid="edit-contact-first-name"
            />
          </div>
          <div>
            <Label>{t("common.lastName", "Last Name")} *</Label>
            <Input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              data-testid="edit-contact-last-name"
            />
          </div>
          <div>
            <Label>{t("common.email")}</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              data-testid="edit-contact-email"
            />
          </div>
          <div>
            <Label>{t("common.phone")}</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              data-testid="edit-contact-phone"
            />
          </div>
          <div>
            <Label>{t("contacts.role")}</Label>
            <select
              className="h-9 text-sm border rounded px-2 bg-background w-full"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              data-testid="edit-contact-role"
            >
              <option value="">{t("contacts.selectRole")}</option>
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <Label>{t("contacts.stakeholderType")}</Label>
            <div className="flex flex-wrap gap-3 mt-2" data-testid="edit-contact-stakeholder-types">
              {stakeholderOptions.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                  data-testid={`stakeholder-option-${opt.value}`}
                >
                  <Checkbox
                    checked={form.stakeholderType.includes(opt.value)}
                    onCheckedChange={() => toggleStakeholder(opt.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-2 flex items-center gap-2">
            <Checkbox
              id="isLegalRep"
              checked={form.isLegalRepresentative}
              onCheckedChange={(checked) => setForm({ ...form, isLegalRepresentative: checked === true })}
              data-testid="checkbox-legal-rep"
            />
            <Label htmlFor="isLegalRep" className="cursor-pointer text-sm">
              {t("contacts.legalRep")}
            </Label>
          </div>
        </div>
      ) : (
        <div className="space-y-4 max-w-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InfoRow icon={Building2} label={t("contacts.company")}>
              {company ? (
                <Link
                  href={`/clients/${company.id}`}
                  className="text-primary hover:underline inline-flex items-center gap-1"
                  data-testid="link-contact-company"
                >
                  {company.name}
                  <ExternalLink className="w-3 h-3" />
                </Link>
              ) : (
                "—"
              )}
            </InfoRow>
            <InfoRow icon={User} label={t("contacts.role")}>{roleLabel(contact.role) || "—"}</InfoRow>
            <InfoRow icon={Mail} label={t("common.email")}>{contact.email || "—"}</InfoRow>
            <InfoRow icon={Phone} label={t("common.phone")}>{contact.phone || "—"}</InfoRow>
          </div>
          <div>
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
              {t("contacts.stakeholderType")}
            </p>
            {contact.stakeholderType && contact.stakeholderType.length > 0 ? (
              <div className="flex flex-wrap gap-1.5" data-testid="text-stakeholder-types">
                {contact.stakeholderType.map((s) => (
                  <Badge key={s} variant="secondary" className="text-[10px]" data-testid={`badge-stakeholder-${s}`}>
                    {stakeholderLabel(s)}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("contacts.noStakeholderType")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}
