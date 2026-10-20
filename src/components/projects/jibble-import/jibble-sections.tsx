// Blocos visuais do importador Jibble. Apenas apresentação: recebem dados e callbacks.
import { useState } from "react";
import { AlertTriangle, KeyRound, PlugZap, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, FormSection, MetricCard, StatusBadge } from "@/components/techhire/ui";
import {
  JB_CAPABILITY_LABEL,
  JB_CONN_LABEL,
  JB_PHASE_LABEL,
  JB_RUN_KIND_LABEL,
  hours,
  jbPhaseProgress,
} from "@/lib/integrations/jibble/jibble-format";
import {
  JB_ACCESS_LABEL,
  JB_ENTITY_LABEL,
  JB_REASON_LABEL,
  canReadWholeOrg,
  type JbAccess,
} from "@/lib/integrations/jibble/jibble-map";
import { RUN_STATUS_LABEL, toneFor } from "@/lib/integrations/clockify/clockify-format";

export type JbConnectionView = {
  configured: boolean;
  clientIdMasked: string | null;
  secretMasked: string | null;
  status: string;
  lastError: string | null;
  lastTestedAt: string | null;
  org: {
    id: string;
    name: string | null;
    role: string | null;
    access: JbAccess;
    confirmedAt: string | null;
  } | null;
};

export type JbRunView = {
  id: string;
  kind: string;
  status: string;
  phase: string;
  error: string | null;
  created_at: string;
  finished_at: string | null;
  preview_confirmed_at: string | null;
  target_run_id: string | null;
  counts: Record<string, unknown> | null;
  report: Record<string, unknown> | null;
};

const fmt = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("pt-BR") : "—");

export function JbAccessBadge({ access }: { access: JbAccess | null }) {
  const a = access ?? "unknown";
  return (
    <StatusBadge
      status={canReadWholeOrg(a) ? "open" : a === "not_admin" ? "closed" : "onhold"}
      label={JB_ACCESS_LABEL[a]}
    />
  );
}

export function JbConnectionSection({
  conn,
  encryptionReady,
  busy,
  onSave,
  onTest,
  onRemove,
}: {
  conn: JbConnectionView;
  encryptionReady: boolean;
  busy: boolean;
  onSave: (v: { clientId: string; clientSecret: string }) => void;
  onTest: () => void;
  onRemove: () => void;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const canSave = clientId.trim().length >= 8 && clientSecret.trim().length >= 8;
  return (
    <FormSection
      title="1. Conexão com o Jibble"
      description="Client ID e Client Secret ficam cifrados no servidor. Nunca voltam para o navegador nem aparecem em registros."
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge
          status={toneFor(conn.status)}
          label={JB_CONN_LABEL[conn.status] ?? conn.status}
        />
        {conn.clientIdMasked && (
          <span className="inline-flex items-center gap-1 text-text-secondary">
            <KeyRound className="h-3.5 w-3.5" aria-hidden /> Client ID {conn.clientIdMasked} ·
            Secret {conn.secretMasked}
          </span>
        )}
        {conn.lastTestedAt && (
          <span className="text-text-tertiary">Testado em {fmt(conn.lastTestedAt)}</span>
        )}
      </div>
      {!encryptionReady && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Cifragem indisponível</AlertTitle>
          <AlertDescription>
            O servidor está sem a chave de cifragem; as credenciais não podem ser salvas.
          </AlertDescription>
        </Alert>
      )}
      {conn.lastError && conn.status === "failed" && (
        <Alert variant="destructive" role="alert">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>O teste falhou</AlertTitle>
          <AlertDescription>{conn.lastError}</AlertDescription>
        </Alert>
      )}
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ clientId, clientSecret });
          setClientId("");
          setClientSecret("");
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="jb-client-id">Client ID</Label>
          <Input
            id="jb-client-id"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder={
              conn.configured ? "Preencha os dois campos para trocar" : "Cole o Client ID"
            }
            aria-describedby="jb-help"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="jb-client-secret">Client Secret</Label>
          <Input
            id="jb-client-secret"
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={
              conn.configured ? "Preencha os dois campos para trocar" : "Cole o Client Secret"
            }
            aria-describedby="jb-help"
          />
        </div>
        <p id="jb-help" className="text-xs text-text-tertiary md:col-span-2">
          No Jibble, o proprietário cria as credenciais em Organization Settings › API Credentials.
          O importador só faz consultas: nada é alterado nem excluído no Jibble.
        </p>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button type="submit" disabled={busy || !encryptionReady || !canSave}>
            <ShieldCheck className="mr-1.5 h-4 w-4" aria-hidden /> Salvar
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !conn.configured}
            onClick={onTest}
          >
            <PlugZap className="mr-1.5 h-4 w-4" aria-hidden /> Testar (somente leitura)
          </Button>
          {conn.configured && (
            <Button type="button" variant="ghost" disabled={busy} onClick={onRemove}>
              Remover credenciais
            </Button>
          )}
        </div>
      </form>
    </FormSection>
  );
}

