// Vendas atendidas por um contrato de compra (várias vendas/negócios por compra)
// e, na venda, as compras que a atendem como venda adicional.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Unlink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { CounterpartyField } from "@/components/contracts/purchase-from-sale-dialog";
import { listPurchaseSales, setPurchaseSale } from "@/lib/contracts/purchase-from-sale.functions";
import { suggestPurchaseTerm } from "@/lib/contracts/purchase-term";
import { formatCurrency } from "@/lib/crm";
import type { PurchaseSaleRow } from "@/lib/contracts/purchase-from-sale.server";
import { usePermissions } from "@/lib/access-control/use-permissions";

const fmt = (v: string | null) =>
  v ? new Date(`${v.slice(0, 10)}T00:00:00`).toLocaleDateString("pt-BR") : "—";

export function PurchaseSalesPanel({
  contractId,
  role,
  canEdit,
}: {
  contractId: string;
  role: "provider" | "client";
  canEdit: boolean;
}) {
  const perms = usePermissions();
  const canUpdate =
    canEdit &&
    perms.canAny(["own", "team", "workspace"].map((s) => `techcontracts.contracts.update.${s}`));
  const qc = useQueryClient();
  const list = useServerFn(listPurchaseSales);
  const setLink = useServerFn(setPurchaseSale);
  const [adding, setAdding] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const key = ["purchase-sales", contractId];
  const q = useQuery({ queryKey: key, queryFn: () => list({ data: { contractId } }) });
  const rows: PurchaseSaleRow[] = q.data?.rows ?? [];
  const isPurchase = role === "client";
  if (!isPurchase && !q.isLoading && !q.isError && rows.length === 0) return null;

  async function change(saleId: string, link: boolean, purchaseId = contractId) {
    setBusy(true);
    try {
      await setLink({ data: { purchaseId, saleId, link } });
      toast.success(link ? "Venda incluída." : "Vínculo removido.");
      setAdding(null);
      await qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const term = rows.length > 1 ? suggestPurchaseTerm(rows, new Date().toISOString()) : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {isPurchase ? "Vendas atendidas" : "Contratos de compra que também atendem esta venda"}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {isPurchase
            ? "Uma compra pode atender várias vendas, cada uma com seu negócio. A venda principal é a de criação; inclua aqui as demais (contratos ou aditivos)."
            : "Compras ligadas a esta venda como venda adicional."}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {q.isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : q.isError ? (
          <div className="flex items-center justify-between rounded-lg border border-dashed p-3 text-sm">
            <span className="text-muted-foreground">Não foi possível carregar as vendas.</span>
            <Button size="sm" variant="outline" onClick={() => void q.refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed py-4 text-center text-sm text-muted-foreground">
            Nenhuma venda ligada ainda.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link
                    to="/contracts/$id"
                    params={{ id: r.id }}
                    className="block truncate text-sm font-medium hover:underline"
                  >
                    {r.title ?? r.number ?? "Contrato"}
                  </Link>
                  <div className="truncate text-xs text-muted-foreground">
                    {r.number ?? "Sem número"} · {fmt(r.starts_at)} → {fmt(r.ends_at)}
                    {r.deal_id ? (
                      <>
                        {" · Negócio: "}
                        <Link
                          to="/deals/$id"
                          params={{ id: r.deal_id }}
                          className="hover:underline"
                        >
                          {r.deal_title ?? "abrir"}
                        </Link>
                      </>
                    ) : null}
                  </div>
                </div>
                {r.primary ? <Badge variant="secondary">Principal</Badge> : null}
                <span className="whitespace-nowrap text-sm tabular-nums">
                  {formatCurrency(r.total_value, r.currency)}
                </span>
                {!r.primary ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={!canUpdate || busy}
                    aria-label="Remover vínculo"
                    title={canUpdate ? "Remover vínculo" : "Sem permissão para alterar"}
                    onClick={async () => {
                      if (!(await confirmDialog("Remover o vínculo entre a compra e esta venda?")))
                        return;
                      if (isPurchase) void change(r.id, false);
                      else void change(contractId, false, r.id);
                    }}
                  >
                    <Unlink className="h-4 w-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {term ? (
          <p className="text-xs text-muted-foreground">
            Vigência que cobre todas as vendas: {fmt(term.starts_at)} → {fmt(term.ends_at)}. Ajuste
            as datas da compra se necessário.
          </p>
        ) : null}
        {isPurchase && canUpdate ? (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <CounterpartyField
                id={`purchase-add-sale-${contractId}`}
                label="Adicionar venda"
                entity="sale_any"
                value={adding}
                onChange={setAdding}
              />
            </div>
            <Button disabled={!adding || busy} onClick={() => adding && void change(adding, true)}>
              {busy ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
              )}
              Incluir
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
