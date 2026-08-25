import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { BarChart3, Download, Info } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/crm";
import { getDreReport } from "@/lib/finance.functions";
import {
  LegalEntitySelect,
  useLegalEntityFilter,
  useLegalEntityFilterInput,
} from "@/components/finance/legal-entity-select";

export const Route = createFileRoute("/_authenticated/finance/dre")({
  head: () => ({
    meta: [
      { title: "DRE gerencial" },
      { name: "description", content: "Demonstrativo de resultado por competência." },
    ],
  }),
  component: DrePage,
});

function formatMonth(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function DrePage() {
  const get = useServerFn(getDreReport);
  const [months, setMonths] = useState(6);
  const [basis, setBasis] = useState<"accrual" | "cash">("accrual");
  const [legalEntityId, setLegalEntityId] = useLegalEntityFilter();

  const filterInput = useLegalEntityFilterInput(legalEntityId);
  const { data, isLoading } = useQuery({
    queryKey: ["finance", "dre", months, basis, legalEntityId, JSON.stringify(filterInput)],
    queryFn: () =>
      get({
        data: {
          months,
          basis,
          ...filterInput,
        },
      }),
  });

  const revenueRows = useMemo(
    () => (data?.categories ?? []).filter((c) => c.kind === "revenue"),
    [data],
  );
  const expenseRows = useMemo(
    () => (data?.categories ?? []).filter((c) => c.kind === "expense"),
    [data],
  );

  const monthList = data?.months ?? [];

  function exportCsv() {
    if (!data) return;
    const header = ["Categoria", "Tipo", ...monthList.map(formatMonth), "Total"];
    const rows = data.categories.map((c) => [
      c.category_name,
      c.kind === "revenue" ? "Receita" : "Despesa",
      ...monthList.map((m) => String(c.byMonth[m] ?? 0)),
      String(c.total),
    ]);
    rows.push([
      "Receita total",
      "",
      ...data.totals.revenue.map(String),
      String(data.totals.totalRevenue),
    ]);
    rows.push([
      "Despesa total",
      "",
      ...data.totals.expense.map(String),
      String(data.totals.totalExpense),
    ]);
    rows.push(["Resultado", "", ...data.totals.result.map(String), String(data.totals.netResult)]);
    const csv = [header, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dre-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="DRE gerencial"
        description={
          basis === "accrual"
            ? "Receitas e despesas por competência (regime de competência)."
            : "Receitas e despesas por data de pagamento (regime de caixa)."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={basis} onValueChange={(v) => setBasis(v as "accrual" | "cash")}>
              <TabsList>
                <TabsTrigger value="accrual">Competência</TabsTrigger>
                <TabsTrigger value="cash">Caixa</TabsTrigger>
              </TabsList>
            </Tabs>
            <LegalEntitySelect value={legalEntityId} onChange={setLegalEntityId} />
            <Select value={String(months)} onValueChange={(v) => setMonths(Number(v))}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Últimos 3 meses</SelectItem>
                <SelectItem value="6">Últimos 6 meses</SelectItem>
                <SelectItem value="12">Últimos 12 meses</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={exportCsv} disabled={!data}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
          </div>
        }
      />

      {data?.consolidation?.isGroup && (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm flex items-center justify-between gap-2 cursor-help">
                <span className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary" />
                  <strong>Consolidado</strong> — {data.consolidation.groupSize} CNPJs do grupo
                </span>
                <span className="text-muted-foreground text-xs">
                  {data.consolidation.intercompanyEliminated} transação(ões) intercompany
                  eliminada(s)
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-sm">
              Transações entre CNPJs do grupo são eliminadas para não inflar receitas e despesas na
              visão consolidada.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {data?.consolidation?.isGroup && (
        <Alert variant="default" className="bg-muted/40">
          <Info className="h-4 w-4" />
          <AlertTitle>Como funciona a eliminação intercompany</AlertTitle>
          <AlertDescription>
            Quando um grupo empresarial é selecionado, lançamentos cuja empresa e contra-parte
            pertencem ao mesmo grupo são excluídos do cálculo. Isso evita que vendas internas entre
            CNPJs do grupo sejam contadas como receita/despesa real.
          </AlertDescription>
        </Alert>
      )}

      {data && (
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard label="Receita total" value={data.totals.totalRevenue} tone="positive" />
          <SummaryCard label="Despesa total" value={data.totals.totalExpense} tone="negative" />
          <SummaryCard
            label={`Resultado (${(data.totals.margin * 100).toFixed(1)}%)`}
            value={data.totals.netResult}
            tone={data.totals.netResult >= 0 ? "positive" : "negative"}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Demonstrativo
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
          {isLoading && <p className="text-sm text-muted-foreground p-4">Carregando DRE…</p>}
          {!isLoading && data && (
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Categoria</th>
                  {monthList.map((m) => (
                    <th key={m} className="text-right px-3 py-2 font-medium tabular-nums">
                      {formatMonth(m)}
                    </th>
                  ))}
                  <th className="text-right px-4 py-2 font-medium tabular-nums">Total</th>
                </tr>
              </thead>
              <tbody>
                <SectionHeaderRow label="Receitas" colSpan={monthList.length + 2} />
                {revenueRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={monthList.length + 2}
                      className="px-4 py-2 text-muted-foreground italic"
                    >
                      Sem receitas no período.
                    </td>
                  </tr>
                )}
                {revenueRows.map((c) => (
                  <CategoryRow key={c.category_id ?? c.category_name} cat={c} months={monthList} />
                ))}
                <TotalRow
                  label="Receita total"
                  monthValues={data.totals.revenue}
                  total={data.totals.totalRevenue}
                  months={monthList}
                  tone="positive"
                />

                <SectionHeaderRow label="Despesas" colSpan={monthList.length + 2} />
                {expenseRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={monthList.length + 2}
                      className="px-4 py-2 text-muted-foreground italic"
                    >
                      Sem despesas no período.
                    </td>
                  </tr>
                )}
                {expenseRows.map((c) => (
                  <CategoryRow key={c.category_id ?? c.category_name} cat={c} months={monthList} />
                ))}
                <TotalRow
                  label="Despesa total"
                  monthValues={data.totals.expense}
                  total={data.totals.totalExpense}
                  months={monthList}
                  tone="negative"
                />

                <TotalRow
                  label="Resultado"
                  monthValues={data.totals.result}
                  total={data.totals.netResult}
                  months={monthList}
                  tone={data.totals.netResult >= 0 ? "positive" : "negative"}
                  emphasized
                />
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "positive" | "negative";
}) {
  const cls =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-semibold tabular-nums ${cls} truncate`}>
          {formatCurrency(value)}
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeaderRow({ label, colSpan }: { label: string; colSpan: number }) {
  return (
    <tr className="bg-muted/60">
      <td colSpan={colSpan} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide">
        {label}
      </td>
    </tr>
  );
}

function CategoryRow({
  cat,
  months,
}: {
  cat: {
    category_name: string;
    byMonth: Record<string, number>;
    total: number;
  };
  months: string[];
}) {
  return (
    <tr className="border-b hover:bg-muted/20">
      <td className="px-4 py-1.5">{cat.category_name}</td>
      {months.map((m) => (
        <td key={m} className="text-right px-3 py-1.5 tabular-nums">
          {formatCurrency(cat.byMonth[m] ?? 0)}
        </td>
      ))}
      <td className="text-right px-4 py-1.5 tabular-nums font-medium">
        {formatCurrency(cat.total)}
      </td>
    </tr>
  );
}

function TotalRow({
  label,
  monthValues,
  total,
  months,
  tone,
  emphasized,
}: {
  label: string;
  monthValues: number[];
  total: number;
  months: string[];
  tone: "positive" | "negative";
  emphasized?: boolean;
}) {
  const cls =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";
  return (
    <tr className={emphasized ? "bg-muted/40 border-t-2" : "bg-muted/20 border-t"}>
      <td className={`px-4 py-2 font-semibold ${emphasized ? "" : ""}`}>{label}</td>
      {months.map((m, i) => (
        <td
          key={m}
          className={`text-right px-3 py-2 tabular-nums font-medium ${emphasized ? cls : ""}`}
        >
          {formatCurrency(monthValues[i] ?? 0)}
        </td>
      ))}
      <td className={`text-right px-4 py-2 tabular-nums font-semibold ${cls}`}>
        {formatCurrency(total)}
      </td>
    </tr>
  );
}
