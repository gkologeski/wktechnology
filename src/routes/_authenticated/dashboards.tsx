import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichHtmlEditor, HtmlContent, htmlToPlain } from "@/components/rich-html-editor";
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
import { Plus, Trash2, Star, StarOff, Pencil, LayoutDashboard, GripVertical } from "lucide-react";
import { toast } from "sonner";
import {
  listDashboards,
  createDashboard,
  updateDashboard,
  deleteDashboard,
  listWidgets,
  upsertWidget,
  deleteWidget,
} from "@/lib/dashboards.functions";
import { listReports, runReport } from "@/lib/reports.functions";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { LazyChart } from "@/components/charts/lazy-chart";

const compactNumber = (v: number) =>
  new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(
    Number(v) || 0,
  );

export const Route = createFileRoute("/_authenticated/dashboards")({
  component: DashboardsPage,
});

const PALETTE = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 215 80% 60%))",
  "hsl(var(--chart-3, 145 60% 50%))",
  "hsl(var(--chart-4, 35 90% 55%))",
  "hsl(var(--chart-5, 280 65% 60%))",
  "hsl(var(--muted-foreground))",
];

type Dashboard = {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_favorite: boolean;
};
type Widget = {
  id: string;
  dashboard_id: string;
  title: string;
  widget_type: string;
  report_id: string | null;
  config: Record<string, unknown>;
  position: number;
  width: number;
  height: number;
};
type Report = { id: string; name: string; entity: string; config: Record<string, unknown> };

