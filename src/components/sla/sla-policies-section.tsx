import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Plus, Trash2, Zap } from "lucide-react";
import { confirmDialog } from "@/components/ui/confirm-dialog";
// (Dialog imports above already provide Dialog/DialogContent/etc.)
import {
  listSlaPolicies,
  upsertSlaPolicy,
  deleteSlaPolicy,
  listTicketPipelines,
  runSlaBreachCheck,
} from "@/lib/sla-policies.functions";

type Policy = Awaited<ReturnType<typeof listSlaPolicies>>[number];

const PRIORITY_LABEL: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

export function SlaPoliciesSection() {
  const qc = useQueryClient();
  const list = useServerFn(listSlaPolicies);
  const pipes = useServerFn(listTicketPipelines);
  const del = useServerFn(deleteSlaPolicy);
  const runCheck = useServerFn(runSlaBreachCheck);

  const policiesQ = useQuery({ queryKey: ["sla-policies"], queryFn: () => list() });
  const pipesQ = useQuery({ queryKey: ["sla-policies", "pipelines"], queryFn: () => pipes() });

  const [editing, setEditing] = useState<Policy | "new" | null>(null);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Políticas de SLA por prioridade/fila (tickets)</CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const r = await runCheck({});
              toast.success(
                `Checagem: ${r.first_response_breaches} 1ª resp + ${r.resolution_breaches} resolução`,
              );
              qc.invalidateQueries({ queryKey: ["sla-policies"] });
            }}
          >
            <Zap className="h-4 w-4 mr-1" /> Verificar agora
          </Button>
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4 mr-1" /> Nova política
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {policiesQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (policiesQ.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma política. Crie uma para que tickets ganhem prazos automáticos de primeira
            resposta e resolução.
          </p>
        ) : (
          <div className="divide-y">
            {(policiesQ.data ?? []).map((p) => {
              const pipeName = pipesQ.data?.find((x) => x.id === p.pipeline_id)?.name;
              return (
                <div key={p.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-1.5 mt-0.5">
                      <Badge variant="outline">
                        Fila: {pipeName ?? (p.pipeline_id ? "—" : "Todas")}
                      </Badge>
                      <Badge variant="outline">
                        Prioridade: {p.priority ? PRIORITY_LABEL[p.priority] : "Todas"}
                      </Badge>
                      <Badge variant="outline">1ª resp: {formatMins(p.first_response_mins)}</Badge>
                      <Badge variant="outline">Resolução: {formatMins(p.resolution_mins)}</Badge>
                      {!p.active && <Badge variant="secondary">Inativa</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if (!(await confirmDialog(`Excluir "${p.name}"?`))) return;
                        await del({ data: { id: p.id } });
                        toast.success("Política removida");
                        qc.invalidateQueries({ queryKey: ["sla-policies"] });
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <PolicyDialog
        open={editing !== null}
        initial={editing === "new" ? null : editing}
        pipelines={pipesQ.data ?? []}
        onClose={() => setEditing(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["sla-policies"] })}
      />
    </Card>
  );
}

function PolicyDialog({
  open,
  initial,
  pipelines,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: Policy | null;
  pipelines: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(upsertSlaPolicy);
  const [name, setName] = useState(initial?.name ?? "");
  const [pipelineId, setPipelineId] = useState<string>(initial?.pipeline_id ?? "");
  const [priority, setPriority] = useState<string>(initial?.priority ?? "");
  const [firstMins, setFirstMins] = useState<string>(String(initial?.first_response_mins ?? 60));
  const [resMins, setResMins] = useState<string>(String(initial?.resolution_mins ?? 1440));
  const [active, setActive] = useState<boolean>(initial?.active ?? true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setPipelineId(initial?.pipeline_id ?? "");
    setPriority(initial?.priority ?? "");
    setFirstMins(String(initial?.first_response_mins ?? 60));
    setResMins(String(initial?.resolution_mins ?? 1440));
    setActive(initial?.active ?? true);
  }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Editar política" : "Nova política de SLA"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: VIP — Urgente"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Fila (pipeline)</Label>
              <Select
                value={pipelineId || "all"}
                onValueChange={(v) => setPipelineId(v === "all" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {pipelines.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Prioridade</Label>
              <Select
                value={priority || "all"}
                onValueChange={(v) => setPriority(v === "all" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>1ª resposta (min)</Label>
              <Input
                type="number"
                min={1}
                value={firstMins}
                onChange={(e) => setFirstMins(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Resolução (min)</Label>
              <Input
                type="number"
                min={1}
                value={resMins}
                onChange={(e) => setResMins(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} id="sla-active" />
            <Label htmlFor="sla-active">Ativa</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={saving || !name.trim()}
            onClick={async () => {
              setSaving(true);
              try {
                await save({
                  data: {
                    id: initial?.id,
                    name: name.trim(),
                    pipeline_id: pipelineId || null,
                    priority: (priority || null) as "low" | "medium" | "high" | "urgent" | null,
                    first_response_mins: Math.max(1, Number(firstMins) || 60),
                    resolution_mins: Math.max(1, Number(resMins) || 1440),
                    active,
                  },
                });
                toast.success("Política salva");
                onSaved();
                onClose();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro ao salvar");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatMins(m: number): string {
  if (m < 60) return `${m}min`;
  const h = m / 60;
  if (h < 48) return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
  return `${Math.round(h / 24)}d`;
}
