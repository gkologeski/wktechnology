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
import { RichHtmlEditor } from "@/components/rich-html-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, ExternalLink, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDateTime } from "@/lib/crm";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const NO_TEMPLATE = "__none__";

type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "expired";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviada",
  accepted: "Aceita",
  declined: "Recusada",
  expired: "Expirada",
};

const STATUS_DOT: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  sent: "bg-blue-500",
  accepted: "bg-emerald-500",
  declined: "bg-rose-500",
  expired: "bg-rose-500",
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    title: string;
    validUntil: string;
    notes: string;
    terms: string;
    templateId: string;
  }>({
    title: "",
    validUntil: "",
    notes: "",
    terms: "",
    templateId: "",
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

  function openDialog() {
    setEditingId(null);
    setDraft({
      title: "",
      validUntil: "",
      notes: "",
      terms: "",
      templateId: defaultTemplateId,
    });
    setOpen(true);
  }

  function openEditDialog(q: {
    id: string;
    title: string | null;
    valid_until: string | null;
    notes: string | null;
    terms: string | null;
    template_id: string | null;
  }) {
    setEditingId(q.id);
    setDraft({
      title: q.title ?? "",
      validUntil: q.valid_until ? String(q.valid_until).slice(0, 10) : "",
      notes: q.notes ?? "",
      terms: q.terms ?? "",
      templateId: q.template_id ?? "",
    });
    setOpen(true);
  }

  function resetDialog() {
    setOpen(false);
    setEditingId(null);
    setDraft({ title: "", validUntil: "", notes: "", terms: "", templateId: "" });
  }

  const { data: lineItems = [] } = useQuery({
    queryKey: ["deal_line_items", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_line_items")
        .select("id")
        .eq("deal_id", dealId);
      if (error) throw error;
      return data ?? [];
    },
  });
  const hasLineItems = lineItems.length > 0;

  const createMut = useMutation({
    mutationFn: () =>
      create({
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
  async function markAccepted(id: string) {
    await update({
      data: { id, patch: { status: "accepted", accepted_at: new Date().toISOString() } },
    });
    toast.success("Cotação marcada como aceita.");
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
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {quotes.length === 0 ? "Nenhuma cotação" : `${quotes.length} cotação(ões)`}
        </span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={hasLineItems ? -1 : 0}>
                <Button
                  size="sm"
                  variant="link"
                  className="h-auto p-0"
                  onClick={openDialog}
                  disabled={!hasLineItems}
                >
                  <Plus className="h-3.5 w-3.5 mr-0.5" /> Adicionar
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
      ) : quotes.length === 0 ? null : (
        <div className="space-y-2">
          {quotes.map((q) => {
            const status = (q.status as QuoteStatus) ?? "draft";
            const expiredOrExpiring =
              status === "expired"
                ? `Expirou: ${q.valid_until ? formatDateTime(q.valid_until) : "—"}`
                : q.valid_until
                  ? `Validade: ${formatDateTime(q.valid_until)}`
                  : null;
            return (
              <div key={q.id} className="rounded-md border p-3 group">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => window.open(publicUrl(q.public_token), "_blank")}
                    className="min-w-0 text-left flex items-center gap-1 text-primary hover:underline"
                  >
                    <span className="font-semibold truncate">{q.title || q.number}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 shrink-0"
                        aria-label="Ações"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem
                        onSelect={() => window.open(publicUrl(q.public_token), "_blank")}
                      >
                        Detalhes
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => copyLink(q.public_token)}>
                        Copiar link
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {status === "draft" && (
                        <DropdownMenuItem onSelect={() => markSent(q.id)}>
                          Marcar como enviada
                        </DropdownMenuItem>
                      )}
                      {status !== "accepted" && (
                        <DropdownMenuItem onSelect={() => markAccepted(q.id)}>
                          Marcar como aceita
                        </DropdownMenuItem>
                      )}
                      {!q.paid_at && (
                        <DropdownMenuItem onSelect={() => genPayLink(q.id)}>
                          {q.payment_link_url
                            ? "Regerar link de pagamento"
                            : "Gerar link de pagamento"}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => regenerate(q.id)}>
                        Gerar novo link público
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => remove(q.id)}
                        className="text-destructive focus:text-destructive"
                      >
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-2 space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${STATUS_DOT[status] ?? ""}`} />
                    <span>{STATUS_LABEL[status] ?? status}</span>
                  </div>
                  {expiredOrExpiring && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                      <span className="text-xs">{expiredOrExpiring}</span>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground tabular-nums pt-0.5">
                    {q.number} · {formatCurrency(Number(q.total), q.currency)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova cotação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Modelo de cotação</Label>
              <Select
                value={draft.templateId || NO_TEMPLATE}
                onValueChange={(v) =>
                  setDraft({ ...draft, templateId: v === NO_TEMPLATE ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar modelo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEMPLATE}>Sem modelo (layout padrão)</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                      {t.is_default ? " (padrão)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="(usar nome do negócio)"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Válida até</Label>
              <Input
                type="date"
                value={draft.validUntil}
                onChange={(e) => setDraft({ ...draft, validUntil: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <RichHtmlEditor
                value={draft.notes}
                onChange={(html) => setDraft({ ...draft, notes: html })}
                minHeight={140}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Termos e condições</Label>
              <RichHtmlEditor
                value={draft.terms}
                onChange={(html) => setDraft({ ...draft, terms: html })}
                minHeight={180}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? "Gerando…" : "Gerar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
