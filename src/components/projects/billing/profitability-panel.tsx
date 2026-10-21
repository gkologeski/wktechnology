// Rentabilidade de projeto ou contrato: receitas separadas por situação (nunca somadas), custo estimado
// (horas × tarifa vigente na data + custo mensal alocado) separado do custo real lançado no Financeiro,
// cobertura e margem só quando a cobertura permite. Valores vêm prontos do banco, conforme a permissão.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Info } from "lucide-react";

import { EmptyState, MetricCard, RowSkeleton, SectionHeader } from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
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
import { getProfitability } from "@/lib/projects/billing.functions";
import { formatMoney, formatPct, toCsv } from "@/lib/projects/billing.shared";
import { formatSeconds } from "@/lib/projects/time-entry.shared";

function currentMonth(offset = 0) {
  const d = new Date();
  const x = new Date(d.getFullYear(), d.getMonth() + offset, 1, 12);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
}

function download(name: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ProfitabilityPanel({
  projectId,
  contractId,
  defaultCurrency = "BRL",
}: {
  projectId?: string;
  contractId?: string;
  defaultCurrency?: string;
}) {
  const fn = useServerFn(getProfitability);
  const [fromMonth, setFromMonth] = useState(() => currentMonth(-2));
  const [toMonth, setToMonth] = useState(() => currentMonth(0));
  const [currency, setCurrency] = useState(defaultCurrency);
  const valid =
    /^\d{4}-\d{2}$/.test(fromMonth) &&
    /^\d{4}-\d{2}$/.test(toMonth) &&
    /^[A-Za-z]{3}$/.test(currency);

  const q = useQuery({
    queryKey: [
      "profitability",
      projectId ?? null,
      contractId ?? null,
      fromMonth,
      toMonth,
      currency.toUpperCase(),
    ],
    queryFn: () =>
      fn({ data: { projectId, contractId, fromMonth, toMonth, currency: currency.toUpperCase() } }),
    enabled: valid,
    retry: false,
  });
  const p = q.data;
  const cur = p?.currency ?? currency.toUpperCase();
  // Custo ausente nunca vira zero: sem nenhuma hora coberta (e sem custo mensal) é desconhecido;
  // com cobertura parcial, o valor é rotulado como parcial.
  const costLabel = (() => {
    if (!p) return "";
    const total = p.effort.total_seconds;
    const covered = p.effort.cost_covered_seconds;
    if (total > 0 && covered === 0 && p.cost.monthly_rates === 0) return "desconhecido";
    const v = formatMoney(p.cost.estimated, cur);
    return total > 0 && covered < total ? `${v} (parcial)` : v;
  })();

  const exportCsv = () => {
    if (!p) return;
    const rows: Array<Record<string, unknown>> = [
      { item: "Receita prevista (rascunho/revisão)", valor: p.revenue.forecast },
      { item: "Receita aprovada (medida)", valor: p.revenue.approved },
      { item: "Lançada no Financeiro", valor: p.finance.launched },
      { item: "Recebida", valor: p.finance.received },
      { item: "Estornada", valor: p.revenue.reversed },
      { item: "Custo estimado", valor: p.cost.estimated },
      { item: "Custo real (títulos a pagar)", valor: p.cost.actual_payables },
      { item: "Margem estimada", valor: p.margin.estimated ?? "desconhecida" },
      { item: "Cobertura de custo (%)", valor: p.coverage.cost_pct ?? "n/a" },
      { item: "Horas registradas (s)", valor: p.effort.total_seconds },
    ];
    for (const person of p.people ?? []) {
      rows.push({ item: `Custo — ${person.name ?? person.user_id}`, valor: person.cost_hourly });
    }
    download(
      `rentabilidade-${p.period_from}-${p.period_to}-${cur}.csv`,
      toCsv(rows, [
        ["item", "Item"],
        ["valor", `Valor (${cur})`],
      ]),
    );
  };

  return (
    <section className="space-y-4 rounded-lg border bg-card p-4">
      <SectionHeader
        title="Rentabilidade"
        description="Receitas por situação (prevista, aprovada, lançada, recebida) nunca somadas entre si. Custo estimado usa a tarifa vigente na data de cada apontamento; custo real vem dos títulos a pagar do Financeiro."
        action={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!p}>
            <Download className="mr-1 h-4 w-4" aria-hidden="true" /> Exportar CSV
          </Button>
        }
      />
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label htmlFor="pf-from">De</Label>
          <Input
            id="pf-from"
            type="month"
            value={fromMonth}
            onChange={(e) => setFromMonth(e.target.value)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="pf-to">Até</Label>
          <Input
            id="pf-to"
            type="month"
            value={toMonth}
            onChange={(e) => setToMonth(e.target.value)}
          />
        </div>
        <div className="grid w-24 gap-1">
          <Label htmlFor="pf-cur">Moeda</Label>
          <Input
            id="pf-cur"
            value={currency}
            maxLength={3}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          />
        </div>
      </div>

      {q.isLoading ? (
        <RowSkeleton />
      ) : q.isError ? (
        <EmptyState title="Rentabilidade indisponível" description={(q.error as Error).message} />
      ) : !p ? null : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Receita aprovada (medida)"
              value={formatMoney(p.revenue.approved, cur)}
              hint={`Prevista: ${formatMoney(p.revenue.forecast, cur)}`}
            />
            <MetricCard
              label="Lançada no Financeiro"
              value={formatMoney(p.finance.launched, cur)}
              hint={`Recebida: ${formatMoney(p.finance.received, cur)}`}
            />
            <MetricCard
              label="Custo estimado"
              value={costLabel}
              hint={`Cobertura de custo: ${formatPct(p.coverage.cost_pct)}`}
              tone={
                p.coverage.cost_pct !== null && p.coverage.cost_pct < 100 ? "warning" : "neutral"
              }
            />
            <MetricCard
              label="Margem estimada"
              value={
                p.margin.estimated === null ? "desconhecida" : formatMoney(p.margin.estimated, cur)
              }
              hint={
                p.margin.estimated === null
                  ? "Falta custo para parte das horas"
                  : `Margem: ${formatPct(p.margin.estimated_pct)}`
              }
              tone={
                p.margin.estimated === null
                  ? "warning"
                  : p.margin.estimated < 0
                    ? "negative"
                    : "positive"
              }
            />
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <dl className="space-y-1 rounded-md border p-3">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Horas registradas</dt>
                <dd className="tabular-nums">{formatSeconds(p.effort.total_seconds)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Aprovadas · pendentes</dt>
                <dd className="tabular-nums">
                  {formatSeconds(p.effort.approved_seconds)} ·{" "}
                  {formatSeconds(p.effort.pending_seconds)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Importadas (histórico, não cobradas)</dt>
                <dd className="tabular-nums">{formatSeconds(p.effort.imported_seconds)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Custo por hora · custo mensal alocado</dt>
                <dd className="tabular-nums">
                  {p.effort.cost_covered_seconds === 0 && p.effort.total_seconds > 0
                    ? "desconhecido"
                    : formatMoney(p.cost.hourly, cur)}{" "}
                  · {formatMoney(p.cost.monthly_allocated, cur)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Custo real (títulos a pagar vinculados)</dt>
                <dd className="tabular-nums">{formatMoney(p.cost.actual_payables, cur)}</dd>
              </div>
            </dl>
            <dl className="space-y-1 rounded-md border p-3">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Cobertura de preço · vínculo de pessoa</dt>
                <dd className="tabular-nums">
                  {formatPct(p.coverage.price_pct)} · {formatPct(p.coverage.person_link_pct)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">
                  Margem parcial das horas com custo e preço
                </dt>
                <dd className="tabular-nums">
                  {p.margin.partial_hours.seconds > 0 ? (
                    <>
                      {formatMoney(p.margin.partial_hours.margin, cur)} (
                      {formatPct(p.margin.partial_hours.margin_pct)}) em{" "}
                      {formatSeconds(p.margin.partial_hours.seconds)}
                    </>
                  ) : (
                    "sem horas com custo e preço"
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Margem com custo real lançado</dt>
                <dd className="tabular-nums">
                  {formatMoney(p.margin.actual, cur)} ({formatPct(p.margin.actual_pct)})
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Estornada</dt>
                <dd className="tabular-nums">{formatMoney(p.revenue.reversed, cur)}</dd>
              </div>
            </dl>
          </div>
          <ul className="space-y-1 text-xs text-muted-foreground" aria-live="polite">
            {p.revenue.unattributed_approved > 0 && (
              <li className="flex gap-1">
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {formatMoney(p.revenue.unattributed_approved, cur)} medidos no serviço/contrato não
                são atribuídos a um projeto (mensalidade, franquia, ajustes).
              </li>
            )}
            {p.finance.shared_measurements > 0 && (
              <li className="flex gap-1">
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {p.finance.shared_measurements} medição(ões) gerada(s) atendem a vários projetos; o
                valor lançado aparece no contrato.
              </li>
            )}
            {p.revenue.unknown_amount > 0 && (
              <li className="flex gap-1">
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {p.revenue.unknown_amount} medição(ões) com valor ainda desconhecido (falta tarifa
                ou valor).
              </li>
            )}
            {p.other_currencies.length > 0 && (
              <li className="flex gap-1">
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Há valores em {p.other_currencies.join(", ")} que não são somados nem convertidos
                aqui.
              </li>
            )}
            {p.reconciliation_open > 0 && (
              <li className="flex gap-1">
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {p.reconciliation_open} alerta(s) de conciliação de horas em aberto neste escopo.
              </li>
            )}
            {!p.can_view_rates && (
              <li className="flex gap-1">
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Custos por pessoa ocultos: exigem a permissão de ver tarifas e custos.
              </li>
            )}
          </ul>
          {p.people && p.people.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pessoa</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead className="text-right">Com custo</TableHead>
                    <TableHead className="text-right">Custo estimado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.people.map((r) => (
                    <TableRow key={r.user_id}>
                      <TableCell>{r.name ?? "Sem nome"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatSeconds(r.seconds)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatSeconds(r.covered_seconds ?? 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(r.covered_seconds ?? 0) === 0
                          ? "desconhecido"
                          : `${formatMoney(r.cost_hourly, cur)}${(r.covered_seconds ?? 0) < r.seconds ? " (parcial)" : ""}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {p.projects && p.projects.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Projeto</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    <TableHead className="text-right">Com custo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.projects.map((r) => (
                    <TableRow key={r.project_id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatSeconds(r.seconds)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatSeconds(r.covered_seconds ?? 0)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
