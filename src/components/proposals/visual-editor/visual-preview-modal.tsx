import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, Info, Loader2, Printer, RotateCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  designUsesClientLogo,
  mergeVisualPreviewContext,
  renderVisualDesignPagesHtml,
  renderVisualDesignPrintDocument,
  type VisualRenderContext,
} from "@/lib/proposals/visual-renderer";

type VisualPreviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  design: VisualDesign;
  signedUrls: Record<string, string>;
  workspaceLogoUrl?: string | null;
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
  workspaceLogoUrl = null,
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
    retry: false,
  });

  const isRealSelected = selectedProposalId !== "__demo__";
  const hasRealError = isRealSelected && realCtxQ.isError;
  const isRealLoading = isRealSelected && realCtxQ.isLoading;
  const usesClientLogo = useMemo(() => designUsesClientLogo(design), [design]);
  const missingClientLogo =
    isRealSelected && Boolean(realCtxQ.data) && usesClientLogo && !realCtxQ.data?.clientLogoUrl;

  const mergedContext: VisualRenderContext = useMemo(() => {
    const base = isRealSelected && realCtxQ.data ? realCtxQ.data : DEMO_CONTEXT;
    return mergeVisualPreviewContext(base, design, signedUrls, workspaceLogoUrl);
  }, [design, isRealSelected, realCtxQ.data, signedUrls, workspaceLogoUrl]);

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
                disabled={isRealLoading || hasRealError}
                onClick={handlePrint}
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir / PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        {proposalsQ.isError && (
          <Alert variant="destructive" className="shrink-0 py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Não foi possível carregar a lista de propostas reais do workspace. Você ainda pode
              pré-visualizar com os dados de exemplo.
            </AlertDescription>
          </Alert>
        )}

        {missingClientLogo && (
          <Alert className="shrink-0 py-2">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              A empresa cliente ({realCtxQ.data?.companyName || "desta proposta"}) não possui
              logotipo nem domínio/site cadastrado em Empresas; o espaço de logotipo do cliente
              permanece em branco.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex-1 overflow-auto rounded-md border border-border bg-muted/60 p-4">
          {isRealLoading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando dados da proposta...
            </div>
          ) : hasRealError ? (
            <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center gap-4 text-center">
              <Alert variant="destructive" className="text-left">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Não foi possível carregar os dados desta proposta</AlertTitle>
                <AlertDescription className="mt-1 text-xs">
                  {realCtxQ.error instanceof Error
                    ? realCtxQ.error.message
                    : "Ocorreu um erro ao buscar os dados reais da proposta selecionada."}
                </AlertDescription>
              </Alert>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => void realCtxQ.refetch()}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Tentar novamente
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setSelectedProposalId("__demo__")}
                >
                  Ver dados de exemplo
                </Button>
              </div>
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
