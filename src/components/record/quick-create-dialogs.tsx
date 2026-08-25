import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { REMINDER_OPTIONS } from "@/lib/activity-reminders";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useToastCreated } from "@/lib/toast-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
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
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { usePipelines } from "@/lib/pipelines";
import { listWorkspaceTeam } from "@/lib/workspace-invites.functions";
import { Building2, User } from "lucide-react";
import { isCNPJ, formatCNPJ } from "@/lib/validators";
import { OnboardingGuidedEntry } from "@/components/onboarding/onboarding-guided-entry";

const LEGACY_ENUM = ["new", "qualified", "proposal", "negotiation", "won", "lost"];

type BaseProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (id: string) => void;
  /** Contrato canônico da Fase 3 — preferido sobre `onCreated`. */
  onSaved?: (r: { id: string; action: "created" }) => void;
};

/* ───────────── Company ───────────── */
export function QuickCreateCompanyDialog({
  open,
  onOpenChange,
  onCreated,
  onSaved,
  initialName,
}: BaseProps & { initialName?: string }) {
  const { user } = useAuth();
  const toastCreated = useToastCreated();
  const [name, setName] = useState(initialName ?? "");
  const [domain, setDomain] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [saving, setSaving] = useState(false);

  // Sincroniza quando o diálogo abre com um nome inicial novo
  useEffect(() => {
    if (open) setName(initialName ?? "");
  }, [open, initialName]);

  const submit = async () => {
    if (!user) return;
    if (!name.trim()) return toast.error("Informe o nome");
    const cnpjDigits = cnpj.replace(/\D/g, "");
    if (cnpjDigits && !isCNPJ(cnpjDigits)) {
      return toast.error("CNPJ inválido.");
    }
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("companies")
        .insert({
          owner_id: user.id,
          name: name.trim(),
          domain: domain.trim() || null,
          cnpj: cnpjDigits || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      toastCreated("Empresa criada", "Ir para a empresa", (nav) =>
        nav({ to: "/companies/$id", params: { id: data.id } }),
      );
      onOpenChange(false);
      setName("");
      setDomain("");
      setCnpj("");
      onCreated?.(data.id);
      onSaved?.({ id: data.id, action: "created" });
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
          <div className="space-y-1.5">
            <Label htmlFor="qc-co-cnpj">CNPJ</Label>
            <Input
              id="qc-co-cnpj"
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              maxLength={18}
              value={cnpj}
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, "").slice(0, 14);
                const masked =
                  d.length === 14
                    ? formatCNPJ(d)
                    : d.length > 12
                      ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
                      : d.length > 8
                        ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
                        : d.length > 5
                          ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
                          : d.length > 2
                            ? `${d.slice(0, 2)}.${d.slice(2)}`
                            : d;
                setCnpj(masked);
              }}
            />
          </div>
          <OnboardingGuidedEntry entity="company" onNavigate={() => onOpenChange(false)} />
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
const CURRENCIES = ["BRL", "USD", "EUR", "GBP"] as const;

export function QuickCreateDealDialog({
  open,
  onOpenChange,
  onCreated,
  onSaved,
  defaultCompanyId,
  defaultContactId,
}: BaseProps & { defaultCompanyId?: string | null; defaultContactId?: string | null }) {
  const { user } = useAuth();
  const toastCreated = useToastCreated();
  const { pipelines } = usePipelines("deal");

  const listTeamFn = useServerFn(listWorkspaceTeam);
  const team = useQuery({
    queryKey: ["workspace-team", "quick-create-deal"],
    queryFn: () => listTeamFn(),
    staleTime: 60_000,
    enabled: open,
  });
  const members = team.data?.members ?? [];

  const [name, setName] = useState("");
  const [value, setValue] = useState<string>("0");
  const [currency, setCurrency] = useState<string>("BRL");
  const [pipelineId, setPipelineId] = useState<string>("");
  const [stageId, setStageId] = useState<string>("");
  const [ownerId, setOwnerId] = useState<string>("");
  const [companyId, setCompanyId] = useState<string | null>(defaultCompanyId ?? null);
  const [contactId, setContactId] = useState<string | null>(defaultContactId ?? null);
  const [closeDate, setCloseDate] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Inicializa defaults quando o diálogo abre
  useEffect(() => {
    if (!open) return;
    setName("");
    setValue("0");
    setCurrency("BRL");
    setCloseDate("");
    setCompanyId(defaultCompanyId ?? null);
    setContactId(defaultContactId ?? null);
    setOwnerId(user?.id ?? "");
  }, [open, defaultCompanyId, defaultContactId, user?.id]);

  // Seleciona pipeline default quando carregado
  useEffect(() => {
    if (!open || pipelines.length === 0) return;
    if (pipelineId && pipelines.some((p) => p.id === pipelineId)) return;
    const servicos = pipelines.find((p) => (p.name ?? "").trim().toLowerCase() === "serviços");
    const def = servicos ?? pipelines.find((p) => p.is_default) ?? pipelines[0];
    setPipelineId(def.id);
    setStageId(def.stages[0]?.value ?? "new");
  }, [open, pipelines, pipelineId]);

  const activePipeline = useMemo(
    () => pipelines.find((p) => p.id === pipelineId) ?? null,
    [pipelines, pipelineId],
  );

  const onPipelineChange = (id: string) => {
    setPipelineId(id);
    const p = pipelines.find((x) => x.id === id);
    setStageId(p?.stages[0]?.value ?? "new");
  };

  const submit = async () => {
    if (!user) return;
    if (!name.trim()) return toast.error("Informe o nome");
    setSaving(true);
    try {
      const stageKey = stageId || activePipeline?.stages[0]?.value || "new";
      const stageType = activePipeline?.stages.find((s) => s.value === stageKey)?.type;
      const legacyStage = LEGACY_ENUM.includes(stageKey)
        ? stageKey
        : stageType === "won"
          ? "won"
          : stageType === "lost"
            ? "lost"
            : "new";

      const payload: Record<string, unknown> = {
        owner_id: ownerId || user.id,
        name: name.trim(),
        value: Number(value || 0),
        currency,
        stage: legacyStage,
        stage_id: stageKey,
        pipeline_id: activePipeline?.id ?? null,
        company_id: companyId,
        primary_contact_id: contactId,
        expected_close_date: closeDate || null,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("deals")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      const dealId = data.id as string;
      if (contactId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("deal_contacts")
          .insert({ deal_id: dealId, contact_id: contactId });
      }
      toastCreated("Negócio criado", "Ir para o negócio", (nav) =>
        nav({ to: "/deals/$id", params: { id: dealId } }),
      );
      onOpenChange(false);
      onCreated?.(dealId);
      onSaved?.({ id: dealId, action: "created" });
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Criar negócio</DialogTitle>
          <DialogDescription>
            Preencha as informações principais. Você poderá editar os detalhes depois.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="qc-d-name">Nome *</Label>
            <Input
              id="qc-d-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="Ex.: Projeto - Cliente X"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="qc-d-pipeline">Pipeline</Label>
              <Select value={pipelineId} onValueChange={onPipelineChange}>
                <SelectTrigger id="qc-d-pipeline" className="h-9">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-d-stage">Etapa</Label>
              <Select value={stageId} onValueChange={setStageId} disabled={!activePipeline}>
                <SelectTrigger id="qc-d-stage" className="h-9">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {activePipeline?.stages.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="qc-d-owner">Responsável</Label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger id="qc-d-owner" className="h-9">
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name || m.email || m.user_id.slice(0, 8)}
                      {m.user_id === user?.id ? " (eu)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-d-close">Data prevista de fechamento</Label>
              <Input
                id="qc-d-close"
                type="date"
                value={closeDate}
                onChange={(e) => setCloseDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Empresa</Label>
            <EntityCombobox
              entity="companies"
              select="id,name,domain"
              searchColumn="name"
              labelFrom={(row) => String(row.name ?? "")}
              hintFrom={(row) => (row.domain ? String(row.domain) : null)}
              value={companyId}
              onChange={(id) => setCompanyId(id)}
              placeholder="Buscar empresa…"
              emptyLabel="Nenhuma empresa encontrada"
              icon={Building2}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Contato principal</Label>
            <EntityCombobox
              entity="contacts"
              select="id,first_name,last_name,email"
              searchColumn="first_name"
              searchColumns={["first_name", "last_name", "email"]}
              labelFrom={(row) =>
                `${String(row.first_name ?? "")} ${String(row.last_name ?? "")}`.trim() ||
                String(row.email ?? "")
              }
              hintFrom={(row) => (row.email ? String(row.email) : null)}
              value={contactId}
              onChange={(id) => setContactId(id)}
              placeholder="Buscar contato…"
              emptyLabel="Nenhum contato encontrado"
              icon={User}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <div className="space-y-1.5">
              <Label htmlFor="qc-d-value">Valor</Label>
              <CurrencyInput
                id="qc-d-value"
                currency={currency}
                value={value === "" ? null : Number(value)}
                onValueChange={(n) => setValue(n === null ? "" : String(n))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qc-d-currency">Moeda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="qc-d-currency" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
  onSaved,
  defaultCompanyId,
  defaultContactId,
  defaultDealId,
}: BaseProps & {
  defaultCompanyId?: string | null;
  defaultContactId?: string | null;
  defaultDealId?: string | null;
}) {
  const { user } = useAuth();
  const toastCreated = useToastCreated();
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
      toastCreated("Ticket criado", "Ir para o ticket", (nav) =>
        nav({ to: "/tickets/$id", params: { id: data.id } }),
      );
      onOpenChange(false);
      setSubject("");
      setPriority("medium");
      onCreated?.(data.id);
      onSaved?.({ id: data.id, action: "created" });
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
  onSaved,
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
  const toastCreated = useToastCreated();
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [remindBefore, setRemindBefore] = useState("0");
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
          remind_before_minutes: dueDate && remindBefore !== "none" ? Number(remindBefore) : null,
          completed: false,
          related_contact_id: defaultContactId ?? null,
          related_company_id: defaultCompanyId ?? null,
          related_deal_id: defaultDealId ?? null,
          related_lead_id: defaultLeadId ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      toastCreated("Tarefa criada", "Ir para a tarefa", (nav) =>
        nav({ to: "/tasks/$id", params: { id: data.id } }),
      );
      onOpenChange(false);
      setSubject("");
      setPriority("MEDIUM");
      setDueDate("");
      setRemindBefore("0");
      onCreated?.(data.id);
      onSaved?.({ id: data.id, action: "created" });
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
          <div className="space-y-1.5">
            <Label>Lembrete</Label>
            <Select value={remindBefore} onValueChange={setRemindBefore} disabled={!dueDate}>
              <SelectTrigger aria-label="Lembrete">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem lembrete</SelectItem>
                {REMINDER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!dueDate && (
              <p className="text-xs text-muted-foreground">
                Defina um vencimento para habilitar o lembrete.
              </p>
            )}
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
