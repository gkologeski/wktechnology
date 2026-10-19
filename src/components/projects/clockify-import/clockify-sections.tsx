// Blocos visuais do importador Clockify. Apenas apresentação: recebem dados e callbacks.
import { useState } from "react";
import { AlertTriangle, KeyRound, PlugZap, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, FormSection, MetricCard, SectionHeader, StatusBadge } from "@/components/techhire/ui";
import {
  CAPABILITY_LABEL,
  ENTITY_LABEL,
  PHASE_LABEL,
  RUN_KIND_LABEL,
  RUN_STATUS_LABEL,
  formatMoney,
  formatSeconds,
} from "@/lib/integrations/clockify/clockify-format";
import { ENTRY_REASON_LABEL } from "@/lib/integrations/clockify/clockify-map";
import { CLOCKIFY_REGIONS, CLOCKIFY_REGION_LABEL } from "@/lib/integrations/clockify/clockify-urls";

type Tone = "open" | "onhold" | "closed" | "draft";

export function toneFor(status: string): Tone {
  if (["connected", "completed"].includes(status)) return "open";
  if (["failed", "cancelled"].includes(status)) return "closed";
  if (["running", "queued", "connecting", "paused", "cancel_requested", "configured"].includes(status)) return "onhold";
  return "draft";
}

const CONN_LABEL: Record<string, string> = {
  not_configured: "Não configurado",
  configured: "Chave salva, não testada",
  connecting: "Testando…",
  connected: "Conectado",
  failed: "Falha na conexão",
  disabled: "Desativado",
};

export type ConnectionView = {
  configured: boolean;
  keyMasked: string | null;
  region: string;
  subdomain: string | null;
  status: string;
  lastError: string | null;
  lastTestedAt: string | null;
  source: { id: string; name: string | null; plan: string | null } | null;
};

