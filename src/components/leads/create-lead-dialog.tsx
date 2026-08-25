import { useEffect, useRef, useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmailInput } from "@/components/ui/email-input";
import { PhoneInput } from "@/components/ui/phone-input";
import { CompanyPicker, type CompanyPickerValue } from "@/components/ui/company-picker";
import { SourceCombobox } from "@/components/leads/source-combobox";
import { QuickCreateCompanyDialog } from "@/components/record/quick-create-dialogs";
import { ensureLeadSource } from "@/lib/lead-sources";
import { ensureLeadRelationsSafe } from "@/lib/leads/lead-relations";
import { isEmail, toE164 } from "@/lib/validators";
import { useToastCreated } from "@/lib/toast-nav";
import { OnboardingGuidedEntry } from "@/components/onboarding/onboarding-guided-entry";

type ContactMatch = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company_id: string | null;
  company_name: string | null;
  companies: { id: string; name: string } | null;
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
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company_name: "",
    source: "",
  });
  const [company, setCompany] = useState<CompanyPickerValue>({ id: null, name: "" });
  const [matchedContact, setMatchedContact] = useState<ContactMatch | null>(null);
  const [showReuse, setShowReuse] = useState(false);
  const [createCompanyOpen, setCreateCompanyOpen] = useState(false);
  const [pendingCompanyName, setPendingCompanyName] = useState("");
  const lastCheckedEmail = useRef<string>("");

  const reset = () => {
    setForm({ first_name: "", last_name: "", email: "", phone: "", company_name: "", source: "" });
    setCompany({ id: null, name: "" });
    setMatchedContact(null);
    setShowReuse(false);
    lastCheckedEmail.current = "";
  };

  // Busca contato existente pelo email (debounced)
  useEffect(() => {
    if (!user) return;
    const email = form.email.trim().toLowerCase();
    if (!email || !isEmail(email)) return;
    if (email === lastCheckedEmail.current) return;

    const timer = setTimeout(async () => {
      lastCheckedEmail.current = email;
      const { data, error } = await supabase
        .from("contacts")
        .select(
          "id, first_name, last_name, email, phone, company_id, company_name, companies(id, name)",
        )
        .ilike("email", email)
        .limit(1)
        .maybeSingle();
      if (error || !data) return;
      setMatchedContact(data as unknown as ContactMatch);
      setShowReuse(true);
    }, 500);

    return () => clearTimeout(timer);
  }, [form.email, user]);

  const applyContact = () => {
    if (!matchedContact) return;
    setForm((f) => ({
      ...f,
      first_name: matchedContact.first_name ?? f.first_name,
      last_name: matchedContact.last_name ?? f.last_name,
      email: matchedContact.email ?? f.email,
      phone: matchedContact.phone ?? f.phone,
      company_name: matchedContact.companies?.name ?? matchedContact.company_name ?? f.company_name,
    }));
    if (matchedContact.companies?.id) {
      setCompany({ id: matchedContact.companies.id, name: matchedContact.companies.name });
    } else if (matchedContact.company_name) {
      setCompany({ id: null, name: matchedContact.company_name });
    }
    setShowReuse(false);
    toast.success("Dados do contato aplicados");
  };

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
    const phoneE164 = form.phone.trim() ? toE164(form.phone.trim()) : null;
    if (form.phone.trim() && !phoneE164) {
      toast.error("Telefone inválido. Use o formato E.164 (ex.: +5511999998888).");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .insert({
          owner_id: user.id,
          status: "new",
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim() || null,
          email: form.email.trim() || null,
          phone: phoneE164,
          company_id: company.id ?? null,
          company_name: company.name.trim() || null,
          source: form.source.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
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
          if (!saving) onOpenChange(v);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar lead</DialogTitle>
            <DialogDescription>
              Preencha as informações básicas. Você poderá editar tudo depois.
            </DialogDescription>
          </DialogHeader>
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
              <Label htmlFor="email">Email</Label>
              <EmailInput
                id="email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone</Label>
              <PhoneInput
                id="phone"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company_name">Empresa</Label>
              <CompanyPicker
                id="company_name"
                value={company}
                onChange={setCompany}
                toastOnMatches
                onCreateNew={(name) => {
                  setPendingCompanyName(name);
                  setCreateCompanyOpen(true);
                }}
              />
            </div>

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
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={saving || !form.first_name.trim() || (!!company.name.trim() && !company.id)}
              title={
                !!company.name.trim() && !company.id
                  ? "Selecione a empresa na lista para continuar"
                  : undefined
              }
            >
              {saving ? "Criando…" : "Criar lead"}
            </Button>
          </DialogFooter>
        </DialogContent>

        <AlertDialog open={showReuse} onOpenChange={setShowReuse}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Contato existente encontrado</AlertDialogTitle>
              <AlertDialogDescription>
                Encontramos um contato com o e-mail <strong>{matchedContact?.email}</strong>
                {matchedContact?.first_name || matchedContact?.last_name ? (
                  <>
                    {" "}
                    (
                    <strong>
                      {[matchedContact?.first_name, matchedContact?.last_name]
                        .filter(Boolean)
                        .join(" ")}
                    </strong>
                    {matchedContact?.companies?.name || matchedContact?.company_name
                      ? ` — ${matchedContact?.companies?.name ?? matchedContact?.company_name}`
                      : ""}
                    )
                  </>
                ) : null}
                . Deseja reaproveitar os dados desse contato neste novo lead?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Não, manter o que digitei</AlertDialogCancel>
              <AlertDialogAction onClick={applyContact}>Sim, reaproveitar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Dialog>

      <QuickCreateCompanyDialog
        open={createCompanyOpen}
        onOpenChange={setCreateCompanyOpen}
        initialName={pendingCompanyName}
        onCreated={(id) => {
          setCompany({ id, name: pendingCompanyName });
          setForm((f) => ({ ...f, company_name: pendingCompanyName }));
        }}
      />
    </>
  );
}
