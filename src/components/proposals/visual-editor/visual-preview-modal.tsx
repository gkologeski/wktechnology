import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listProposalsForPreview,
  loadProposalPreviewContext,
} from "@/lib/proposals/proposal-assets.functions";
import { usePermissions } from "@/lib/access-control/use-permissions";
import type { VisualDesign } from "@/lib/proposals/visual-design";
import {
  renderVisualDesignPagesHtml,
  renderVisualDesignPrintDocument,
  type VisualRenderContext,
} from "@/lib/proposals/visual-renderer";

type VisualPreviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  design: VisualDesign;
  signedUrls: Record<string, string>;
};

const DEMO_CONTEXT: VisualRenderContext = {
  proposalTitle: "Proposta Comercial — Projeto de Evolução Digital",
  companyName: "Nexxus Engenharia & Inovação",
  companyLegalName: "Nexxus Engenharia e Sistemas Ltda",
  companyCnpj: "12.345.678/0001-90",
  contactName: "Mariana Costa",
  contactEmail: "mariana.costa@nexxus.com.br",
  dealName: "Evolução Portal e Automação Comercial",
  total: "R$ 48.500,00",
  validUntil: "15/12/2026",
  validityDays: 15,
  date: "25/11/2026",
  contractingName: "WK Technology",
  contractingCnpj: "19.133.530/0001-36",
  agentName: "Guilherme Kologeski",
  paymentMethod: "PIX / Boleto",
  installmentsCount: 3,
  installmentValue: "R$ 16.166,67",
  installmentsSummary: "3x de R$ 16.166,67 (entrada + 2 parcelas mensais)",
  paymentTermsSummary: "Entrada de 40% na assinatura e saldo em 2 parcelas mensais",
  items: [
    { id: "1", name: "Descoberta técnica e arquitetura", billing: "R$ 8.500,00 (único)" },
    { id: "2", name: "Squad dedicado de desenvolvimento (160 h)", billing: "R$ 32.000,00" },
    { id: "3", name: "Homologação, deploy e treinamento", billing: "R$ 8.000,00 (único)" },
  ],
};

export function VisualPreviewModal({
  open,
  onOpenChange,
  design,
  signedUrls,
}: VisualPreviewModalProps) {
  const { can } = usePermissions();
  const canLoadReal = ["own", "team", "workspace"].some(
    (s) => can(`techsales.proposal_templates.view.${s}`) || can(`techsales.proposals.view.${s}`),
  );
  const [selectedProposalId, setSelectedProposalId] = useState<string>("__demo__");
  const listFn = useServerFn(listProposalsForPreview);
  const ctxFn = useServerFn(loadProposalPreviewContext);

  const proposalsQ = useQuery({
    queryKey: ["proposal-visual-preview-list"],
    enabled: open && canLoadReal,
    queryFn: () => listFn(),
  });

  const realCtxQ = useQuery({
    queryKey: ["proposal-visual-preview-ctx", selectedProposalId],
    enabled: open && canLoadReal && selectedProposalId !== "__demo__",
    queryFn: () => ctxFn({ data: { proposalId: selectedProposalId } }),
  });

  const mergedContext: VisualRenderContext = useMemo(() => {
    const base = selectedProposalId !== "__demo__" && realCtxQ.data ? realCtxQ.data : DEMO_CONTEXT;
    return {
      ...base,
      contractingName: base.contractingName || design.brandKit.legalEntityName || "WK Technology",
      contractingLogoUrl: base.contractingLogoUrl || design.brandKit.logoUrl || null,
      signedUrls: { ...signedUrls, ...(base.signedUrls ?? {}) },
    };
  }, [
    design.brandKit.legalEntityName,
    design.brandKit.logoUrl,
    realCtxQ.data,
    selectedProposalId,
    signedUrls,
  ]);

  const renderedHtml = useMemo(
    () => renderVisualDesignPagesHtml(design, mergedContext),
    [design, mergedContext],
  );

  function handlePrint() {
    const html = renderVisualDesignPrintDocument(design, mergedContext);
    const win = window.open("", "_blank", "noopener,noreferrer");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-w-5xl flex-col gap-3 p-4">
        <DialogHeader className="shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-8">
            <div>
              <DialogTitle>Pré-visualização do modelo visual</DialogTitle>
              <DialogDescription>
                Renderização idêntica à ficha da proposta, link público e PDF.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={selectedProposalId} onValueChange={setSelectedProposalId}>
                <SelectTrigger className="h-8 w-64 text-xs" aria-label="Escolher proposta real">
                  <SelectValue placeholder="Dados de exemplo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__demo__">Dados de exemplo (Nexxus)</SelectItem>
                  {(proposalsQ.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                      {p.company_name ? ` — ${p.company_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={handlePrint}
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir / PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto rounded-md border border-border bg-muted/60 p-4">
          {realCtxQ.isLoading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando dados da proposta...
            </div>
          ) : (
            <div
              className="mx-auto w-fit origin-top"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
