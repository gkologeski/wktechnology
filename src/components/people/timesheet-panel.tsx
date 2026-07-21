// Painel de Timesheet — Sprint 5 do TechPeople.
// Consolida apontamentos de horas da pessoa em um intervalo, com KPIs e detalhamento.
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Clock, TrendingUp, DollarSign, CheckCircle2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listPersonTimesheet } from "@/lib/people/timesheet.functions";

function firstDayOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function TimesheetPanel({ personId }: { personId: string }) {
  const [start, setStart] = useState(firstDayOfMonth());
  const [end, setEnd] = useState(today());
  const listFn = useServerFn(listPersonTimesheet);

  const { data, isLoading } = useQuery({
    queryKey: ["person-timesheet", personId, start, end],
    queryFn: () => listFn({ data: { person_id: personId, start, end } }),
    staleTime: 30_000,
  });

  const totals = data?.totals ?? {
    hours: 0,
    billableHours: 0,
    approvedHours: 0,
    revenue: 0,
    cost: 0,
    margin: 0,
  };

  const entriesByDay = useMemo(() => {
    type Entry = NonNullable<typeof data>["entries"][number];
    const map = new Map<string, Entry[]>();
    for (const e of data?.entries ?? []) {
      const key = e.entry_date ?? "—";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [data]);

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Período</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="ts-start" className="text-xs">
              Início
            </Label>
            <Input
              id="ts-start"
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-[180px]"
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
              onChange={(e) => setEnd(e.target.value)}
              className="w-[180px]"
            />
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label="Horas totais"
          value={`${totals.hours.toFixed(2)}h`}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Horas aprovadas"
          value={`${totals.approvedHours.toFixed(2)}h`}
        />
        <KpiCard
          icon={<DollarSign className="h-4 w-4" />}
          label="Receita realizada"
          value={brl(totals.revenue)}
        />
        <KpiCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Margem realizada"
          value={brl(totals.margin)}
          tone={totals.margin >= 0 ? "positive" : "negative"}
        />
      </div>

      {/* Detalhes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Apontamentos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Carregando...</div>
          ) : entriesByDay.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              Nenhum apontamento no período.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Tarefa</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entriesByDay.flatMap(([day, items]) =>
                  items.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{day}</TableCell>
                      <TableCell>{e.project_name ?? "—"}</TableCell>
                      <TableCell>{e.task_title ?? "—"}</TableCell>
                      <TableCell className="max-w-[260px] truncate text-muted-foreground">
                        {e.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {(e.hours ?? 0).toFixed(2)}h
                      </TableCell>
                      <TableCell className="text-right">
                        {e.billable && e.hourly_rate
                          ? brl((e.hours ?? 0) * e.hourly_rate)
                          : "—"}
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
                    </TableRow>
                  )),
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "positive" | "negative";
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
          }`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
