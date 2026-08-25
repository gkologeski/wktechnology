// Painel de Timesheet — TechPeople.
// KPIs, filtros, presets, subtotais por dia, aprovação em massa, lançamento
// de horas, exportação CSV e visão de alocações no período.
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Clock,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  Activity,
  Wallet,
  Download,
  Plus,
  MoreHorizontal,
  Trash2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listPersonTimesheet,
  listPersonAllocationsInPeriod,
  approveTimesheetEntries,
  unapproveTimesheetEntries,
  deleteTimeEntry,
  type TimesheetEntry,
} from "@/lib/people/timesheet.functions";
import { TimeEntryDialog, type TimeEntryDraft } from "./time-entry-dialog";

// ============ presets ============

type PresetKey = "week" | "month" | "last30" | "quarter" | "custom";

function firstDay(offset = 0) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset, 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function startOfWeek() {
  const d = new Date();
  const dow = (d.getDay() + 6) % 7; // segunda = 0
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}
function startOfQuarter() {
  const d = new Date();
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1).toISOString().slice(0, 10);
}

function computePreset(key: PresetKey): { start: string; end: string } | null {
  switch (key) {
    case "week":
      return { start: startOfWeek(), end: today() };
    case "month":
      return { start: firstDay(), end: today() };
    case "last30":
      return { start: daysAgo(29), end: today() };
    case "quarter":
      return { start: startOfQuarter(), end: today() };
    default:
      return null;
  }
}

// ============ helpers ============

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

