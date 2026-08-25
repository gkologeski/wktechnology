import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { financeAuditReport } from "@/lib/finance-audit.functions";
import {
  LegalEntitySelect,
  useLegalEntityFilter,
  useLegalEntityFilterInput,
} from "@/components/finance/legal-entity-select";

export const Route = createFileRoute("/_authenticated/finance/audit")({
  head: () => ({
    meta: [
      { title: "Auditoria financeira" },
      {
        name: "description",
        content: "Verifique lançamentos sem categoria, centro de custo ou empresa vinculada.",
      },
    ],
  }),
  component: FinanceAuditPage,
});

function FinanceAuditPage() {
  const run = useServerFn(financeAuditReport);
  const [legalEntityId, setLegalEntityId] = useLegalEntityFilter();
  const filterInput = useLegalEntityFilterInput(legalEntityId);

  const { data, isLoading } = useQuery({
    queryKey: ["finance", "audit", legalEntityId, JSON.stringify(filterInput)],
    queryFn: () => run({ data: filterInput }),
  });

  const t = data?.totals ?? {
    entries: 0,
    no_category: 0,
    no_cost_center: 0,
    no_legal_entity: 0,
    duplicate_groups: 0,
  };

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="Auditoria financeira"
        description="Lançamentos com dados faltantes e possíveis duplicidades por empresa."
        actions={<LegalEntitySelect value={legalEntityId} onChange={setLegalEntityId} />}
      />

      <div className="grid gap-3 md:grid-cols-5">
        <Metric label="Total analisado" value={t.entries} />
        <Metric label="Sem categoria" value={t.no_category} tone={t.no_category ? "warn" : "ok"} />
        <Metric
          label="Sem centro de custo"
          value={t.no_cost_center}
          tone={t.no_cost_center ? "warn" : "ok"}
        />
        <Metric
          label="Sem empresa"
          value={t.no_legal_entity}
          tone={t.no_legal_entity ? "warn" : "ok"}
        />
        <Metric
          label="Grupos duplicados"
          value={t.duplicate_groups}
          tone={t.duplicate_groups ? "warn" : "ok"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Por empresa</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : !data?.by_entity.length ? (
            <p className="text-sm text-muted-foreground">Nenhum lançamento no filtro atual.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Sem categoria</TableHead>
                  <TableHead className="text-right">Sem centro de custo</TableHead>
                  <TableHead className="text-right">Sem empresa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.by_entity.map((r) => (
                  <TableRow key={r.legal_entity_id ?? "__none"}>
                    <TableCell className="font-medium">
                      {r.code ? `${r.code} · ${r.name}` : r.name}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.total}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.no_category}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.no_cost_center}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.no_legal_entity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Possíveis duplicidades</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : !data?.duplicates.length ? (
            <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" /> Nenhum grupo de lançamentos duplicados detectado.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assinatura (empresa · data · direção · valor · descrição)</TableHead>
                  <TableHead className="text-right">Ocorrências</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.duplicates.map((d) => (
                  <TableRow key={d.key}>
                    <TableCell className="font-mono text-xs">{d.key}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.count}</TableCell>
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

function Metric({ label, value, tone }: { label: string; value: number; tone?: "ok" | "warn" }) {
  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        {tone === "warn" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-semibold tabular-nums ${
            tone === "warn"
              ? "text-amber-600 dark:text-amber-400"
              : tone === "ok"
                ? "text-emerald-600 dark:text-emerald-400"
                : ""
          } truncate`}
        >
          {value.toLocaleString("pt-BR")}
        </div>
      </CardContent>
    </Card>
  );
}
