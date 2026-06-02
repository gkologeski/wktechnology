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
import { isEmail, toE164 } from "@/lib/validators";

export function CreateContactDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    job_title: "",
  });
  const [company, setCompany] = useState<CompanyPickerValue>({ id: null, name: "" });

  const reset = () => {
    setForm({ first_name: "", last_name: "", email: "", phone: "", job_title: "" });
    setCompany({ id: null, name: "" });
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
        .from("contacts")
        .insert({
          owner_id: user.id,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim() || null,
          email: form.email.trim() || null,
          phone: phoneE164,
          job_title: form.job_title.trim() || null,
          company_id: company.id,
          company_name: company.name.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Contato criado");
      reset();
      onOpenChange(false);
      onCreated?.(data!.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar contato");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar contato</DialogTitle>
          <DialogDescription>Preencha as informações básicas. Você poderá editar tudo depois.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first_name">Nome *</Label>
              <Input id="first_name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">Sobrenome</Label>
              <Input id="last_name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <EmailInput id="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone</Label>
            <PhoneInput id="phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job_title">Cargo</Label>
            <Input id="job_title" value={form.job_title} onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="company_name">Empresa</Label>
            <CompanyPicker
              id="company_name"
              value={company}
              onChange={setCompany}
              toastOnMatches
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Criando…" : "Criar contato"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
