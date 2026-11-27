import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import DOMPurify from "isomorphic-dompurify";
import { Check, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContractPaymentTermsCard } from "@/components/contracts/contract-payment-terms-card";
import {
  decidePublicContractAcceptance,
  getPublicContractAcceptance,
} from "@/lib/contracts/acceptance.functions";
import { formatCurrency, formatDateOnly, formatDateTime } from "@/lib/crm";

export const Route = createFileRoute("/contract-acceptance/$token")({
  head: () => ({
    meta: [
      { title: "Aceite comercial do contrato" },
      {
        name: "description",
        content: "Confira o contrato e confirme o aceite das condições comerciais.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
      { property: "og:title", content: "Aceite comercial do contrato" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicContractAcceptancePage,
});

function PublicContractAcceptancePage() {
  const { token } = Route.useParams();
  const [clientName, setClientName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const q = useQuery({
    queryKey: ["public-contract-acceptance", token],
    queryFn: () => getPublicContractAcceptance({ data: { token } }),
    retry: false,
  });
  const m = useMutation({
    mutationFn: () =>
      decidePublicContractAcceptance({
        data: { token, clientName: clientName.trim(), accepted: true },
      }),
    onSuccess: async () => {
      toast.success("Aceite do contrato registrado. A assinatura continua em seu fluxo próprio.");
      await q.refetch();
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível registrar o aceite."),
  });
  if (q.isError || (q.isSuccess && !q.data))
    return (
      <main className="mx-auto max-w-2xl space-y-3 p-8 text-center">
        <h1 className="text-xl font-semibold">Link de aceite indisponível</h1>
        <p className="text-muted-foreground">
          O link pode ter expirado, sido revogado ou pertencer a uma versão anterior do contrato.
          Solicite um novo link ao responsável.
        </p>
      </main>
    );
  if (q.isLoading || !q.data)
    return (
      <main className="mx-auto flex max-w-2xl justify-center p-8" role="status">
        <Loader2 className="h-6 w-6 animate-spin" aria-label="Carregando contrato" />
      </main>
    );
  const d = q.data;
  const accepted = d.status === "accepted";
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">{d.workspaceName}</p>
        <h1 className="break-words text-2xl font-semibold">{d.title}</h1>
        <p className="text-sm text-muted-foreground">
          {d.number && <>Contrato {d.number} · </>}
          {d.counterpartyName}
        </p>
        <Badge variant="secondary">
          {accepted ? "Contrato aceito comercialmente" : "Aguardando seu aceite"}
        </Badge>
      </header>
      <section
        className="space-y-2 rounded-md border border-border bg-muted/40 p-4 text-sm"
        aria-label="Finalidade do aceite"
      >
        <h2 className="font-medium">Aceite comercial, separado da assinatura</h2>
        <p>
          Ao aceitar, você confirma as condições desta versão do contrato e permite o faturamento
          pela empresa prestadora. Este aceite não registra nem substitui sua assinatura do
          contrato.
        </p>
        <p className="text-muted-foreground">
          Valor do contrato: {formatCurrency(d.totalValue, d.currency)}
        </p>
      </section>
      <article
        aria-label="Documento do contrato para aceite"
        className="prose max-w-none rounded-md border border-border bg-card p-6 text-card-foreground dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(d.bodyHtml) }}
      />
      <ContractPaymentTermsCard
        raw={d.paymentTerms}
        total={d.totalValue}
        currency={d.currency}
        startsAt={d.startsAt}
        publicView
      />
      {d.attachments.length > 0 && (
        <section
          className="space-y-3 rounded-md border border-border bg-card p-6"
          aria-labelledby="contract-acceptance-annexes"
        >
          <h2 id="contract-acceptance-annexes" className="font-semibold">
            Anexos desta versão
          </h2>
          <p className="text-sm text-muted-foreground">
            Confira também os documentos vinculados antes de confirmar o aceite.
          </p>
          <ul className="space-y-2">
            {d.attachments.map((attachment) => (
              <li key={attachment.id}>
                <Button size="sm" variant="outline" asChild>
                  <a
                    href={`/api/public/contract-acceptance/${encodeURIComponent(token)}/attachments/${encodeURIComponent(attachment.id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0 whitespace-normal text-left">
                      {attachment.kind === "quote"
                        ? "Cotação"
                        : attachment.kind === "proposal"
                          ? "Proposta"
                          : "Documento"}
                      : {attachment.name}
                    </span>
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {accepted ? (
        <section className="space-y-2 rounded-md border border-border bg-card p-6" role="status">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Check className="h-5 w-5 text-primary" aria-hidden /> Aceite registrado
          </h2>
          <p>
            {d.clientName}
            {d.acceptedAt ? ` · ${formatDateOnly(d.acceptedAt)}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            A assinatura do contrato continua separada deste aceite.
          </p>
        </section>
      ) : (
        <form
          className="space-y-4 rounded-md border border-border bg-card p-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (confirmed && clientName.trim().length >= 3) m.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="public-contract-acceptance-name">Seu nome completo</Label>
            <Input
              id="public-contract-acceptance-name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              maxLength={200}
              autoComplete="name"
              disabled={m.isPending}
              required
            />
          </div>
          <div className="flex items-start gap-3">
            <Checkbox
              id="public-contract-acceptance-confirm"
              checked={confirmed}
              onCheckedChange={(value) => setConfirmed(value === true)}
              disabled={m.isPending}
            />
            <Label
              htmlFor="public-contract-acceptance-confirm"
              className="text-sm font-normal leading-relaxed"
            >
              Li o contrato acima, aceito as condições desta versão e autorizo seu faturamento.
              Entendo que este aceite não substitui a assinatura do contrato.
            </Label>
          </div>
          {m.isError && (
            <p role="alert" className="text-sm text-destructive">
              {m.error.message}
            </p>
          )}
          <Button
            type="submit"
            disabled={!confirmed || clientName.trim().length < 3 || m.isPending}
          >
            {m.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
            Aceitar contrato
          </Button>
          <p className="text-xs text-muted-foreground">
            Link válido até {formatDateTime(d.expiresAt)}. Seu aceite fica associado a esta versão
            do documento.
          </p>
        </form>
      )}
    </main>
  );
}