function toCsv(rows: TimesheetEntry[]): string {
  const header = [
    "Data",
    "Projeto",
    "Tarefa",
    "Descrição",
    "Horas",
    "Billable",
    "Tarifa efetiva",
    "Valor",
    "Custo/h",
    "Custo",
    "Status",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((e) => {
    const h = e.hours ?? 0;
    const rate = e.effective_rate ?? 0;
    const value = e.billable ? h * rate : 0;
    const cRate = e.effective_cost_rate ?? 0;
    const status = e.approved_at ? "Aprovado" : e.billable ? "Billable" : "Interno";
    return [
      e.entry_date ?? "",
      e.project_name ?? "",
      e.task_title ?? "",
      e.description ?? "",
      h,
      e.billable ? "Sim" : "Não",
      rate,
      value,
      cRate,
      h * cRate,
      status,
    ]
      .map(esc)
      .join(";");
  });
  return [header.join(";"), ...lines].join("\n");
}

// ============ Panel ============

export function TimesheetPanel({ personId }: { personId: string }) {
  const qc = useQueryClient();
  const [preset, setPreset] = useState<PresetKey>("month");
  const [start, setStart] = useState(firstDay());
  const [end, setEnd] = useState(today());
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "billable" | "internal">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TimeEntryDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const listFn = useServerFn(listPersonTimesheet);
  const allocFn = useServerFn(listPersonAllocationsInPeriod);
  const approveFn = useServerFn(approveTimesheetEntries);
  const unapproveFn = useServerFn(unapproveTimesheetEntries);
  const deleteFn = useServerFn(deleteTimeEntry);

  const applyPreset = (key: PresetKey) => {
    setPreset(key);
    const r = computePreset(key);
    if (r) {
      setStart(r.start);
      setEnd(r.end);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["person-timesheet", personId, start, end],
    queryFn: () => listFn({ data: { person_id: personId, start, end } }),
    staleTime: 30_000,
  });

  const { data: allocs } = useQuery({
    queryKey: ["person-allocations-period", personId, start, end],
    queryFn: () => allocFn({ data: { person_id: personId, start, end } }),
    staleTime: 30_000,
  });

  const totals = data?.totals ?? {
    hours: 0,
    billableHours: 0,
    approvedHours: 0,
    pendingHours: 0,
    revenue: 0,
    cost: 0,
    margin: 0,
    capacityHours: 0,
    utilization: 0,
  };

  const projects = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of data?.entries ?? []) {
      if (e.project_id) map.set(e.project_id, e.project_name ?? e.project_id);
    }
    return Array.from(map, ([id, name]) => ({ id, name }));
  }, [data]);

  const filtered = useMemo(() => {
    const rows = data?.entries ?? [];
    return rows.filter((e) => {
      if (projectFilter !== "all" && e.project_id !== projectFilter) return false;
      if (statusFilter === "approved" && !e.approved_at) return false;
      if (statusFilter === "pending" && e.approved_at) return false;
      if (typeFilter === "billable" && !e.billable) return false;
      if (typeFilter === "internal" && e.billable) return false;
      return true;
    });
  }, [data, projectFilter, statusFilter, typeFilter]);

  const entriesByDay = useMemo(() => {
    const map = new Map<string, TimesheetEntry[]>();
    for (const e of filtered) {
      const key = e.entry_date ?? "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  const allSelected = filtered.length > 0 && filtered.every((e) => selected.has(e.id));

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(filtered.map((e) => e.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearFilters = () => {
    setProjectFilter("all");
    setStatusFilter("all");
    setTypeFilter("all");
  };

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["person-timesheet", personId] });
    qc.invalidateQueries({ queryKey: ["person-allocations-period", personId] });
  };

  const approveMut = useMutation({
    mutationFn: (ids: string[]) => approveFn({ data: { ids } }),
    onSuccess: (r) => {
      toast.success(`${r.approved} apontamento(s) aprovado(s)`);
      setSelected(new Set());
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const unapproveMut = useMutation({
    mutationFn: (ids: string[]) => unapproveFn({ data: { ids } }),
    onSuccess: (r) => {
      toast.success(`${r.unapproved} aprovação(ões) removidas`);
      setSelected(new Set());
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Apontamento excluído");
      setConfirmDelete(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleExportCsv = () => {
    const csv = toCsv(filtered);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesheet-${personId.slice(0, 8)}-${start}_${end}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filtros + Presets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Período e filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs">Preset</Label>
            <Select value={preset} onValueChange={(v) => applyPreset(v as PresetKey)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="month">Mês atual</SelectItem>
                <SelectItem value="last30">Últimos 30 dias</SelectItem>
                <SelectItem value="quarter">Trimestre</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ts-start" className="text-xs">
              Início
            </Label>
            <Input
              id="ts-start"
              type="date"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                setPreset("custom");
              }}
              className="w-[160px]"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ts-end" className="text-xs">
              Fim
            </Label>
            <Input
              id="ts-end"
              type="date"
              value={end}
              onChange={(e) => {
                setEnd(e.target.value);
                setPreset("custom");
              }}
              className="w-[160px]"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Projeto</Label>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Tipo</Label>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="billable">Billable</SelectItem>
                <SelectItem value="internal">Interno</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Limpar filtros
          </Button>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label="Horas totais"
          value={`${totals.hours.toFixed(2)}h`}
        />
        <KpiCard
          icon={<Activity className="h-4 w-4" />}
          label="Billable"
          value={`${totals.billableHours.toFixed(2)}h`}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Aprovadas"
          value={`${totals.approvedHours.toFixed(2)}h`}
          hint={`${totals.pendingHours.toFixed(2)}h pendentes`}
        />
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Utilização
            </div>
            <div className="mt-1.5 text-2xl font-semibold">{pct(totals.utilization)}</div>
            <Progress value={Math.min(100, totals.utilization * 100)} className="mt-2 h-1.5" />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {totals.billableHours.toFixed(2)}h / {totals.capacityHours.toFixed(2)}h
            </p>
          </CardContent>
        </Card>
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Receita"
          value={brl(totals.revenue)}
        />
        <KpiCard icon={<Wallet className="h-4 w-4" />} label="Custo" value={brl(totals.cost)} />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Margem"
          value={brl(totals.margin)}
          tone={totals.margin >= 0 ? "positive" : "negative"}
        />
      </div>

      {/* Alocações no período */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Alocações no período</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!allocs || allocs.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              Nenhuma alocação vigente no período.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contrato / Projeto</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead className="text-right">Capacidade</TableHead>
                  <TableHead className="text-right">Apontadas</TableHead>
                  <TableHead className="text-right">Utilização</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocs.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium">
                        {a.contract_title ?? a.project_name ?? a.contract_number ?? "—"}
                      </div>
                      {a.contract_number && a.contract_title && (
                        <div className="text-xs text-muted-foreground">#{a.contract_number}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{a.role_title ?? "—"}</TableCell>
                    <TableCell className="text-right">{a.capacityHours.toFixed(1)}h</TableCell>
                    <TableCell className="text-right">{a.billableHours.toFixed(1)}h</TableCell>
                    <TableCell className="text-right">{pct(a.utilization)}</TableCell>
                    <TableCell className="text-right">{brl(a.revenue)}</TableCell>
                    <TableCell
                      className={`text-right font-medium ${
                        a.margin >= 0
                          ? "text-emerald-600 dark:text-emerald-500"
                          : "text-destructive"
                      }`}
                    >
                      {brl(a.margin)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Barra de seleção */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex items-center justify-between rounded-md border bg-background p-2 shadow-sm">
          <span className="text-sm">{selected.size} apontamento(s) selecionado(s)</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => approveMut.mutate(Array.from(selected))}
              disabled={approveMut.isPending}
            >
              Aprovar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => unapproveMut.mutate(Array.from(selected))}
              disabled={unapproveMut.isPending}
            >
              Remover aprovação
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Limpar
            </Button>
          </div>
        </div>
      )}

      {/* Detalhes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Apontamentos</CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportCsv}
              disabled={filtered.length === 0}
            >
              <Download className="mr-1.5 h-4 w-4" />
              CSV
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Lançar horas
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
          ) : entriesByDay.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhum apontamento no período.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="Selecionar todos"
                    />
                  </TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Tarefa</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {entriesByDay.flatMap(([day, items]) => {
                  const dayHours = items.reduce((s, e) => s + (e.hours ?? 0), 0);
                  const dayValue = items.reduce(
                    (s, e) => s + (e.billable ? (e.hours ?? 0) * (e.effective_rate ?? 0) : 0),
                    0,
                  );
                  return [
                    <TableRow key={`h-${day}`} className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={4} className="py-1.5 font-mono text-xs">
                        {day}
                      </TableCell>
                      <TableCell className="py-1.5 text-right text-xs font-semibold">
                        {dayHours.toFixed(2)}h
                      </TableCell>
                      <TableCell className="py-1.5 text-right text-xs font-semibold">
                        {brl(dayValue)}
                      </TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>,
                    ...items.map((e) => {
                      const value =
                        e.billable && e.effective_rate ? (e.hours ?? 0) * e.effective_rate : 0;
                      return (
                        <TableRow
                          key={e.id}
                          data-state={selected.has(e.id) ? "selected" : undefined}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selected.has(e.id)}
                              onCheckedChange={() => toggleOne(e.id)}
                              aria-label="Selecionar linha"
                            />
                          </TableCell>
                          <TableCell>
                            {e.project_id ? (
                              <Link
                                to="/projects/$id"
                                params={{ id: e.project_id }}
                                className="hover:underline"
                              >
                                {e.project_name ?? "—"}
                              </Link>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell>{e.task_title ?? "—"}</TableCell>
                          <TableCell className="max-w-[260px] truncate text-muted-foreground">
                            {e.description ?? "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {(e.hours ?? 0).toFixed(2)}h
                          </TableCell>
                          <TableCell className="text-right">
                            {value > 0 ? brl(value) : "—"}
                          </TableCell>
                          <TableCell>
                            {e.approved_at ? (
                              <Badge variant="default">Aprovado</Badge>
                            ) : e.billable ? (
                              <Badge variant="secondary">Billable</Badge>
                            ) : (
                              <Badge variant="outline">Interno</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditing({
                                      id: e.id,
                                      project_id: e.project_id,
                                      project_name: e.project_name,
                                      task_id: e.task_id,
                                      task_title: e.task_title,
                                      allocation_id: e.allocation_id,
                                      entry_date: e.entry_date ?? undefined,
                                      hours: e.hours ?? 0,
                                      billable: e.billable,
                                      hourly_rate: e.hourly_rate,
                                      description: e.description,
                                    });
                                    setDialogOpen(true);
                                  }}
                                >
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setConfirmDelete(e.id)}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    }),
                  ];
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TimeEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        personId={personId}
        initial={editing}
      />

      <AlertDialog open={confirmDelete !== null} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir apontamento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && deleteMut.mutate(confirmDelete)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "positive" | "negative";
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div
          className={`mt-1.5 text-2xl font-semibold ${
            tone === "positive"
              ? "text-emerald-600 dark:text-emerald-500"
              : tone === "negative"
                ? "text-destructive"
                : ""
          } truncate`}
        >
          {value}
        </div>
        {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
