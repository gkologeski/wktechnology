import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownCircle, ArrowUpCircle, DollarSign, TrendingUp, Plus } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/crm";
import { compactBRL } from "@/lib/format-compact";
import { getFinanceDashboard } from "@/lib/finance.functions";
import { QuickCreateEntryDialog } from "@/components/finance/quick-create-entry-dialog";
import { FinanceAlertsPanel } from "@/components/finance/finance-alerts-panel";
import {
  LegalEntitySelect,
  useLegalEntityFilter,
  useLegalEntityFilterInput,
} from "@/components/finance/legal-entity-select";

export const Route = createFileRoute("/_authenticated/finance/")({
  head: () => ({
    meta: [
      { title: "Financeiro" },
      { name: "description", content: "Contas a receber e a pagar unificadas." },
    ],
  }),
  component: FinanceDashboard,
});

function Metric({
  title,
  raw,
  hint,
  tone,
  icon: Icon,
}: {
  title: string;
  raw: number;
  hint?: string;
  tone?: "positive" | "negative" | "neutral" | "warning";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const toneCls =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-rose-600 dark:text-rose-400"
        : tone === "warning"
          ? "text-amber-600 dark:text-amber-400"
          : "text-foreground";
  const full = formatCurrency(raw);
  const short = compactBRL(raw);
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2 flex-row items-center justify-between gap-2">
        <CardTitle className="min-w-0 truncate text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 shrink-0 ${toneCls}`} />
      </CardHeader>
      <CardContent className="min-w-0">
        <div title={full} className={`truncate text-2xl font-semibold tabular-nums ${toneCls}`}>
          {short}
        </div>
        {hint && (
          <p className="mt-1 truncate text-xs text-muted-foreground" title={hint}>
            {hint}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function FinanceDashboard() {
  const get = useServerFn(getFinanceDashboard);
  const [openNew, setOpenNew] = useState(false);
  const [legalEntityId, setLegalEntityId] = useLegalEntityFilter();

  const filterInput = useLegalEntityFilterInput(legalEntityId);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["finance", "dashboard", legalEntityId, JSON.stringify(filterInput)],
    queryFn: () => get({ data: filterInput }),
  });

  const ar = data?.ar ?? { open: 0, overdue: 0, paid_180d: 0, d30: 0, d60: 0, d90: 0 };
  const ap = data?.ap ?? { open: 0, overdue: 0, paid_180d: 0, d30: 0, d60: 0, d90: 0 };
  const net30 = data?.net_30 ?? 0;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Financeiro"
        description="Contas a receber e a pagar, fluxo de caixa e categorias."
        actions={
          <div className="flex flex-wrap gap-2">
            <LegalEntitySelect value={legalEntityId} onChange={setLegalEntityId} />
            <Button variant="outline" asChild>
              <Link to="/finance/receivable">A receber</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/finance/payable">A pagar</Link>
            </Button>
            <Button onClick={() => setOpenNew(true)}>
              <Plus className="h-4 w-4 mr-1" /> Novo lançamento
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          title="A receber (em aberto)"
          raw={ar.open}
          hint={ar.overdue > 0 ? `${formatCurrency(ar.overdue)} vencido` : "sem atrasos"}
          tone={ar.overdue > 0 ? "warning" : "positive"}
          icon={ArrowDownCircle}
        />
        <Metric
          title="A pagar (em aberto)"
          raw={ap.open}
          hint={ap.overdue > 0 ? `${formatCurrency(ap.overdue)} vencido` : "sem atrasos"}
          tone={ap.overdue > 0 ? "warning" : "neutral"}
          icon={ArrowUpCircle}
        />
        <Metric
          title="Saldo previsto 30d"
          raw={net30}
          hint="Receber − Pagar nos próximos 30 dias"
          tone={net30 >= 0 ? "positive" : "negative"}
          icon={TrendingUp}
        />
        <Metric
          title="Recebido (180d)"
          raw={ar.paid_180d}
          hint={`Pago: ${formatCurrency(ap.paid_180d)}`}
          tone="neutral"
          icon={DollarSign}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Aging — a receber</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Vencido" value={ar.overdue} tone="warning" />
            <Row label="Próx. 30 dias" value={ar.d30} />
            <Row label="31–60 dias" value={ar.d60} />
            <Row label="61–90 dias" value={ar.d90} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Aging — a pagar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Vencido" value={ap.overdue} tone="warning" />
            <Row label="Próx. 30 dias" value={ap.d30} />
            <Row label="31–60 dias" value={ap.d60} />
            <Row label="61–90 dias" value={ap.d90} />
          </CardContent>
        </Card>
      </div>

      <FinanceAlertsPanel />

      {isLoading && (
        <p className="text-sm text-muted-foreground">Carregando dashboard financeiro…</p>
      )}

      <QuickCreateEntryDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onCreated={() => refetch()}
      />
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: number; tone?: "warning" }) {
  return (
    <div className="flex items-center justify-between border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`tabular-nums font-medium ${
          tone === "warning" ? "text-amber-600 dark:text-amber-400" : ""
        }`}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}
