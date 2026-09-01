import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmailInput } from "@/components/ui/email-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { CompanyPicker, type CompanyPickerValue } from "@/components/ui/company-picker";
import { SourceCombobox } from "@/components/leads/source-combobox";
import { QuickCreateCompanyDialog } from "@/components/record/quick-create-dialogs";
import {
  LeadContactSearchStep,
  type ContactSearchResult,
} from "@/components/leads/lead-contact-search-step";
import { ensureLeadSource } from "@/lib/lead-sources";
import { ensureLeadRelationsSafe } from "@/lib/leads/lead-relations";
import { checkLeadDuplicate } from "@/lib/leads/lead-duplicate-check";
import { normalizeLinkedinUrl } from "@/lib/prospecting/linkedin-url";
import { isEmail, toE164 } from "@/lib/validators";
import { useToastCreated } from "@/lib/toast-nav";
import { OnboardingGuidedEntry } from "@/components/onboarding/onboarding-guided-entry";

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  linkedin_url: "",
  email: "",
  phone: "",
  company_name: "",
  source: "",
};

export function CreateLeadDialog({
  open,
  onOpenChange,
  onCreated,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
  onSaved?: (r: { id: string; action: "created" }) => void;
}) {
  const { user } = useAuth();
  const toastCreated = useToastCreated();
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"search" | "form">("search");
  const [form, setForm] = useState(EMPTY_FORM);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
  const [dupError, setDupError] = useState<{ field: "email" | "phone"; message: string } | null>(
    null,
  );
  const [company, setCompany] = useState<CompanyPickerValue>({ id: null, name: "" });
  /** Domínio da empresa vinculada: null = sem domínio, undefined = desconhecido. */
  const [companyDomain, setCompanyDomain] = useState<string | null | undefined>(undefined);
  const [domainInput, setDomainInput] = useState("");
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const [pendingCompanyName, setPendingCompanyName] = useState("");

  const reset = () => {
    setForm(EMPTY_FORM);
    setLinkedinError(null);
    setDupError(null);
    setCompanyDomain(undefined);
    setDomainInput("");
    setCompany({ id: null, name: "" });
    setStep("search");
  };

  const closeDialog = () => {
    reset();
    onOpenChange(false);
  };

  /** Carrega o domínio da empresa vinculada (sinal de enriquecimento). */
  const loadCompanyDomain = async (companyId: string) => {
    const { data, error } = await supabase
      .from("companies")
      .select("id, domain, website")
      .eq("id", companyId)
      .maybeSingle();
    if (error || !data) {
      setCompanyDomain(undefined);
      return;
    }
    const existing =
      (data.domain as string | null)?.trim() || (data.website as string | null)?.trim() || null;
    setCompanyDomain(existing);
    if (existing) setDomainInput("");
  };

  const handleCompanyChange = (v: CompanyPickerValue) => {
    setCompany(v);
    if (v.id) {
      void loadCompanyDomain(v.id);
    } else {
      setCompanyDomain(undefined);
      setDomainInput("");
    }
  };

  /** Resolve a empresa a partir do nome quando o contato não tem company_id. */
  const resolveCompanyByName = async (name: string) => {
    const term = name.trim();
    if (!term) return;
    const { data } = await supabase
      .from("companies")
      .select("id, name")
      .ilike("name", term)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (data?.id) {
      handleCompanyChange({ id: data.id as string, name: (data.name as string) ?? term });
    } else {
      setCompany({ id: null, name: term });
    }
  };

  const applyContact = (contact: ContactSearchResult) => {
    setForm({
      ...EMPTY_FORM,
      first_name: contact.first_name ?? "",
      last_name: contact.last_name ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      company_name: contact.companies?.name ?? contact.company_name ?? "",
    });
    if (contact.companies?.id) {
      handleCompanyChange({ id: contact.companies.id, name: contact.companies.name });
    } else if (contact.company_name) {
      void resolveCompanyByName(contact.company_name);
    } else {
      setCompany({ id: null, name: "" });
    }
    setDupError(null);
    setStep("form");
  };

  const startBlank = (initialQuery: string) => {
    const q = initialQuery.trim();
    setForm({ ...EMPTY_FORM, email: isEmail(q) ? q : "" });
    setCompany({ id: null, name: "" });
    setDupError(null);
    setStep("form");
  };

  /** Checa duplicidade de lead ao sair do campo de e-mail/telefone. */
  const checkDuplicateField = async (field: "email" | "phone") => {
    const email = field === "email" ? form.email.trim() : "";
    const phone = field === "phone" ? form.phone.trim() : "";
    if (field === "email" && (!email || !isEmail(email))) return;
    if (field === "phone" && !phone) return;
    try {
      const dup = await checkLeadDuplicate(supabase, {
        email: email || null,
        phone: phone || null,
      });
      if (dup.duplicate && dup.field) {
        setDupError({ field: dup.field, message: dup.message ?? "Lead duplicado" });
      } else if (dupError?.field === field) {
        setDupError(null);
      }
    } catch {
      // silencioso: a checagem final antes do insert cobre este caso
    }
  };

  const companyPending = !!company.name.trim() && !company.id;

  const submit = async () => {
    if (!user) return;
    if (!form.first_name.trim()) {
      toast.error("Informe ao menos o nome");
      return;
    }
    if (form.email && !isEmail(form.email)) {
      toast.error("Email inválido");
      return;
    }
    let linkedinUrl: string | null = null;
    if (form.linkedin_url.trim()) {
      const parsed = normalizeLinkedinUrl(form.linkedin_url);
      if (!parsed.ok) {
        setLinkedinError(parsed.error);
        toast.error(parsed.error);
        return;
      }
      linkedinUrl = parsed.url;
      setLinkedinError(null);
    }
    const phoneE164 = form.phone.trim() ? toE164(form.phone.trim()) : null;
    if (form.phone.trim() && !phoneE164) {
      toast.error("Telefone inválido. Use o formato E.164 (ex.: +5511999998888).");
      return;
    }
    setSaving(true);
    try {
      const dup = await checkLeadDuplicate(supabase, {
        email: form.email.trim() || null,
        phone: phoneE164,
      });
      if (dup.duplicate) {
        if (dup.field) setDupError({ field: dup.field, message: dup.message ?? "Lead duplicado" });
        toast.error(dup.message ?? "Lead duplicado");
        setSaving(false);
        return;
      }
      const { data, error } = await supabase
        .from("leads")
        .insert({
          owner_id: user.id,
          status: "new",
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim() || null,
          linkedin_url: linkedinUrl,
          email: form.email.trim() || null,
          phone: phoneE164,
          company_id: company.id ?? null,
          company_name: company.name.trim() || null,
          source: form.source.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      // Completa o domínio da empresa vinculada (só quando ainda estiver vazio)
      const domainToSave = domainInput.trim();
      if (company.id && !companyDomain && domainToSave) {
        const normalized = domainToSave
          .replace(/^https?:\/\//i, "")
          .replace(/^www\./i, "")
          .replace(/\/.*$/, "")
          .trim()
          .toLowerCase();
        if (normalized) {
          await supabase
            .from("companies")
            .update({ domain: normalized })
            .eq("id", company.id)
            .is("domain", null);
        }
      }
      // Garante empresa e contato vinculados ao lead recém-criado
      await ensureLeadRelationsSafe(supabase, data!.id);
      // Persiste fonte nova no catálogo
      if (form.source.trim()) {
        await ensureLeadSource(user.id, form.source.trim());
      }
      toastCreated("Lead criado", "Ir para o lead", (nav) =>
        nav({ to: "/leads/$id", params: { id: data!.id } }),
      );
      reset();
      onOpenChange(false);
      onCreated?.(data!.id);
      onSaved?.({ id: data!.id, action: "created" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar lead");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (saving) return;
          if (!v) reset();
          onOpenChange(v);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar lead</DialogTitle>
            <DialogDescription>
              {step === "search"
                ? "Busque um contato existente para reaproveitar os dados ou crie do zero."
                : "Preencha as informações básicas. Você poderá editar tudo depois."}
            </DialogDescription>
          </DialogHeader>

          {step === "search" ? (
            <LeadContactSearchStep
              onPickContact={applyContact}
              onStartBlank={startBlank}
              onCancel={closeDialog}
            />
          ) : (
            <>
              <div className="grid gap-3 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="first_name">Nome *</Label>
                    <Input
                      id="first_name"
                      value={form.first_name}
                      onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last_name">Sobrenome</Label>
                    <Input
                      id="last_name"
                      value={form.last_name}
                      onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="linkedin_url">LinkedIn</Label>
                  <Input
                    id="linkedin_url"
                    value={form.linkedin_url}
                    placeholder="https://www.linkedin.com/in/nome-sobrenome"
                    aria-invalid={linkedinError ? true : undefined}
                    aria-describedby="linkedin_url-hint"
                    onChange={(e) => {
                      setLinkedinError(null);
                      setForm({ ...form, linkedin_url: e.target.value });
                    }}
                  />
                  <p id="linkedin_url-hint" className="text-[11px] text-muted-foreground">
                    {linkedinError ??
                      "Opcional. Melhora a precisão do enriquecimento na qualificação."}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <EmailInput
                    id="email"
                    value={form.email}
                    aria-invalid={dupError?.field === "email" ? true : undefined}
                    aria-describedby={dupError?.field === "email" ? "email-error" : undefined}
                    onChange={(v) => {
                      if (dupError?.field === "email") setDupError(null);
                      setForm({ ...form, email: v });
                    }}
                    onBlur={() => void checkDuplicateField("email")}
                  />
                  {dupError?.field === "email" && (
                    <p id="email-error" role="alert" className="text-[11px] text-destructive">
                      {dupError.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5" onBlur={() => void checkDuplicateField("phone")}>
                  <Label htmlFor="phone">Telefone</Label>
                  <PhoneInput
                    id="phone"
                    value={form.phone}
                    aria-invalid={dupError?.field === "phone" ? true : undefined}
                    aria-describedby={dupError?.field === "phone" ? "phone-error" : undefined}
                    onChange={(v) => {
                      if (dupError?.field === "phone") setDupError(null);
                      setForm({ ...form, phone: v });
                    }}
                  />

                  {dupError?.field === "phone" && (
                    <p id="phone-error" role="alert" className="text-[11px] text-destructive">
                      {dupError.message}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company_name">Empresa</Label>
                  <CompanyPicker
                    id="company_name"
                    value={company}
                    onChange={handleCompanyChange}
                    toastOnMatches
                    onCreateNew={(name) => {
                      setPendingCompanyName(name);
                      setCreateCompanyOpen(true);
                    }}
                  />
                  {companyPending && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-500">
                      Selecione “{company.name.trim()}” na lista ou crie a empresa para continuar.
                    </p>
                  )}
                </div>

                {company.id && companyDomain === null && (
                  <div className="space-y-1.5">
                    <Label htmlFor="company_domain">Site da empresa</Label>
                    <Input
                      id="company_domain"
                      value={domainInput}
                      placeholder="empresa.com.br"
                      aria-describedby="company_domain-hint"
                      onChange={(e) => setDomainInput(e.target.value)}
                    />
                    <p id="company_domain-hint" className="text-[11px] text-muted-foreground">
                      Esta empresa ainda não tem domínio. Informar o site permite enriquecer os
                      dados da empresa.
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Fonte</Label>
                  <SourceCombobox
                    value={form.source}
                    onChange={(v) => setForm({ ...form, source: v })}
                  />
                </div>
                <OnboardingGuidedEntry entity="lead" onNavigate={() => onOpenChange(false)} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep("search")} disabled={saving}>
                  Voltar
                </Button>
                <Button
                  onClick={submit}
                  disabled={saving || !form.first_name.trim() || companyPending || !!dupError}
                >
                  {saving ? "Criando…" : "Criar lead"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <QuickCreateCompanyDialog
        open={createCompanyOpen}
        onOpenChange={setCreateCompanyOpen}
        initialName={pendingCompanyName}
        onCreated={(id) => {
          handleCompanyChange({ id, name: pendingCompanyName });
          setForm((f) => ({ ...f, company_name: pendingCompanyName }));
        }}
      />
    </>
  );
}