export function JbOrgSection({
  conn,
  busy,
  onConfirm,
}: {
  conn: JbConnectionView;
  busy: boolean;
  onConfirm: (orgId: string) => void;
}) {
  const org = conn.org;
  return (
    <FormSection
      title="2. Organização de origem"
      description="Confira o nome e o ID mostrados pelo Jibble antes de confirmar. A permissão é comprovada pelo papel de quem criou as credenciais."
    >
      {!org ? (
        <EmptyState
          compact
          title="Nenhuma organização ainda"
          description="Salve as credenciais e clique em Testar."
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{org.name ?? "Sem nome"}</span>
            <JbAccessBadge access={org.access} />
            {org.role && <span className="text-text-tertiary">papel no Jibble: {org.role}</span>}
            {org.confirmedAt && (
              <StatusBadge status="open" label={`Confirmada em ${fmt(org.confirmedAt)}`} />
            )}
          </div>
          <div className="font-mono text-xs text-text-secondary">ID {org.id}</div>
          {!canReadWholeOrg(org.access) && (
            <Alert role="alert">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Prévia bloqueada</AlertTitle>
              <AlertDescription>
                As credenciais não comprovaram papel de proprietário ou administrador. Peça ao
                proprietário para criar as credenciais e teste de novo.
              </AlertDescription>
            </Alert>
          )}
          {!org.confirmedAt && (
            <Button
              size="sm"
              disabled={busy || !canReadWholeOrg(org.access)}
              onClick={() => onConfirm(org.id)}
            >
              Confirmar esta organização
            </Button>
          )}
        </div>
      )}
    </FormSection>
  );
}

export function JbRunProgress({
  run,
  busy,
  onState,
}: {
  run: JbRunView;
  busy: boolean;
  onState: (a: "pause" | "resume" | "cancel") => void;
}) {
  const c = (run.counts ?? {}) as {
    requests?: number;
    retries?: number;
    inventory?: Record<string, { count: number }>;
  };
  const inv = c.inventory ?? {};
  const total = Object.values(inv).reduce((a, x) => a + (x?.count ?? 0), 0);
  return (
    <div className="space-y-3 rounded-lg border border-border-subtle p-4" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{JB_RUN_KIND_LABEL[run.kind] ?? run.kind}</span>
        <StatusBadge
          status={toneFor(run.status)}
          label={RUN_STATUS_LABEL[run.status] ?? run.status}
        />
        <span className="text-text-secondary">{JB_PHASE_LABEL[run.phase] ?? run.phase}</span>
      </div>
      <Progress value={jbPhaseProgress(run.kind, run.phase)} aria-label="Progresso por fase" />
      <div className="text-xs text-text-secondary">
        {total.toLocaleString("pt-BR")} registros lidos ·{" "}
        {(c.requests ?? 0).toLocaleString("pt-BR")} requisições ·{" "}
        {(c.retries ?? 0).toLocaleString("pt-BR")} novas tentativas (429/5xx)
      </div>
      {run.error && <p className="text-xs text-warning">{run.error}</p>}
      <div className="flex flex-wrap gap-2">
        {run.status === "paused" || run.status === "failed" ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onState("resume")}>
            Retomar
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onState("pause")}>
            Pausar
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => onState("cancel")}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

