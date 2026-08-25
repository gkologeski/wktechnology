import { getPublicAppUrl } from "@/lib/app-url";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronLeft, ChevronRight, ExternalLink, Loader2, Slash } from "lucide-react";
import { toast } from "sonner";
import { createQuoteFromDeal, updateQuote, resyncQuoteLineItems } from "@/lib/quotes.functions";
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
import { LineItemsEditorBody } from "@/components/deals/deal-line-items";
import { SendEmailDialog } from "@/components/email/send-email-dialog";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/crm";
import { cn } from "@/lib/utils";

const NO_TEMPLATE = "__none__";

type Deal = {
  id: string;
  name: string | null;
  owner_id: string;
  currency: string | null;
  primary_contact_id: string | null;
  company_id: string | null;
};

type QuoteRow = {
  id: string;
  public_token: string;
  number: string;
  title: string | null;
  currency: string | null;
  valid_until: string | null;
  notes: string | null;
  terms: string | null;
  template_id: string | null;
  status: string | null;
  subtotal: number | string | null;
  discount_total: number | string | null;
  tax_total: number | string | null;
  total: number | string | null;
};

type Props = {
  dealId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingQuote?: QuoteRow | null;
};

const STEPS = [
  { key: "basics", label: "Modelo & Identificação" },
  { key: "items", label: "Itens de linha" },
  { key: "notes", label: "Observações & Termos" },
  { key: "review", label: "Revisão & Publicação" },
] as const;

function SnippetHint() {
  return (
    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-text-tertiary">
      <Slash className="h-3 w-3" aria-hidden="true" />
      <span>Digite "/" para inserir um snippet</span>
    </p>
  );
}

