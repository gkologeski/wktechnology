// Aba "Cobertura": coletado × importado × staging × pendente × ignorado × inacessível.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  EmptyState,
  MetricCard,
  SectionHeader,
  Skeletons,
  StatusBadge,
} from "@/components/techhire/ui";
import {
  getReconciliationOverview,
  refreshReconciliationIssues,
} from "@/lib/projects/reconciliation.functions";
import {
  ISSUE_TYPE_LABEL,
  formatSeconds,
  type IssueType,
} from "@/lib/projects/reconciliation-labels";

type Obj = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0)) || 0;
const fmtDate = (v: unknown) =>
  typeof v === "string"
    ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "—";

function sumBy(map: Obj | undefined, test: (k: string) => boolean) {
  return Object.entries(map ?? {}).reduce((s, [k, v]) => (test(k) ? s + num(v) : s), 0);
}

function ProviderCard({
  name,
  data,
  connection,
}: {
  name: string;
  data: Obj;
  connection: {
    status: string;
    access: string | null;
    lastTestedAt: string | null;
    hasKey: boolean;
  } | null;
}) {
  const staging = (data.staging ?? {}) as Obj;
  const links = (data.links ?? {}) as Obj;
  const collected = sumBy(staging, () => true);
  const imported = sumBy(links, () => true);
  const stagedOnly = sumBy(staging, (k) => k.endsWith(":staged"));
  const pending = sumBy(staging, (k) => k.endsWith(":pending_review"));
  const caps = (data.capabilities ?? {}) as Record<
    string,
    { status: string; count: number; detail: string | null }
  >;
  const forbidden = Object.entries(caps).filter(([, c]) => c.status === "forbidden");
  const notCollected = (data.not_collected ?? data.not_imported ?? []) as Array<{
    entity?: string;
    label?: string;
    reason: string;
  }>;
  const erp = num(data.erp_seconds);
  const src = num(data.source_seconds);
  const origin = data.origin_report as {
    finished_at: string;
    diffs: Array<{ userId: string; diff: number }>;
  } | null;
  const originDiff = (origin?.diffs ?? []).reduce((s, d) => s + num(d.diff), 0);
  return (
    <section
      className="space-y-4 rounded-lg border border-border-subtle bg-surface-2 p-5 shadow-xs"
      aria-label={`Cobertura do ${name}`}
    >
      <SectionHeader
        title={name}
        description={
          connection
            ? `Conexão: ${connection.hasKey ? "chave guardada" : "sem chave"} · último teste ${fmtDate(connection.lastTestedAt)}`
            : "Sem conexão configurada"
        }
        action={
          <StatusBadge
            status={connection?.status === "connected" ? "open" : "onhold"}
            label={connection?.status === "connected" ? "Conectado" : "Sem conexão ativa"}
          />
        }
      />
      <Alert>
        <AlertTriangle className="h-4 w-4" aria-hidden />
        <AlertTitle>Não conciliado com a origem nesta tela</AlertTitle>
        <AlertDescription>
          Os números comparam o ERP com o que foi coletado na importação. A origem não é consultada
          de novo aqui; nada é certificado.
        </AlertDescription>
      </Alert>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {[
          ["Coletados (bruto)", collected],
          ["Registros ligados ao ERP", imported],
          ["Só no staging", stagedOnly],
          ["Pendentes de revisão", pending],
          ["Inacessíveis (403)", forbidden.length],
        ].map(([label, value]) => (
          <div key={label as string}>
            <dt className="text-xs text-text-tertiary">{label}</dt>
            <dd className="text-sm font-medium tabular-nums text-text-primary">
              {num(value).toLocaleString("pt-BR")}
            </dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-2 text-sm md:grid-cols-3">
        <p>
          <span className="text-text-tertiary">ERP: </span>
          <span className="tabular-nums">{formatSeconds(erp)}</span>
        </p>
        <p>
          <span className="text-text-tertiary">Coletado: </span>
          <span className="tabular-nums">{formatSeconds(src)}</span>
        </p>
        <p>
          <span className="text-text-tertiary">Diferença: </span>
          <span className="tabular-nums">{formatSeconds(erp - src)}</span>
        </p>
      </div>
      {origin ? (
        <p className="text-sm text-text-secondary">
          Relatório de resumo da própria origem (prévia de {fmtDate(origin.finished_at)}):{" "}
          {origin.diffs.length === 0
            ? "sem diferença por pessoa."
            : `${origin.diffs.length} pessoas com diferença, total ${formatSeconds(originDiff)} entre coletado e informado pela origem.`}
        </p>
      ) : null}
      {forbidden.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-text-secondary">
            Dados que a origem recusou (403)
          </p>
          <ul className="mt-1 list-disc pl-5 text-xs text-text-secondary">
            {forbidden.map(([k]) => (
              <li key={k}>
                {k}: causa a verificar — pode ser plano, papel da chave ou recurso desativado na
                origem.
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {notCollected.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-text-secondary">Não trazidos para o ERP</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-text-secondary">
            {notCollected.map((n) => (
              <li key={n.entity ?? n.label}>
                {n.label ?? n.entity}: {n.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>
        <p className="text-xs font-medium text-text-secondary">Últimas execuções</p>
        <ul className="mt-1 space-y-0.5 text-xs text-text-secondary">
          {((data.runs ?? []) as Array<Obj>).slice(0, 5).map((r) => (
            <li key={String(r.id)}>
              {r.kind === "dry_run" ? "Prévia" : "Importação"} · {String(r.status)} ·{" "}
              {fmtDate(r.finished_at ?? r.started_at)}
              {r.has_error ? " · com erro" : ""}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function ReconOverviewTab({ onOpenIssues }: { onOpenIssues: () => void }) {
  const qc = useQueryClient();
  const get = useServerFn(getReconciliationOverview);
  const refresh = useServerFn(refreshReconciliationIssues);
  const q = useQuery({ queryKey: ["recon-overview"], queryFn: () => get() });
  const m = useMutation({
    mutationFn: () => refresh(),
    onSuccess: (r) => {
      toast.success(
        `Fila conferida: ${num((r as Obj).detected).toLocaleString("pt-BR")} alertas detectados.`,
      );
      void qc.invalidateQueries({ queryKey: ["recon-overview"] });
      void qc.invalidateQueries({ queryKey: ["recon-issues"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (q.isLoading) return <Skeletons.MetricsGrid count={4} />;
  if (q.isError || !q.data)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Não foi possível carregar a cobertura"
        description={(q.error as Error | null)?.message ?? "Tente novamente."}
        action={<Button onClick={() => void q.refetch()}>Tentar novamente</Button>}
      />
    );
  const ov = q.data.overview as Obj;
  const issues = (ov.issues ?? {}) as Record<string, { n: number; seconds: number }>;
  const erp = (ov.erp ?? {}) as Obj;
  const open = Object.entries(issues).filter(
    ([k]) => k.endsWith(":open") || k.endsWith(":deferred"),
  );
  const byType = new Map<string, { n: number; seconds: number }>();
  for (const [k, v] of open) {
    const t = k.split(":")[0];
    const cur = byType.get(t) ?? { n: 0, seconds: 0 };
    byType.set(t, { n: cur.n + num(v.n), seconds: cur.seconds + num(v.seconds) });
  }
  const dismissed = Object.entries(issues).reduce(
    (s, [k, v]) => (k.endsWith(":dismissed") ? s + num(v.n) : s),
    0,
  );
  const last = ov.last_refresh as { finished_at: string } | null;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Apontamentos no ERP"
          value={num(erp.entries).toLocaleString("pt-BR")}
          hint={`${num(erp.entries_with_person).toLocaleString("pt-BR")} com pessoa · ${num(erp.entries_with_allocation)} com alocação`}
        />
        <MetricCard
          label="Projetos com empresa"
          value={`${num(erp.projects_with_company)} de ${num(erp.projects)}`}
          hint="Vínculo canônico ao cadastro de empresas"
        />
        <MetricCard
          label="Registros com alerta aberto"
          value={num(ov.issue_entries_open).toLocaleString("pt-BR")}
          hint="Registros únicos; um registro pode ter vários alertas"
          tone={num(ov.issue_entries_open) > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Fila conferida em"
          value={last ? fmtDate(last.finished_at) : "Nunca"}
          hint={`Gerado em ${fmtDate(ov.generated_at)}`}
        />
      </div>
      <section className="space-y-3 rounded-lg border border-border-subtle bg-surface-2 p-5 shadow-xs">
        <SectionHeader
          title="Alertas abertos por tipo"
          description={`Os tipos não somam registros únicos: o mesmo apontamento pode estar em mais de um. ${dismissed.toLocaleString("pt-BR")} descartados com justificativa.`}
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => m.mutate()} disabled={m.isPending}>
                <RefreshCw
                  className={m.isPending ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"}
                  aria-hidden
                />
                Conferir agora
              </Button>
              <Button size="sm" onClick={onOpenIssues}>
                Abrir pendências
              </Button>
            </div>
          }
        />
        {byType.size === 0 ? (
          <EmptyState
            compact
            title={last ? "Nenhum alerta aberto" : "A fila ainda não foi conferida"}
            description={last ? "Tudo conferido." : "Use “Conferir agora” para montar a fila."}
          />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {[...byType.entries()]
              .sort((a, b) => b[1].n - a[1].n)
              .map(([t, v]) => (
                <li
                  key={t}
                  className="flex items-center justify-between rounded-md border border-border-subtle bg-surface-1 px-3 py-2 text-sm"
                >
                  <span>{ISSUE_TYPE_LABEL[t as IssueType] ?? t}</span>
                  <span className="tabular-nums text-text-secondary">
                    {v.n.toLocaleString("pt-BR")} · {formatSeconds(v.seconds)}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>
      <div className="grid gap-4 xl:grid-cols-2">
        <ProviderCard
          name="Clockify"
          data={(ov.clockify ?? {}) as Obj}
          connection={q.data.connections.clockify}
        />
        <ProviderCard
          name="Jibble"
          data={(ov.jibble ?? {}) as Obj}
          connection={q.data.connections.jibble}
        />
      </div>
    </div>
  );
}
