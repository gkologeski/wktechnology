import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listDealQuotes,
  createQuoteFromDeal,
  updateQuote,
  deleteQuote,
  regenerateQuoteToken,
  createQuotePaymentLink,
} from "@/lib/quotes.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, ExternalLink, Copy, RefreshCw, Trash2, Send, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/crm";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviada",
  accepted: "Aceita",
  declined: "Recusada",
  expired: "Expirada",
};

export function DealQuotes({ dealId }: { dealId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listDealQuotes);
  const create = useServerFn(createQuoteFromDeal);
  const update = useServerFn(updateQuote);
  const del = useServerFn(deleteQuote);
  const regen = useServerFn(regenerateQuoteToken);
  const payLink = useServerFn(createQuotePaymentLink);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ title: string; validUntil: string; notes: string; terms: string }>({
    title: "", validUntil: "", notes: "", terms: "",
  });

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["deal-quotes", dealId],
    queryFn: () => list({ data: { dealId } }),
  });

  const createMut = useMutation({
    mutationFn: () => create({
      data: {
        dealId,
        title: draft.title || undefined,
        validUntil: draft.validUntil || undefined,
        notes: draft.notes || undefined,
        terms: draft.terms || undefined,
      },
    }),
    onSuccess: () => {
      toast.success("Cotação criada.");
      setOpen(false);
      setDraft({ title: "", validUntil: "", notes: "", terms: "" });
      qc.invalidateQueries({ queryKey: ["deal-quotes", dealId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function publicUrl(token: string) {
    return `${window.location.origin}/quote/${token}`;
  }
  async function copyLink(token: string) {
    await navigator.clipboard.writeText(publicUrl(token));
    toast.success("Link copiado.");
  }
  async function markSent(id: string) {
    await update({ data: { id, patch: { status: "sent", sent_at: new Date().toISOString() } } });
    qc.invalidateQueries({ queryKey: ["deal-quotes", dealId] });
  }
  async function regenerate(id: string) {
    await regen({ data: { id } });
    toast.success("Novo link gerado.");
    qc.invalidateQueries({ queryKey: ["deal-quotes", dealId] });
  }
  async function remove(id: string) {
    if (!confirm("Excluir esta cotação?")) return;
    await del({ data: { id } });
    qc.invalidateQueries({ queryKey: ["deal-quotes", dealId] });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Nova cotação
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : quotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma cotação gerada. Cotações usam os itens atuais do negócio.</p>
      ) : (
        <div className="space-y-2">
          {quotes.map((q) => (
            <div key={q.id} className="rounded-md border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium truncate">{q.title || q.number}</div>
                  <div className="text-xs text-muted-foreground">{q.number} · {new Date(q.created_at).toLocaleDateString("pt-BR")}</div>
                </div>
                <Badge variant={
                  q.status === "accepted" ? "default" :
                  q.status === "declined" ? "destructive" :
                  q.status === "sent" ? "secondary" : "outline"
                }>{STATUS_LABEL[q.status] ?? q.status}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold tabular-nums">{formatCurrency(Number(q.total), q.currency)}</span>
                {q.valid_until && (
                  <span className="text-xs text-muted-foreground">Validade {new Date(q.valid_until).toLocaleDateString("pt-BR")}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="outline" onClick={() => window.open(publicUrl(q.public_token), "_blank")}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir
                </Button>
                <Button size="sm" variant="outline" onClick={() => copyLink(q.public_token)}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar link
                </Button>
                {q.status === "draft" && (
                  <Button size="sm" variant="outline" onClick={() => markSent(q.id)}>
                    <Send className="h-3.5 w-3.5 mr-1" /> Marcar como enviada
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => regenerate(q.id)}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Novo link
                </Button>
                <Button size="sm" variant="ghost" onClick={() => remove(q.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova cotação</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="(usar nome do negócio)" />
            </div>
            <div className="space-y-1.5">
              <Label>Válida até</Label>
              <Input type="date" value={draft.validUntil} onChange={(e) => setDraft({ ...draft, validUntil: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Termos e condições</Label>
              <Textarea rows={4} value={draft.terms} onChange={(e) => setDraft({ ...draft, terms: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? "Gerando…" : "Gerar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
