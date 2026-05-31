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
import { ensureLeadSource } from "@/lib/lead-sources";
import { isEmail, toE164 } from "@/lib/validators";



export function CreateLeadDialog({
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
    company_name: "",
    source: "",
  });
  const [companyMatches, setCompanyMatches] = useState<CompanyMatch[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<CompanyMatch | null>(null);
  const lastSearchedRef = useRef<string>("");

  const reset = () => {
    setForm({ first_name: "", last_name: "", email: "", phone: "", company_name: "", source: "" });
    setCompanyMatches([]);
    setSelectedCompany(null);
    lastSearchedRef.current = "";
  };

  // Empresa: a partir de 3 caracteres, busca matches e mostra toast informativo
  useEffect(() => {
    if (!user) return;
    const q = form.company_name.trim();
    if (q.length < 3) {
      setCompanyMatches([]);
      return;
    }
    if (selectedCompany && selectedCompany.name === q) {
      setCompanyMatches([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .ilike("name", `%${q}%`)
        .order("name", { ascending: true })
        .limit(500);
      if (error) return;
      const matches = (data ?? []) as CompanyMatch[];
      setCompanyMatches(matches);
      if (matches.length > 0 && lastSearchedRef.current !== q) {
        lastSearchedRef.current = q;
        toast.info(
          matches.length === 1
            ? `1 empresa parecida encontrada: ${matches[0].name}`
            : `${matches.length} empresas parecidas encontradas`,
          { description: "Clique em uma para reutilizar." },
        );
      } else if (matches.length === 0) {
        lastSearchedRef.current = q;
      }
    }, 350);
    return () => clearTimeout(t);
  }, [form.company_name, user, selectedCompany]);

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
          company_name: form.company_name.trim() || null,
          source: form.source.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      // Persiste fonte nova no catálogo
      if (form.source.trim()) {
        await ensureLeadSource(user.id, form.source.trim());
      }
      toast.success("Lead criado");
      reset();
      onOpenChange(false);
      onCreated?.(data!.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar lead");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar lead</DialogTitle>
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
            <Label htmlFor="company_name">Empresa</Label>
            <Input
              id="company_name"
              value={form.company_name}
              onChange={(e) => {
                if (selectedCompany && e.target.value !== selectedCompany.name) {
                  setSelectedCompany(null);
                }
                setForm({ ...form, company_name: e.target.value });
              }}
            />
            {selectedCompany && (
              <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs">
                <Building2 className="h-3.5 w-3.5 text-primary" />
                <span className="truncate">Vinculada a <strong>{selectedCompany.name}</strong></span>
              </div>
            )}
            {companyMatches.length > 0 && (
              <div className="rounded-md border bg-muted/30 p-2 space-y-1 max-h-72 overflow-y-auto">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">Empresas parecidas</p>
                {companyMatches.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
                    onClick={() => {
                      setSelectedCompany(c);
                      setForm({ ...form, company_name: c.name });
                      setCompanyMatches([]);
                      lastSearchedRef.current = c.name;
                      toast.success(`Empresa selecionada: ${c.name}`);
                    }}
                  >
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Fonte</Label>
            <SourceCombobox value={form.source} onChange={(v) => setForm({ ...form, source: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Criando…" : "Criar lead"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
