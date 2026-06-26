import { formatDateTime } from "@/lib/crm";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Trash2, Copy, RotateCcw, Eye, Repeat } from "lucide-react";
import { toast } from "sonner";

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

function WebhooksPage() {
  const list = useServerFn(listWebhooks);
  const save = useServerFn(upsertWebhook);
  const del = useServerFn(deleteWebhook);
  const listDel = useServerFn(listWebhookDeliveries);
  const getSec = useServerFn(getWebhookSecret);
  const retry = useServerFn(retryWebhookDelivery);

  const [hooks, setHooks] = useState<Hook[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Hook | null>(null);
  const [form, setForm] = useState({ name: "", url: "", events: [] as string[], active: true });

  // filters
  const [fWebhook, setFWebhook] = useState<string>("all");
  const [fEvent, setFEvent] = useState<string>("all");
  const [fStatus, setFStatus] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  // payload viewer
  const [viewing, setViewing] = useState<Delivery | null>(null);

  const loadHooks = async () => {
    const r = await list({});
    setHooks(r.hooks as Hook[]);
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

  const toggleEvent = (e: string) =>
    setForm((f) => ({
      ...f,
      events: f.events.includes(e) ? f.events.filter((x) => x !== e) : [...f.events, e],
    }));

  const showSecret = async (id: string) => {
    const r = await getSec({ data: { id } });
    if (r.secret) {
      navigator.clipboard.writeText(r.secret);
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Webhooks de saída</h1>
          <p className="text-sm text-muted-foreground">
            Receba eventos do CRM e do ATS em seus sistemas externos.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Novo webhook
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Endpoints configurados</CardTitle>
          <CardDescription>
            POST JSON com header <code>X-Webhook-Signature</code> HMAC-SHA256 do body.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hooks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum webhook.</p>
          ) : (
            <div className="space-y-2">
              {hooks.map((h) => (
                <div
                  key={h.id}
                  className="border rounded-md p-3 flex justify-between items-start gap-4"
                >
                  <div className="flex-1 space-y-1">
                    <div className="font-medium flex items-center gap-2">
                      {h.name}
                      {!h.active && <Badge variant="secondary">Inativo</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono break-all">{h.url}</div>
                    <div className="flex gap-1 flex-wrap">
                      {h.events.map((e) => (
                        <Badge key={e} variant="outline">
                          {e}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => showSecret(h.id)}
                      title="Copiar secret"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(h)}>
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        await del({ data: { id: h.id } });
                        loadHooks();
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Entregas recentes
            <Button variant="ghost" size="sm" onClick={loadDeliveries} disabled={loading}>
              <RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </CardTitle>
          <CardDescription>Últimas 100 entregas correspondentes ao filtro.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Select value={fWebhook} onValueChange={setFWebhook}>
              <SelectTrigger>
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
              <SelectTrigger>
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
              <SelectTrigger>
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

          {deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Sem entregas para os filtros atuais.
            </p>
          ) : (
            <div className="border rounded-md divide-y max-h-[28rem] overflow-auto">
              {deliveries.map((d) => {
                const hook = hooksById.get(d.webhook_id);
                return (
                  <div
                    key={d.id}
                    className="px-3 py-2 text-xs flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-mono truncate">{d.event_type}</div>
                      <div className="text-muted-foreground truncate">
                        {hook?.name ?? "—"} · tent. {d.attempt}
                      </div>
                    </div>
                    <Badge
                      variant={
                        d.status === "success"
                          ? "default"
                          : d.status === "dead"
                            ? "destructive"
                            : d.status === "failed"
                              ? "secondary"
                              : "outline"
                      }
                    >
                      {d.status}
                      {d.response_status ? ` ${d.response_status}` : ""}
                    </Badge>
                    <span className="text-muted-foreground hidden md:inline">
                      {formatDateTime(d.created_at)}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewing(d)}
                        title="Ver payload e resposta"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {(d.status === "failed" || d.status === "dead") && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRetry(d.id)}
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
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit ? "Editar webhook" : "Novo webhook"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>URL</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://"
              />
            </div>
            <div>
              <Label>Eventos</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-60 overflow-auto">
                {WEBHOOK_EVENTS.map((e) => (
                  <label key={e} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.events.includes(e)}
                      onCheckedChange={() => toggleEvent(e)}
                    />{" "}
                    {e}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm({ ...form, active: v })}
              />{" "}
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
                <Badge variant="outline">status: {viewing.status}</Badge>
                <Badge variant="outline">tentativas: {viewing.attempt}</Badge>
                {viewing.response_status !== null && (
                  <Badge variant="outline">HTTP {viewing.response_status}</Badge>
                )}
                {viewing.next_retry_at && (
                  <Badge variant="outline">
                    próximo retry: {formatDateTime(viewing.next_retry_at)}
                  </Badge>
                )}
              </div>
              <div>
                <div className="font-medium mb-1">Payload</div>
                <pre className="bg-muted rounded p-2 max-h-60 overflow-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(viewing.payload, null, 2)}
                </pre>
              </div>
              {viewing.response_body && (
                <div>
                  <div className="font-medium mb-1">Resposta</div>
                  <pre className="bg-muted rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap break-all">
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
