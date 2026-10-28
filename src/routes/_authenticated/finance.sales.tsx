import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShoppingCart } from "lucide-react";

import { HrScreenAccess } from "@/components/hr-access";
import { IsoDatePicker } from "@/components/iso-date-picker";
import { EmptyState, FilterBar, MetricCard, PageHeader } from "@/components/techhire/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseIsoDate } from "@/lib/iso-date";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { listFinanceSales } from "@/lib/finance-sales.functions";

export const Route = createFileRoute("/_authenticated/finance/sales")({
  head: () => ({
    meta: [
      { title: "Vendas importadas | TechFinance" },
      {
        name: "description",
        content: "Vendas trazidas do Conta Azul, com cliente, situação e valor, somente leitura.",
      },
      { property: "og:title", content: "Vendas importadas | TechFinance" },
      {
        property: "og:description",
        content: "Vendas trazidas do Conta Azul, com cliente, situação e valor, somente leitura.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <HrScreenAccess resources={["techfinance.sales"]}>
      <FinanceSalesPage />
    </HrScreenAccess>
  ),
});

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateBr = (iso: string | null) => {
  const d = parseIsoDate(iso);
  return d ? d.toLocaleDateString("pt-BR") : "—";
};
const ITEMS: Record<string, string> = { SERVICE: "Serviço", PRODUCT: "Produto", BOTH: "Produto e serviço" };

function FinanceSalesPage() {
  const permissions = usePermissions();
  const list = useServerFn(listFinanceSales);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const q = useQuery({
    queryKey: ["finance", permissions.workspaceId, "sales", search, status, from, to, page],
    queryFn: () => list({ data: { search, status, from, to, page } }),
    placeholderData: keepPreviousData,
  });
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(0);
  };
  const summary = q.data?.summary;
  const statuses = Object.entries(summary?.byStatus ?? {}).sort((a, b) => b[1].count - a[1].count);
  const rows = q.data?.rows ?? [];
  const count = q.data?.count ?? 0;

  return (
    <div className="space-y-5 p-6">
      <PageHeader
        title="Vendas importadas"
        description="Vendas trazidas do Conta Azul. Somente leitura: a cobrança continua nos lançamentos a receber."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Vendas no período" value={summary?.count ?? 0} loading={q.isLoading} />
        <MetricCard label="Valor total" value={brl(summary?.total ?? 0)} loading={q.isLoading} />
        <MetricCard
          label="Ticket médio"
          value={brl(summary?.count ? summary.total / summary.count : 0)}
          loading={q.isLoading}
        />
      </div>

      <FilterBar
        search={{ value: search, onChange: reset(setSearch), placeholder: "Buscar por cliente" }}
        chips={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={status === null ? "default" : "outline"}
              onClick={() => reset(setStatus)(null)}
            >
              Todas
            </Button>
            {statuses.map(([label, s]) => (
              <Button
                key={label}
                size="sm"
                variant={status === label ? "default" : "outline"}
                onClick={() => reset(setStatus)(label)}
              >
                {label} ({s.count})
              </Button>
            ))}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <IsoDatePicker ariaLabel="Data inicial" value={from} max={to} onChange={reset(setFrom)} />
            <IsoDatePicker ariaLabel="Data final" value={to} min={from} onChange={reset(setTo)} />
          </div>
        }
      />

      {q.isLoading ? (
        <div className="space-y-2" role="status" aria-label="Carregando vendas">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : q.isError ? (
        <div role="alert" className="rounded-md border border-destructive/40 p-4 text-sm">
          <p className="font-medium text-destructive">Não foi possível carregar as vendas.</p>
          <p className="text-muted-foreground">{(q.error as Error).message}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => void q.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Nenhuma venda encontrada"
          description="Ajuste os filtros, ou rode a importação completa em Configurações › Integrações › Conta Azul."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="tabular-nums">{r.number ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{dateBr(r.sale_date)}</TableCell>
                  <TableCell>
                    {r.company_id ? (
                      <Link to="/companies/$id" params={{ id: r.company_id }} className="hover:underline">
                        {r.customer_name ?? "—"}
                      </Link>
                    ) : r.contact_id ? (
                      <Link to="/contacts/$id" params={{ id: r.contact_id }} className="hover:underline">
                        {r.customer_name ?? "—"}
                      </Link>
                    ) : (
                      (r.customer_name ?? "—")
                    )}
                  </TableCell>
                  <TableCell>{(r.items_kind && ITEMS[r.items_kind]) ?? r.items_kind ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{r.status_label ?? "Sem situação"}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{brl(Number(r.total) || 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground" aria-live="polite">
              {count} venda(s){from || to ? ` entre ${dateBr(from)} e ${dateBr(to)}` : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <span className="text-muted-foreground">
                Página {page + 1} de {Math.max(1, Math.ceil(count / 50))}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={(page + 1) * 50 >= count}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
