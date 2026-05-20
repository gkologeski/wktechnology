import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  listWebhooks, upsertWebhook, deleteWebhook, listWebhookDeliveries, getWebhookSecret, WEBHOOK_EVENTS,
} from "@/lib/webhooks.functions";
import { Plus, Trash2, Copy, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/webhooks")({
  component: WebhooksPage,
});

type Hook = { id: string; name: string; url: string; events: string[]; active: boolean; created_at: string };
type Delivery = { id: string; webhook_id: string; event_type: string; status: string; attempt: number; response_status: number | null; created_at: string; delivered_at: string | null };

function WebhooksPage() {
  const list = useServerFn(listWebhooks);
  const save = useServerFn(upsertWebhook);
  const del = useServerFn(deleteWebhook);
  const listDel = useServerFn(listWebhookDeliveries);
  const getSec = useServerFn(getWebhookSecret);
  const [hooks, setHooks] = useState<Hook[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Hook | null>(null);
  const [form, setForm] = useState({ name: "", url: "", events: [] as string[], active: true });

  const load = async () => {
    const r = await list({});
    setHooks(r.hooks as Hook[]);
    const d = await listDel({ data: { webhook_id: null } });
    setDeliveries(d.deliveries as Delivery[]);
  };
  useEffect(() => { void load(); }, []);

  const openNew = () => { setEdit(null); setForm({ name: "", url: "", events: [], active: true }); setOpen(true); };
  const openEdit = (h: Hook) => { setEdit(h); setForm({ name: h.name, url: h.url, events: h.events, active: h.active }); setOpen(true); };

  const submit = async () => {
    try {
      await save({ data: { id: edit?.id, ...form } });
      setOpen(false);
      await load();
      toast.success("Webhook salvo");
    } catch (e) { toast.error((e as Error).message); }
  };

  const toggleEvent = (e: string) =>
    setForm((f) => ({ ...f, events: f.events.includes(e) ? f.events.filter((x) => x !== e) : [...f.events, e] }));

  const showSecret = async (id: string) => {
    const r = await getSec({ data: { id } });
    if (r.secret) { navigator.clipboard.writeText(r.secret); toast.success("Secret copiado"); }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Webhooks de saída</h1>
          <p className="text-sm text-muted-foreground">Receba eventos do CRM em seus sistemas externos.</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Novo webhook</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Endpoints configurados</CardTitle>
          <CardDescription>O payload é POST JSON com header <code>X-Webhook-Signature</code> HMAC-SHA256 do body.</CardDescription>
        </CardHeader>
        <CardContent>
          {hooks.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum webhook.</p> :
           <div className="space-y-2">
            {hooks.map((h) => (
              <div key={h.id} className="border rounded-md p-3 flex justify-between items-start gap-4">
                <div className="flex-1 space-y-1">
                  <div className="font-medium flex items-center gap-2">{h.name}
                    {!h.active && <Badge variant="secondary">Inativo</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono break-all">{h.url}</div>
                  <div className="flex gap-1 flex-wrap">{h.events.map((e) => <Badge key={e} variant="outline">{e}</Badge>)}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => showSecret(h.id)}><Copy className="h-4 w-4" /></Button>
                  <Button variant="outline" size="sm" onClick={() => openEdit(h)}>Editar</Button>
                  <Button variant="ghost" size="sm" onClick={async () => { await del({ data: { id: h.id } }); load(); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
           </div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">Entregas recentes
            <Button variant="ghost" size="sm" onClick={load}><RotateCcw className="h-4 w-4" /></Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {deliveries.length === 0 ? <p className="text-sm text-muted-foreground">Sem entregas ainda.</p> :
           <div className="space-y-1 max-h-96 overflow-auto">
            {deliveries.map((d) => (
              <div key={d.id} className="text-xs border-b py-2 flex justify-between gap-2">
                <span className="font-mono">{d.event_type}</span>
                <span className="flex items-center gap-2">
                  <Badge variant={d.status === "success" ? "default" : d.status === "dead" ? "destructive" : "secondary"}>
                    {d.status}{d.response_status ? ` ${d.response_status}` : ""}
                  </Badge>
                  <span className="text-muted-foreground">{new Date(d.created_at).toLocaleString("pt-BR")}</span>
                </span>
              </div>
            ))}
           </div>}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit ? "Editar webhook" : "Novo webhook"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} /></div>
            <div><Label>URL</Label><Input value={form.url} onChange={(e) => setForm({...form, url: e.target.value})} placeholder="https://" /></div>
            <div>
              <Label>Eventos</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-60 overflow-auto">
                {WEBHOOK_EVENTS.map((e) => (
                  <label key={e} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={form.events.includes(e)} onCheckedChange={() => toggleEvent(e)} /> {e}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({...form, active: v})} /> Ativo
            </label>
          </div>
          <DialogFooter><Button onClick={submit} disabled={!form.name || !form.url || form.events.length === 0}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
