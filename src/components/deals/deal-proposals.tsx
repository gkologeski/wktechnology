// Quadro "Propostas" do negócio: cabeçalho com "+ Adicionar", cartões com menu
// de ações e assistente passo a passo para criar/editar.
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/crm";
import { deleteRowGuarded } from "@/lib/delete-guard";
import { requestProposalApproval, sendProposal } from "@/lib/proposals.functions";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { ProposalWizard, type ProposalSource } from "@/components/proposals/proposal-wizard";
import { ContractWizard, type ContractWizardSource } from "@/components/contracts/contract-wizard";
import { DealDocumentCard, DealDocsHeader, type DocAction } from "./deal-document-card";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovada",
  sent: "Enviada",
  accepted: "Aceita",
  rejected: "Recusada",
  expired: "Expirada",
  canceled: "Cancelada",
};

export function DealProposals({ dealId, companyId }: { dealId: string; companyId?: string | null }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const reqApproval = useServerFn(requestProposalApproval);
  const send = useServerFn(sendProposal);
  const [wizard, setWizard] = useState<ProposalSource | null>(null);
  const [contractWizard, setContractWizard] = useState<ContractWizardSource | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["deal-proposals", dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("id, title, status, total_amount, currency, version, locked")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = data ?? [];
  const refresh = () => void qc.invalidateQueries({ queryKey: ["deal-proposals", dealId] });

  async function run(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn();
      toast.success(ok);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove(id: string) {
    const yes = await confirmDialog({
      title: "Excluir proposta?",
      description: "Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!yes) return;
    const r = await deleteRowGuarded("proposals", id);
    if (!r.ok) return toast.error(r.message);
    toast.success("Proposta excluída.");
    refresh();
  }

  function actionsFor(p: (typeof rows)[number]): DocAction[] {
    const a: DocAction[] = [
      { kind: "item", label: "Abrir", onSelect: () => void navigate({ to: "/proposals/$id", params: { id: p.id } }) },
    ];
    if (!p.locked) a.push({ kind: "item", label: "Editar", onSelect: () => setWizard({ proposalId: p.id }) });
    if (p.status === "draft" && !p.locked)
      a.push({
        kind: "item",
        label: "Enviar para aprovação",
        onSelect: () => void run(() => reqApproval({ data: { proposalId: p.id } } as never), "Aprovação solicitada."),
      });
    if (p.status === "draft" || p.status === "approved")
      a.push({
        kind: "item",
        label: "Enviar ao cliente",
        onSelect: () => void run(() => send({ data: { id: p.id } }), "Proposta enviada."),
      });
    a.push({
      kind: "item",
      label: "Gerar contrato",
      onSelect: () => setContractWizard({ proposalId: p.id, dealId, companyId }),
    });
    a.push({ kind: "separator" });
    a.push({ kind: "item", label: "Excluir", destructive: true, onSelect: () => void remove(p.id) });
    return a;
  }

  return (
    <div className="space-y-3">
      <DealDocsHeader
        count={rows.length}
        singular="proposta"
        plural="propostas"
        onAdd={() => setWizard({ dealId })}
      />
      {isLoading ? (
        <div className="h-16 animate-pulse rounded-md bg-muted" aria-busy="true" />
      ) : error ? (
        <div className="text-sm">
          <p className="text-destructive">Não foi possível carregar as propostas.</p>
          <button type="button" className="text-xs text-primary hover:underline" onClick={() => void refetch()}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <DealDocumentCard
              key={p.id}
              title={p.title || "Proposta"}
              onOpen={() => void navigate({ to: "/proposals/$id", params: { id: p.id } })}
              status={
                <span>
                  {STATUS_LABEL[p.status] ?? p.status}
                  {p.locked ? " · Travada" : ""}
                </span>
              }
              meta={
                <>
                  v{p.version}
                  {p.total_amount != null && ` · ${formatCurrency(Number(p.total_amount), p.currency)}`}
                </>
              }
              actions={actionsFor(p)}
            />
          ))}
        </div>
      )}
      <ProposalWizard source={wizard} onOpenChange={(o) => !o && setWizard(null)} onDone={refresh} />
      <ContractWizard source={contractWizard} onOpenChange={(o) => !o && setContractWizard(null)} />
    </div>
  );
}
