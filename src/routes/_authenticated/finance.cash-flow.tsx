import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, Settings2, Info } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/crm";
import { getCashFlowProjection } from "@/lib/finance.functions";
import {
  LegalEntitySelect,
  useLegalEntityFilter,
  useLegalEntityFilterInput,
} from "@/components/finance/legal-entity-select";

export const Route = createFileRoute("/_authenticated/finance/cash-flow")({
  head: () => ({
    meta: [
      { title: "Fluxo de caixa" },
      { name: "description", content: "Projeção 30/60/90 dias com cenários." },
    ],
  }),
  component: CashFlowPage,
});

type ScenarioKey = "pessimistic" | "realistic" | "optimistic";
const BUCKET_LABELS: Record<"overdue" | "d30" | "d60" | "d90", string> = {
  overdue: "Vencido",
  d30: "0–30 dias",
  d60: "31–60 dias",
  d90: "61–90 dias",
};

function CashFlowPage() {
  const get = useServerFn(getCashFlowProjection);
  const [factors, setFactors] = useState({
    pessimistic: 0.7,
    realistic: 1.0,
    optimistic: 1.05,
    expenseFactorPessimistic: 1.0,
    expenseFactorRealistic: 1.0,
    expenseFactorOptimistic: 1.0,
  });
  const [legalEntityId, setLegalEntityId] = useLegalEntityFilter();

  const filterInput = useLegalEntityFilterInput(legalEntityId);
  const { data, isLoading } = useQuery({
    queryKey: ["finance", "cash-flow", factors, legalEntityId, JSON.stringify(filterInput)],
    queryFn: () =>
      get({
        data: {
          ...factors,
          ...filterInput,
        },
      }),
  });

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Fluxo de caixa"
        description="Projeção 30/60/90 dias com cenários pessimista, realista e otimista."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <LegalEntitySelect value={legalEntityId} onChange={setLegalEntityId} />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <Settings2 className="h-4 w-4 mr-1" /> Cenários
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[360px] space-y-4">
                <div>
                  <p className="text-sm font-semibold mb-1">% de recebimento</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Ajuste a taxa esperada de conversão de contas a receber em cada cenário.
                  </p>
                  <FactorSlider
                    label="Pessimista"
                    value={factors.pessimistic}
                    onChange={(v) => setFactors((f) => ({ ...f, pessimistic: v }))}
                  />
                  <FactorSlider
                    label="Realista"
                    value={factors.realistic}
                    onChange={(v) => setFactors((f) => ({ ...f, realistic: v }))}
                  />
                  <FactorSlider
                    label="Otimista"
                    value={factors.optimistic}
                    onChange={(v) => setFactors((f) => ({ ...f, optimistic: v }))}
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1">% de despesas mantidas</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Simule cortes ou aumentos de despesas por cenário.
                  </p>
                  <FactorSlider
                    label="Pessimista"
                    value={factors.expenseFactorPessimistic}
                    onChange={(v) => setFactors((f) => ({ ...f, expenseFactorPessimistic: v }))}
                  />
                  <FactorSlider
                    label="Realista"
                    value={factors.expenseFactorRealistic}
                    onChange={(v) => setFactors((f) => ({ ...f, expenseFactorRealistic: v }))}
                  />
                  <FactorSlider
                    label="Otimista"
                    value={factors.expenseFactorOptimistic}
                    onChange={(v) => setFactors((f) => ({ ...f, expenseFactorOptimistic: v }))}
                  />
                </div>
              </PopoverContent>
            </Popover>
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
                  {data.consolidation.intercompanyEliminated} lançamento(s) intercompany
                  eliminado(s)
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-sm">
              Transações entre CNPJs do grupo são eliminadas para não inflar entradas e saídas na
              projeção consolidada.
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
            pertencem ao mesmo grupo são excluídos da projeção. Isso evita que transferências
            internas entre CNPJs do grupo sejam contadas como entrada ou saída de caixa real.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Saldo inicial (contas bancárias)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums truncate">
            {formatCurrency(data?.openingBalance ?? 0)}
          </div>
        </CardContent>
      </Card>

      {isLoading && <p className="text-sm text-muted-foreground">Calculando projeção…</p>}

      {data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <ScenarioCard
            keyName="pessimistic"
            title="Pessimista"
            icon={TrendingDown}
            tone="negative"
            scenario={data.scenarios.pessimistic}
          />
          <ScenarioCard
            keyName="realistic"
            title="Realista"
            icon={Minus}
            tone="neutral"
            scenario={data.scenarios.realistic}
          />
          <ScenarioCard
            keyName="optimistic"
            title="Otimista"
            icon={TrendingUp}
            tone="positive"
            scenario={data.scenarios.optimistic}
          />
        </div>
      )}
    </div>
  );
}

function FactorSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs">{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {Math.round(value * 100)}%
        </span>
      </div>
      <Slider
        min={0}
        max={150}
        step={5}
        value={[Math.round(value * 100)]}
        onValueChange={(v) => onChange(v[0] / 100)}
      />
    </div>
  );
}

function ScenarioCard({
  keyName,
  title,
  icon: Icon,
  tone,
  scenario,
}: {
  keyName: ScenarioKey;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "positive" | "negative" | "neutral";
  scenario: {
    buckets: Array<{ key: string; inflow: number; outflow: number; net: number; balance: number }>;
    finalBalance: number;
    totalInflow: number;
    totalOutflow: number;
  };
}) {
  const toneCls =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-rose-600 dark:text-rose-400"
        : "text-foreground";
  const finalCls =
    scenario.finalBalance >= 0
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";

  return (
    <Card data-scenario={keyName}>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${toneCls}`} />
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-muted-foreground">Saldo em 90 dias</p>
          <p className={`text-2xl font-semibold tabular-nums ${finalCls} truncate`}>
            {formatCurrency(scenario.finalBalance)}
          </p>
        </div>

        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-2 py-1.5 font-medium">Janela</th>
                <th className="text-right px-2 py-1.5 font-medium">Entrada</th>
                <th className="text-right px-2 py-1.5 font-medium">Saída</th>
                <th className="text-right px-2 py-1.5 font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {scenario.buckets.map((b) => (
                <tr key={b.key} className="border-t">
                  <td className="px-2 py-1.5">
                    {BUCKET_LABELS[b.key as keyof typeof BUCKET_LABELS] ?? b.key}
                  </td>
                  <td className="text-right px-2 py-1.5 tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(b.inflow)}
                  </td>
                  <td className="text-right px-2 py-1.5 tabular-nums text-rose-600 dark:text-rose-400">
                    {formatCurrency(b.outflow)}
                  </td>
                  <td
                    className={`text-right px-2 py-1.5 tabular-nums font-medium ${
                      b.balance >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {formatCurrency(b.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 border-t">
                <td className="px-2 py-1.5 font-medium">Total</td>
                <td className="text-right px-2 py-1.5 tabular-nums font-medium">
                  {formatCurrency(scenario.totalInflow)}
                </td>
                <td className="text-right px-2 py-1.5 tabular-nums font-medium">
                  {formatCurrency(scenario.totalOutflow)}
                </td>
                <td className="px-2 py-1.5" />
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
