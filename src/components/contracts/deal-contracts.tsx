// Quadro "Contratos" do negócio: cabeçalho com "+ Adicionar", cartões com menu
// de ações e assistente passo a passo para criar.
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { listContracts, deleteContract } from "@/lib/contracts.functions";
import { formatCurrency } from "@/lib/crm";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { DealDocumentCard, DealDocsHeader, type DocAction } from "@/components/deals/deal-document-card";
import { ContractWizard, type ContractWizardSource } from "./contract-wizard";

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  in_negotiation: "Em negociação",
  awaiting_signature: "Aguard. assinatura",
  active: "Ativo",
  renewing: "Renovando",
  ended: "Encerrado",
  terminated: "Rescindido",
};

export function DealContracts({ dealId, companyId }: { dealId: string; companyId?: string | null }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useServerFn(listContracts);
  const del = useServerFn(deleteContract);
  const [wizard, setWizard] = useState<ContractWizardSource | null>(null);

  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["deal-contracts", dealId],
    queryFn: () => list({ data: { dealId } }),
  });

  const open = (id: string) => void navigate({ to: "/contracts/$id", params: { id } });

  async function remove(id: string) {
    const yes = await confirmDialog({
      title: "Excluir contrato?",
      description: "Esta ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      variant: "destructive",
    });
    if (!yes) return;
    try {
      await del({ data: { id } });
      toast.success("Contrato excluído.");
      void qc.invalidateQueries({ queryKey: ["deal-contracts", dealId] });
      void qc.invalidateQueries({ queryKey: ["contracts"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function actionsFor(c: (typeof rows)[number]): DocAction[] {
    const a: DocAction[] = [
      { kind: "item", label: "Abrir", onSelect: () => open(c.id) },
      {
        kind: "item",
        label: "Ver fluxo do contrato",
        onSelect: () => void navigate({ to: "/contracts/$id/flow", params: { id: c.id } }),
      },
      { kind: "item", label: "Editar", onSelect: () => open(c.id) },
      {
        kind: "item",
        label: "Adicionar aditivo",
        onSelect: () => setWizard({ dealId, companyId, mainContractId: c.id }),
      },
    ];
    if (c.status === "draft" || c.status === "in_review" || c.status === "in_negotiation")
      a.push({ kind: "item", label: "Enviar para assinatura", onSelect: () => open(c.id) });
    a.push({ kind: "separator" });
    a.push({ kind: "item", label: "Excluir", destructive: true, onSelect: () => void remove(c.id) });
    return a;
  }

  return (
    <div className="space-y-3">
      <DealDocsHeader
        count={rows.length}
        singular="contrato"
        plural="contratos"
        onAdd={() => setWizard({ dealId, companyId })}
      />
      {isLoading ? (
        <div className="h-16 animate-pulse rounded-md bg-muted" aria-busy="true" />
      ) : isError ? (
        <div className="text-sm">
          <p className="text-destructive">Não foi possível carregar os contratos.</p>
          <button type="button" className="text-xs text-primary hover:underline" onClick={() => void refetch()}>
            Tentar novamente
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <DealDocumentCard
              key={c.id}
              title={c.title}
              onOpen={() => open(c.id)}
              status={<span>{STATUS_LABEL[c.status] ?? c.status}</span>}
              meta={
                <>
                  {c.number} · {formatCurrency(Number(c.total_value), c.currency)}
                </>
              }
              actions={actionsFor(c)}
            />
          ))}
        </div>
      )}
      <ContractWizard source={wizard} onOpenChange={(o) => !o && setWizard(null)} />
    </div>
  );
}
