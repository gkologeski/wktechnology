import { getPublicAppUrl } from "@/lib/app-url";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listDealQuotes,
  updateQuote,
  deleteQuote,
  regenerateQuoteToken,
  createQuotePaymentLink,
} from "@/lib/quotes.functions";
import { Button } from "@/components/ui/button";
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
import { QuoteWizard } from "@/components/deals/quote-wizard";
import { SendEmailDialog } from "@/components/email/send-email-dialog";

type QuoteStatus = "draft" | "published" | "sent" | "accepted" | "declined" | "expired";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicada",
  sent: "Enviada",
  accepted: "Aceita",
  declined: "Recusada",
  expired: "Expirada",
};

const STATUS_DOT: Record<string, string> = {
  draft: "bg-muted-foreground/40",
  published: "bg-amber-500",
  sent: "bg-blue-500",
  accepted: "bg-emerald-500",
  declined: "bg-rose-500",
  expired: "bg-rose-500",
};

type QuoteListItem = Awaited<ReturnType<typeof listDealQuotes>>[number];

export function DealQuotes({ dealId }: { dealId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listDealQuotes);
  const update = useServerFn(updateQuote);
  const del = useServerFn(deleteQuote);
  const regen = useServerFn(regenerateQuoteToken);
  const payLink = useServerFn(createQuotePaymentLink);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<QuoteListItem | null>(null);
  const [sendingQuote, setSendingQuote] = useState<QuoteListItem | null>(null);

  const { data: deal } = useQuery({
    queryKey: ["deal-quotes-context", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, name, company_id, primary_contact_id")
        .eq("id", dealId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: primaryContact } = useQuery({
    queryKey: ["deal-quotes-primary-contact", deal?.primary_contact_id],
    queryFn: async () => {
      if (!deal?.primary_contact_id) return null;
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email")
        .eq("id", deal.primary_contact_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(deal?.primary_contact_id),
  });

  const contactHasEmail = Boolean(primaryContact?.email);

  const { data: quotes = [], isLoading } = useQuery({
    queryKey: ["deal-quotes", dealId],
    queryFn: () => list({ data: { dealId } }),
  });

  function openNew() {
    setEditingQuote(null);
    setWizardOpen(true);
  }

  function openEdit(q: QuoteListItem) {
    setEditingQuote(q);
    setWizardOpen(true);
  }

  const { data: lineItems = [] } = useQuery({
    queryKey: ["deal_line_items", dealId, "count"],
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

  function publicUrl(token: string) {
    return `${getPublicAppUrl()}/quote/${token}`;
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
                  onClick={openNew}
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
                      <DropdownMenuItem
                        onSelect={() =>
                          window.open(
                            `${getPublicAppUrl()}/api/public/quotes/${q.public_token}/pdf`,
                            "_blank",
                          )
                        }
                      >
                        Baixar PDF
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {(status === "draft" || status === "published") && (
                        <DropdownMenuItem onSelect={() => openEdit(q)}>
                          Editar
                        </DropdownMenuItem>
                      )}
                      {(status === "draft" || status === "published") && contactHasEmail && (
                        <DropdownMenuItem onSelect={() => setSendingQuote(q)}>
                          Enviar por e-mail
                        </DropdownMenuItem>
                      )}
                      {(status === "draft" || status === "published") && (
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

      <QuoteWizard
        dealId={dealId}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        existingQuote={editingQuote}
      />

      {sendingQuote && primaryContact?.email && (
        <SendEmailDialog
          open={Boolean(sendingQuote)}
          onOpenChange={(v) => {
            if (!v) setSendingQuote(null);
          }}
          defaultTo={primaryContact.email}
          defaultSubject={`Cotação ${sendingQuote.number ? `${sendingQuote.number} · ` : ""}${sendingQuote.title || deal?.name || ""}`}
          defaultBody={(() => {
            const contactName = [primaryContact.first_name, primaryContact.last_name]
              .filter(Boolean)
              .join(" ")
              .trim();
            const greeting = contactName ? `Olá ${contactName.split(" ")[0]},` : "Olá,";
            const title = sendingQuote.title || deal?.name || "Cotação";
            const link = publicUrl(sendingQuote.public_token);
            return [
              `<p>${greeting}</p>`,
              `<p>Segue nossa cotação <strong>${title}</strong>${sendingQuote.number ? ` (${sendingQuote.number})` : ""}.</p>`,
              `<p>Acesse pelo link: <a href="${link}">${link}</a></p>`,
              `<p>Qualquer dúvida, estou à disposição.</p>`,
            ].join("");
          })()}
          contactId={primaryContact.id}
          dealId={dealId}
          companyId={deal?.company_id ?? undefined}
          contactName={
            [primaryContact.first_name, primaryContact.last_name]
              .filter(Boolean)
              .join(" ")
              .trim() || undefined
          }
          onSent={async () => {
            try {
              await update({
                data: {
                  id: sendingQuote.id,
                  patch: { status: "sent", sent_at: new Date().toISOString() },
                },
              });
              qc.invalidateQueries({ queryKey: ["deal-quotes", dealId] });
            } catch (e) {
              toast.error((e as Error).message);
            }
            setSendingQuote(null);
          }}
        />
      )}
    </div>
  );
}

