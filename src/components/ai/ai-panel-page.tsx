import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity, AlertTriangle, Coins, Download, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, MetricCard, FilterBar, EmptyState, Skeletons } from "@/components/techhire/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAiUsageSummary, listAiCallLogs } from "@/lib/ai/ai-usage.functions";
import { AI_FEATURES, featureLabel } from "@/lib/ai/features";
import { AI_PROVIDERS, getAiProvider } from "@/lib/ai/providers";
import { downloadCsv, toCsv } from "@/lib/csv-export";

type Days = 7 | 30 | 90;
const ALL = "__all";
const PAGE_SIZE = 25;

const usd = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
const dt = (s: string) => new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
const providerName = (id: string) => getAiProvider(id)?.name ?? id;
const STATUS_LABEL: Record<string, string> = {
  configured: "Configurado",
  connected: "Conectado",
  failed: "Falha",
  disabled: "Desativado",
};

export function AiPanelPage() {
  const [days, setDays] = useState<Days>(30);
  const [search, setSearch] = useState("");
  const [feature, setFeature] = useState(ALL);
  const [source, setSource] = useState(ALL);
  const [provider, setProvider] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [page, setPage] = useState(0);

  const summaryFn = useServerFn(getAiUsageSummary);
  const logsFn = useServerFn(listAiCallLogs);
  const filters = {
    days,
    search: search.trim() || undefined,
    feature: feature === ALL ? undefined : feature,
    triggerSource: source === ALL ? undefined : (source as "user" | "automatic"),
    provider: provider === ALL ? undefined : provider,
    status: status === ALL ? undefined : (status as "success" | "failed"),
  };

  const summary = useQuery({
    queryKey: ["ai-usage-summary", days],
    queryFn: () => summaryFn({ data: { days } }),
  });
  const isAdmin = summary.data?.isAdmin ?? false;
  const logs = useQuery({
    queryKey: ["ai-call-logs", filters, page],
    queryFn: () => logsFn({ data: { ...filters, page, pageSize: PAGE_SIZE } }),
    enabled: isAdmin,
    placeholderData: keepPreviousData,
  });

  const reset =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(0);
    };

  async function exportCsv() {
    try {
      const all = await logsFn({ data: { ...filters, page: 0, pageSize: 5000 } });
      const csv = toCsv(all.rows, [
        { header: "Data", value: (r) => dt(r.created_at) },
        { header: "Recurso", value: (r) => featureLabel(r.feature) },
        {
          header: "Origem",
          value: (r) => (r.trigger_source === "automatic" ? "Automático" : "Usuário"),
        },
        { header: "Disparado por", value: (r) => r.triggered_by_name ?? "" },
        { header: "Provedor", value: (r) => providerName(r.provider) },
        { header: "Modelo", value: (r) => r.model ?? "" },
        { header: "Tokens entrada", value: (r) => r.prompt_tokens ?? "" },
        { header: "Tokens saída", value: (r) => r.completion_tokens ?? "" },
        { header: "Custo estimado (USD)", value: (r) => r.estimated_cost_usd ?? "" },
        { header: "Duração (ms)", value: (r) => r.duration_ms ?? "" },
        { header: "Resultado", value: (r) => (r.status === "success" ? "Sucesso" : "Falha") },
      ]);
      downloadCsv(`historico-ia-${days}d.csv`, csv);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const m = summary.data?.metrics;
  const active = summary.data?.active;
  const totalPages = Math.max(1, Math.ceil((logs.data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Configurações"
        title="Painel de IA"
        description="Modelo em uso, custo estimado por chamada e histórico de gatilhos do workspace."
        primaryAction={
          <Select value={String(days)} onValueChange={(v) => reset(setDays)(Number(v) as Days)}>
            <SelectTrigger className="w-[160px]" aria-label="Período">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      {summary.isLoading && <Skeletons.Card />}
      {summary.isError && (
        <EmptyState
          title="Não foi possível carregar o painel de IA"
          description={(summary.error as Error).message}
          action={<Button onClick={() => summary.refetch()}>Tentar novamente</Button>}
        />
      )}

      {active && (
        <section
          aria-label="IA em uso"
          className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary" aria-hidden />
            <div>
              <p className="text-sm font-medium text-foreground">
                {providerName(active.provider)}
                {active.model ? ` · ${active.model}` : " · modelos padrão da Lovable AI"}
              </p>
              <p className="text-xs text-muted-foreground">
                {active.provider === "lovable"
                  ? "Consumo nos créditos Lovable do workspace."
                  : "Consumo cobrado na conta do provedor."}
              </p>
              {active.lastError && (
                <p role="alert" className="mt-1 text-xs text-destructive">
                  {active.lastError}
                </p>
              )}
            </div>
            <Badge variant={active.status === "failed" ? "destructive" : "secondary"}>
              {STATUS_LABEL[active.status] ?? active.status}
            </Badge>
          </div>
          {isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link to="/settings/integrations/ai">Trocar provedor</Link>
            </Button>
          )}
        </section>
      )}

      {summary.data && !isAdmin && (
        <EmptyState
          title="Custos e histórico são restritos"
          description="Apenas administradores do workspace veem o custo e o histórico de chamadas de IA."
        />
      )}

      {m && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Chamadas" value={m.total.toLocaleString("pt-BR")} icon={Activity} />
            <MetricCard
              label="Custo estimado"
              value={usd(m.costUsd)}
              hint={
                m.unpricedCalls ? `${m.unpricedCalls} sem preço (ex.: Créditos Lovable)` : undefined
              }
              icon={Coins}
            />
            <MetricCard
              label="Custo médio por chamada"
              value={m.avgCostUsd == null ? "—" : usd(m.avgCostUsd)}
              hint={m.avgCostUsd == null ? "Sem preço cadastrado" : undefined}
              icon={Coins}
            />
            <MetricCard
              label="Taxa de erro"
              value={`${(m.errorRate * 100).toFixed(1)}%`}
              hint={`${m.failed} falha(s)`}
              icon={AlertTriangle}
              tone={m.errorRate > 0.1 ? "negative" : "neutral"}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Custos são estimativas pela tabela de preços do sistema; o valor final é o da fatura do
            provedor.
          </p>
        </>
      )}

      {isAdmin && (
        <section aria-label="Histórico de gatilhos" className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Histórico de gatilhos</h2>
          <FilterBar
            search={{
              value: search,
              onChange: reset(setSearch),
              placeholder: "Buscar por recurso, provedor ou modelo…",
            }}
            chips={
              <>
                <FilterSelect
                  label="Recurso"
                  value={feature}
                  onChange={reset(setFeature)}
                  options={Object.entries(AI_FEATURES).map(([v, l]) => ({ value: v, label: l }))}
                />
                <FilterSelect
                  label="Origem"
                  value={source}
                  onChange={reset(setSource)}
                  options={[
                    { value: "user", label: "Usuário" },
                    { value: "automatic", label: "Automático" },
                  ]}
                />
                <FilterSelect
                  label="Provedor"
                  value={provider}
                  onChange={reset(setProvider)}
                  options={AI_PROVIDERS.map((p) => ({ value: p.id, label: p.name }))}
                />
                <FilterSelect
                  label="Resultado"
                  value={status}
                  onChange={reset(setStatus)}
                  options={[
                    { value: "success", label: "Sucesso" },
                    { value: "failed", label: "Falha" },
                  ]}
                />
              </>
            }
            actions={
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={!logs.data?.total}>
                <Download className="mr-1 h-4 w-4" aria-hidden /> Exportar
              </Button>
            }
          />

          {logs.isLoading && <Skeletons.Card />}
          {logs.isError && (
            <EmptyState
              title="Não foi possível carregar o histórico"
              description={(logs.error as Error).message}
              action={<Button onClick={() => logs.refetch()}>Tentar novamente</Button>}
            />
          )}
          {logs.data && logs.data.rows.length === 0 && (
            <EmptyState
              title="Nenhuma chamada de IA no período"
              description="As chamadas aparecem aqui assim que algum recurso de IA for usado."
            />
          )}
          {logs.data && logs.data.rows.length > 0 && (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Recurso</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Disparado por</TableHead>
                    <TableHead>Provedor / modelo</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Custo</TableHead>
                    <TableHead className="text-right">Duração</TableHead>
                    <TableHead>Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.data.rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">{dt(r.created_at)}</TableCell>
                      <TableCell>{featureLabel(r.feature)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {r.trigger_source === "automatic" ? "Automático" : "Usuário"}
                        </Badge>
                      </TableCell>
                      <TableCell>{r.triggered_by_name ?? "—"}</TableCell>
                      <TableCell>
                        <span className="block">{providerName(r.provider)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {r.model ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.prompt_tokens == null && r.completion_tokens == null
                          ? "—"
                          : ((r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0)).toLocaleString(
                              "pt-BR",
                            )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.estimated_cost_usd != null
                          ? usd(r.estimated_cost_usd)
                          : r.provider === "lovable"
                            ? "Créditos Lovable"
                            : "Sem preço"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)} s` : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={r.status === "success" ? "secondary" : "destructive"}
                          title={r.error ?? undefined}
                        >
                          {r.status === "success" ? "Sucesso" : "Falha"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span aria-live="polite">
                  {logs.data.total.toLocaleString("pt-BR")} chamada(s) · página {page + 1} de{" "}
                  {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page + 1 >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[170px]" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{label}: todos</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
