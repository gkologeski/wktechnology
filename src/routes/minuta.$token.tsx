import { useState } from "react";
import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Download, FileText, Loader2, PencilLine } from "lucide-react";
import { toast } from "sonner";
import DOMPurify from "isomorphic-dompurify";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProposalDocument } from "@/components/proposals/proposal-document";
import {
  decidePublicContractDraft,
  getPublicContractDraft,
} from "@/lib/contracts/contract-draft-public.functions";
import { isValidDraftToken } from "@/lib/contracts/contract-draft-public-rules";
import {
  requestHiringDraftCode,
  decideHiringDraft,
  downloadHiringDraftAttachment,
} from "@/lib/hiring/requests/formalization.functions";

export const Route = createFileRoute("/minuta/$token")({
  head: () => ({
    meta: [
      { title: "Minuta de contrato — WK Technology" },
      { name: "description", content: "Leia a minuta do contrato e aceite ou peça ajustes." },
      { property: "og:title", content: "Minuta de contrato — WK Technology" },
      {
        property: "og:description",
        content: "Leia a minuta do contrato e aceite ou peça ajustes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicContractDraftPage,
});

const STATUS: Record<string, string> = {
  sent: "Aguardando sua resposta",
  accepted: "Minuta aceita",
  changes_requested: "Ajustes solicitados",
};

function PublicContractDraftPage() {
  const { token } = useParams({ from: "/minuta/$token" });
  const fetchDoc = useServerFn(getPublicContractDraft);
  const decide = useServerFn(decidePublicContractDraft);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [askChanges, setAskChanges] = useState(false);
  const [code, setCode] = useState("");
  const sendCode = useServerFn(requestHiringDraftCode),
    hiringDecide = useServerFn(decideHiringDraft),
    download = useServerFn(downloadHiringDraftAttachment);
  const otp = useMutation({ mutationFn: () => sendCode({ data: { token } }) });
  const annex = useMutation({
    mutationFn: (id: string) => download({ data: { token, annex: id } }),
    onSuccess: (d) => {
      const bytes = Uint8Array.from(atob(d.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: d.mime }));
      const a = document.createElement("a");
      a.href = url;
      a.download = d.name;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
  const valid = isValidDraftToken(token);
  const q = useQuery({
    queryKey: ["public-contract-draft", token],
    queryFn: () => fetchDoc({ data: { token } }),
    enabled: valid,
    retry: false,
  });
  const m = useMutation({
    mutationFn: async (decision: "accept" | "changes") => {
      if (q.data?.requires_code) return hiringDecide({ data: { token, decision, code, note } });
      return decide({ data: { token, decision, name, note: note.trim() || null } });
    },
    onSuccess: (_r, d) => {
      toast.success(d === "accept" ? "Minuta aceita. Obrigado!" : "Pedido de ajustes enviado.");
      q.refetch();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  if (!valid || q.isError || (q.isSuccess && !q.data))
    return (
      <main className="mx-auto max-w-2xl p-8 text-center">
        <h1 className="text-xl font-semibold">Minuta não encontrada</h1>
        <p className="mt-2 text-muted-foreground">
          O link pode estar incorreto ou a minuta ainda não foi liberada.
        </p>
      </main>
    );
  if (q.isLoading || !q.data)
    return (
      <main className="mx-auto flex max-w-2xl justify-center p-8" role="status">
        <Loader2 className="h-6 w-6 animate-spin" aria-label="Carregando minuta" />
      </main>
    );

  const d = q.data;
  const open = d.status === "sent";
  const linkedProposal = d.linked_proposal ?? null;
  const proposalPdfUrl = d.has_proposal_pdf
    ? `/api/public/contract-drafts/${encodeURIComponent(token)}/proposal-pdf`
    : null;
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">{d.workspace_name ?? "WK Technology"}</p>
        <h1 className="break-words text-2xl font-semibold">{d.title}</h1>
        <Badge variant="secondary">{STATUS[d.status] ?? d.status}</Badge>
      </header>
      {linkedProposal && (
        <section
          aria-label="Proposta comercial vinculada"
          className="flex flex-col gap-3 rounded-md border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-medium text-foreground">
                Proposta comercial vinculada (Anexo)
              </p>
              <p className="break-words text-sm text-muted-foreground">
                {linkedProposal.proposal.title} · Versão {linkedProposal.proposal.version} —
                consulte os valores, prazos e escopo logo abaixo da minuta.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <a href="#proposta-comercial">Ver proposta abaixo</a>
            </Button>
            {proposalPdfUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={proposalPdfUrl}>
                  <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Baixar PDF
                </a>
              </Button>
            )}
          </div>
        </section>
      )}
      {d.linked_proposal_error && !linkedProposal && (
        <p
          className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground"
          role="alert"
        >
          Não foi possível carregar a proposta comercial vinculada agora. Recarregue a página ou
          solicite uma cópia ao responsável antes de responder.
        </p>
      )}
      <article
        className="prose max-w-none rounded-md border border-border bg-card p-6 text-card-foreground dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(d.body_html) }}
      />
      {linkedProposal && (
        <section
          id="proposta-comercial"
          aria-labelledby="proposta-comercial-heading"
          className="space-y-3 pt-2"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="proposta-comercial-heading" className="text-lg font-semibold text-foreground">
                Anexo — Proposta comercial
              </h2>
              <p className="text-sm text-muted-foreground">
                Documento comercial de referência vinculado a esta minuta.
              </p>
            </div>
            {proposalPdfUrl && (
              <Button size="sm" variant="outline" asChild>
                <a href={proposalPdfUrl}>
                  <Download className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Baixar PDF da proposta
                </a>
              </Button>
            )}
          </div>
          <div className="min-w-0 overflow-x-auto">
            <ProposalDocument doc={linkedProposal} />
          </div>
        </section>
      )}
      {d.attachments?.map((a) => (
        <Button
          key={a.id}
          variant="outline"
          disabled={annex.isPending}
          onClick={() => annex.mutate(a.id)}
        >
          Baixar anexo: {a.name}
        </Button>
      ))}
      {annex.isError && <p role="alert">{annex.error.message}</p>}
      {open ? (
        <section
          className="space-y-4 rounded-md border border-border bg-card p-6"
          aria-label="Sua resposta"
        >
          {d.requires_code ? (
            <div className="space-y-2">
              <Button variant="outline" disabled={otp.isPending} onClick={() => otp.mutate()}>
                Enviar código ao meu e-mail cadastrado
              </Button>
              {otp.isSuccess && (
                <p role="status">
                  {otp.data.sent
                    ? "Código enviado ao e-mail cadastrado."
                    : "Código não enviado; tente depois ou contate o responsável."}
                </p>
              )}
              {otp.isError && <p role="alert">{otp.error.message}</p>}
              <Label htmlFor="mn-code">Código temporário</Label>
              <Input
                id="mn-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Label htmlFor="mn-name">Seu nome completo</Label>
              <Input id="mn-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          {askChanges && (
            <div className="space-y-1">
              <Label htmlFor="mn-note">Quais ajustes você precisa?</Label>
              <Textarea
                id="mn-note"
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {!askChanges ? (
              <>
                <Button
                  onClick={() => m.mutate("accept")}
                  disabled={
                    m.isPending ||
                    (d.requires_code ? !/^\d{8}$/.test(code) : name.trim().length < 3)
                  }
                >
                  {m.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="mr-2 h-4 w-4" />
                  )}
                  Aceitar minuta
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setAskChanges(true)}
                  disabled={m.isPending}
                >
                  <PencilLine className="mr-2 h-4 w-4" /> Pedir ajustes
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={() => m.mutate("changes")}
                  disabled={
                    m.isPending ||
                    (d.requires_code ? !/^\d{8}$/.test(code) : name.trim().length < 3) ||
                    note.trim().length < 5
                  }
                >
                  Enviar pedido de ajustes
                </Button>
                <Button variant="ghost" onClick={() => setAskChanges(false)} disabled={m.isPending}>
                  Voltar
                </Button>
              </>
            )}
          </div>
        </section>
      ) : (
        <p className="text-sm text-muted-foreground" role="status">
          Resposta registrada{d.client_name ? ` por ${d.client_name}` : ""}
          {d.client_decided_at
            ? ` em ${new Date(d.client_decided_at).toLocaleString("pt-BR")}`
            : ""}
          .
        </p>
      )}
    </main>
  );
}
