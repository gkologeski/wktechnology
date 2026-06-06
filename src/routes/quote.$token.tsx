import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getQuoteByToken, respondToQuote } from "@/lib/quotes.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, Check, X, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/crm";

export const Route = createFileRoute("/quote/$token")({
  component: PublicQuotePage,
});

function lineTotal(li: { quantity: number; unit_price: number; discount_pct: number; tax_rate: number }) {
  const sub = Number(li.quantity) * Number(li.unit_price) * (1 - Number(li.discount_pct) / 100);
  return sub * (1 + Number(li.tax_rate) / 100);
}

function PublicQuotePage() {
  const { token } = useParams({ from: "/quote/$token" });
  const qc = useQueryClient();
  const fetchQuote = useServerFn(getQuoteByToken);
  const respond = useServerFn(respondToQuote);

  const [acceptOpen, setAcceptOpen] = useState(false);
  const [signature, setSignature] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-quote", token],
    queryFn: () => fetchQuote({ data: { token } }),
  });

  const respondMut = useMutation({
    mutationFn: (vars: { action: "accept" | "decline"; signature?: string }) =>
      respond({ data: { token, ...vars } }),
    onSuccess: () => {
      toast.success("Resposta registrada.");
      setAcceptOpen(false);
      qc.invalidateQueries({ queryKey: ["public-quote", token] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  if (error || !data) return <div className="p-8 text-sm text-destructive">Cotação não encontrada.</div>;

  const { quote, items, company, contact, agent } = data;
  const expired = quote.valid_until && new Date(quote.valid_until) < new Date();
  const responded = quote.status === "accepted" || quote.status === "declined";

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Badge variant={
            quote.status === "accepted" ? "default" :
            quote.status === "declined" ? "destructive" :
            quote.status === "sent" ? "secondary" : "outline"
          }>
            {quote.status === "draft" && "Rascunho"}
            {quote.status === "sent" && "Enviada"}
            {quote.status === "accepted" && "Aceita"}
            {quote.status === "declined" && "Recusada"}
            {quote.status === "expired" && "Expirada"}
          </Badge>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> Imprimir / PDF
          </Button>
        </div>

        <Card className="print:shadow-none print:border-0">
          <CardContent className="p-8 space-y-6">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="text-2xl font-semibold">{quote.title || "Cotação"}</h1>
                <p className="text-sm text-muted-foreground mt-1">Nº {quote.number}</p>
              </div>
              <div className="text-right text-sm">
                {agent?.full_name && <div className="font-medium">{agent.full_name}</div>}
                {agent?.email && <div className="text-muted-foreground">{agent.email}</div>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Para</div>
                {company?.name && <div className="font-medium">{company.name}</div>}
                {contact && <div>{contact.first_name} {contact.last_name ?? ""}</div>}
                {contact?.email && <div className="text-muted-foreground">{contact.email}</div>}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Detalhes</div>
                <div>Emitida em {new Date(quote.created_at).toLocaleDateString("pt-BR")}</div>
                {quote.valid_until && (
                  <div className={expired ? "text-destructive" : ""}>
                    Válida até {new Date(quote.valid_until).toLocaleDateString("pt-BR")}
                  </div>
                )}
              </div>
            </div>

            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3">Item</th>
                    <th className="text-right p-3 w-20">Qtd</th>
                    <th className="text-right p-3 w-28">Preço</th>
                    <th className="text-right p-3 w-20">Desc</th>
                    <th className="text-right p-3 w-20">Imp</th>
                    <th className="text-right p-3 w-32">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((li) => (
                    <tr key={li.id} className="border-t">
                      <td className="p-3">
                        <div>{li.name}</div>
                        {li.description && <div className="text-xs text-muted-foreground mt-0.5">{li.description}</div>}
                      </td>
                      <td className="text-right p-3 tabular-nums">{Number(li.quantity)}</td>
                      <td className="text-right p-3 tabular-nums">{formatCurrency(Number(li.unit_price), quote.currency)}</td>
                      <td className="text-right p-3 tabular-nums">{Number(li.discount_pct)}%</td>
                      <td className="text-right p-3 tabular-nums">{Number(li.tax_rate)}%</td>
                      <td className="text-right p-3 tabular-nums font-medium">{formatCurrency(lineTotal(li), quote.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <Row label="Subtotal" value={formatCurrency(Number(quote.subtotal), quote.currency)} />
                <Row label="Descontos" value={`− ${formatCurrency(Number(quote.discount_total), quote.currency)}`} />
                <Row label="Impostos" value={`+ ${formatCurrency(Number(quote.tax_total), quote.currency)}`} />
                <div className="border-t pt-1 mt-1 text-base font-semibold flex justify-between">
                  <span>Total</span>
                  <span className="tabular-nums">{formatCurrency(Number(quote.total), quote.currency)}</span>
                </div>
              </div>
            </div>

            {quote.notes && (
              <div className="text-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Observações</div>
                <p className="whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}
            {quote.terms && (
              <div className="text-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Termos</div>
                <p className="whitespace-pre-wrap">{quote.terms}</p>
              </div>
            )}

            {quote.status === "accepted" && quote.signature_name && (
              <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-4 text-sm">
                <div className="font-medium">Aceita em {new Date(quote.accepted_at!).toLocaleString("pt-BR")}</div>
                <div className="text-muted-foreground">Assinado por: {quote.signature_name}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {quote.paid_at ? (
          <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-4 text-sm print:hidden">
            <div className="font-medium">Pagamento confirmado em {new Date(quote.paid_at).toLocaleString("pt-BR")}</div>
          </div>
        ) : (
          <>
            {quote.payment_link_url && !responded && (
              <div className="print:hidden">
                <Button className="w-full" size="lg" onClick={() => window.location.assign(quote.payment_link_url!)}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pagar {formatCurrency(Number(quote.total), quote.currency)}
                </Button>
              </div>
            )}
            {!responded && !expired && (
              <div className="flex gap-2 justify-end print:hidden">
                <Button variant="outline" onClick={() => respondMut.mutate({ action: "decline" })} disabled={respondMut.isPending}>
                  <X className="h-4 w-4 mr-1" /> Recusar
                </Button>
                <Button onClick={() => setAcceptOpen(true)}>
                  <Check className="h-4 w-4 mr-1" /> Aceitar
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={acceptOpen} onOpenChange={setAcceptOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Aceitar cotação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Digite seu nome completo como assinatura eletrônica.</p>
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input value={signature} onChange={(e) => setSignature(e.target.value)} placeholder="Seu nome" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => respondMut.mutate({ action: "accept", signature })}
              disabled={!signature.trim() || respondMut.isPending}
            >
              Confirmar aceite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
