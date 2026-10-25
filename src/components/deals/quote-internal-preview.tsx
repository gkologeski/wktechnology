import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getQuotePreview } from "@/lib/quotes.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/crm";
import { lineGross, lineDiscount } from "@/components/deals/use-line-items";

/** Uses authenticated data only. Viewing a draft does not publish or share it. */
export function QuoteInternalPreview({ id, onClose }: { id: string | null; onClose: () => void }) {
  const get = useServerFn(getQuotePreview);
  const query = useQuery({
    queryKey: ["quote-internal-preview", id],
    enabled: !!id,
    queryFn: () => get({ data: { id: id! } }),
  });
  const q = query.data?.quote;
  return (
    <Dialog
      open={!!id}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{q?.title || q?.number || "Prévia da cotação"}</DialogTitle>
          <DialogDescription>
            Visualização interna. Rascunhos só ficam disponíveis ao cliente após a publicação
            autorizada.
          </DialogDescription>
        </DialogHeader>
        {query.isPending && <p role="status">Carregando cotação…</p>}
        {query.isError && (
          <div role="alert">
            Não foi possível consultar esta cotação.{" "}
            <Button variant="outline" onClick={() => void query.refetch()}>
              Tentar novamente
            </Button>
          </div>
        )}
        {q && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {q.number} · {q.status === "draft" ? "Rascunho" : q.status}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">Item</th>
                    <th className="text-right">Quantidade</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(query.data?.items ?? []).map((item) => {
                    const line = {
                      ...item,
                      discount_type:
                        item.discount_type === "amount" ? ("amount" as const) : ("pct" as const),
                    };
                    const base = lineGross(line) - lineDiscount(line);
                    const total = base * (1 + Number(item.tax_rate ?? 0) / 100);
                    return (
                      <tr key={item.id} className="border-b">
                        <td className="py-3 pr-3">
                          <p>{item.name}</p>
                          {item.description && (
                            <p className="text-muted-foreground whitespace-pre-wrap">
                              {item.description}
                            </p>
                          )}
                        </td>
                        <td className="text-right">{Number(item.quantity)}</td>
                        <td className="text-right whitespace-nowrap">
                          {formatCurrency(total, q.currency ?? "BRL")}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-right font-semibold">
              Total: {formatCurrency(Number(q.total), q.currency ?? "BRL")}
            </p>
            {q.notes && (
              <section>
                <h3 className="font-medium">Observações</h3>
                <p className="whitespace-pre-wrap">{q.notes}</p>
              </section>
            )}
            {q.terms && (
              <section>
                <h3 className="font-medium">Condições</h3>
                <p className="whitespace-pre-wrap">{q.terms}</p>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
