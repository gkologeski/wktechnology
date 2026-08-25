import { formatDateTime } from "@/lib/crm";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  listWebhooks,
  upsertWebhook,
  deleteWebhook,
  listWebhookDeliveries,
  getWebhookSecret,
  retryWebhookDelivery,
  WEBHOOK_EVENTS,
} from "@/lib/webhooks.functions";
import { Plus, Trash2, Copy, RotateCcw, Eye, Repeat, Webhook, Inbox } from "lucide-react";
import { toast } from "sonner";
import {
  AtsPageHeader,
  AtsSectionHeader,
  EmptyState,
  FilterBar,
  Skeletons,
} from "@/components/ats/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings/webhooks")({
  component: WebhooksPage,
});

type Hook = {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
};
type Delivery = {
  id: string;
  webhook_id: string;
  event_type: string;
  status: string;
  attempt: number;
  response_status: number | null;
  response_body: string | null;
  payload: unknown;
  created_at: string;
  delivered_at: string | null;
  next_retry_at: string | null;
};

const DELIVERY_STATUS = {
  pending: {
    label: "Pendente",
    cls: "border-status-onhold/30 bg-status-onhold/10 text-status-onhold",
  },
  success: {
    label: "Sucesso",
    cls: "border-status-open/30 bg-status-open/10 text-status-open",
  },
  failed: {
    label: "Falha",
    cls: "border-risk-medium/30 bg-risk-medium/10 text-risk-medium",
  },
  dead: {
    label: "Dead-letter",
    cls: "border-risk-high/30 bg-risk-high/10 text-risk-high",
  },
} as const;

function DeliveryStatusBadge({ status, http }: { status: string; http?: number | null }) {
  const cfg = (DELIVERY_STATUS as Record<string, { label: string; cls: string }>)[status] ?? {
    label: status,
    cls: "border-border-default bg-surface-sunken text-text-secondary",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
        "text-[11px] font-medium leading-none whitespace-nowrap tabular-nums",
        cfg.cls,
      )}
    >
      {cfg.label}
      {http ? <span className="opacity-70">· {http}</span> : null}
    </span>
  );
}

