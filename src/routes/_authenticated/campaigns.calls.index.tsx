import {
  callCampaignStatusLabel,
  canCancelCallCampaign,
  canDeleteCallCampaign,
  canEditCallCampaign,
  estimateCallPace,
  type CallCampaignStats,
  type DialingWindow,
} from "@/lib/prospecting/calls/status-label";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Play, Pause, Trash2, Pencil, Copy, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  listCampaigns,
  upsertCampaign,
  deleteCampaign,
  setCampaignStatus,
  duplicateCampaign,
  type Campaign,
} from "@/lib/prospecting-campaigns.functions";

export const Route = createFileRoute("/_authenticated/campaigns/calls/")({
  head: () => ({ meta: [{ title: "Campanhas de Ligação — TechSales" }] }),
  component: CampaignsListPage,
});

function CampaignsListPage() {
  const listFn = useServerFn(listCampaigns);
  const saveFn = useServerFn(upsertCampaign);
  const delFn = useServerFn(deleteCampaign);
  const statusFn = useServerFn(setCampaignStatus);
  const { canAny } = usePermissions();
  const canCreate = canAny([
    "techsales.marketing.campaigns.create.own",
    "techsales.marketing.campaigns.create.team",
    "techsales.marketing.campaigns.create.workspace",
  ]);

  const has = (a: string) =>
    canAny(["own", "team", "workspace"].map((sc) => `techsales.marketing.campaigns.${a}.${sc}`));
  const canUpdate = has("update");
  const canDelete = has("delete");
  const canManage = has("manage");
  const dupFn = useServerFn(duplicateCampaign);
  const run = async (kind: Action, c: Campaign) => {
    try {
      if (kind === "start") {
        await statusFn({ data: { id: c.id, status: "running" } });
        toast.success("Campanha iniciada");
      } else if (kind === "pause") {
        await statusFn({ data: { id: c.id, status: "paused" } });
        toast.success("Campanha pausada");
      } else if (kind === "cancel") {
        if (
          !(await confirmDialog(
            `Encerrar "${c.name}"? As ligações ainda na fila não serão feitas. A campanha fica como Cancelada.`,
          ))
        )
          return;
        await statusFn({ data: { id: c.id, status: "canceled" } });
        toast.success("Campanha encerrada");
      } else if (kind === "duplicate") {
        const out = await dupFn({ data: { id: c.id } });
        toast.success("Cópia criada como rascunho");
        navigate({ to: "/campaigns/calls/$id", params: { id: out.id } });
        return;
      } else if (kind === "delete") {
        if (
          !(await confirmDialog(
            `Excluir "${c.name}"${c.stats ? ` (${c.stats.total} tentativas)` : ""}? As ligações já feitas continuam registradas nas fichas.`,
          ))
        )
          return;
        await delFn({ data: { id: c.id } });
        toast.success("Campanha excluída");
      }
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir a ação.");
    }
  };
  const navigate = useNavigate();

  const [rows, setRows] = useState<Campaign[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const refresh = async () => setRows(await listFn());
  useEffect(() => {
    refresh(); /* eslint-disable-next-line */
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    try {
      const out = await saveFn({
        data: {
          name: name.trim(),
          assignment_mode: "weighted",
          max_attempts: 3,
          retry_interval_minutes: 240,
          source_type: "manual",
          source_ref: null,
          lead_ids: [],
          dialing_window: {
            start: "09:00",
            end: "18:00",
            timezone: "America/Sao_Paulo",
            days: [1, 2, 3, 4, 5],
          },
          variants: [],
        },
      });
      toast.success("Campanha criada");
      setOpen(false);
      setName("");
      await refresh();
      window.location.href = `/campaigns/calls/${out.id}`;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <div>
      <PageHeader
        title="Campanhas de Ligação"
        description="Ligações automáticas com o agente de voz e teste A/B de roteiros."
      />
      <div className="flex justify-end gap-2 mb-3">
        <Button variant="outline" asChild>
          <Link to="/campaigns/calls/scripts">Roteiros de ligação</Link>
        </Button>
        <Button onClick={() => setOpen(true)} disabled={!canCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nova campanha
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma campanha ainda.</p>
          )}
          <div className="divide-y">
            {rows.map((c) => (
              <div key={c.id} className="py-2 flex items-center justify-between gap-3">
                <Link to="/campaigns/calls/$id" params={{ id: c.id }} className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(c.audience_config as { state?: { base?: string } } | null)?.state?.base ===
                    "contacts"
                      ? "Contatos"
                      : `${c.lead_ids?.length ?? 0} leads`}{" "}
                    · {c.assignment_mode === "weighted" ? "A/B por peso" : "Por segmento"}
                  </div>
                  {c.stats && (
                    <div className="text-xs text-muted-foreground">
                      {c.stats.done} realizadas · {c.stats.failed} sem sucesso · {c.stats.pending}{" "}
                      pendentes · {c.stats.total} tentativas
                      {c.stats.startedAt &&
                        ` · iniciou em ${new Date(c.stats.startedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
                    </div>
                  )}
                  <CallPaceLine c={c} />
                </Link>
                <Badge
                  variant={
                    c.status === "running"
                      ? "default"
                      : c.status === "paused"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {callCampaignStatusLabel(c.status)}
                </Badge>
                <CampaignActions
                  c={c}
                  canCreate={canCreate}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  canManage={canManage}
                  run={run}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova campanha</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={create}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type Action = "start" | "pause" | "cancel" | "duplicate" | "delete";

function CampaignActions({
  c,
  canCreate,
  canUpdate,
  canDelete,
  canManage,
  run,
}: {
  c: Campaign;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canManage: boolean;
  run: (k: Action, c: Campaign) => Promise<void>;
}) {
  const editable = canEditCallCampaign(c.status);
  const deletable = canDeleteCallCampaign(c.status);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {editable && canUpdate ? (
        <Button size="sm" variant="outline" asChild>
          <Link to="/campaigns/calls/$id" params={{ id: c.id }}>
            <Pencil className="h-3.5 w-3.5 mr-1" />
            Editar
          </Link>
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled
          title={
            editable
              ? "Sem permissão para editar"
              : "Só é possível editar campanhas em rascunho ou pausadas"
          }
        >
          <Pencil className="h-3.5 w-3.5 mr-1" />
          Editar
        </Button>
      )}
      <Button size="sm" variant="outline" disabled={!canCreate} onClick={() => run("duplicate", c)}>
        <Copy className="h-3.5 w-3.5 mr-1" />
        Duplicar
      </Button>
      {c.status === "running" ? (
        <Button size="sm" variant="outline" disabled={!canManage} onClick={() => run("pause", c)}>
          <Pause className="h-3.5 w-3.5 mr-1" />
          Pausar
        </Button>
      ) : c.status !== "done" && c.status !== "canceled" ? (
        <Button size="sm" variant="outline" disabled={!canManage} onClick={() => run("start", c)}>
          <Play className="h-3.5 w-3.5 mr-1" />
          {c.status === "paused" ? "Retomar" : "Iniciar"}
        </Button>
      ) : null}
      {canCancelCallCampaign(c.status) && (
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Encerrar campanha ${c.name}`}
          title="Encerrar campanha"
          disabled={!canManage}
          onClick={() => run("cancel", c)}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Excluir campanha ${c.name}`}
        title={deletable ? "Excluir campanha" : "Pause a campanha antes de excluir"}
        disabled={!canDelete || !deletable}
        onClick={() => run("delete", c)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

function fmtPace(d: Date, withTime: boolean): string {
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

function CallPaceLine({
  c,
}: {
  c: { status: string; stats?: CallCampaignStats | null; dialing_window?: unknown };
}) {
  if (c.status !== "running" && c.status !== "paused") return null;
  const pace = estimateCallPace({
    status: c.status,
    pending: c.stats?.pending ?? 0,
    nextAt: c.stats?.nextAt ?? null,
    window: (c.dialing_window as DialingWindow | null) ?? null,
    now: new Date(),
  });
  return (
    <div className="text-xs text-muted-foreground">
      {pace.kind === "estimate"
        ? `Estimativa: próxima ligação ${fmtPace(pace.nextAt, true)} · término ${fmtPace(pace.endAt, false)}`
        : pace.label}
    </div>
  );
}