export function ConnectionSection({
  conn,
  encryptionReady,
  busy,
  onSave,
  onTest,
  onRemove,
}: {
  conn: ConnectionView;
  encryptionReady: boolean;
  busy: boolean;
  onSave: (v: { apiKey?: string; region: string; subdomain: string | null }) => void;
  onTest: () => void;
  onRemove: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [region, setRegion] = useState(conn.region);
  const [subdomain, setSubdomain] = useState(conn.subdomain ?? "");
  return (
    <FormSection
      title="1. Conexão com o Clockify"
      description="A chave fica cifrada no servidor. Ela nunca volta para o navegador nem aparece em registros."
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge status={toneFor(conn.status)} label={CONN_LABEL[conn.status] ?? conn.status} />
        {conn.keyMasked && (
          <span className="inline-flex items-center gap-1 text-text-secondary">
            <KeyRound className="h-3.5 w-3.5" aria-hidden /> Chave {conn.keyMasked}
          </span>
        )}
        {conn.lastTestedAt && (
          <span className="text-text-tertiary">
            Testado em {new Date(conn.lastTestedAt).toLocaleString("pt-BR")}
          </span>
        )}
      </div>
      {!encryptionReady && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Cifragem indisponível</AlertTitle>
          <AlertDescription>
            O servidor está sem a chave de cifragem. A conexão não pode ser salva até isso ser corrigido.
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
        className="grid gap-4 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ apiKey: apiKey.trim() || undefined, region, subdomain: subdomain.trim() || null });
          setApiKey("");
        }}
      >
        <div className="space-y-1.5 md:col-span-3">
          <Label htmlFor="ck-key">Chave de API do Clockify</Label>
          <Input
            id="ck-key"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={conn.configured ? "Deixe em branco para manter a chave salva" : "Cole a chave gerada em Profile settings › API"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            aria-describedby="ck-key-help"
          />
          <p id="ck-key-help" className="text-xs text-text-tertiary">
            Use a chave de um administrador do workspace de origem. Workspaces com subdomínio exigem a chave gerada no próprio subdomínio.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ck-region">Região dos dados</Label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger id="ck-region">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLOCKIFY_REGIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {CLOCKIFY_REGION_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ck-sub">Subdomínio (opcional)</Label>
          <Input
            id="ck-sub"
            placeholder="ex.: minhaempresa"
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="submit" disabled={busy || !encryptionReady || (!conn.configured && !apiKey.trim())}>
            <ShieldCheck className="mr-1.5 h-4 w-4" aria-hidden /> Salvar
          </Button>
          <Button type="button" variant="outline" disabled={busy || !conn.configured} onClick={onTest}>
            <PlugZap className="mr-1.5 h-4 w-4" aria-hidden /> Testar
          </Button>
          {conn.configured && (
            <Button type="button" variant="ghost" disabled={busy} onClick={onRemove}>
              Remover chave
            </Button>
          )}
        </div>
      </form>
    </FormSection>
  );
}

export function SourceSection({
  conn,
  workspaces,
  busy,
  onSelect,
}: {
  conn: ConnectionView;
  workspaces: Array<{ id: string; name: string; plan: string | null }> | null;
  busy: boolean;
  onSelect: (id: string) => void;
}) {
  const [choice, setChoice] = useState(conn.source?.id ?? "");
  return (
    <FormSection
      title="2. Workspace de origem"
      description="Escolha de qual workspace do Clockify os dados vêm. O destino é sempre o workspace atual do ERP."
    >
      {conn.source ? (
        <p className="text-sm">
          Origem: <strong>{conn.source.name ?? conn.source.id}</strong>
          {conn.source.plan ? <span className="text-text-tertiary"> · plano {conn.source.plan}</span> : null}
        </p>
      ) : (
        <p className="text-sm text-text-secondary">Nenhum workspace de origem escolhido.</p>
      )}
      {workspaces === null ? (
        <p className="text-sm text-text-tertiary">Teste a conexão para listar os workspaces que a chave enxerga.</p>
      ) : workspaces.length === 0 ? (
        <EmptyState compact title="Nenhum workspace encontrado" description="A chave não tem acesso a nenhum workspace." />
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="ck-src">Workspace do Clockify</Label>
            <Select value={choice} onValueChange={setChoice}>
              <SelectTrigger id="ck-src">
                <SelectValue placeholder="Escolha o workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} {w.plan ? `(${w.plan})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button disabled={busy || !choice} onClick={() => onSelect(choice)}>
            Usar como origem
          </Button>
        </div>
      )}
    </FormSection>
  );
}

export type RunView = {
  id: string;
  kind: string;
  status: string;
  phase: string;
  error: string | null;
  created_at: string;
  finished_at: string | null;
  preview_confirmed_at: string | null;
  progress?: { waitUntil: number | null; index: number | null; total: number | null; page: number | null };
};

export function RunProgress({
  run,
  phases,
  onPause,
  onResume,
  onCancel,
  busy,
}: {
  run: RunView;
  phases: readonly string[];
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const i = Math.max(0, phases.indexOf(run.phase));
  const pct = run.status === "completed" ? 100 : Math.round((i / Math.max(1, phases.length - 1)) * 100);
  const waiting = run.progress?.waitUntil && run.progress.waitUntil > Date.now();
  const active = ["queued", "running", "cancel_requested"].includes(run.status);
  return (
    <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-1 p-4" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{RUN_KIND_LABEL[run.kind] ?? run.kind}</span>
          <StatusBadge status={toneFor(run.status)} label={RUN_STATUS_LABEL[run.status] ?? run.status} />
        </div>
        <div className="flex flex-wrap gap-2">
          {active && run.status !== "cancel_requested" && (
            <Button size="sm" variant="outline" disabled={busy} onClick={onPause}>
              Pausar
            </Button>
          )}
          {(run.status === "paused" || run.status === "failed") && (
            <Button size="sm" variant="outline" disabled={busy} onClick={onResume}>
              Retomar
            </Button>
          )}
          {(active || run.status === "paused") && run.status !== "cancel_requested" && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
              Cancelar
            </Button>
          )}
        </div>
      </div>
      <Progress value={pct} aria-label="Progresso da execução" />
      <p className="text-sm text-text-secondary">
        Etapa: {PHASE_LABEL[run.phase] ?? run.phase}
        {run.progress?.total ? ` · ${Math.min(run.progress.index ?? 0, run.progress.total)} de ${run.progress.total}` : ""}
        {run.progress?.page && run.progress.page > 1 ? ` · página ${run.progress.page}` : ""}
        {waiting ? ` · aguardando limite do Clockify até ${new Date(run.progress!.waitUntil!).toLocaleTimeString("pt-BR")}` : ""}
      </p>
      {run.error && (
        <Alert variant={run.status === "failed" ? "destructive" : "default"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{run.status === "failed" ? "A execução parou" : "Aviso"}</AlertTitle>
          <AlertDescription>{run.error} Use “Retomar” depois de corrigir; nada já gravado é perdido.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

type Report = {
  plan?: string | null;
  capabilities?: Record<string, { status: string; count: number; detail: string | null }>;
  not_collected?: Array<{ entity: string; label: string; reason: string }>;
  time_entry_user_errors?: Array<{ user: string; error: string }>;
  in_progress?: number | null;
  mappings?: Record<string, Record<string, number>>;
  totals?: {
    entries: number;
    sourceSeconds: number;
    importableSeconds: number;
    stagedSeconds: number;
    segments: number;
    byReason: Record<string, { entries: number; seconds: number }>;
    byUser: Record<string, number>;
    byProject: Record<string, number>;
    byMonth: Record<string, number>;
    earnedByCurrency: Record<string, number>;
    costByCurrency: Record<string, number>;
  };
  preview?: {
    segmentsToInsert: number;
    entriesToUpdate: number;
    entriesUnchanged: number;
    conflicts: Record<string, number>;
    overlapExisting: number;
  } | null;
  reconciliation?: { status: string; diffs: Array<{ userId: string; collected: number; reported: number; diff: number }> };
  staging?: { byEntity: Record<string, Record<string, number>>; entryReasons: Record<string, number>; notSeenThisRun: number | null };
  import?: {
    inserted: number;
    updated: number;
    unchanged: number;
    failed: number;
    conflicts: Record<string, number>;
    secondsImported: number;
    byUser: Record<string, number>;
    byProject: Record<string, number>;
    byMonth: Record<string, number>;
    projectsCreated: number;
    projectsLinked: number;
    tasksCreated: number;
    membersAdded: number;
    errors: Array<{ entry: string; reason: string }>;
  };
};

function TopTable({ title, rows, nameOf }: { title: string; rows: Record<string, number>; nameOf: (k: string) => string }) {
  const list = Object.entries(rows).sort((a, b) => b[1] - a[1]);
  if (!list.length) return null;
  return (
    <div className="min-w-0">
      <h4 className="mb-2 text-sm font-medium">{title}</h4>
      <div className="max-h-72 overflow-auto rounded-md border border-border-subtle">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Tempo exato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map(([k, v]) => (
              <TableRow key={k}>
                <TableCell className="max-w-[16rem] truncate">{nameOf(k)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatSeconds(v)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function PreviewReport({ report, nameOf }: { report: Report; nameOf: (kind: "user" | "project", id: string) => string }) {
  const t = report.totals;
  const caps = Object.entries(report.capabilities ?? {});
  return (
    <div className="space-y-6">
      <SectionHeader title="Inventário por capacidade" description="O que a chave conseguiu ler. Itens sem permissão ou indisponíveis no plano não viram zero silencioso." />
      <div className="overflow-auto rounded-md border border-border-subtle">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dado</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead className="text-right">Registros</TableHead>
              <TableHead>Detalhe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {caps.map(([k, c]) => (
              <TableRow key={k}>
                <TableCell>{ENTITY_LABEL[k] ?? k}</TableCell>
                <TableCell>
                  <StatusBadge status={c.status === "collected" ? "open" : c.status === "empty" ? "draft" : c.status === "forbidden" || c.status === "failed" ? "closed" : "onhold"} label={CAPABILITY_LABEL[c.status] ?? c.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.count.toLocaleString("pt-BR")}</TableCell>
                <TableCell className="max-w-[20rem] text-xs text-text-tertiary">{c.detail ?? "—"}</TableCell>
              </TableRow>
            ))}
            {(report.not_collected ?? []).map((n) => (
              <TableRow key={n.entity}>
                <TableCell>{n.label}</TableCell>
                <TableCell>
                  <StatusBadge status="draft" label={CAPABILITY_LABEL.not_collected} />
                </TableCell>
                <TableCell className="text-right">—</TableCell>
                <TableCell className="max-w-[20rem] text-xs text-text-tertiary">{n.reason}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {t && (
        <>
          <SectionHeader title="Horas (segundos exatos)" description="Totais da origem, sem arredondar. A tela do ERP mostra minutos, mas a conciliação usa segundos." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Apontamentos coletados" value={t.entries.toLocaleString("pt-BR")} />
            <MetricCard label="Tempo na origem" value={formatSeconds(t.sourceSeconds)} />
            <MetricCard label="Importável" value={formatSeconds(t.importableSeconds)} tone="positive" hint={`${t.segments.toLocaleString("pt-BR")} trechos diários`} />
            <MetricCard label="Fica no staging" value={formatSeconds(t.stagedSeconds)} tone={t.stagedSeconds ? "warning" : "neutral"} />
          </div>
          {report.preview && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Trechos a criar" value={report.preview.segmentsToInsert.toLocaleString("pt-BR")} />
              <MetricCard label="Apontamentos a atualizar" value={report.preview.entriesToUpdate.toLocaleString("pt-BR")} />
              <MetricCard label="Já importados, sem mudança" value={report.preview.entriesUnchanged.toLocaleString("pt-BR")} />
              <MetricCard label="Sobreposição com o ERP" value={report.preview.overlapExisting.toLocaleString("pt-BR")} tone={report.preview.overlapExisting ? "warning" : "neutral"} />
            </div>
          )}
          {Object.keys(t.byReason).length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium">Pendências e itens sem equivalente</h4>
              <div className="overflow-auto rounded-md border border-border-subtle">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="text-right">Apontamentos</TableHead>
                      <TableHead className="text-right">Tempo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(t.byReason).map(([k, v]) => (
                      <TableRow key={k}>
                        <TableCell>{ENTRY_REASON_LABEL[k] ?? k}</TableCell>
                        <TableCell className="text-right tabular-nums">{v.entries.toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatSeconds(v.seconds)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-3">
            <TopTable title="Por pessoa" rows={t.byUser} nameOf={(k) => nameOf("user", k)} />
            <TopTable title="Por projeto" rows={t.byProject} nameOf={(k) => (k === "sem_projeto" ? "Sem projeto" : nameOf("project", k))} />
            <TopTable title="Por mês (fuso da pessoa)" rows={t.byMonth} nameOf={(k) => k} />
          </div>
          {(Object.keys(t.earnedByCurrency).length > 0 || Object.keys(t.costByCurrency).length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard label="Valor faturável por moeda" value={Object.entries(t.earnedByCurrency).map(([c, v]) => formatMoney(v, c)).join(" · ") || "—"} hint="Moedas diferentes nunca são somadas." />
              <MetricCard label="Custo por moeda" value={Object.entries(t.costByCurrency).map(([c, v]) => formatMoney(v, c)).join(" · ") || "—"} />
            </div>
          )}
        </>
      )}

      {report.reconciliation && (
        <Alert variant={report.reconciliation.status === "ok" && report.reconciliation.diffs.length === 0 ? "default" : "destructive"}>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Conciliação com o relatório do Clockify</AlertTitle>
          <AlertDescription>
            {report.reconciliation.status !== "ok"
              ? "O relatório resumido não está disponível para esta chave ou plano. A conciliação foi feita só com a coleta."
              : report.reconciliation.diffs.length === 0
                ? "Os segundos coletados batem com o relatório do Clockify para todas as pessoas."
                : `${report.reconciliation.diffs.length} pessoa(s) com diferença: ${report.reconciliation.diffs
                    .slice(0, 5)
                    .map((d) => `${nameOf("user", d.userId)} (${d.diff > 0 ? "+" : "−"}${formatSeconds(Math.abs(d.diff))})`)
                    .join(", ")}. Diferenças podem vir de cronômetros abertos, pausas ou pessoas sem acesso.`}
          </AlertDescription>
        </Alert>
      )}
      {report.in_progress ? (
        <p className="text-sm text-text-secondary">
          {report.in_progress} cronômetro(s) em andamento no Clockify ficam no staging até terminarem; o ERP não inventa horário de fim.
        </p>
      ) : null}
    </div>
  );
}

export function ImportReport({ report, nameOf }: { report: Report; nameOf: (kind: "user" | "project", id: string) => string }) {
  const r = report.import;
  if (!r) return null;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Trechos criados" value={r.inserted.toLocaleString("pt-BR")} tone="positive" />
        <MetricCard label="Trechos atualizados" value={r.updated.toLocaleString("pt-BR")} />
        <MetricCard label="Tempo importado" value={formatSeconds(r.secondsImported)} />
        <MetricCard label="Falhas e conflitos" value={(r.failed + Object.values(r.conflicts).reduce((a, b) => a + b, 0)).toLocaleString("pt-BR")} tone={r.failed ? "warning" : "neutral"} />
      </div>
      <p className="text-sm text-text-secondary">
        Projetos criados: {r.projectsCreated} · vinculados: {r.projectsLinked} · tarefas: {r.tasksCreated} · membros: {r.membersAdded} · sem mudança: {r.unchanged}
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        <TopTable title="Importado por pessoa" rows={r.byUser} nameOf={(k) => nameOf("user", k)} />
        <TopTable title="Importado por projeto" rows={r.byProject} nameOf={(k) => (k === "sem_projeto" ? "Sem projeto" : nameOf("project", k))} />
        <TopTable title="Importado por mês" rows={r.byMonth} nameOf={(k) => k} />
      </div>
    </div>
  );
}

export type { Report as ClockifyReport };
