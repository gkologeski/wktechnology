// Operação do TechProjects (somente administrador ativo): agendamentos, filas e saúde.
// Leitura pura: nada é agendado, reprocessado ou reenviado a partir desta tela.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  MetricCard,
  PageHeader,
  SectionHeader,
  Skeletons,
  StatusBadge,
} from "@/components/techhire/ui";
import { getProjectsOps } from "@/lib/projects/ops.functions";
import { OPS_JOB_LABEL, type OpsJob } from "@/lib/projects/ops.types";

const fmt = (v: string | null | undefined) => (v ? new Date(v).toLocaleString("pt-BR") : "—");

const IMPORT_STATUS_LABEL: Record<string, string> = {
  queued: "Na fila",
  pending: "Pendente",
  running: "Em execução",
  paused: "Pausada",
  completed: "Concluída",
  completed_with_errors: "Concluída com erros",
  failed: "Falhou",
  cancelled: "Cancelada",
  canceled: "Cancelada",
};

function jobBadge(j: OpsJob) {
  if (!j.scheduled)
    return (
      <StatusBadge
        status="draft"
        label={OPS_JOB_LABEL[j.name]?.optional ? "Não agendado (opcional)" : "Não agendado"}
      />
    );
  if (!j.active) return <StatusBadge status="onhold" label="Pausado" />;
  const st = j.last_run?.status ?? j.last_log?.status;
  if (st && /fail|error/i.test(st))
    return <StatusBadge status="closed" label="Última execução falhou" />;
  return <StatusBadge status="open" label="Agendado" />;
}

export function ProjectsOpsPage() {
  const get = useServerFn(getProjectsOps);
  const q = useQuery({
    queryKey: ["projects-ops"],
    queryFn: () => get(),
    refetchInterval: 60_000,
    retry: false,
  });
  const d = q.data;
  const dd = d?.queues.deal_delivery;
  const wh = d?.queues.webhooks.by_status ?? {};
  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        eyebrow="TechProjects · Configurações"
        title="Operação e saúde"
        description="Agendamentos, filas e últimas execuções do workspace. Somente leitura; metas de disponibilidade e recuperação dependem de configuração e observação operacional."
        secondaryActions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => void q.refetch()}
            disabled={q.isFetching}
          >
            <RefreshCw
              className={q.isFetching ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"}
              aria-hidden
            />
            Atualizar
          </Button>
        }
      />
      {q.isLoading && <Skeletons.MetricsGrid />}
      {q.isError && (
        <EmptyState
          title="Não foi possível carregar a operação"
          description={`${(q.error as Error).message} Apenas administradores ativos do workspace veem esta tela.`}
          action={
            <Button size="sm" onClick={() => void q.refetch()}>
              Tentar de novo
            </Button>
          }
        />
      )}
      {d && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Entregas pendentes"
              value={String(dd?.by_status.pending ?? 0)}
              hint={`Mais antiga: ${fmt(dd?.oldest_pending)}`}
            />
            <MetricCard
              label="Entregas com falha"
              value={String(dd?.by_status.failed ?? 0)}
              hint={`Locks vencidos: ${dd?.expired_leases ?? 0}`}
            />
            <MetricCard
              label="Webhooks pendentes/falha"
              value={String((wh.pending ?? 0) + (wh.failed ?? 0))}
              hint={`Descartados: ${wh.dead ?? 0}`}
            />
            <MetricCard
              label="Avaliações de alertas"
              value={String(d.queues.alerts.runs)}
              hint={`Última: ${fmt(d.queues.alerts.last_run)}`}
            />
          </div>
          <section className="space-y-3">
            <SectionHeader
              title="Agendamentos"
              description={`Gerado em ${fmt(d.generated_at)}. "Não agendado" não é falha quando o recurso é opcional.`}
            />
            <ul className="divide-y divide-border rounded-md border border-border">
              {d.jobs.map((j) => (
                <li key={j.name} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{OPS_JOB_LABEL[j.name]?.label ?? j.name}</p>
                    <p className="text-muted-foreground">{OPS_JOB_LABEL[j.name]?.purpose}</p>
                  </div>
                  <span className="text-muted-foreground">{j.schedule ?? "—"}</span>
                  <span className="text-muted-foreground">
                    Última: {fmt(j.last_run?.started_at ?? j.last_log?.started_at)}
                  </span>
                  {jobBadge(j)}
                </li>
              ))}
            </ul>
          </section>
          <section className="space-y-3">
            <SectionHeader title="Importações recentes" />
            {d.queues.imports.length === 0 ? (
              <EmptyState compact title="Nenhuma importação registrada" />
            ) : (
              <ul className="divide-y divide-border rounded-md border border-border">
                {d.queues.imports.map((r, i) => (
                  <li key={i} className="flex flex-wrap gap-3 p-3 text-sm">
                    <span className="font-medium">{IMPORT_STATUS_LABEL[r.status] ?? r.status}</span>
                    <span className="text-muted-foreground">Início {fmt(r.started_at)}</span>
                    <span className="text-muted-foreground">Fim {fmt(r.finished_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="space-y-2">
            <SectionHeader
              title="Verificação externa"
              description="Endpoints sem dados pessoais para monitoramento: /api/public/health (servidor) e /api/public/health/ready (banco)."
            />
          </section>
        </>
      )}
    </div>
  );
}