function WebhooksPage() {
  const list = useServerFn(listWebhooks);
  const save = useServerFn(upsertWebhook);
  const del = useServerFn(deleteWebhook);
  const listDel = useServerFn(listWebhookDeliveries);
  const getSec = useServerFn(getWebhookSecret);
  const retry = useServerFn(retryWebhookDelivery);

  const [hooks, setHooks] = useState<Hook[]>([]);
  const [hooksLoading, setHooksLoading] = useState(true);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Hook | null>(null);
  const [form, setForm] = useState({ name: "", url: "", events: [] as string[], active: true });

  // filters
  const [fWebhook, setFWebhook] = useState<string>("all");
  const [fEvent, setFEvent] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  // payload viewer
  const [viewing, setViewing] = useState<Delivery | null>(null);

  const loadHooks = async () => {
    setHooksLoading(true);
    try {
      const r = await list({});
      setHooks(r.hooks as Hook[]);
    } finally {
      setHooksLoading(false);
    }
  };

  const loadDeliveries = async () => {
    setLoading(true);
    try {
      const d = await listDel({
        data: {
          webhook_id: fWebhook === "all" ? null : fWebhook,
          event_type: fEvent === "all" ? null : fEvent,
          status: fStatus === "all" ? null : (fStatus as "pending" | "success" | "failed" | "dead"),
        },
      });
      setDeliveries(d.deliveries as Delivery[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHooks();
  }, []);

  useEffect(() => {
    void loadDeliveries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fWebhook, fEvent, fStatus]);

  const openNew = () => {
    setEdit(null);
    setForm({ name: "", url: "", events: [], active: true });
    setOpen(true);
  };
  const openEdit = (h: Hook) => {
    setEdit(h);
    setForm({ name: h.name, url: h.url, events: h.events, active: h.active });
    setOpen(true);
  };

  const submit = async () => {
    try {
      await save({ data: { id: edit?.id, ...form } });
      setOpen(false);
      await loadHooks();
      toast.success("Webhook salvo");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await del({ data: { id } });
      await loadHooks();
      toast.success("Webhook removido");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const toggleEvent = (e: string) =>
    setForm((f) => ({
      ...f,
      events: f.events.includes(e) ? f.events.filter((x) => x !== e) : [...f.events, e],
    }));

  const showSecret = async (id: string) => {
    const r = await getSec({ data: { id } });
    if (r.secret) {
      await navigator.clipboard.writeText(r.secret);
      toast.success("Secret copiado");
    }
  };

  const handleRetry = async (id: string) => {
    try {
      await retry({ data: { id } });
      toast.success("Entrega reenfileirada");
      await loadDeliveries();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const hooksById = useMemo(() => {
    const m = new Map<string, Hook>();
    hooks.forEach((h) => m.set(h.id, h));
    return m;
  }, [hooks]);

  const activeCount = hooks.filter((h) => h.active).length;
  const description = hooksLoading
    ? "Carregando endpoints…"
    : `${hooks.length} endpoint${hooks.length === 1 ? "" : "s"} · ${activeCount} ativo${activeCount === 1 ? "" : "s"} · POST JSON com header X-Webhook-Signature (HMAC-SHA256).`;

  return (
    <div className="p-6 space-y-6">
      <AtsPageHeader
        eyebrow="Integrações"
        title="Webhooks de saída"
        description={description}
        descriptionLive
        primaryAction={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> Novo webhook
          </Button>
        }
      />

      {/* Endpoints */}
      <section className="space-y-3">
        <AtsSectionHeader title="Endpoints configurados" />
        {hooksLoading ? (
          <div className="space-y-2">
            <Skeletons.Card lines={2} />
            <Skeletons.Card lines={2} />
          </div>
        ) : hooks.length === 0 ? (
          <EmptyState
            icon={Webhook}
            title="Nenhum endpoint configurado"
            description="Cadastre um endpoint HTTPS para receber eventos do CRM e do ATS em tempo real."
            action={
              <Button onClick={openNew} size="sm">
                <Plus className="h-4 w-4 mr-2" /> Novo webhook
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {hooks.map((h) => (
              <div
                key={h.id}
                className="rounded-lg border border-border-subtle bg-surface-2 p-3 shadow-xs flex justify-between items-start gap-4"
              >
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary truncate">{h.name}</span>
                    {h.active ? (
                      <span className="inline-flex items-center rounded-md border border-status-open/30 bg-status-open/10 px-1.5 py-0.5 text-[11px] font-medium text-status-open">
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md border border-border-default bg-surface-sunken px-1.5 py-0.5 text-[11px] font-medium text-text-secondary">
                        Inativo
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text-tertiary font-mono break-all">{h.url}</div>
                  <div className="flex gap-1 flex-wrap">
                    {h.events.map((e) => (
                      <span
                        key={e}
                        className="inline-flex items-center rounded-md border border-border-subtle bg-surface-sunken px-1.5 py-0.5 text-[11px] font-mono text-text-secondary"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => showSecret(h.id)}
                    title="Copiar secret"
                    aria-label="Copiar secret"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(h)}>
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(h.id)}
                    aria-label="Remover webhook"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Deliveries */}
      <section className="space-y-3">
        <AtsSectionHeader
          title="Entregas recentes"
          description="Últimas 100 entregas correspondentes ao filtro."
        />

        <FilterBar
          chips={
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full">
              <Select value={fWebhook} onValueChange={setFWebhook}>
                <SelectTrigger aria-label="Filtrar por webhook">
                  <SelectValue placeholder="Webhook" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os webhooks</SelectItem>
                  {hooks.map((h) => (
                    <SelectItem key={h.id} value={h.id}>
                      {h.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={fEvent} onValueChange={setFEvent}>
                <SelectTrigger aria-label="Filtrar por evento">
                  <SelectValue placeholder="Evento" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">Todos os eventos</SelectItem>
                  {WEBHOOK_EVENTS.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger aria-label="Filtrar por status">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="success">Sucesso</SelectItem>
                  <SelectItem value="failed">Falha (retry)</SelectItem>
                  <SelectItem value="dead">Dead-letter</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={loadDeliveries}
              disabled={loading}
              aria-label="Atualizar entregas"
            >
              <RotateCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          }
        />

        {loading ? (
          <div className="space-y-1">
            <Skeletons.Row />
            <Skeletons.Row />
            <Skeletons.Row />
            <Skeletons.Row />
          </div>
        ) : deliveries.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Sem entregas para os filtros atuais"
            description="Quando um evento for disparado, ele aparecerá aqui com o status da tentativa."
            compact
          />
        ) : (
          <div className="rounded-lg border border-border-subtle bg-surface-2 shadow-xs divide-y divide-border-subtle max-h-[28rem] overflow-auto">
            {deliveries.map((d) => {
              const hook = hooksById.get(d.webhook_id);
              return (
                <div
                  key={d.id}
                  className="px-3 py-2 text-xs flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-mono truncate text-text-primary">{d.event_type}</div>
                    <div className="text-text-tertiary truncate">
                      {hook?.name ?? "—"} · tent. {d.attempt}
                    </div>
                  </div>
                  <DeliveryStatusBadge status={d.status} http={d.response_status} />
                  <span className="text-text-tertiary hidden md:inline tabular-nums">
                    {formatDateTime(d.created_at)}
                  </span>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setViewing(d)}
                      aria-label="Ver payload e resposta"
                      title="Ver payload e resposta"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {(d.status === "failed" || d.status === "dead") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRetry(d.id)}
                        aria-label="Reenviar entrega"
                        title="Reenviar"
                      >
                        <Repeat className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit ? "Editar webhook" : "Novo webhook"}</DialogTitle>
            <DialogDescription>
              Configure o endpoint HTTPS e os eventos que deseja receber.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="wh-name">Nome</Label>
              <Input
                id="wh-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="wh-url">URL</Label>
              <Input
                id="wh-url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://"
              />
            </div>
            <div>
              <Label>Eventos</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-60 overflow-auto rounded-md border border-border-subtle bg-surface-sunken p-2">
                {WEBHOOK_EVENTS.map((e) => (
                  <label key={e} className="flex items-center gap-2 text-sm font-mono">
                    <Checkbox
                      checked={form.events.includes(e)}
                      onCheckedChange={() => toggleEvent(e)}
                    />
                    {e}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />
              Ativo
            </label>
          </div>
          <DialogFooter>
            <Button onClick={submit} disabled={!form.name || !form.url || form.events.length === 0}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(v) => !v && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Entrega de webhook</DialogTitle>
            <DialogDescription>
              {viewing?.event_type} ·{" "}
              {viewing?.created_at ? formatDateTime(viewing.created_at) : ""}
            </DialogDescription>
          </DialogHeader>
          {viewing && (
            <div className="space-y-3 text-xs">
              <div className="flex flex-wrap gap-2">
                <DeliveryStatusBadge status={viewing.status} http={viewing.response_status} />
                <span className="inline-flex items-center rounded-md border border-border-subtle bg-surface-sunken px-1.5 py-0.5 text-[11px] text-text-secondary">
                  tentativas: {viewing.attempt}
                </span>
                {viewing.next_retry_at && (
                  <span className="inline-flex items-center rounded-md border border-border-subtle bg-surface-sunken px-1.5 py-0.5 text-[11px] text-text-secondary">
                    próximo retry: {formatDateTime(viewing.next_retry_at)}
                  </span>
                )}
              </div>
              <div>
                <div className="font-medium mb-1 text-text-primary">Payload</div>
                <pre className="bg-surface-sunken border border-border-subtle rounded p-2 max-h-60 overflow-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(viewing.payload, null, 2)}
                </pre>
              </div>
              {viewing.response_body && (
                <div>
                  <div className="font-medium mb-1 text-text-primary">Resposta</div>
                  <pre className="bg-surface-sunken border border-border-subtle rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap break-all">
                    {viewing.response_body}
                  </pre>
                </div>
              )}
              {(viewing.status === "failed" || viewing.status === "dead") && (
                <Button
                  size="sm"
                  onClick={async () => {
                    await handleRetry(viewing.id);
                    setViewing(null);
                  }}
                >
                  <Repeat className="h-4 w-4 mr-2" /> Reenviar agora
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
