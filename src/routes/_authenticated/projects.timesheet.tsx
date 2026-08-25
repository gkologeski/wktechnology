// Sprint D — Timesheet semanal (Clockify-like) do TechProjects.
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
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
import { Checkbox } from "@/components/ui/checkbox";
import { listTimesheet, approveTimeEntries } from "@/lib/project-timer.functions";

export const Route = createFileRoute("/_authenticated/projects/timesheet")({
  head: () => ({
    meta: [
      { title: "Timesheet — TechProjects" },
      { name: "description", content: "Timesheet semanal com apontamentos de horas por projeto." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TimesheetPage,
});

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0 = Sun
  const diff = (day + 6) % 7; // segunda como início
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function fmtHours(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h${String(mm).padStart(2, "0")}`;
}

function TimesheetPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTimesheet);
  const approveFn = useServerFn(approveTimeEntries);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [weekStart],
  );
  const from = toIsoDate(days[0]!);
  const to = toIsoDate(days[6]!);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ["timesheet", from, to],
    queryFn: () => listFn({ data: { from, to } }),
  });

  const approveMut = useMutation({
    mutationFn: (ids: string[]) => approveFn({ data: { ids } }),
    onSuccess: () => {
      toast.success("Horas aprovadas");
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["timesheet"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao aprovar"),
  });

  const rows = (query.data ?? []) as Array<{
    id: string;
    project_id: string;
    task_id: string | null;
    entry_date: string;
    hours: number | null;
    description: string | null;
    billable: boolean;
    approved_at: string | null;
    hourly_rate: number | null;
    projects?: { id: string; name: string } | null;
    project_tasks?: { id: string; title: string } | null;
  }>;

  const totalsPerDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      m.set(r.entry_date, (m.get(r.entry_date) ?? 0) + (r.hours ?? 0));
    }
    return m;
  }, [rows]);
  const total = rows.reduce((acc, r) => acc + (r.hours ?? 0), 0);

  function shiftWeek(delta: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d);
    setSelected(new Set());
  }

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectableIds = rows.filter((r) => !r.approved_at).map((r) => r.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timesheet"
        description="Apontamentos de horas da semana. Aprove entradas billable para gerar cobrança."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => shiftWeek(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm text-muted-foreground min-w-[180px] text-center">
              {days[0]!.toLocaleDateString("pt-BR")} — {days[6]!.toLocaleDateString("pt-BR")}
            </div>
            <Button variant="outline" size="sm" onClick={() => shiftWeek(1)}>
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

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {days.map((d) => (
          <div key={d.toISOString()} className="rounded-md border p-3 bg-card">
            <div className="text-xs text-muted-foreground uppercase">
              {d.toLocaleDateString("pt-BR", { weekday: "short" })}
            </div>
            <div className="text-sm font-medium">{d.toLocaleDateString("pt-BR")}</div>
            <div className="text-lg font-semibold mt-1 tabular-nums">
              {fmtHours(totalsPerDay.get(toIsoDate(d)) ?? 0)}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Total da semana: <span className="font-semibold text-foreground">{fmtHours(total)}</span>
        </div>
        <Button
          size="sm"
          disabled={selected.size === 0 || approveMut.isPending}
          onClick={() => approveMut.mutate(Array.from(selected))}
        >
          <Check className="h-3 w-3 mr-1" />
          Aprovar selecionados ({selected.size})
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={(v) => {
                    if (v) setSelected(new Set(selectableIds));
                    else setSelected(new Set());
                  }}
                />
              </TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Projeto</TableHead>
              <TableHead>Tarefa</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Horas</TableHead>
              <TableHead>Billable</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                  Sem apontamentos na semana.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Checkbox
                      disabled={Boolean(r.approved_at)}
                      checked={selected.has(r.id)}
                      onCheckedChange={() => toggle(r.id)}
                    />
                  </TableCell>
                  <TableCell className="text-sm">
                    {new Date(r.entry_date + "T12:00:00").toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-sm">{r.projects?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.project_tasks?.title ?? "—"}</TableCell>
                  <TableCell className="text-sm max-w-[280px] truncate">
                    {r.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {fmtHours(r.hours ?? 0)}
                  </TableCell>
                  <TableCell>
                    {r.billable ? (
                      <Badge variant="default">Billable</Badge>
                    ) : (
                      <Badge variant="secondary">Interno</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.approved_at ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        Aprovado
                      </Badge>
                    ) : (
                      <Badge variant="outline">Pendente</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
