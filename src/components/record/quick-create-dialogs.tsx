import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useToastCreated } from "@/lib/toast-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BaseProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
};

/* ───────────── Company ───────────── */
export function QuickCreateCompanyDialog({ open, onOpenChange, onCreated }: BaseProps) {
  const { user } = useAuth();
  const toastCreated = useToastCreated();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!name.trim()) return toast.error("Informe o nome");
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("companies")
        .insert({ owner_id: user.id, name: name.trim(), domain: domain.trim() || null })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Empresa criada");
      onOpenChange(false);
      setName("");
      setDomain("");
      onCreated?.(data.id);
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Falha ao criar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!saving) onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar empresa</DialogTitle>
          <DialogDescription>Informe os dados básicos.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="qc-co-name">Nome *</Label>
            <Input
              id="qc-co-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-co-domain">Domínio</Label>
            <Input
              id="qc-co-domain"
              placeholder="exemplo.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || !name.trim()}>
            {saving ? "Criando…" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────── Deal ───────────── */
export function QuickCreateDealDialog({
  open,
  onOpenChange,
  onCreated,
  defaultCompanyId,
  defaultContactId,
}: BaseProps & { defaultCompanyId?: string | null; defaultContactId?: string | null }) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [value, setValue] = useState("0");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!name.trim()) return toast.error("Informe o nome");
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("deals")
        .insert({
          owner_id: user.id,
          name: name.trim(),
          value: Number(value || 0),
          currency: "BRL",
          stage: "new",
          stage_id: "new",
          company_id: defaultCompanyId ?? null,
          primary_contact_id: defaultContactId ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      const dealId = data.id as string;
      if (defaultContactId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("deal_contacts")
          .insert({ deal_id: dealId, contact_id: defaultContactId });
      }
      toast.success("Negócio criado");
      onOpenChange(false);
      setName("");
      setValue("0");
      onCreated?.(dealId);
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Falha ao criar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!saving) onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar negócio</DialogTitle>
          <DialogDescription>Você poderá editar os detalhes depois.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="qc-d-name">Nome *</Label>
            <Input
              id="qc-d-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-d-value">Valor (BRL)</Label>
            <Input
              id="qc-d-value"
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || !name.trim()}>
            {saving ? "Criando…" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────── Ticket ───────────── */
export function QuickCreateTicketDialog({
  open,
  onOpenChange,
  onCreated,
  defaultCompanyId,
  defaultContactId,
  defaultDealId,
}: BaseProps & {
  defaultCompanyId?: string | null;
  defaultContactId?: string | null;
  defaultDealId?: string | null;
}) {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("medium");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!subject.trim()) return toast.error("Informe o assunto");
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("tickets")
        .insert({
          owner_id: user.id,
          subject: subject.trim(),
          priority,
          status: "new",
          contact_id: defaultContactId ?? null,
          company_id: defaultCompanyId ?? null,
          deal_id: defaultDealId ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Ticket criado");
      onOpenChange(false);
      setSubject("");
      setPriority("medium");
      onCreated?.(data.id);
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Falha ao criar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!saving) onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar ticket</DialogTitle>
          <DialogDescription>Assunto e prioridade.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="qc-t-subject">Assunto *</Label>
            <Input
              id="qc-t-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixa</SelectItem>
                <SelectItem value="medium">Média</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || !subject.trim()}>
            {saving ? "Criando…" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────── Task ───────────── */
export function QuickCreateTaskDialog({
  open,
  onOpenChange,
  onCreated,
  defaultContactId,
  defaultCompanyId,
  defaultDealId,
  defaultLeadId,
}: BaseProps & {
  defaultContactId?: string | null;
  defaultCompanyId?: string | null;
  defaultDealId?: string | null;
  defaultLeadId?: string | null;
}) {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!subject.trim()) return toast.error("Informe o assunto");
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("activities")
        .insert({
          owner_id: user.id,
          type: "task",
          subject: subject.trim(),
          task_status: "NOT_STARTED",
          task_priority: priority,
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          completed: false,
          related_contact_id: defaultContactId ?? null,
          related_company_id: defaultCompanyId ?? null,
          related_deal_id: defaultDealId ?? null,
          related_lead_id: defaultLeadId ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast.success("Tarefa criada");
      onOpenChange(false);
      setSubject("");
      setPriority("MEDIUM");
      setDueDate("");
      onCreated?.(data.id);
    } catch (e) {
      toast.error((e as { message?: string })?.message ?? "Falha ao criar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!saving) onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar tarefa</DialogTitle>
          <DialogDescription>Assunto, prioridade e vencimento.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="qc-ta-subject">Assunto *</Label>
            <Input
              id="qc-ta-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Baixa</SelectItem>
                <SelectItem value="MEDIUM">Média</SelectItem>
                <SelectItem value="HIGH">Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-ta-due">Vencimento</Label>
            <Input
              id="qc-ta-due"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || !subject.trim()}>
            {saving ? "Criando…" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