export function QuoteWizard({ dealId, open, onOpenChange, existingQuote }: Props) {
  const qc = useQueryClient();
  const createFn = useServerFn(createQuoteFromDeal);
  const updateFn = useServerFn(updateQuote);
  const resyncFn = useServerFn(resyncQuoteLineItems);
  const listTemplatesFn = useServerFn(listQuoteTemplates);

  const [step, setStep] = useState(0);
  const [quoteId, setQuoteId] = useState<string | null>(existingQuote?.id ?? null);
  const [publicToken, setPublicToken] = useState<string | null>(
    existingQuote?.public_token ?? null,
  );
  const [quoteNumber, setQuoteNumber] = useState<string | null>(existingQuote?.number ?? null);
  const [totals, setTotals] = useState<{
    subtotal: number;
    discount_total: number;
    tax_total: number;
    total: number;
  } | null>(
    existingQuote
      ? {
          subtotal: Number(existingQuote.subtotal ?? 0),
          discount_total: Number(existingQuote.discount_total ?? 0),
          tax_total: Number(existingQuote.tax_total ?? 0),
          total: Number(existingQuote.total ?? 0),
        }
      : null,
  );

  const [draft, setDraft] = useState({
    title: existingQuote?.title ?? "",
    validUntil: existingQuote?.valid_until ? String(existingQuote.valid_until).slice(0, 10) : "",
    notes: existingQuote?.notes ?? "",
    terms: existingQuote?.terms ?? "",
    templateId: existingQuote?.template_id ?? "",
  });

  const [showSend, setShowSend] = useState(false);

  // Reset when dialog opens/closes or existingQuote changes
  useEffect(() => {
    if (!open) return;
    setStep(0);
    setQuoteId(existingQuote?.id ?? null);
    setPublicToken(existingQuote?.public_token ?? null);
    setQuoteNumber(existingQuote?.number ?? null);
    setDraft({
      title: existingQuote?.title ?? "",
      validUntil: existingQuote?.valid_until ? String(existingQuote.valid_until).slice(0, 10) : "",
      notes: existingQuote?.notes ?? "",
      terms: existingQuote?.terms ?? "",
      templateId: existingQuote?.template_id ?? "",
    });
    setTotals(
      existingQuote
        ? {
            subtotal: Number(existingQuote.subtotal ?? 0),
            discount_total: Number(existingQuote.discount_total ?? 0),
            tax_total: Number(existingQuote.tax_total ?? 0),
            total: Number(existingQuote.total ?? 0),
          }
        : null,
    );
  }, [open, existingQuote]);

  const { data: deal } = useQuery({
    queryKey: ["deal-basics", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, name, owner_id, currency, primary_contact_id, company_id")
        .eq("id", dealId)
        .maybeSingle();
      if (error) throw error;
      return data as Deal | null;
    },
    enabled: open,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["quote-templates"],
    queryFn: () => listTemplatesFn(),
    enabled: open,
  });

  const { data: contact } = useQuery({
    queryKey: ["deal-primary-contact", deal?.primary_contact_id],
    queryFn: async () => {
      if (!deal?.primary_contact_id) return null;
      const { data, error } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email")
        .eq("id", deal.primary_contact_id)
        .maybeSingle();
      if (error) throw error;
      return data as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        email: string | null;
      } | null;
    },
    enabled: open && Boolean(deal?.primary_contact_id),
  });

  const { data: lineItemsCount = [] } = useQuery({
    queryKey: ["deal_line_items", dealId, "count"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_line_items")
        .select("id")
        .eq("deal_id", dealId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });
  const hasLineItems = lineItemsCount.length > 0;

  const currency = deal?.currency ?? "BRL";

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["deal-quotes", dealId] });
  };

  // Save basics: creates the quote on first call, updates otherwise
  const saveBasicsMut = useMutation({
    mutationFn: async () => {
      if (!quoteId) {
        const q = await createFn({
          data: {
            dealId,
            title: draft.title || undefined,
            validUntil: draft.validUntil || undefined,
            notes: draft.notes || undefined,
            terms: draft.terms || undefined,
            templateId: draft.templateId ? draft.templateId : null,
          },
        });
        return { created: true, quote: q as QuoteRow };
      }
      await updateFn({
        data: {
          id: quoteId,
          patch: {
            title: draft.title || null,
            valid_until: draft.validUntil || null,
            template_id: draft.templateId ? draft.templateId : null,
          },
        },
      });
      return { created: false, quote: null };
    },
    onSuccess: (r) => {
      if (r.created && r.quote) {
        setQuoteId(r.quote.id);
        setPublicToken(r.quote.public_token);
        setQuoteNumber(r.quote.number);
        setTotals({
          subtotal: Number(r.quote.subtotal ?? 0),
          discount_total: Number(r.quote.discount_total ?? 0),
          tax_total: Number(r.quote.tax_total ?? 0),
          total: Number(r.quote.total ?? 0),
        });
      }
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resyncMut = useMutation({
    mutationFn: async () => {
      if (!quoteId) return null;
      return resyncFn({ data: { id: quoteId } });
    },
    onSuccess: (r) => {
      if (r?.totals) {
        setTotals({
          subtotal: Number(r.totals.subtotal ?? 0),
          discount_total: Number(r.totals.discount_total ?? 0),
          tax_total: Number(r.totals.tax_total ?? 0),
          total: Number(r.totals.total ?? 0),
        });
      }
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveNotesMut = useMutation({
    mutationFn: async () => {
      if (!quoteId) return;
      await updateFn({
        data: {
          id: quoteId,
          patch: {
            notes: draft.notes || null,
            terms: draft.terms || null,
          },
        },
      });
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const publishMut = useMutation({
    mutationFn: async () => {
      if (!quoteId) return;
      await updateFn({
        data: {
          id: quoteId,
          patch: {
            status: "published",
            sent_at: null,
          },
        },
      });
    },
    onSuccess: () => {
      toast.success("Cotação publicada.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markAsSentMut = useMutation({
    mutationFn: async () => {
      if (!quoteId) return;
      await updateFn({
        data: {
          id: quoteId,
          patch: {
            status: "sent",
            sent_at: new Date().toISOString(),
          },
        },
      });
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  async function goNext() {
    // Autosave for current step, then advance
    try {
      if (step === 0) {
        if (!hasLineItems) {
          toast.error("Adicione itens de linha ao negócio antes de continuar.");
          return;
        }
        await saveBasicsMut.mutateAsync();
      } else if (step === 1) {
        await resyncMut.mutateAsync();
      } else if (step === 2) {
        await saveNotesMut.mutateAsync();
      }
      setStep((s) => Math.min(STEPS.length - 1, s + 1));
    } catch {
      // toast already shown
    }
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  async function handleSaveDraft() {
    // Persist whatever step we're on
    try {
      if (step === 0) await saveBasicsMut.mutateAsync();
      else if (step === 2) await saveNotesMut.mutateAsync();
      toast.success("Rascunho salvo.");
      onOpenChange(false);
    } catch {
      /* toast already shown */
    }
  }

  async function handlePublish() {
    await publishMut.mutateAsync();
    onOpenChange(false);
  }

  async function handlePublishAndSend() {
    await publishMut.mutateAsync();
    setShowSend(true);
  }

  const publicUrl = useMemo(
    () => (publicToken ? `${getPublicAppUrl()}/quote/${publicToken}` : ""),
    [publicToken],
  );

  const emailDefaults = useMemo(() => {
    const title = draft.title || deal?.name || quoteNumber || "Cotação";
    const contactName = contact
      ? [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim()
      : "";
    const greeting = contactName ? `Olá ${contactName.split(" ")[0]},` : "Olá,";
    const subject = `Cotação ${quoteNumber ? `${quoteNumber} · ` : ""}${title}`;
    const body = [
      `<p>${greeting}</p>`,
      `<p>Segue nossa cotação <strong>${title}</strong>${quoteNumber ? ` (${quoteNumber})` : ""}.</p>`,
      publicUrl ? `<p>Acesse pelo link: <a href="${publicUrl}">${publicUrl}</a></p>` : "",
      `<p>Qualquer dúvida, estou à disposição.</p>`,
    ]
      .filter(Boolean)
      .join("");
    return { subject, body };
  }, [draft.title, deal?.name, quoteNumber, contact, publicUrl]);

  const isBusy =
    saveBasicsMut.isPending ||
    resyncMut.isPending ||
    saveNotesMut.isPending ||
    publishMut.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => (isBusy ? undefined : onOpenChange(v))}>
        <DialogContent className="max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {existingQuote ? "Editar cotação" : "Nova cotação"}
              {quoteNumber ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {quoteNumber}
                </span>
              ) : null}
            </DialogTitle>
          </DialogHeader>

          {/* Stepper */}
          <ol className="mb-4 grid grid-cols-4 gap-2">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              return (
                <li key={s.key} className="flex flex-col gap-1">
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs",
                      active && "border-primary bg-primary/5 text-primary",
                      done &&
                        "border-emerald-500/50 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400",
                      !active && !done && "text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                        active && "border-primary bg-primary text-primary-foreground",
                        done && "border-emerald-500 bg-emerald-500 text-white",
                      )}
                    >
                      {done ? <Check className="h-3 w-3" /> : i + 1}
                    </span>
                    <span className="truncate">{s.label}</span>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Step content */}
          {step === 0 && (
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
                  placeholder={deal?.name ?? "(usar nome do negócio)"}
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
              {!hasLineItems && (
                <p className="text-xs text-amber-600">
                  Este negócio ainda não possui itens de linha. Você poderá adicioná-los na próxima
                  etapa, mas será necessário ter ao menos um item para publicar.
                </p>
              )}
            </div>
          )}

          {step === 1 && deal && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Edite os itens do negócio. Ao avançar, a cotação será re-snapshot com os itens
                atuais.
              </p>
              <LineItemsEditorBody dealId={dealId} ownerId={deal.owner_id} currency={currency} />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Observações</Label>
                <RichHtmlEditor
                  value={draft.notes}
                  onChange={(html) => setDraft({ ...draft, notes: html })}
                  minHeight={140}
                />
                <SnippetHint />
              </div>
              <div className="space-y-1.5">
                <Label>Termos e condições</Label>
                <RichHtmlEditor
                  value={draft.terms}
                  onChange={(html) => setDraft({ ...draft, terms: html })}
                  minHeight={180}
                />
                <SnippetHint />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="rounded-md border p-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Título</span>
                  <span className="font-medium">{draft.title || deal?.name || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Número</span>
                  <span className="font-mono">{quoteNumber ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Válida até</span>
                  <span>{draft.validUntil || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Itens</span>
                  <span>{lineItemsCount.length}</span>
                </div>
                {totals && (
                  <>
                    <div className="flex justify-between pt-1 border-t">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="tabular-nums">
                        {formatCurrency(totals.subtotal, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Desconto</span>
                      <span className="tabular-nums">
                        -{formatCurrency(totals.discount_total, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Impostos</span>
                      <span className="tabular-nums">
                        {formatCurrency(totals.tax_total, currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-base font-semibold pt-1 border-t">
                      <span>Total</span>
                      <span className="tabular-nums">{formatCurrency(totals.total, currency)}</span>
                    </div>
                  </>
                )}
                {publicUrl && (
                  <div className="pt-2">
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                    >
                      Ver link público <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
              {!contact?.email && (
                <p className="text-xs text-amber-600">
                  Sem e-mail no contato principal — a cotação será publicada; você poderá enviá-la
                  por e-mail depois de cadastrar o e-mail do contato.
                </p>
              )}
            </div>
          )}

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button variant="ghost" onClick={goBack} disabled={isBusy}>
                  <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
                </Button>
              )}
              <Button variant="outline" onClick={handleSaveDraft} disabled={isBusy}>
                Salvar rascunho
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {step < STEPS.length - 1 ? (
                <Button onClick={goNext} disabled={isBusy}>
                  {isBusy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  Avançar <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Button variant="secondary" onClick={handlePublish} disabled={isBusy || !quoteId}>
                    Publicar
                  </Button>
                  <Button
                    onClick={handlePublishAndSend}
                    disabled={isBusy || !quoteId || !contact?.email}
                  >
                    Publicar e enviar
                  </Button>
                </>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showSend && deal && (
        <SendEmailDialog
          open={showSend}
          onOpenChange={(v) => {
            setShowSend(v);
            if (!v) onOpenChange(false);
          }}
          defaultTo={contact?.email ?? ""}
          defaultSubject={emailDefaults.subject}
          defaultBody={emailDefaults.body}
          contactId={contact?.id}
          dealId={dealId}
          companyId={deal.company_id ?? undefined}
          contactName={
            contact
              ? [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() ||
                undefined
              : undefined
          }
          onSent={async () => {
            try {
              await markAsSentMut.mutateAsync();
            } catch {
              /* toast already shown */
            }
            setShowSend(false);
            onOpenChange(false);
          }}
        />
      )}
    </>
  );
}
