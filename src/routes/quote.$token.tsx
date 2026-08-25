import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { getQuoteByToken, respondToQuote } from "@/lib/quotes.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Check, X, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDateTime } from "@/lib/crm";
import { renderQuoteTemplate, type QuoteRenderContext } from "@/lib/quote-template-renderer";
import { SENIORITY_LABEL } from "@/lib/job-profiles-shared";

function lineRoleHint(li: { seniority?: string | null; unit?: string | null }) {
  return [
    li.seniority ? (SENIORITY_LABEL[li.seniority] ?? li.seniority) : null,
    li.unit ? `por ${li.unit}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}


export const Route = createFileRoute("/quote/$token")({
  component: PublicQuotePage,
});

function lineTotal(li: {
  quantity: number;
  unit_price: number;
  discount_pct: number;
  tax_rate: number;
}) {
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

  const paperRef = useRef<HTMLDivElement>(null);

  const triggerDownload = () => {
    if (typeof window === "undefined") return;
    window.location.assign(`${window.location.origin}/api/public/quotes/${token}/pdf`);
  };

  const downloadedRef = useRef(false);
  useEffect(() => {
    if (downloadedRef.current || isLoading || error || !data) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const wants = params.get("download") === "pdf" || params.get("print") === "1";
    if (!wants) return;
    downloadedRef.current = true;
    triggerDownload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, error, data]);


  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  if (error || !data)
    return <div className="p-8 text-sm text-destructive">Cotação não encontrada.</div>;

  const { quote, items, company, contact, agent } = data;
  const template = (
    data as unknown as { template: { id: string; name: string; html: string } | null }
  ).template;
  const expired = quote.valid_until && new Date(quote.valid_until) < new Date();
  const responded = quote.status === "accepted" || quote.status === "declined";

  if (template?.html) {
    return (
      <TemplatedQuote
        html={template.html}
        quote={quote}
        items={items}
        company={company}
        contact={contact}
        agent={agent}
        expired={!!expired}
        responded={responded}
        paperRef={paperRef}
        onDownload={triggerDownload}
        onAcceptClick={() => setAcceptOpen(true)}
        onDeclineClick={() => respondMut.mutate({ action: "decline" })}
        respondPending={respondMut.isPending}
        acceptOpen={acceptOpen}
        setAcceptOpen={setAcceptOpen}
        signature={signature}
        setSignature={setSignature}
        onAcceptSubmit={() => respondMut.mutate({ action: "accept", signature })}
      />
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      <div className="w-full mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Badge
            variant={
              quote.status === "accepted"
                ? "default"
                : quote.status === "declined"
                  ? "destructive"
                  : quote.status === "sent" || quote.status === "published"
                    ? "secondary"
                    : "outline"
            }
          >
            {quote.status === "draft" && "Rascunho"}
            {quote.status === "published" && "Publicada"}
            {quote.status === "sent" && "Enviada"}
            {quote.status === "accepted" && "Aceita"}
            {quote.status === "declined" && "Recusada"}
            {quote.status === "expired" && "Expirada"}
          </Badge>
          <Button size="sm" variant="outline" onClick={() => void triggerDownload()}>
            <Download className="h-4 w-4 mr-1" /> Baixar PDF
          </Button>
        </div>

        <Card ref={paperRef} className="print:shadow-none print:border-0 bg-white">
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
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Para
                </div>
                {company?.name && <div className="font-medium">{company.name}</div>}
                {contact && (
                  <div>
                    {contact.first_name} {contact.last_name ?? ""}
                  </div>
                )}
                {contact?.email && <div className="text-muted-foreground">{contact.email}</div>}
              </div>
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Detalhes
                </div>
                <div>Emitida em {formatDateTime(quote.created_at)}</div>
                {quote.valid_until && (
                  <div className={expired ? "text-destructive" : ""}>
                    Válida até {formatDateTime(quote.valid_until)}
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
                        {lineRoleHint(li) && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {lineRoleHint(li)}
                          </div>
                        )}
                        {li.description && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {li.description}
                          </div>
                        )}
                      </td>
                      <td className="text-right p-3 tabular-nums">{Number(li.quantity)}</td>
                      <td className="text-right p-3 tabular-nums">
                        {formatCurrency(Number(li.unit_price), quote.currency)}
                      </td>
                      <td className="text-right p-3 tabular-nums">{Number(li.discount_pct)}%</td>
                      <td className="text-right p-3 tabular-nums">{Number(li.tax_rate)}%</td>
                      <td className="text-right p-3 tabular-nums font-medium">
                        {formatCurrency(lineTotal(li), quote.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <Row
                  label="Subtotal"
                  value={formatCurrency(Number(quote.subtotal), quote.currency)}
                />
                <Row
                  label="Descontos"
                  value={`− ${formatCurrency(Number(quote.discount_total), quote.currency)}`}
                />
                <Row
                  label="Impostos"
                  value={`+ ${formatCurrency(Number(quote.tax_total), quote.currency)}`}
                />
                <div className="border-t pt-1 mt-1 text-base font-semibold flex justify-between">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {formatCurrency(Number(quote.total), quote.currency)}
                  </span>
                </div>
              </div>
            </div>

            {quote.notes && (
              <div className="text-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Observações
                </div>
                <p className="whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}
            {quote.terms && (
              <div className="text-sm">
                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Termos
                </div>
                <p className="whitespace-pre-wrap">{quote.terms}</p>
              </div>
            )}

            {quote.status === "accepted" && quote.signature_name && (
              <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-4 text-sm">
                <div className="font-medium">Aceita em {formatDateTime(quote.accepted_at!)}</div>
                <div className="text-muted-foreground">Assinado por: {quote.signature_name}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {quote.paid_at ? (
          <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-4 text-sm print:hidden">
            <div className="font-medium">
              Pagamento confirmado em {formatDateTime(quote.paid_at)}
            </div>
          </div>
        ) : (
          <>
            {quote.payment_link_url && !responded && (
              <div className="print:hidden">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => window.location.assign(quote.payment_link_url!)}
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pagar {formatCurrency(Number(quote.total), quote.currency)}
                </Button>
              </div>
            )}
            {!responded && !expired && (
              <div className="flex gap-2 justify-end print:hidden">
                <Button
                  variant="outline"
                  onClick={() => respondMut.mutate({ action: "decline" })}
                  disabled={respondMut.isPending}
                >
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
          <DialogHeader>
            <DialogTitle>Aceitar cotação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Digite seu nome completo como assinatura eletrônica.
            </p>
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Seu nome"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptOpen(false)}>
              Cancelar
            </Button>
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

// ============== Renderer para cotações com modelo HTML ==============

type LineItem = {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  tax_rate: number;
  seniority?: string | null;
  unit?: string | null;
};

type QuoteForRender = {
  id: string;
  number: string;
  title: string | null;
  status: string;
  currency: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  total: number;
  notes: string | null;
  terms: string | null;
  created_at: string;
  valid_until: string | null;
  payment_link_url: string | null;
  paid_at: string | null;
};

type TemplatedQuoteProps = {
  html: string;
  quote: QuoteForRender;
  items: LineItem[];
  company: { name?: string | null; website?: string | null } | null;
  contact: { first_name?: string | null; last_name?: string | null; email?: string | null } | null;
  agent: { full_name?: string | null; email?: string | null } | null;
  expired: boolean;
  responded: boolean;
  paperRef: React.RefObject<HTMLDivElement | null>;
  onDownload: () => void;
  onAcceptClick: () => void;
  onDeclineClick: () => void;
  respondPending: boolean;
  acceptOpen: boolean;
  setAcceptOpen: (v: boolean) => void;
  signature: string;
  setSignature: (v: string) => void;
  onAcceptSubmit: () => void;
};

const ACTIONS_MARKER = "__QUOTE_ACTIONS_PLACEHOLDER__";

function TemplatedQuote(props: TemplatedQuoteProps) {
  const { html, quote, items, company, contact, agent, expired, responded } = props;

  const ctx: QuoteRenderContext = useMemo(() => {
    const fmt = (n: number) => formatCurrency(Number(n), quote.currency);
    return {
      quote: {
        number: quote.number,
        title: quote.title ?? "Cotação",
        created_at: formatDateTime(quote.created_at),
        valid_until: quote.valid_until ? formatDateTime(quote.valid_until) : "",
        subtotal: fmt(quote.subtotal),
        discount_total: fmt(quote.discount_total),
        tax_total: fmt(quote.tax_total),
        total: fmt(quote.total),
        notes: quote.notes ?? "",
        terms: quote.terms ?? "",
      },
      company: { name: company?.name ?? "", domain: company?.website ?? "" },
      contact: {
        name: contact ? `${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() : "",
        email: contact?.email ?? "",
      },
      agent: { name: agent?.full_name ?? "", email: agent?.email ?? "" },
      items: items.map((li) => {
        const total =
          Number(li.quantity) *
          Number(li.unit_price) *
          (1 - Number(li.discount_pct) / 100) *
          (1 + Number(li.tax_rate) / 100);
        return {
          name: li.name,
          description: li.description ?? "",
          quantity: Number(li.quantity),
          unit_price: fmt(Number(li.unit_price)),
          discount_pct: Number(li.discount_pct),
          tax_rate: Number(li.tax_rate),
          line_total: fmt(total),
        };
      }),
    };
  }, [quote, items, company, contact, agent]);

  const rendered = useMemo(() => {
    const out = renderQuoteTemplate(html, ctx).replace(/\{\{#actions\/\}\}/g, ACTIONS_MARKER);
    return DOMPurify.sanitize(out, { WHOLE_DOCUMENT: true, ADD_TAGS: ["style"] });
  }, [html, ctx]);

  const [before, after] = useMemo(() => {
    const idx = rendered.indexOf(ACTIONS_MARKER);
    if (idx === -1) return [rendered, ""];
    return [rendered.slice(0, idx), rendered.slice(idx + ACTIONS_MARKER.length)];
  }, [rendered]);

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      <div className="w-full mx-auto p-4 sm:p-6 space-y-3">
        <div className="flex items-center justify-end print:hidden" data-pdf-hide>
          <Button size="sm" variant="outline" onClick={props.onDownload}>
            <Download className="h-4 w-4 mr-1" /> Baixar PDF
          </Button>
        </div>

        <div
          ref={props.paperRef}
          className="rounded-md border bg-white overflow-hidden print:border-0"
          dangerouslySetInnerHTML={{
            __html: before + makeActionsHtml(props, !!after, expired, responded) + after,
          }}
        />

        {/* Bind real action handlers via overlay buttons (the marker block in HTML is presentational only) */}
        {!quote.paid_at && quote.payment_link_url && !responded && (
          <div className="print:hidden">
            <Button
              className="w-full"
              size="lg"
              onClick={() => window.location.assign(quote.payment_link_url!)}
            >
              <CreditCard className="h-4 w-4 mr-2" /> Pagar{" "}
              {formatCurrency(Number(quote.total), quote.currency)}
            </Button>
          </div>
        )}
        {!quote.paid_at && !responded && !expired && (
          <div className="flex gap-2 justify-end print:hidden">
            <Button
              variant="outline"
              onClick={props.onDeclineClick}
              disabled={props.respondPending}
            >
              <X className="h-4 w-4 mr-1" /> Recusar
            </Button>
            <Button onClick={props.onAcceptClick}>
              <Check className="h-4 w-4 mr-1" /> Aceitar
            </Button>
          </div>
        )}
      </div>

      <Dialog open={props.acceptOpen} onOpenChange={props.setAcceptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aceitar cotação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Digite seu nome completo como assinatura eletrônica.
            </p>
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input
                value={props.signature}
                onChange={(e) => props.setSignature(e.target.value)}
                placeholder="Seu nome"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => props.setAcceptOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={props.onAcceptSubmit}
              disabled={!props.signature.trim() || props.respondPending}
            >
              Confirmar aceite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Renders a static informational block inside the templated HTML; the real
// interactive buttons live outside the dangerouslySetInnerHTML container.
function makeActionsHtml(
  p: TemplatedQuoteProps,
  _hasAfter: boolean,
  expired: boolean,
  responded: boolean,
): string {
  if (p.quote.paid_at) {
    return `<div style="margin:24px 0;padding:14px 18px;border-radius:10px;background:#dcfce7;color:#166534;text-align:center;font-weight:600">Pagamento confirmado</div>`;
  }
  if (responded) {
    return `<div style="margin:24px 0;padding:14px 18px;border-radius:10px;background:#f1f5f9;color:#475569;text-align:center">Resposta registrada</div>`;
  }
  if (expired) {
    return `<div style="margin:24px 0;padding:14px 18px;border-radius:10px;background:#fee2e2;color:#991b1b;text-align:center;font-weight:600">Esta cotação expirou</div>`;
  }
  return "";
}
