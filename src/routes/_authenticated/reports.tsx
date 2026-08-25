import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichHtmlEditor } from "@/components/rich-html-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Plus, Save, Trash2, Star, StarOff, Play, Download } from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  REPORT_ENTITIES,
  listReports,
  saveReport,
  deleteReport,
  runReport,
  toggleReportFavorite,
} from "@/lib/reports.functions";
import { LazyChart } from "@/components/charts/lazy-chart";

const compactNumber = (v: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(
    Number(v) || 0,
  );

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

type Entity = keyof typeof REPORT_ENTITIES;
type Config = {
  entity: Entity;
  groupBy: string;
  metric: "count" | "sum" | "avg";
  metricField?: string;
  chartType: "bar" | "line" | "pie" | "table";
  dateField?: string;
  dateFrom?: string;
  dateTo?: string;
  limit: number;
};

const DEFAULT_CONFIG: Config = {
  entity: "deals",
  groupBy: "stage",
  metric: "count",
  chartType: "bar",
  limit: 50,
};

const PALETTE = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 215 80% 60%))",
  "hsl(var(--chart-3, 145 60% 50%))",
  "hsl(var(--chart-4, 35 90% 55%))",
  "hsl(var(--chart-5, 280 65% 60%))",
  "hsl(var(--muted-foreground))",
];

