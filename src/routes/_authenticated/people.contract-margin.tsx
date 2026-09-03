// TechPeople · Sprint 14 — /people/contract-margin
// Relatório de margem por contrato consolidando horas, receita e custo.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, DollarSign, Clock, TrendingUp, Users } from "lucide-react";

import { IsoDateRangePicker } from "@/components/iso-date-range-picker";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getContractMarginReport } from "@/lib/people/contract-margin.functions";

export const Route = createFileRoute("/_authenticated/people/contract-margin")({
  head: () => ({
    meta: [
      { title: "Margem por contrato — TechPeople" },
      {
        name: "description",
        content:
          "Relatório de margem por contrato: horas apontadas, receita billable, custo e margem líquida.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ContractMarginPage,
});

function fmtCurrency(v: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(v);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
function firstDayOfMonthIso() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function ContractMarginPage() {
  const fn = useServerFn(getContractMarginReport);
  const [start, setStart] = useState<string>(firstDayOfMonthIso());
  const [end, setEnd] = useState<string>(todayIso());

  const q = useQuery({
    queryKey: ["people-contract-margin", start, end],
    queryFn: () => fn({ data: { start: start || undefined, end: end || undefined } }),
  });

  const rows = q.data?.rows ?? [];
  const totals = rows.reduce(
    (acc, r) => {
      acc.hours += r.hours;
      acc.revenue += r.revenue;
      acc.cost += r.cost;
      acc.margin += r.margin;
      acc.invoiced += r.invoiced_amount;
      return acc;
    },
    { hours: 0, revenue: 0, cost: 0, margin: 0, invoiced: 0 },
  );
  const marginPct = totals.revenue > 0 ? (totals.margin / totals.revenue) * 100 : 0;

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Margem por contrato"
        description="Consolidação de horas apontadas, receita billable, custo e margem líquida por contrato."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link to="/people">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" /> Horas totais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold truncate">{totals.hours.toFixed(2)}h</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" /> Receita
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold truncate">{fmtCurrency(totals.revenue)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Faturado: {fmtCurrency(totals.invoiced)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Custo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold truncate">{fmtCurrency(totals.cost)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Margem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold truncate">{fmtCurrency(totals.margin)}</div>
            <div className="text-xs text-muted-foreground mt-1">{marginPct.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <CardTitle className="text-base">Contratos</CardTitle>
            <div className="flex gap-2">
              <IsoDateRangePicker
                ariaLabel="Período dos contratos"
                from={start}
                to={end}
                onChange={({ from, to }) => {
                  setStart(from);
                  setEnd(to);
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center">
              Nenhum apontamento encontrado no período.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Contrato</TableHead>
                  <TableHead className="text-right">
                    <Users className="inline h-3.5 w-3.5 mr-1" />
                    Pessoas
                  </TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.contract_id ?? "sem-contrato"}>
                    <TableCell className="font-medium">
                      {r.company_name ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {r.contract_id ? (
                        <Link
                          to="/contracts/$id"
                          params={{ id: r.contract_id }}
                          className="hover:underline"
                        >
                          <div className="flex flex-col">
                            <span className="text-sm">{r.contract_number ?? r.contract_title}</span>
                            {r.contract_number && r.contract_title && (
                              <span className="text-xs text-muted-foreground">
                                {r.contract_title}
                              </span>
                            )}
                          </div>
                        </Link>
                      ) : (
                        <Badge variant="outline">Sem contrato</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.people_count}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.hours.toFixed(2)}
                      {r.billable_hours < r.hours && (
                        <div className="text-xs text-muted-foreground">
                          {r.billable_hours.toFixed(2)} billable
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtCurrency(r.revenue, r.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtCurrency(r.cost, r.currency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span
                        className={
                          r.margin >= 0
                            ? "text-emerald-600 dark:text-emerald-400 font-medium"
                            : "text-red-600 dark:text-red-400 font-medium"
                        }
                      >
                        {fmtCurrency(r.margin, r.currency)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Badge variant={r.margin_pct >= 0 ? "secondary" : "destructive"}>
                        {r.margin_pct.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
