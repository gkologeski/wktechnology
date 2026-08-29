import { formatDateTime } from "@/lib/crm";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listAlertRules,
  upsertAlertRule,
  deleteAlertRule,
  listAlertEvents,
} from "@/lib/platform-observability.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useIsPlatformAdmin } from "@/lib/use-platform-admin";
import { Trash2, Plus } from "lucide-react";


export function AdminAlertsPage() {
  const { isPlatformAdmin, loading } = useIsPlatformAdmin();
  const qc = useQueryClient();
  const listFn = useServerFn(listAlertRules);
  const eventsFn = useServerFn(listAlertEvents);
  const upsertFn = useServerFn(upsertAlertRule);
  const delFn = useServerFn(deleteAlertRule);

  const rules = useQuery({
    queryKey: ["alert-rules"],
    queryFn: () => listFn(),
    enabled: isPlatformAdmin,
  });
  const events = useQuery({
    queryKey: ["alert-events"],
    queryFn: () => eventsFn(),
    enabled: isPlatformAdmin,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    rule_type: "cron_late" as const,
    threshold_mins: 5,
    threshold_pct: 10,
    target_key: "",
    email: "",
    enabled: true,
  });

  const save = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          name: form.name,
          description: form.description,
          rule_type: form.rule_type,
          threshold_mins: form.threshold_mins,
          threshold_pct: form.threshold_pct,
          target_key: form.target_key || null,
          channels: form.email ? [{ type: "email" as const, value: form.email }] : [],
          enabled: form.enabled,
        },
      }),
    onSuccess: () => {
      toast.success("Regra salva");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["alert-rules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Regra removida");
      qc.invalidateQueries({ queryKey: ["alert-rules"] });
    },
  });

  if (loading) return <div className="p-6">Carregando…</div>;
  if (!isPlatformAdmin) return <div className="p-6">Acesso restrito a super-admins.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Alertas Operacionais</h1>
          <p className="text-sm text-muted-foreground">Regras de alerta e histórico de disparos.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova regra
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nova regra de alerta</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select
                  value={form.rule_type}
                  onValueChange={(v) => setForm({ ...form, rule_type: v as typeof form.rule_type })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cron_late">Cron atrasado</SelectItem>
                    <SelectItem value="broadcast_failure">Falha em broadcast</SelectItem>
                    <SelectItem value="twilio_errors">Erros Twilio</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Limite (min)</Label>
                  <Input
                    type="number"
                    value={form.threshold_mins}
                    onChange={(e) => setForm({ ...form, threshold_mins: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Limite (%)</Label>
                  <Input
                    type="number"
                    value={form.threshold_pct}
                    onChange={(e) => setForm({ ...form, threshold_pct: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <Label>Alvo (ex: nome do cron)</Label>
                <Input
                  value={form.target_key}
                  onChange={(e) => setForm({ ...form, target_key: e.target.value })}
                />
              </div>
              <div>
                <Label>Email de notificação</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.enabled}
                  onCheckedChange={(c) => setForm({ ...form, enabled: c })}
                />
                <Label>Ativa</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending || !form.name}>
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Regras</CardTitle>
        </CardHeader>
        <CardContent>
          {(rules.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma regra configurada.</p>
          ) : (
            <ul className="space-y-2">
              {(rules.data?.items ?? []).map((r: any) => (
                <li key={r.id} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <div className="font-medium">
                      {r.name}{" "}
                      <Badge variant={r.enabled ? "default" : "secondary"}>
                        {r.enabled ? "ativa" : "inativa"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.rule_type} · alvo: {r.target_key || "—"} · {r.threshold_mins ?? "—"}min /{" "}
                      {r.threshold_pct ?? "—"}%
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove.mutate(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de disparos</CardTitle>
        </CardHeader>
        <CardContent>
          {(events.data?.items ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem eventos.</p>
          ) : (
            <ul className="space-y-2">
              {(events.data?.items ?? []).map((e: any) => (
                <li key={e.id} className="flex items-center justify-between text-sm border-b pb-2">
                  <span>
                    <Badge variant={e.severity === "critical" ? "destructive" : "secondary"}>
                      {e.severity}
                    </Badge>{" "}
                    {e.message}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatDateTime(e.fired_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
