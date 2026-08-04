import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, FileStack, Plus, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listContracts, createContractFromDeal } from "@/lib/contracts.functions";
import { formatCurrency } from "@/lib/crm";
import { QuickCreateContractDialog } from "@/components/contracts/quick-create-contract-dialog";
import { ApplyContractTemplateDialog } from "@/components/contracts/apply-contract-template-dialog";

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

export function DealContracts({
  dealId,
  companyId,
}: {
  dealId: string;
  companyId?: string | null;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listContracts);
  const fromDeal = useServerFn(createContractFromDeal);
  const [openNew, setOpenNew] = useState(false);
  const [openTemplate, setOpenTemplate] = useState(false);
  const [creating, setCreating] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["deal-contracts", dealId],
    queryFn: () => list({ data: { dealId } }),
  });

  async function quickFromDeal() {
    setCreating(true);
    try {
      await fromDeal({ data: { dealId } });
      toast.success("Contrato criado a partir do negócio.");
      qc.invalidateQueries({ queryKey: ["deal-contracts", dealId] });
      qc.invalidateQueries({ queryKey: ["contracts"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {rows.length === 0 ? "Nenhum contrato" : `${rows.length} contrato(s)`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="link"
            className="h-auto p-0"
            onClick={quickFromDeal}
            disabled={creating}
          >
            <FileText className="h-3.5 w-3.5 mr-0.5" /> Gerar do negócio
          </Button>
          <Button
            size="sm"
            variant="link"
            className="h-auto p-0"
            onClick={() => setOpenTemplate(true)}
          >
            <FileStack className="h-3.5 w-3.5 mr-0.5" /> Gerar de modelo
          </Button>
          <Button size="sm" variant="link" className="h-auto p-0" onClick={() => setOpenNew(true)}>
            <Plus className="h-3.5 w-3.5 mr-0.5" /> Adicionar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? null : (
        <div className="space-y-2">
          {rows.map((c) => (
            <Link
              key={c.id}
              to="/contracts/$id"
              params={{ id: c.id }}
              className="block rounded-md border p-3 hover:border-primary/40 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex items-center gap-1 text-primary group-hover:underline">
                  <span className="font-semibold truncate">{c.title}</span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </div>
                <Badge variant="outline" className="shrink-0">
                  {STATUS_LABEL[c.status] ?? c.status}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground tabular-nums">
                {c.number} · {formatCurrency(Number(c.total_value), c.currency)}
              </div>
            </Link>
          ))}
        </div>
      )}

      <ApplyContractTemplateDialog
        open={openTemplate}
        onOpenChange={setOpenTemplate}
        dealId={dealId}
        companyId={companyId ?? null}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["deal-contracts", dealId] });
          qc.invalidateQueries({ queryKey: ["contracts"] });
        }}
      />

      <QuickCreateContractDialog
        open={openNew}
        onOpenChange={setOpenNew}
        initialDealId={dealId}
        initialCompanyId={companyId ?? null}
        onCreated={() => {
          qc.invalidateQueries({ queryKey: ["deal-contracts", dealId] });
          qc.invalidateQueries({ queryKey: ["contracts"] });
        }}
      />
    </div>
  );
}