type Report = {
  inventory?: Record<string, { count: number; capability: string; status?: number | null }>;
  totals?: {
    workSeconds: number;
    paidBreakSeconds: number;
    unpaidBreakSeconds: number;
    openIntervals: number;
    intervals: number;
  };
  pending?: Record<string, number>;
  anomalies?: Record<string, number>;
  duplicates?: { exact: number; overlap: number };
  reconcile?: { matchedDays: number; divergentDays: number; daysWithoutTimesheet: number } | null;
  importTotals?: Record<string, number> | null;
  rollback?: Record<string, number> | null;
  notImported?: Array<{ entity: string; reason: string }>;
};

export function JbReport({ report }: { report: Report }) {
  const t = report.totals;
  const reasons = { ...(report.pending ?? {}), ...(report.anomalies ?? {}) };
  return (
    <div className="space-y-5">
      {t && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Horas trabalhadas (eventos)" value={hours(t.workSeconds)} />
          <MetricCard
            label="Pausas pagas / não pagas"
            value={`${hours(t.paidBreakSeconds)} / ${hours(t.unpaidBreakSeconds)}`}
          />
          <MetricCard
            label="Intervalos abertos (sem saída)"
            value={t.openIntervals.toLocaleString("pt-BR")}
          />
          <MetricCard
            label="Possíveis duplicidades entre fontes"
            value={`${report.duplicates?.exact ?? 0} exatas · ${report.duplicates?.overlap ?? 0} parciais`}
          />
        </div>
      )}
      {report.reconcile && (
        <p className="text-sm text-text-secondary">
          Conciliação com timesheets do Jibble:{" "}
          {report.reconcile.matchedDays.toLocaleString("pt-BR")} dias batem,{" "}
          {report.reconcile.divergentDays.toLocaleString("pt-BR")} divergem e{" "}
          {report.reconcile.daysWithoutTimesheet.toLocaleString("pt-BR")} sem timesheet. Timesheets
          são só referência: nunca somam com os eventos.
        </p>
      )}
      {report.importTotals && (
        <p className="text-sm text-text-secondary">
          Gravado: {report.importTotals.inserted ?? 0} apontamentos,{" "}
          {report.importTotals.projectsCreated ?? 0} projetos,{" "}
          {report.importTotals.tasksCreated ?? 0} tarefas;{" "}
          {report.importTotals.matchedExisting ?? 0} ligados a apontamentos existentes;{" "}
          {report.importTotals.errors ?? 0} erros.
        </p>
      )}
      {report.rollback && (
        <p className="text-sm text-text-secondary">
          Desfeito: {report.rollback.entries ?? 0} apontamentos, {report.rollback.tasks ?? 0}{" "}
          tarefas, {report.rollback.projects ?? 0} projetos, {report.rollback.members ?? 0} membros;{" "}
          {report.rollback.kept ?? 0} mantidos por terem sido alterados ou usados no ERP.
        </p>
      )}
      <div className="overflow-auto rounded-md border border-border-subtle">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Inventário</TableHead>
              <TableHead className="text-right">Registros</TableHead>
              <TableHead>Situação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(report.inventory ?? {}).map(([k, v]) => (
              <TableRow key={k}>
                <TableCell>{JB_ENTITY_LABEL[k] ?? k}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {v.count.toLocaleString("pt-BR")}
                </TableCell>
                <TableCell>
                  <StatusBadge
                    status={v.capability === "ok" ? "open" : "onhold"}
                    label={`${JB_CAPABILITY_LABEL[v.capability] ?? v.capability}${v.status ? ` (${v.status})` : ""}`}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {Object.keys(reasons).length > 0 && (
        <div className="space-y-1 text-sm">
          <div className="font-medium">Para revisão</div>
          <ul className="list-inside list-disc text-text-secondary">
            {Object.entries(reasons).map(([k, n]) => (
              <li key={k}>
                {JB_REASON_LABEL[k] ?? k}: {n.toLocaleString("pt-BR")}
              </li>
            ))}
          </ul>
        </div>
      )}
      {report.notImported && (
        <div className="space-y-1 text-sm">
          <div className="font-medium">
            Não importado para o TechProjects (preservado no staging privado)
          </div>
          <ul className="list-inside list-disc text-text-secondary">
            {report.notImported.map((n) => (
              <li key={n.entity}>
                <span className="text-foreground">{n.entity}:</span> {n.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function JbRunsHistory({
  runs,
  busy,
  onRollback,
}: {
  runs: JbRunView[];
  busy: boolean;
  onRollback: (runId: string) => void;
}) {
  if (!runs.length) return <EmptyState compact title="Nenhuma execução ainda" />;
  return (
    <div className="overflow-auto rounded-md border border-border-subtle">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Execução</TableHead>
            <TableHead>Situação</TableHead>
            <TableHead>Início</TableHead>
            <TableHead>Fim</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                {JB_RUN_KIND_LABEL[r.kind] ?? r.kind}
                {r.preview_confirmed_at && (
                  <div className="text-xs text-text-tertiary">
                    Conferida em {fmt(r.preview_confirmed_at)}
                  </div>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge
                  status={toneFor(r.status)}
                  label={RUN_STATUS_LABEL[r.status] ?? r.status}
                />
              </TableCell>
              <TableCell className="text-xs tabular-nums">{fmt(r.created_at)}</TableCell>
              <TableCell className="text-xs tabular-nums">{fmt(r.finished_at)}</TableCell>
              <TableCell className="text-right">
                {r.kind === "import" && ["completed", "failed", "cancelled"].includes(r.status) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => onRollback(r.id)}
                  >
                    Desfazer
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export type JbDuplicateRow = {
  id: string;
  externalId: string;
  segment: number;
  existingSource: string | null;
  overlapSeconds: number;
  kind: "exact" | "overlap";
  decision: "pending" | "same_event" | "distinct";
  existing: {
    entry_date: string | null;
    start_time: string | null;
    end_time: string | null;
    duration_minutes: number | null;
  } | null;
};

const DUP_LABEL = {
  pending: "Pendente",
  same_event: "Mesmo evento",
  distinct: "Eventos diferentes",
} as const;

export function JbDuplicatesTable({
  rows,
  busy,
  onDecide,
}: {
  rows: JbDuplicateRow[];
  busy: boolean;
  onDecide: (id: string, d: "same_event" | "distinct" | "pending") => void;
}) {
  if (!rows.length)
    return (
      <EmptyState
        compact
        title="Sem possíveis duplicidades"
        description="Nada do Jibble cruza com apontamentos de outras fontes."
      />
    );
  return (
    <div className="overflow-auto rounded-md border border-border-subtle">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Apontamento existente</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Cruzamento</TableHead>
            <TableHead>Decisão</TableHead>
            <TableHead className="min-w-[16rem] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-xs tabular-nums">
                {r.existing
                  ? `${r.existing.entry_date} ${r.existing.start_time ?? ""}–${r.existing.end_time ?? ""}`
                  : "Removido do ERP"}
                <div className="font-mono text-[11px] text-text-tertiary">
                  Jibble {r.externalId.slice(0, 8)}… trecho {r.segment}
                </div>
              </TableCell>
              <TableCell>{r.existingSource ?? "—"}</TableCell>
              <TableCell className="text-xs">
                {r.kind === "exact" ? "Mesmo intervalo" : "Sobreposição"} ·{" "}
                {hours(r.overlapSeconds)}
              </TableCell>
              <TableCell>
                <StatusBadge
                  status={r.decision === "pending" ? "onhold" : "open"}
                  label={DUP_LABEL[r.decision]}
                />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-wrap justify-end gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onDecide(r.id, "same_event")}
                  >
                    É o mesmo evento
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => onDecide(r.id, "distinct")}
                  >
                    São diferentes
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
