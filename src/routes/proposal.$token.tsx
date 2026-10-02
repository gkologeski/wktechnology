import { createFileRoute, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Download, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProposalDocument } from "@/components/proposals/proposal-document";
import { getProposalByToken, respondToProposal } from "@/lib/proposals/proposal-document.functions";
import { PROPOSAL_STATUS_LABEL } from "@/lib/proposals/proposal-document-types";

export const Route = createFileRoute("/proposal/$token")({
  head: () => ({
    meta: [
      { title: "Proposta comercial — WK Technology" },
      { name: "description", content: "Visualize, baixe e responda a proposta comercial." },
      { property: "og:title", content: "Proposta comercial — WK Technology" },
      { property: "og:description", content: "Visualize, baixe e responda a proposta comercial." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicProposalPage,
});

function PublicProposalPage() {
  const { token } = useParams({ from: "/proposal/$token" });
  const qc = useQueryClient();
  const fetchDoc = useServerFn(getProposalByToken);
  const respond = useServerFn(respondToProposal);
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-proposal", token],
    queryFn: () => fetchDoc({ data: { token } }),
    retry: false,
  });
  const respondMut = useMutation({
    mutationFn: (action: "accept" | "decline") => respond({ data: { token, action } }),
    onSuccess: (_r, action) => {
      toast.success(action === "accept" ? "Proposta aceita. Obrigado!" : "Resposta registrada.");
      void qc.invalidateQueries({ queryKey: ["public-proposal", token] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading)
    return (
      <div className="mx-auto max-w-4xl space-y-3 p-6" aria-busy="true">
        <div className="h-10 animate-pulse rounded-md bg-muted" />
        <div className="h-96 animate-pulse rounded-md bg-muted" />
      </div>
    );
  if (error || !data)
    return (
      <div className="mx-auto max-w-xl p-10 text-center text-sm text-muted-foreground">
        {(error as Error)?.message || "Proposta não encontrada."}
      </div>
    );

  const p = data.proposal;
  const expired = !!p.expires_at && new Date(p.expires_at) < new Date();
  return (
    <div className="min-h-screen bg-muted/30 py-8 print:bg-transparent">
      <div className="mx-auto max-w-4xl space-y-4 px-4">
        <div className="flex items-center justify-end gap-2 print:hidden">
          <Badge variant="outline">{PROPOSAL_STATUS_LABEL[p.status] ?? p.status}</Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.location.assign(`/api/public/proposals/${token}/pdf`)}
          >
            <Download className="mr-1 h-4 w-4" /> Baixar PDF
          </Button>
        </div>
        <ProposalDocument doc={data} />
        {p.status === "sent" && !expired && (
          <div className="flex justify-end gap-2 print:hidden">
            <Button
              variant="outline"
              onClick={() => respondMut.mutate("decline")}
              disabled={respondMut.isPending}
            >
              <X className="mr-1 h-4 w-4" /> Recusar
            </Button>
            <Button onClick={() => respondMut.mutate("accept")} disabled={respondMut.isPending}>
              <Check className="mr-1 h-4 w-4" /> Aceitar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
