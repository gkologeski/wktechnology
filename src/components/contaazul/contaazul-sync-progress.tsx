// Painel presentacional de progresso da sincronização do Conta Azul.
// Componente puro: recebe estado por props, sem acesso a dados.
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  RefreshCw,
  TimerReset,
} from "lucide-react";


import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState, MetricCard, SectionHeader, StatusBadge } from "@/components/techhire/ui";
import { formatDateTime } from "@/lib/crm";
import { CA_ENTITIES, CA_ENTITY_LABELS, type CaEntity } from "@/lib/integrations/contaazul-map";

export type CaSyncStateRow = {
  entity: string;
  last_synced_at: string | null;
  imported_count: number | null;
  failed_count: number | null;
  last_error: string | null;
};

export type CaCronRun = {
  id: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  status: string | null;
  error: string | null;
  /** Origem do registro: execução do próprio workspace ou execução global. */
  scope?: "workspace" | "global";
  workspaces: number;
  imported: number;
  updated: number;
  failed: number;
};

export interface ContaAzulSyncProgressProps {
  syncState: CaSyncStateRow[];
  cronRuns: CaCronRun[];
  /** Sincronização manual em andamento. */
  running?: boolean;
  /** Atualização automática do painel ativa. */
  autoRefresh?: boolean;
  /** Requisição de status em andamento. */
  refreshing?: boolean;
}


function formatDuration(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${Math.round(s % 60)} s`;
}

export function ContaAzulSyncProgress({
  syncState,
  cronRuns,
  running = false,
  autoRefresh = false,
  refreshing = false,
}: ContaAzulSyncProgressProps) {

  const byEntity = new Map<string, CaSyncStateRow>(syncState.map((s) => [s.entity, s]));

  const totalImported = syncState.reduce((acc, s) => acc + (s.imported_count ?? 0), 0);
  const totalFailed = syncState.reduce((acc, s) => acc + (s.failed_count ?? 0), 0);
  const syncedEntities = syncState.filter((s) => !!s.last_synced_at).length;
  const lastSyncedAt = syncState
    .map((s) => s.last_synced_at)
    .filter((v): v is string => !!v)
    .sort()
    .at(-1);

  const neverSynced = syncedEntities === 0;

  return (
    <Card>
      <CardHeader className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Progresso da sincronização</CardTitle>
            <CardDescription>
              Situação por entidade e execuções automáticas. O agendador roda a cada 6 horas.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2" aria-live="polite">
            {running ? (
              <Badge variant="secondary" className="gap-1">
                <TimerReset className="h-3.5 w-3.5 animate-spin" />
                Sincronizando…
              </Badge>
            ) : null}
            {autoRefresh ? (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <RefreshCw
                  className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {refreshing ? "Atualizando…" : "Atualização automática"}
              </Badge>
            ) : null}
          </div>

        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Registros importados"
            value={totalImported.toLocaleString("pt-BR")}
            icon={Database}
            tone="neutral"
          />
          <MetricCard
            label="Registros com erro"
            value={totalFailed.toLocaleString("pt-BR")}
            icon={AlertTriangle}
            tone={totalFailed > 0 ? "negative" : "positive"}
          />
          <MetricCard
            label="Entidades sincronizadas"
            value={`${syncedEntities}/${CA_ENTITIES.length}`}
            icon={CheckCircle2}
            tone={syncedEntities === CA_ENTITIES.length ? "positive" : "warning"}
          />
          <MetricCard
            label="Última sincronização"
            value={lastSyncedAt ? formatDateTime(lastSyncedAt) : "—"}
            hint={lastSyncedAt ? undefined : "Nenhuma execução registrada"}
            icon={Clock}
            tone="neutral"
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <section className="space-y-3">
          <SectionHeader
            title="Por entidade"
            description="Contagem acumulada da última execução de cada entidade."
          />
          {neverSynced ? (
            <EmptyState
              compact
              icon={Database}
              title="Nenhuma sincronização ainda"
              description="Conecte o Conta Azul e clique em “Sincronizar agora”, ou use a importação por arquivo."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Entidade</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Registros</TableHead>
                    <TableHead className="text-right">Erros</TableHead>
                    <TableHead>Última sincronização</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {CA_ENTITIES.map((entity: CaEntity) => {
                    const s = byEntity.get(entity);
                    const failed = s?.failed_count ?? 0;
                    return (
                      <TableRow key={entity}>
                        <TableCell className="font-medium">{CA_ENTITY_LABELS[entity]}</TableCell>
                        <TableCell>
                          {!s?.last_synced_at ? (
                            <StatusBadge status="draft" label="Nunca sincronizado" />
                          ) : failed > 0 ? (
                            <Badge variant="destructive">Com erros</Badge>
                          ) : (
                            <StatusBadge status="open" label="Sincronizado" />
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {(s?.imported_count ?? 0).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {failed.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {s?.last_synced_at ? formatDateTime(s.last_synced_at) : "—"}
                        </TableCell>
                        <TableCell className="max-w-[16rem]">
                          {s?.last_error ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="block truncate text-xs text-destructive">
                                  {s.last_error}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm break-words">
                                {s.last_error}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <SectionHeader
            title="Execuções automáticas"
            description="Últimas execuções do agendador (a cada 6 horas)."
          />
          {cronRuns.length === 0 ? (
            <EmptyState
              compact
              icon={Clock}
              title="Nenhuma execução automática registrada"
              description="A primeira execução agendada acontece no próximo ciclo de 6 horas."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Início</TableHead>
                    <TableHead>Situação</TableHead>
                    <TableHead className="text-right">Duração</TableHead>
                    <TableHead className="text-right">Workspaces</TableHead>
                    <TableHead className="text-right">Importados</TableHead>
                    <TableHead className="text-right">Erros</TableHead>
                    <TableHead>Mensagem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cronRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="whitespace-nowrap">
                        {run.startedAt ? formatDateTime(run.startedAt) : "—"}
                      </TableCell>
                      <TableCell>
                        {run.status === "success" ? (
                          <StatusBadge status="open" label="Sucesso" />
                        ) : run.status === "running" ? (
                          <StatusBadge status="onhold" label="Em execução" />
                        ) : (
                          <Badge variant="destructive">Falha</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatDuration(run.durationMs)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{run.workspaces}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(run.imported + run.updated).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{run.failed}</TableCell>
                      <TableCell className="max-w-[16rem]">
                        {run.error ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="block truncate text-xs text-destructive">
                                {run.error}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm break-words">
                              {run.error}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
