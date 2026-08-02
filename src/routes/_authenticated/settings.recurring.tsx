import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";

import {
  listPlans,
  upsertPlan,
  deletePlan,
  listSubscriptions,
  getSubscription,
  createSubscription,
  updateSubscriptionStatus,
  deleteSubscription,
  setInvoiceStatus,
  listAllInvoices,
} from "@/lib/recurring.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichHtmlEditor, HtmlContent, htmlToPlain } from "@/components/rich-html-editor";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { ContactPickerById } from "@/components/ui/contact-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Plus,
  Trash2,
  Pencil,
  Pause,
  Play,
  XCircle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/crm";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/settings/recurring")({
  component: RecurringPage,
});

const INTERVALS = [
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "quarter", label: "Trimestre" },
  { value: "year", label: "Ano" },
] as const;

const STATUS_LABEL: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  trialing: { label: "Trial", variant: "secondary" },
  active: { label: "Ativa", variant: "default" },
  paused: { label: "Pausada", variant: "outline" },
  canceled: { label: "Cancelada", variant: "destructive" },
  past_due: { label: "Vencida", variant: "destructive" },
  completed: { label: "Concluída", variant: "secondary" },
};
const INV_LABEL: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  pending: { label: "Pendente", variant: "outline" },
  paid: { label: "Paga", variant: "default" },
  failed: { label: "Falhou", variant: "destructive" },
  void: { label: "Cancelada", variant: "secondary" },
};

function RecurringPage() {
  return (
    <Tabs defaultValue="subs" className="space-y-4">
      <TabsList>
        <TabsTrigger value="subs">Assinaturas</TabsTrigger>
        <TabsTrigger value="plans">Planos</TabsTrigger>
        <TabsTrigger value="invoices">Faturas</TabsTrigger>
      </TabsList>
      <TabsContent value="subs">
        <SubscriptionsTab />
      </TabsContent>
      <TabsContent value="plans">
        <PlansTab />
      </TabsContent>
      <TabsContent value="invoices">
        <InvoicesTab />
      </TabsContent>
    </Tabs>
  );
}

