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
import { listQuoteTemplates } from "@/lib/quote-templates.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, ExternalLink, Copy, RefreshCw, Trash2, Send, CreditCard, FileText } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDateTime } from "@/lib/crm";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const NO_TEMPLATE = "__none__";

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

  const listTemplates = useServerFn(listQuoteTemplates);

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{ title: string; validUntil: string; notes: string; terms: string; templateId: string }>({
    title: "", validUntil: "", notes: "", terms: "", templateId: "",
  });

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["deal-quotes", dealId],
    queryFn: () => list({ data: { dealId } }),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["quote-templates"],
    queryFn: () => listTemplates(),
  });

  const defaultTemplateId = templates.find((t) => t.is_default)?.id ?? "";

  // Inicializa o seletor com o template padrão quando o diálogo abre.
  function openDialog() {
    setDraft((d) => ({ ...d, templateId: defaultTemplateId }));
    setOpen(true);
  }

  const { data: lineItemsCount = 0 } = useQuery({
    queryKey: ["deal-line-items-count", dealId],
    queryFn: async () => {
      const { count } = await supabase
        .from("deal_line_items")
        .select("id", { count: "exact", head: true })
        .eq("deal_id", dealId);
      return count ?? 0;
    },
  });
  const hasLineItems = lineItemsCount > 0;

  const createMut = useMutation({
    mutationFn: () => create({
      data: {
        dealId,
        title: draft.title || undefined,
        validUntil: draft.validUntil || undefined,
        notes: draft.notes || undefined,
        terms: draft.terms || undefined,
        templateId: draft.templateId ? draft.templateId : null,
      },
    }),
    onSuccess: () => {
      toast.success("Cotação criada.");
      setOpen(false);
      setDraft({ title: "", validUntil: "", notes: "", terms: "", templateId: "" });
      qc.invalidateQueries({ queryKey: ["deal-quotes", dealId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function changeTemplate(id: string, templateId: string | null) {
    await update({ data: { id, patch: { template_id: templateId } } });
    toast.success("Modelo atualizado.");
    qc.invalidateQueries({ queryKey: ["deal-quotes", dealId] });
  }

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
  async function genPayLink(id: string) {
    try {
      const r = await payLink({ data: { id } });
      await navigator.clipboard.writeText(r.url);
      toast.success("Link de pagamento gerado e copiado.");
      qc.invalidateQueries({ queryKey: ["deal-quotes", dealId] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={hasLineItems ? -1 : 0}>
                <Button size="sm" onClick={openDialog} disabled={!hasLineItems}>
                  <Plus className="h-4 w-4 mr-1" /> Nova cotação
                </Button>
              </span>
            </TooltipTrigger>
            {!hasLineItems && (
              <TooltipContent>
                Adicione itens de linha ao negócio para gerar uma cotação.
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
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
                  <div className="text-xs text-muted-foreground">{q.number} · {formatDateTime(q.created_at)}</div>
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
                  <span className="text-xs text-muted-foreground">Validade {formatDateTime(q.valid_until)}</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  <span>Modelo:</span>
                  <Select
                    value={q.template_id ?? NO_TEMPLATE}
                    onValueChange={(v) => changeTemplate(q.id, v === NO_TEMPLATE ? null : v)}
                  >
                    <SelectTrigger className="h-6 w-[200px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_TEMPLATE}>Layout padrão</SelectItem>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}{t.is_default ? " (padrão)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                {!q.paid_at && (
                  <Button size="sm" variant="outline" onClick={() => genPayLink(q.id)}>
                    <CreditCard className="h-3.5 w-3.5 mr-1" />
                    {q.payment_link_url ? "Regerar link de pagamento" : "Gerar link de pagamento"}
                  </Button>
                )}
                {q.paid_at && (
                  <Badge variant="default" className="ml-1">Paga</Badge>
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
              <Label>Modelo de cotação</Label>
              <Select
                value={draft.templateId || NO_TEMPLATE}
                onValueChange={(v) => setDraft({ ...draft, templateId: v === NO_TEMPLATE ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar modelo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEMPLATE}>Sem modelo (layout padrão)</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{t.is_default ? " (padrão)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