function ReportsPage() {
  const qc = useQueryClient();
  const list = useServerFn(listReports);
  const save = useServerFn(saveReport);
  const del = useServerFn(deleteReport);
  const run = useServerFn(runReport);
  const fav = useServerFn(toggleReportFavorite);

  const { data: reports = [] } = useQuery({ queryKey: ["custom-reports"], queryFn: () => list() });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [meta, setMeta] = useState<{ name: string; description: string }>({
    name: "Novo relatório",
    description: "",
  });
  const [saveOpen, setSaveOpen] = useState(false);

  const {
    data: result,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["report-run", config],
    queryFn: () => run({ data: { config } }),
    enabled: true,
  });

  const ent = REPORT_ENTITIES[config.entity];

  function loadReport(r: (typeof reports)[number]) {
    setSelectedId(r.id);
    const c = (r.config as unknown as Config) ?? DEFAULT_CONFIG;
    setConfig({ ...DEFAULT_CONFIG, ...c });
    setMeta({ name: r.name, description: r.description ?? "" });
  }
  function newReport() {
    setSelectedId(null);
    setConfig(DEFAULT_CONFIG);
    setMeta({ name: "Novo relatório", description: "" });
  }
  async function persist(asNew = false) {
    if (!meta.name.trim()) {
      toast.error("Informe o nome.");
      return;
    }
    try {
      const res = await save({
        data: {
          id: asNew ? undefined : (selectedId ?? undefined),
          name: meta.name,
          description: meta.description,
          config,
          is_favorite: false,
        },
      });
      toast.success("Relatório salvo.");
      setSelectedId(res.id);
      setSaveOpen(false);
      qc.invalidateQueries({ queryKey: ["custom-reports"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }
  async function remove(id: string) {
    if (!(await confirmDialog("Excluir relatório?"))) return;
    try {
      await del({ data: { id } });
      if (selectedId === id) newReport();
      qc.invalidateQueries({ queryKey: ["custom-reports"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }
  async function toggleFav(r: (typeof reports)[number]) {
    try {
      await fav({ data: { id: r.id, is_favorite: !r.is_favorite } });
      qc.invalidateQueries({ queryKey: ["custom-reports"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  }

  function setEntity(v: Entity) {
    const e = REPORT_ENTITIES[v];
    setConfig({
      ...config,
      entity: v,
      groupBy: e.groupBy[0],
      metric: "count",
      metricField: undefined,
      dateField: e.date[0],
    });
  }

  function exportCsv() {
    if (!result?.rows?.length) return;
    const csv =
      "key,value,count\n" +
      result.rows
        .map((r) => `"${String(r.key).replace(/"/g, '""')}",${r.value},${r.count}`)
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${meta.name || "relatorio"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const metricLabel =
    config.metric === "count"
      ? "Contagem"
      : config.metric === "sum"
        ? `Soma de ${config.metricField}`
        : `Média de ${config.metricField}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Relatórios"
        description="Crie relatórios personalizados sobre qualquer entidade do CRM."
      />
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Sidebar list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Salvos</CardTitle>
            <Button size="sm" variant="outline" onClick={newReport}>
              <Plus className="h-4 w-4 mr-1" /> Novo
            </Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {reports.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum relatório salvo.</p>
            ) : (
              reports.map((r) => (
                <div
                  key={r.id}
                  className={`flex items-center gap-1 rounded-md px-2 py-1.5 group ${selectedId === r.id ? "bg-accent" : "hover:bg-accent/50"}`}
                >
                  <button onClick={() => loadReport(r)} className="flex-1 min-w-0 text-left">
                    <div className="text-sm font-medium truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {REPORT_ENTITIES[r.entity as Entity]?.label ?? r.entity}
                    </div>
                  </button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => toggleFav(r)}
                  >
                    {r.is_favorite ? (
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    ) : (
                      <StarOff className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100"
                    onClick={() => remove(r.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Builder + chart */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuração</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label>Entidade</Label>
                  <Select value={config.entity} onValueChange={(v) => setEntity(v as Entity)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(REPORT_ENTITIES) as Entity[]).map((k) => (
                        <SelectItem key={k} value={k}>
                          {REPORT_ENTITIES[k].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Agrupar por</Label>
                  <Select
                    value={config.groupBy}
                    onValueChange={(v) => setConfig({ ...config, groupBy: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ent.groupBy.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Métrica</Label>
                  <Select
                    value={config.metric}
                    onValueChange={(v) =>
                      setConfig({
                        ...config,
                        metric: v as Config["metric"],
                        metricField: v === "count" ? undefined : (ent.numeric[0] ?? undefined),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="count">Contagem</SelectItem>
                      <SelectItem value="sum" disabled={ent.numeric.length === 0}>
                        Soma
                      </SelectItem>
                      <SelectItem value="avg" disabled={ent.numeric.length === 0}>
                        Média
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {config.metric !== "count" && (
                  <div className="space-y-1.5">
                    <Label>Campo</Label>
                    <Select
                      value={config.metricField ?? ""}
                      onValueChange={(v) => setConfig({ ...config, metricField: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ent.numeric.map((f) => (
                          <SelectItem key={f} value={f}>
                            {f}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label>Visualização</Label>
                  <Select
                    value={config.chartType}
                    onValueChange={(v) =>
                      setConfig({ ...config, chartType: v as Config["chartType"] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bar">Barras</SelectItem>
                      <SelectItem value="line">Linha</SelectItem>
                      <SelectItem value="pie">Pizza</SelectItem>
                      <SelectItem value="table">Tabela</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {ent.date.length > 0 && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Período por</Label>
                      <Select
                        value={config.dateField ?? ""}
                        onValueChange={(v) => setConfig({ ...config, dateField: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="—" />
                        </SelectTrigger>
                        <SelectContent>
                          {ent.date.map((f) => (
                            <SelectItem key={f} value={f}>
                              {f}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>De</Label>
                      <Input
                        type="date"
                        value={config.dateFrom ?? ""}
                        onChange={(e) =>
                          setConfig({ ...config, dateFrom: e.target.value || undefined })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Até</Label>
                      <Input
                        type="date"
                        value={config.dateTo ?? ""}
                        onChange={(e) =>
                          setConfig({ ...config, dateTo: e.target.value || undefined })
                        }
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button size="sm" onClick={() => refetch()} disabled={isFetching}>
                  <Play className="h-4 w-4 mr-1" /> Executar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setSaveOpen(true)}>
                  <Save className="h-4 w-4 mr-1" /> {selectedId ? "Salvar" : "Salvar como"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={exportCsv}
                  disabled={!result?.rows?.length}
                >
                  <Download className="h-4 w-4 mr-1" /> CSV
                </Button>
                {selectedId && <Badge variant="outline">Editando: {meta.name}</Badge>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {meta.name}{" "}
                <span className="text-sm text-muted-foreground font-normal">
                  · {metricLabel} por {config.groupBy}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isFetching ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : !result?.rows?.length ? (
                <p className="text-sm text-muted-foreground">Sem dados para exibir.</p>
              ) : (
                <ChartRender data={result.rows} type={config.chartType} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar relatório</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                value={meta.name}
                onChange={(e) => setMeta({ ...meta, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <RichHtmlEditor
                value={meta.description}
                onChange={(html) => setMeta({ ...meta, description: html })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>
              Cancelar
            </Button>
            {selectedId && (
              <Button variant="outline" onClick={() => persist(true)}>
                Salvar como novo
              </Button>
            )}
            <Button onClick={() => persist(false)}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ChartRender({
  data,
  type,
}: {
  data: Array<{ key: string; value: number; count: number }>;
  type: "bar" | "line" | "pie" | "table";
}) {
  const truncated = useMemo(
    () => data.map((d) => ({ ...d, key: d.key.length > 28 ? d.key.slice(0, 28) + "…" : d.key })),
    [data],
  );

  if (type === "table") {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="py-2 pr-3">Grupo</th>
              <th className="py-2 pr-3 text-right">Valor</th>
              <th className="py-2 text-right">Registros</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.key} className="border-b last:border-0">
                <td className="py-2 pr-3">{r.key}</td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {r.value.toLocaleString("pt-BR")}
                </td>
                <td className="py-2 text-right tabular-nums">{r.count.toLocaleString("pt-BR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (type === "pie") {
    return (
      <div className="h-[380px]">
        <LazyChart>
          {({ ResponsiveContainer, PieChart, Pie, Cell, Tooltip: RTooltip }) => (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={truncated}
                  dataKey="value"
                  nameKey="key"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  label
                >
                  {truncated.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <RTooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </LazyChart>
      </div>
    );
  }
  if (type === "line") {
    return (
      <div className="h-[380px]">
        <LazyChart>
          {({
            ResponsiveContainer,
            LineChart,
            CartesianGrid,
            XAxis,
            YAxis,
            Tooltip: RTooltip,
            Line,
          }) => (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={truncated}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={compactNumber} />
                <RTooltip />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </LazyChart>
      </div>
    );
  }
  return (
    <div className="h-[380px]">
      <LazyChart>
        {({
          ResponsiveContainer,
          BarChart,
          CartesianGrid,
          XAxis,
          YAxis,
          Tooltip: RTooltip,
          Bar,
        }) => (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={truncated}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="key"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={60}
              />
              <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={compactNumber} />
              <RTooltip />
              <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </LazyChart>
    </div>
  );
}