// ----------- Plans -----------
function PlansTab() {
  const qc = useQueryClient();
  const list = useServerFn(listPlans);
  const upsert = useServerFn(upsertPlan);
  const del = useServerFn(deletePlan);
  const { data: plans = [] } = useQuery({ queryKey: ["recurring-plans"], queryFn: () => list() });
  const [open, setOpen] = useState(false);
  type Draft = {
    id?: string;
    name: string;
    description?: string | null;
    price: number;
    currency: string;
    interval: "week" | "month" | "quarter" | "year";
    interval_count: number;
    trial_days: number;
    active: boolean;
  };
  const [draft, setDraft] = useState<Draft>({
    name: "",
    price: 0,
    currency: "BRL",
    interval: "month",
    interval_count: 1,
    trial_days: 0,
    active: true,
  });

  function openNew() {
    setDraft({
      name: "",
      price: 0,
      currency: "BRL",
      interval: "month",
      interval_count: 1,
      trial_days: 0,
      active: true,
    });
    setOpen(true);
  }
  function openEdit(p: (typeof plans)[number]) {
    setDraft({
      id: p.id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      currency: p.currency,
      interval: p.interval as Draft["interval"],
      interval_count: p.interval_count,
      trial_days: p.trial_days,
      active: p.active,
    });
    setOpen(true);
  }
  async function save() {
    if (!draft.name.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    try {
      await upsert({ data: { ...draft, description: draft.description ?? undefined } });
      toast.success("Plano salvo.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["recurring-plans"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }
  async function remove(id: string) {
    if (!(await confirmDialog("Excluir plano?"))) return;
    try {
      await del({ data: { id } });
      qc.invalidateQueries({ queryKey: ["recurring-plans"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Planos recorrentes</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Catálogo de planos reutilizáveis para criar assinaturas.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Novo plano
        </Button>
      </CardHeader>
      <CardContent>
        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum plano cadastrado.</p>
        ) : (
          <div className="space-y-2">
            {plans.map((p) => (
              <div
                key={p.id}
                className="flex items-start justify-between rounded-md border p-3 gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{p.name}</span>
                    {!p.active && (
                      <Badge variant="secondary" className="text-xs">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatCurrency(Number(p.price), p.currency)} /{" "}
                    {p.interval_count > 1 ? `${p.interval_count} ` : ""}
                    {INTERVALS.find((i) => i.value === p.interval)?.label.toLowerCase()}
                    {p.trial_days > 0 && ` · ${p.trial_days}d trial`}
                  </div>
                  {p.description && htmlToPlain(p.description) && (
                    <HtmlContent
                      html={p.description}
                      className="text-xs text-muted-foreground mt-1 line-clamp-2"
                    />
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar plano" : "Novo plano"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Preço</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.price}
                  onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Moeda</Label>
                <Input
                  value={draft.currency}
                  onChange={(e) =>
                    setDraft({ ...draft, currency: e.target.value.toUpperCase().slice(0, 3) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Trial (dias)</Label>
                <Input
                  type="number"
                  value={draft.trial_days}
                  onChange={(e) => setDraft({ ...draft, trial_days: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Intervalo</Label>
                <Select
                  value={draft.interval}
                  onValueChange={(v) => setDraft({ ...draft, interval: v as Draft["interval"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVALS.map((i) => (
                      <SelectItem key={i.value} value={i.value}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>A cada N intervalos</Label>
                <Input
                  type="number"
                  min={1}
                  value={draft.interval_count}
                  onChange={(e) => setDraft({ ...draft, interval_count: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <RichHtmlEditor
                value={draft.description ?? ""}
                onChange={(html) => setDraft({ ...draft, description: html })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={draft.active}
                onCheckedChange={(v) => setDraft({ ...draft, active: v })}
              />
              <Label className="cursor-pointer">Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ----------- Subscriptions -----------
function SubscriptionsTab() {
  const qc = useQueryClient();
  const list = useServerFn(listSubscriptions);
  const create = useServerFn(createSubscription);
  const update = useServerFn(updateSubscriptionStatus);
  const del = useServerFn(deleteSubscription);
  const { data: subs = [] } = useQuery({ queryKey: ["subscriptions"], queryFn: () => list() });
  const listPlansFn = useServerFn(listPlans);
  const { data: plans = [] } = useQuery({
    queryKey: ["recurring-plans"],
    queryFn: () => listPlansFn(),
  });

  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  type Draft = {
    contact_id: string;
    plan_id?: string | null;
    name: string;
    amount: number;
    currency: string;
    interval: "week" | "month" | "quarter" | "year";
    interval_count: number;
    trial_days: number;
    total_cycles?: number | null;
    notes?: string | null;
    start_date?: string;
  };
  const [draft, setDraft] = useState<Draft>({
    contact_id: "",
    name: "",
    amount: 0,
    currency: "BRL",
    interval: "month",
    interval_count: 1,
    trial_days: 0,
  });

  const metrics = useMemo(() => {
    const active = subs.filter((s) => s.status === "active" || s.status === "trialing");
    const monthly = active.reduce((acc, s) => {
      const amt = Number(s.amount);
      const factor =
        s.interval === "week"
          ? 4.33 / s.interval_count
          : s.interval === "month"
            ? 1 / s.interval_count
            : s.interval === "quarter"
              ? 1 / (3 * s.interval_count)
              : 1 / (12 * s.interval_count);
      return acc + amt * factor;
    }, 0);
    return { total: subs.length, active: active.length, mrr: monthly };
  }, [subs]);

  function applyPlan(planId: string) {
    const p = plans.find((x) => x.id === planId);
    if (!p) return;
    setDraft((d) => ({
      ...d,
      plan_id: planId,
      name: p.name,
      amount: Number(p.price),
      currency: p.currency,
      interval: p.interval as Draft["interval"],
      interval_count: p.interval_count,
      trial_days: p.trial_days,
    }));
  }
  function openNew() {
    setDraft({
      contact_id: "",
      name: "",
      amount: 0,
      currency: "BRL",
      interval: "month",
      interval_count: 1,
      trial_days: 0,
    });
    setOpen(true);
  }
  async function save() {
    if (!draft.contact_id) {
      toast.error("Selecione um contato.");
      return;
    }
    if (!draft.name.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    try {
      await create({
        data: {
          ...draft,
          plan_id: draft.plan_id ?? undefined,
          total_cycles: draft.total_cycles ?? undefined,
          notes: draft.notes ?? undefined,
        },
      });
      toast.success("Assinatura criada. Primeira fatura gerada.");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["sub-invoices-all"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }
  async function act(id: string, action: "pause" | "resume" | "cancel") {
    try {
      await update({ data: { id, action } });
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }
  async function remove(id: string) {
    if (!(await confirmDialog("Excluir assinatura e faturas?"))) return;
    try {
      await del({ data: { id } });
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <MetricCard label="Total" value={String(metrics.total)} />
        <MetricCard label="Ativas / Trial" value={String(metrics.active)} />
        <MetricCard label="MRR estimado" value={formatCurrency(metrics.mrr)} />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Assinaturas</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Faturas pendentes são geradas automaticamente quando uma fatura é marcada como paga.
            </p>
          </div>
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4 mr-1" /> Nova assinatura
          </Button>
        </CardHeader>
        <CardContent>
          {subs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma assinatura.</p>
          ) : (
            <div className="space-y-2">
              {subs.map((s) => {
                const c = s.contacts as {
                  first_name?: string;
                  last_name?: string;
                  email?: string;
                } | null;
                const contactName = c
                  ? `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "—"
                  : "—";
                const st = STATUS_LABEL[s.status] ?? STATUS_LABEL.active;
                return (
                  <div
                    key={s.id}
                    className="flex items-start justify-between rounded-md border p-3 gap-3"
                  >
                    <button onClick={() => setOpenId(s.id)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{s.name}</span>
                        <Badge variant={st.variant} className="text-xs">
                          {st.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {contactName} · {formatCurrency(Number(s.amount), s.currency)}/
                        {INTERVALS.find((i) => i.value === s.interval)?.label.toLowerCase()}
                        {s.next_billing_at && ` · próx: ${formatDate(s.next_billing_at)}`}
                        {s.cycles_completed > 0 &&
                          ` · ${s.cycles_completed}${s.total_cycles ? `/${s.total_cycles}` : ""} ciclos`}
                      </div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      {s.status === "active" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Pausar"
                          onClick={() => act(s.id, "pause")}
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      {(s.status === "paused" || s.status === "past_due") && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Retomar"
                          onClick={() => act(s.id, "resume")}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {s.status !== "canceled" && s.status !== "completed" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Cancelar"
                          onClick={() => act(s.id, "cancel")}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => remove(s.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Nova assinatura</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Contato *</Label>
              <ContactPickerById
                mode="pick"
                id={draft.contact_id || null}
                onChange={(id) => setDraft({ ...draft, contact_id: id ?? "" })}
                placeholder="Selecionar contato…"
              />
            </div>
            {plans.length > 0 && (
              <div className="space-y-1.5">
                <Label>Aplicar plano (opcional)</Label>
                <Select value={draft.plan_id ?? ""} onValueChange={applyPlan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sem plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans
                      .filter((p) => p.active)
                      .map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Valor</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Moeda</Label>
                <Input
                  value={draft.currency}
                  onChange={(e) =>
                    setDraft({ ...draft, currency: e.target.value.toUpperCase().slice(0, 3) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Trial (dias)</Label>
                <Input
                  type="number"
                  value={draft.trial_days}
                  onChange={(e) => setDraft({ ...draft, trial_days: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Intervalo</Label>
                <Select
                  value={draft.interval}
                  onValueChange={(v) => setDraft({ ...draft, interval: v as Draft["interval"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVALS.map((i) => (
                      <SelectItem key={i.value} value={i.value}>
                        {i.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>A cada</Label>
                <Input
                  type="number"
                  min={1}
                  value={draft.interval_count}
                  onChange={(e) => setDraft({ ...draft, interval_count: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ciclos (vazio = infinito)</Label>
                <Input
                  type="number"
                  value={draft.total_cycles ?? ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      total_cycles: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Início</Label>
              <Input
                type="date"
                value={draft.start_date ?? ""}
                onChange={(e) => setDraft({ ...draft, start_date: e.target.value || undefined })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <RichHtmlEditor
                value={draft.notes ?? ""}
                onChange={(html) => setDraft({ ...draft, notes: html })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SubscriptionDrawer id={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

function SubscriptionDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const get = useServerFn(getSubscription);
  const setStatus = useServerFn(setInvoiceStatus);
  const { data } = useQuery({
    queryKey: ["subscription", id],
    queryFn: () => get({ data: { id: id! } }),
    enabled: !!id,
  });
  async function mark(invId: string, status: "paid" | "failed" | "void") {
    try {
      await setStatus({ data: { id: invId, status } });
      qc.invalidateQueries({ queryKey: ["subscription", id] });
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
      qc.invalidateQueries({ queryKey: ["sub-invoices-all"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }
  return (
    <Sheet open={!!id} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{data?.subscription?.name ?? "Assinatura"}</SheetTitle>
        </SheetHeader>
        {data && (
          <div className="space-y-4 mt-4">
            <div className="text-sm space-y-1">
              <div>
                Valor:{" "}
                <strong>
                  {formatCurrency(Number(data.subscription.amount), data.subscription.currency)}
                </strong>
              </div>
              <div>
                Status:{" "}
                <Badge
                  variant={(STATUS_LABEL[data.subscription.status] ?? STATUS_LABEL.active).variant}
                >
                  {(STATUS_LABEL[data.subscription.status] ?? STATUS_LABEL.active).label}
                </Badge>
              </div>
              <div>Início: {formatDate(data.subscription.start_date)}</div>
              {data.subscription.next_billing_at && (
                <div>Próx. cobrança: {formatDate(data.subscription.next_billing_at)}</div>
              )}
              {data.subscription.notes && htmlToPlain(data.subscription.notes) && (
                <HtmlContent html={data.subscription.notes} className="text-muted-foreground" />
              )}
            </div>
            <div>
              <h3 className="font-medium mb-2">Faturas</h3>
              {data.invoices.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem faturas.</p>
              ) : (
                <div className="space-y-2">
                  {data.invoices.map((inv) => {
                    const st = INV_LABEL[inv.status] ?? INV_LABEL.pending;
                    return (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between rounded-md border p-2 gap-2"
                      >
                        <div className="min-w-0 text-sm">
                          <div className="font-mono text-xs">{inv.invoice_number}</div>
                          <div className="text-muted-foreground text-xs">
                            {formatDate(inv.period_start)} → {formatDate(inv.period_end)} · venc.{" "}
                            {formatDate(inv.due_date)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-medium">
                            {formatCurrency(Number(inv.amount), inv.currency)}
                          </span>
                          <Badge variant={st.variant} className="text-xs">
                            {st.label}
                          </Badge>
                          {inv.status === "pending" && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Marcar paga"
                                onClick={() => mark(inv.id, "paid")}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                title="Falhou"
                                onClick={() => mark(inv.id, "failed")}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ----------- Invoices -----------
function InvoicesTab() {
  const qc = useQueryClient();
  const list = useServerFn(listAllInvoices);
  const setStatus = useServerFn(setInvoiceStatus);
  const { data: invs = [] } = useQuery({ queryKey: ["sub-invoices-all"], queryFn: () => list() });

  async function mark(id: string, status: "paid" | "failed" | "void") {
    try {
      await setStatus({ data: { id, status } });
      qc.invalidateQueries({ queryKey: ["sub-invoices-all"] });
      qc.invalidateQueries({ queryKey: ["subscriptions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  const totals = useMemo(() => {
    const paid = invs.filter((i) => i.status === "paid").reduce((a, i) => a + Number(i.amount), 0);
    const pending = invs
      .filter((i) => i.status === "pending")
      .reduce((a, i) => a + Number(i.amount), 0);
    return { paid, pending };
  }, [invs]);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <MetricCard label="Recebido (últimas 200)" value={formatCurrency(totals.paid)} />
        <MetricCard label="Pendente" value={formatCurrency(totals.pending)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Faturas</CardTitle>
        </CardHeader>
        <CardContent>
          {invs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem faturas.</p>
          ) : (
            <div className="space-y-2">
              {invs.map((inv) => {
                const sub = inv.subscriptions as {
                  name?: string;
                  contacts?: { first_name?: string; last_name?: string };
                } | null;
                const contact = sub?.contacts
                  ? `${sub.contacts.first_name ?? ""} ${sub.contacts.last_name ?? ""}`.trim()
                  : "";
                const st = INV_LABEL[inv.status] ?? INV_LABEL.pending;
                return (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-md border p-3 gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs">{inv.invoice_number}</span>
                        <Badge variant={st.variant} className="text-xs">
                          {st.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {sub?.name ?? "—"}
                        {contact ? ` · ${contact}` : ""} · venc. {formatDate(inv.due_date)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-medium">
                        {formatCurrency(Number(inv.amount), inv.currency)}
                      </span>
                      {inv.status === "pending" && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Marcar paga"
                            onClick={() => mark(inv.id, "paid")}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Falhou"
                            onClick={() => mark(inv.id, "failed")}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Cancelar"
                            onClick={() => mark(inv.id, "void")}
                          >
                            <ExternalLink className="h-4 w-4 rotate-45" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