function DashboardsPage() {
  const qc = useQueryClient();
  const listDash = useServerFn(listDashboards);
  const createDash = useServerFn(createDashboard);
  const updateDash = useServerFn(updateDashboard);
  const deleteDash = useServerFn(deleteDashboard);
  const listW = useServerFn(listWidgets);
  const upsertW = useServerFn(upsertWidget);
  const deleteW = useServerFn(deleteWidget);
  const listRep = useServerFn(listReports);

  const { data: dashboards = [] } = useQuery({
    queryKey: ["dashboards"],
    queryFn: () => listDash() as Promise<Dashboard[]>,
  });
  const { data: reports = [] } = useQuery({
    queryKey: ["custom-reports"],
    queryFn: () => listRep() as unknown as Promise<Report[]>,
  });

  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    if (!activeId && dashboards.length > 0) {
      setActiveId(dashboards.find((d) => d.is_default)?.id ?? dashboards[0].id);
    }
  }, [dashboards, activeId]);

  const active = dashboards.find((d) => d.id === activeId) ?? null;
  const { data: widgets = [] } = useQuery({
    queryKey: ["dashboard-widgets", activeId],
    queryFn: () => listW({ data: { dashboard_id: activeId! } }) as unknown as Promise<Widget[]>,
    enabled: !!activeId,
  });

  const [newDashOpen, setNewDashOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDefault, setNewDefault] = useState(false);

  const [editDashOpen, setEditDashOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const [widgetDialogOpen, setWidgetDialogOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null);
  const [wTitle, setWTitle] = useState("");
  const [wReportId, setWReportId] = useState<string>("");
  const [wWidth, setWWidth] = useState("6");

  async function handleCreateDash() {
    if (!newName.trim()) return toast.error("Informe um nome");
    await createDash({
      data: {
        name: newName.trim(),
        description: htmlToPlain(newDesc).trim() ? newDesc : null,
        is_default: newDefault,
      },
    });
    setNewDashOpen(false);
    setNewName("");
    setNewDesc("");
    setNewDefault(false);
    qc.invalidateQueries({ queryKey: ["dashboards"] });
    toast.success("Painel criado");
  }

  async function handleEditDash() {
    if (!active || !editName.trim()) return;
    await updateDash({
      data: {
        id: active.id,
        name: editName.trim(),
        description: htmlToPlain(editDesc).trim() ? editDesc : null,
      },
    });
    setEditDashOpen(false);
    qc.invalidateQueries({ queryKey: ["dashboards"] });
    toast.success("Painel atualizado");
  }

  async function handleDeleteDash() {
    if (!active) return;
    if (!(await confirmDialog(`Excluir o painel "${active.name}"?`))) return;
    await deleteDash({ data: { id: active.id } });
    setActiveId(null);
    qc.invalidateQueries({ queryKey: ["dashboards"] });
    toast.success("Painel excluído");
  }

  async function toggleFav(d: Dashboard) {
    await updateDash({ data: { id: d.id, is_favorite: !d.is_favorite } });
    qc.invalidateQueries({ queryKey: ["dashboards"] });
  }

  async function setDefault(d: Dashboard) {
    await updateDash({ data: { id: d.id, is_default: true } });
    qc.invalidateQueries({ queryKey: ["dashboards"] });
    toast.success("Painel padrão definido");
  }

  function openAddWidget() {
    setEditingWidget(null);
    setWTitle("");
    setWReportId("");
    setWWidth("6");
    setWidgetDialogOpen(true);
  }
  function openEditWidget(w: Widget) {
    setEditingWidget(w);
    setWTitle(w.title);
    setWReportId(w.report_id ?? "");
    setWWidth(String(w.width));
    setWidgetDialogOpen(true);
  }

  async function saveWidget() {
    if (!active) return;
    if (!wTitle.trim()) return toast.error("Informe um título");
    if (!wReportId) return toast.error("Selecione um relatório");
    await upsertW({
      data: {
        id: editingWidget?.id,
        dashboard_id: active.id,
        title: wTitle.trim(),
        widget_type: "report",
        report_id: wReportId,
        config: {},
        position: editingWidget?.position ?? widgets.length,
        width: Number(wWidth) || 6,
        height: 1,
      },
    });
    setWidgetDialogOpen(false);
    qc.invalidateQueries({ queryKey: ["dashboard-widgets", active.id] });
    toast.success("Widget salvo");
  }

  async function removeWidget(id: string) {
    if (!(await confirmDialog("Remover este widget?"))) return;
    await deleteW({ data: { id } });
    qc.invalidateQueries({ queryKey: ["dashboard-widgets", activeId] });
  }

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Dashboards"
        description="Crie múltiplos painéis combinando relatórios salvos."
        actions={
          <Button onClick={() => setNewDashOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo painel
          </Button>
        }
      />

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 md:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Painéis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 px-2 pb-3">
            {dashboards.length === 0 && (
              <p className="text-xs text-muted-foreground p-2">Nenhum painel ainda.</p>
            )}
            {dashboards.map((d) => (
              <div
                key={d.id}
                className={`flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer ${activeId === d.id ? "bg-accent" : "hover:bg-muted"}`}
                onClick={() => setActiveId(d.id)}
              >
                <LayoutDashboard className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-sm flex-1 truncate">{d.name}</span>
                {d.is_default && (
                  <Badge variant="outline" className="text-[10px] py-0 h-4">
                    padrão
                  </Badge>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFav(d);
                  }}
                  className="text-muted-foreground hover:text-amber-500"
                >
                  {d.is_favorite ? (
                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                  ) : (
                    <StarOff className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="col-span-12 md:col-span-9 space-y-4">
          {!active ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Selecione ou crie um painel.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="py-3 flex items-center gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold">{active.name}</h2>
                      {active.is_default && (
                        <Badge variant="secondary" className="text-[10px]">
                          padrão
                        </Badge>
                      )}
                    </div>
                    {active.description && htmlToPlain(active.description) && (
                      <HtmlContent
                        html={active.description}
                        className="text-xs text-muted-foreground"
                      />
                    )}
                  </div>
                  {!active.is_default && (
                    <Button size="sm" variant="outline" onClick={() => setDefault(active)}>
                      Tornar padrão
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditName(active.name);
                      setEditDesc(active.description ?? "");
                      setEditDashOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDeleteDash}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" onClick={openAddWidget}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Widget
                  </Button>
                </CardContent>
              </Card>

              <div className="grid grid-cols-12 gap-4">
                {widgets.length === 0 && (
                  <Card className="col-span-12">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Nenhum widget. Adicione um relatório salvo.
                    </CardContent>
                  </Card>
                )}
                {widgets.map((w) => (
                  <WidgetCard
                    key={w.id}
                    widget={w}
                    reports={reports}
                    onEdit={() => openEditWidget(w)}
                    onDelete={() => removeWidget(w.id)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dialog: new dashboard */}
      <Dialog open={newDashOpen} onOpenChange={setNewDashOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo painel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div>
              <Label>Descrição</Label>
              <RichHtmlEditor value={newDesc} onChange={setNewDesc} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={newDefault}
                onChange={(e) => setNewDefault(e.target.checked)}
              />
              Definir como padrão
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDashOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateDash}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: edit dashboard */}
      <Dialog open={editDashOpen} onOpenChange={setEditDashOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar painel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>Descrição</Label>
              <RichHtmlEditor value={editDesc} onChange={setEditDesc} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDashOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditDash}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: widget */}
      <Dialog open={widgetDialogOpen} onOpenChange={setWidgetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingWidget ? "Editar widget" : "Novo widget"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={wTitle} onChange={(e) => setWTitle(e.target.value)} />
            </div>
            <div>
              <Label>Relatório</Label>
              <Select value={wReportId} onValueChange={setWReportId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um relatório salvo" />
                </SelectTrigger>
                <SelectContent>
                  {reports.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {reports.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Crie um relatório em Relatórios primeiro.
                </p>
              )}
            </div>
            <div>
              <Label>Largura (colunas de 12)</Label>
              <Select value={wWidth} onValueChange={setWWidth}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 — pequeno</SelectItem>
                  <SelectItem value="4">4 — terço</SelectItem>
                  <SelectItem value="6">6 — meio</SelectItem>
                  <SelectItem value="8">8 — dois terços</SelectItem>
                  <SelectItem value="12">12 — inteiro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWidgetDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveWidget}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WidgetCard({
  widget,
  reports,
  onEdit,
  onDelete,
}: {
  widget: Widget;
  reports: Report[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const runRep = useServerFn(runReport);
  const report = reports.find((r) => r.id === widget.report_id);
  const { data, isLoading } = useQuery({
    queryKey: ["widget-data", widget.id, report?.config],
    queryFn: async () => {
      if (!report) return { rows: [] as Array<{ key: string; value: number; count: number }> };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return runRep({ data: { config: report.config as any } });
    },
    enabled: !!report,
  });

  const colSpan = useMemo(() => {
    const map: Record<number, string> = {
      3: "col-span-12 md:col-span-3",
      4: "col-span-12 md:col-span-4",
      6: "col-span-12 md:col-span-6",
      8: "col-span-12 md:col-span-8",
      12: "col-span-12",
    };
    return map[widget.width] ?? "col-span-12 md:col-span-6";
  }, [widget.width]);

  const cfg = (report?.config ?? {}) as { chartType?: string };
  const chartType = cfg.chartType ?? "bar";
  const rows = (data?.rows ?? []) as Array<{ key: string; value: number; count: number }>;

  return (
    <Card className={colSpan}>
      <CardHeader className="pb-2 flex flex-row items-center">
        <div className="flex-1">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
            {widget.title}
          </CardTitle>
          {!report && <p className="text-xs text-destructive">Relatório removido</p>}
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        ) : !report ? (
          <p className="text-xs text-muted-foreground">—</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem dados.</p>
        ) : (
          <div style={{ width: "100%", height: 220 }}>
            {chartType === "table" ? (
              <div className="overflow-auto h-full">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1">Chave</th>
                      <th className="text-right py-1">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((r) => (
                      <tr key={r.key} className="border-b">
                        <td className="py-1">{r.key}</td>
                        <td className="text-right py-1">{r.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <LazyChart>
                {({
                  ResponsiveContainer,
                  LineChart,
                  PieChart,
                  BarChart,
                  CartesianGrid,
                  XAxis,
                  YAxis,
                  Tooltip: RTooltip,
                  Line,
                  Pie,
                  Cell,
                  Bar,
                }) => (
                  <ResponsiveContainer>
                    {chartType === "line" ? (
                      <LineChart data={rows}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={compactNumber} />
                        <RTooltip />
                        <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" />
                      </LineChart>
                    ) : chartType === "pie" ? (
                      <PieChart>
                        <RTooltip />
                        <Pie data={rows} dataKey="value" nameKey="key" outerRadius={80}>
                          {rows.map((_, i) => (
                            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    ) : (
                      <BarChart data={rows}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="key" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} width={48} tickFormatter={compactNumber} />
                        <RTooltip />
                        <Bar dataKey="value" fill="hsl(var(--primary))" />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                )}
              </LazyChart>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
