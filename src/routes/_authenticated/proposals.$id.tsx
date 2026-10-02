// Ficha da proposta: o documento final (igual ao da cotação) com a barra de
// ações. A edição acontece no assistente; aprovação, envio e travamento
// continuam com as mesmas regras.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, Copy, Download, Lock, Pencil, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { GenerateContractButton } from "@/components/contracts/generate-contract-button";
import { ProposalDocument } from "@/components/proposals/proposal-document";
import { ProposalWizard, type ProposalSource } from "@/components/proposals/proposal-wizard";
import {
  getProposal,
  sendProposal,
  requestProposalApproval,
  decideProposalApproval,
} from "@/lib/proposals.functions";
import { getProposalDocument } from "@/lib/proposals/proposal-document.functions";
import { PROPOSAL_STATUS_LABEL } from "@/lib/proposals/proposal-document-types";
import { getPublicAppUrl } from "@/lib/app-url";

export const Route = createFileRoute("/_authenticated/proposals/$id")({
  head: () => ({
    meta: [
      { title: "Proposta — TechSales" },
      { name: "description", content: "Documento da proposta comercial com aprovação e envio." },
      { property: "og:title", content: "Proposta — TechSales" },
      { property: "og:description", content: "Documento da proposta comercial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProposalPage,
});

const APPROVAL_LABEL: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  rejected: "Reprovada",
};

function ProposalPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getDoc = useServerFn(getProposalDocument);
  const get = useServerFn(getProposal);
  const send = useServerFn(sendProposal);
  const req = useServerFn(requestProposalApproval);
  const decide = useServerFn(decideProposalApproval);
  const [comment, setComment] = useState("");
  const [wizard, setWizard] = useState<ProposalSource | null>(null);

  const docQ = useQuery({
    queryKey: ["proposal-doc", id],
    queryFn: () => getDoc({ data: { id } }),
    retry: 1,
  });
  const metaQ = useQuery({ queryKey: ["proposal", id], queryFn: () => get({ data: { id } }) });
  const approvals = metaQ.data?.approvals ?? [];
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["proposal-doc", id] });
    void qc.invalidateQueries({ queryKey: ["proposal", id] });
  };

  const sendM = useMutation({
    mutationFn: () => send({ data: { id } }),
    onSuccess: () => {
      toast.success("Proposta enviada e selada.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reqM = useMutation({
    mutationFn: () => req({ data: { proposalId: id, comment } }),
    onSuccess: () => {
      toast.success("Aprovação solicitada.");
      setComment("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const decideM = useMutation({
    mutationFn: (v: { approvalId: string; decision: "approved" | "rejected" }) =>
      decide({ data: { ...v, comment } }),
    onSuccess: () => {
      toast.success("Decisão registrada.");
      setComment("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (docQ.isLoading)
    return (
      <div className="mx-auto max-w-4xl space-y-3 p-6" aria-busy="true">
        <div className="h-10 animate-pulse rounded-md bg-muted" />
        <div className="h-96 animate-pulse rounded-md bg-muted" />
      </div>
    );
  if (docQ.isError || !docQ.data)
    return (
      <div className="space-y-3 p-6">
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Não foi possível carregar a proposta.</p>
          <p className="mt-1 text-muted-foreground">{(docQ.error as Error)?.message}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/proposals">
              <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
            </Link>
          </Button>
          <Button onClick={() => void docQ.refetch()}>Tentar novamente</Button>
        </div>
      </div>
    );

  const doc = docQ.data;
  const p = doc.proposal;
  const publicUrl = p.public_token ? `${getPublicAppUrl()}/proposal/${p.public_token}` : null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild aria-label="Voltar">
            <Link to="/proposals">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-sm">
            <Badge>{PROPOSAL_STATUS_LABEL[p.status] ?? p.status}</Badge>
            <Badge variant="outline">v{p.version}</Badge>
            {p.locked && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="h-3 w-3" aria-hidden="true" /> Travada
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!p.locked && (
            <Button variant="outline" onClick={() => setWizard({ proposalId: id })}>
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
          )}
          {publicUrl && (
            <Button
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(publicUrl);
                toast.success("Link copiado.");
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> Copiar link
            </Button>
          )}
          {p.public_token && (
            <Button
              variant="outline"
              onClick={() => window.location.assign(`/api/public/proposals/${p.public_token}/pdf`)}
            >
              <Download className="mr-2 h-4 w-4" /> Baixar PDF
            </Button>
          )}
          {p.status === "draft" && !p.locked && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="secondary">
                  <ShieldCheck className="mr-2 h-4 w-4" /> Enviar para aprovação
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Solicitar aprovação interna</SheetTitle>
                </SheetHeader>
                <div className="space-y-3 pt-4">
                  <Label htmlFor="appr-comment">Comentário</Label>
                  <Textarea
                    id="appr-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={4}
                  />
                  <Button onClick={() => reqM.mutate()} disabled={reqM.isPending}>
                    Enviar para revisão
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          )}
          {(p.status === "approved" || p.status === "draft") && (
            <Button onClick={() => sendM.mutate()} disabled={sendM.isPending}>
              <Send className="mr-2 h-4 w-4" /> Enviar ao cliente
            </Button>
          )}
          <GenerateContractButton source={{ proposalId: id }} size="default" />
        </div>
      </div>

      <ProposalDocument doc={doc} />

      {approvals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aprovações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {approvals.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md border p-2 text-sm"
              >
                <div>
                  <Badge
                    variant={
                      a.status === "approved"
                        ? "default"
                        : a.status === "rejected"
                          ? "destructive"
                          : "outline"
                    }
                  >
                    {APPROVAL_LABEL[a.status] ?? a.status}
                  </Badge>
                  <span className="ml-2 text-muted-foreground">{a.comment ?? ""}</span>
                </div>
                {a.status === "pending" && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => decideM.mutate({ approvalId: a.id, decision: "approved" })}
                    >
                      Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => decideM.mutate({ approvalId: a.id, decision: "rejected" })}
                    >
                      Reprovar
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <ProposalWizard
        source={wizard}
        onOpenChange={(o) => !o && setWizard(null)}
        onDone={refresh}
      />
    </div>
  );
}
