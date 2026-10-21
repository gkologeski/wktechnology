// Timesheet semanal do TechProjects: totais por situação agregados no banco, lista paginada,
// envio com prévia, cópia da semana anterior com prévia e atalho para a fila de aprovação.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Copy, Plus, Send } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { GridListToolbar } from "@/components/grid/grid-list-toolbar";
import { SortableTableHead } from "@/components/grid/sortable-table-head";
import { useClientSort } from "@/lib/grid-client-sort";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, MetricCard, RowSkeleton } from "@/components/techhire/ui";
import { listTimesheet } from "@/lib/project-timer.functions";
import { useCurrentUserId } from "@/hooks/use-current-user-id";
import { getTimesheetOverview } from "@/lib/projects/time-workflow.functions";
import {
  formatSeconds,
  isImportedLocked,
  REVIEW_FLAG_LABEL,
  TIME_ENTRY_STATUS_LABEL,
  type TimeEntryStatus,
} from "@/lib/projects/time-entry.shared";
import { QuickTimeEntryDialog } from "@/components/projects/quick-time-entry-dialog";
import { SubmitPeriodDialog } from "@/components/projects/submit-period-dialog";
import { CopyWeekDialog } from "@/components/projects/copy-week-dialog";

export const Route = createFileRoute("/_authenticated/projects/timesheet")({
  head: () => ({
    meta: [
      { title: "Timesheet — TechProjects" },
      {
        name: "description",
        content:
          "Timesheet semanal: registrado, enviado, aprovado e pendências por pessoa e projeto.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TimesheetPage,
});

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  x.setHours(12, 0, 0, 0);
  return x;
}
const toIso = (d: Date) => d.toLocaleDateString("sv-SE");

type Row = {
  id: string;
  user_id: string;
  entry_date: string;
  start_time: string | null;
  end_time: string | null;
  duration_seconds: number | null;
  duration_minutes: number | null;
  description: string | null;
  billable: boolean;
  status: string | null;
  source: string | null;
  review_flags: string[] | null;
  period_closing_id: string | null;
  projects?: { id: string; name: string } | null;
  project_tasks?: { id: string; title: string } | null;
};

const secsOf = (r: Row) => r.duration_seconds ?? (r.duration_minutes ?? 0) * 60;

function TimesheetPage() {
  const listFn = useServerFn(listTimesheet);
  const overviewFn = useServerFn(getTimesheetOverview);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [scope, setScope] = useState<"me" | "visible">("me");
  const [projectId, setProjectId] = useState<string>("all");
  const [quickOpen, setQuickOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart],
  );
  const from = toIso(days[0]!);
  const to = toIso(days[6]!);
  const pid = projectId === "all" ? undefined : projectId;

  const me = useCurrentUserId();
  const overview = useQuery({
    queryKey: ["timesheet-overview", from, to, scope, pid, me],
    queryFn: () =>
      overviewFn({
        data: { from, to, projectId: pid ?? null, userId: scope === "me" ? me : null },
      }),
    enabled: scope === "visible" || !!me,
  });
  const query = useQuery({
    queryKey: ["timesheet", from, to, scope, pid],
    queryFn: () => listFn({ data: { from, to, scope, projectId: pid } }),
  });

  const rows = (query.data ?? []) as unknown as Row[];
  const ov = overview.data;
  const totals = ov?.totals;
  const scheduleMissing = (ov?.by_user ?? []).filter((u) => !u.schedule_configured).length;

  const perDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.entry_date, (m.get(r.entry_date) ?? 0) + secsOf(r));
    return m;
  }, [rows]);

  const { sorted, sort, toggle, grid } = useClientSort(rows, {
    date: (r) => r.entry_date,
    project: (r) => r.projects?.name,
    task: (r) => r.project_tasks?.title,
    desc: (r) => r.description,
    billable: (r) => (r.billable ? "Sim" : "Não"),
    status: (r) => r.status,
  });

  const shiftWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timesheet"
        description="Semana de apontamentos: registrado, enviado, aprovado e histórico importado. Envio e cópia sempre com prévia."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="Semana anterior"
              onClick={() => shiftWeek(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[170px] text-center text-sm text-muted-foreground">
              {days[0]!.toLocaleDateString("pt-BR")} — {days[6]!.toLocaleDateString("pt-BR")}
            </div>
            <Button
              variant="outline"
              size="icon"
              aria-label="Próxima semana"
              onClick={() => shiftWeek(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekStart(startOfWeek(new Date()))}
            >
              Hoje
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          value={scope}
          onValueChange={(v) => v && setScope(v as "me" | "visible")}
          aria-label="Quem mostrar"
        >
          <ToggleGroupItem value="me" size="sm">
            Minhas horas
          </ToggleGroupItem>
          <ToggleGroupItem value="visible" size="sm">
            Equipe (o que posso ver)
          </ToggleGroupItem>
        </ToggleGroup>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger className="w-56" aria-label="Filtrar por projeto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os projetos</SelectItem>
            {(ov?.by_project ?? []).map((p) => (
              <SelectItem key={p.project_id} value={p.project_id}>
                {p.name ?? "Projeto"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => setCopyOpen(true)}>
            <Copy className="mr-1 h-3.5 w-3.5" /> Copiar semana anterior
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSubmitOpen(true)}>
            <Send className="mr-1 h-3.5 w-3.5" /> Enviar semana
          </Button>
          <Button size="sm" onClick={() => setQuickOpen(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Apontar horas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Registrado" value={formatSeconds(totals?.registered ?? 0)} />
        <MetricCard label="Rascunho" value={formatSeconds(totals?.draft ?? 0)} />
        <MetricCard label="Enviado" value={formatSeconds(totals?.submitted ?? 0)} />
        <MetricCard label="Aprovado" value={formatSeconds(totals?.approved ?? 0)} tone="positive" />
        <MetricCard label="Devolvido" value={formatSeconds(totals?.rejected ?? 0)} />
        <MetricCard
          label="Importado (histórico)"
          value={formatSeconds(totals?.locked_import ?? 0)}
          hint="Bloqueado, não aprovado"
        />
      </div>
      {scheduleMissing > 0 && (
        <p className="text-xs text-muted-foreground" role="status">
          {scope === "me"
            ? "Sua jornada não está cadastrada no TechPeople: capacidade prevista não configurada."
            : `${scheduleMissing} pessoa(s) sem jornada cadastrada no TechPeople: capacidade prevista não configurada.`}{" "}
          <Link to="/projects/hours-review" className="underline">
            Fila de aprovação
          </Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {days.map((d) => (
          <div key={toIso(d)} className="rounded-md border bg-card p-3">
            <div className="text-xs uppercase text-muted-foreground">
              {d.toLocaleDateString("pt-BR", { weekday: "short" })}
            </div>
            <div className="text-sm font-medium">{d.toLocaleDateString("pt-BR")}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {formatSeconds(perDay.get(toIso(d)) ?? 0)}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-md border">
        <GridListToolbar
          grid={grid}
          filename="timesheet"
          labels={{
            date: "Data",
            project: "Projeto",
            task: "Tarefa",
            desc: "Descrição",
            billable: "Faturável",
            status: "Situação",
          }}
        />
        {query.isLoading ? (
          <div className="space-y-2 p-3">
            <RowSkeleton />
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : query.isError ? (
          <EmptyState
            title="Não foi possível carregar o timesheet"
            description="Tente novamente em instantes."
            action={
              <Button variant="outline" onClick={() => void query.refetch()}>
                Tentar novamente
              </Button>
            }
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Sem apontamentos na semana"
            description="Use Apontar horas ou o cronômetro."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  label="Data"
                  active={sort?.key === "date"}
                  dir={sort?.dir}
                  onSort={() => toggle("date")}
                />
                <SortableTableHead
                  label="Projeto"
                  active={sort?.key === "project"}
                  dir={sort?.dir}
                  onSort={() => toggle("project")}
                />
                <SortableTableHead
                  label="Tarefa"
                  active={sort?.key === "task"}
                  dir={sort?.dir}
                  onSort={() => toggle("task")}
                />
                <SortableTableHead
                  label="Descrição"
                  active={sort?.key === "desc"}
                  dir={sort?.dir}
                  onSort={() => toggle("desc")}
                />
                <TableHead>Horário</TableHead>
                <TableHead className="text-right">Duração</TableHead>
                <SortableTableHead
                  label="Faturável"
                  active={sort?.key === "billable"}
                  dir={sort?.dir}
                  onSort={() => toggle("billable")}
                />
                <SortableTableHead
                  label="Situação"
                  active={sort?.key === "status"}
                  dir={sort?.dir}
                  onSort={() => toggle("status")}
                />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {new Date(`${r.entry_date}T12:00:00`).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-sm">{r.projects?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.project_tasks?.title ?? "—"}</TableCell>
                  <TableCell
                    className="max-w-[260px] truncate text-sm"
                    title={r.description ?? undefined}
                  >
                    {r.description ?? "—"}
                    {(r.review_flags ?? []).length > 0 && (
                      <span className="block text-xs text-muted-foreground">
                        {(r.review_flags ?? []).map((f) => REVIEW_FLAG_LABEL[f] ?? f).join(" · ")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm tabular-nums">
                    {r.start_time && r.end_time
                      ? `${r.start_time.slice(0, 5)}–${r.end_time.slice(0, 5)}`
                      : "sem horário"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSeconds(secsOf(r))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.billable ? "default" : "secondary"}>
                      {r.billable ? "Faturável" : "Interno"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.status === "rejected"
                          ? "destructive"
                          : r.status === "approved"
                            ? "default"
                            : "outline"
                      }
                    >
                      {isImportedLocked(r)
                        ? "Importado (histórico)"
                        : TIME_ENTRY_STATUS_LABEL[(r.status ?? "draft") as TimeEntryStatus]}
                      {r.period_closing_id ? " · fechado" : ""}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {rows.length >= 200 && (
          <p className="p-3 text-xs text-muted-foreground">
            Mostrando os primeiros 200 apontamentos; os totais acima consideram todos. Filtre por
            projeto para ver o restante.
          </p>
        )}
      </div>

      <QuickTimeEntryDialog
        open={quickOpen}
        onOpenChange={setQuickOpen}
        draft={{ entryDate: from }}
      />
      <SubmitPeriodDialog open={submitOpen} onOpenChange={setSubmitOpen} from={from} to={to} />
      <CopyWeekDialog open={copyOpen} onOpenChange={setCopyOpen} from={from} to={to} />
    </div>
  );
}
