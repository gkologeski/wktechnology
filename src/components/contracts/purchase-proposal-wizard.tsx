import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Eye, FileText, Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useWorkCapabilities } from "@/lib/access-control/use-work-capabilities";
import { readViewAs } from "@/lib/view-as-client";
import {
  createEmptyPurchaseProposalData,
  purchaseProposalDataSchema,
  PURCHASE_PROPOSAL_KEYS,
  type PurchaseProposalContext,
  type PurchaseProposalData,
  type PurchaseProposalDocument,
} from "@/lib/contracts/purchase-proposal.types";
import {
  getPurchaseProposalContext,
  savePurchaseProposalDraft,
  generatePurchaseProposalAttachment,
  previewPurchaseProposal,
} from "@/lib/contracts/purchase-proposal.functions";
import { previewContractSignaturePackage } from "@/lib/contracts/attachments.functions";
import { purchaseProposalAmounts } from "@/lib/contracts/purchase-proposal-amounts";
import { PurchaseProposalFields, PurchaseProposalSummary } from "./purchase-proposal-fields";

const steps = ["Modelo", "Escopo e marcos", "Conferência", "Anexo e assinatura"];

export function PurchaseProposalWizard({
  contractId,
  open,
  onOpenChange,
  onGenerated,
}: {
  contractId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated?: () => void | Promise<void>;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const permissions = usePermissions();
  const parent = useWorkCapabilities("techcontracts.contracts", [contractId]).for(contractId);
  const get = useServerFn(getPurchaseProposalContext);
  const scope = [...(permissions.permissions ?? [])].sort().join("|");
  const queryKey = [
    "purchase-proposal-context",
    user?.id,
    permissions.workspaceId,
    contractId,
    scope,
  ];
  const allowed =
    !permissions.isLoading &&
    !permissions.isError &&
    !!permissions.workspaceId &&
    parent.can_view &&
    permissions.can(PURCHASE_PROPOSAL_KEYS.view);
  const context = useQuery({
    queryKey,
    queryFn: () => get({ data: { contractId } }),
    enabled: open && allowed,
    retry: false,
    staleTime: 0,
  });

  if (!open) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      {!allowed ? (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Proposta técnica de compra</DialogTitle>
            <DialogDescription>
              Seu acesso atual não permite consultar os documentos e valores desta compra.
            </DialogDescription>
          </DialogHeader>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogContent>
      ) : context.isPending ? (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Proposta técnica de compra</DialogTitle>
            <DialogDescription>
              Consultando o contrato e seus modelos disponíveis.
            </DialogDescription>
          </DialogHeader>
          <p role="status" className="text-sm text-muted-foreground">
            Carregando…
          </p>
        </DialogContent>
      ) : context.error || !context.data ? (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Proposta técnica de compra</DialogTitle>
            <DialogDescription>Não foi possível carregar esta compra.</DialogDescription>
          </DialogHeader>
          <p role="alert" className="text-sm text-destructive">
            {context.error instanceof Error ? context.error.message : "Tente novamente."}
          </p>
          <Button variant="outline" onClick={() => void context.refetch()}>
            Tentar novamente
          </Button>
        </DialogContent>
      ) : !context.data.canView ||
        !context.data.isPurchase ||
        !context.data.contract ||
        !context.data.parties ? (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Proposta técnica de compra</DialogTitle>
            <DialogDescription>
              {context.data.blockedReason ??
                "Este documento está disponível somente para contratos de compra autorizados."}
            </DialogDescription>
          </DialogHeader>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogContent>
      ) : (
        <PurchaseProposalEditor
          key={JSON.stringify(queryKey)}
          context={context.data}
          contractId={contractId}
          queryKey={queryKey}
          allowManage={parent.can_update && permissions.can(PURCHASE_PROPOSAL_KEYS.manage)}
          allowSignaturePreview={permissions.can(
            "techcontracts.signature_evidence.manage.workspace",
          )}
          onClose={() => onOpenChange(false)}
          onGenerated={onGenerated}
          busy={busy}
          onBusyChange={setBusy}
        />
      )}
    </Dialog>
  );
}

function PurchaseProposalEditor({
  context,
  contractId,
  queryKey,
  allowManage,
  allowSignaturePreview,
  onClose,
  onGenerated,
  busy,
  onBusyChange,
}: {
  context: PurchaseProposalContext;
  contractId: string;
  queryKey: readonly unknown[];
  allowManage: boolean;
  allowSignaturePreview: boolean;
  onClose: () => void;
  onGenerated?: () => void | Promise<void>;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const get = useServerFn(getPurchaseProposalContext);
  const save = useServerFn(savePurchaseProposalDraft);
  const generate = useServerFn(generatePurchaseProposalAttachment);
  const preview = useServerFn(previewPurchaseProposal);
  const signaturePreview = useServerFn(previewContractSignaturePackage);
  const qc = useQueryClient();
  const latest = [...context.documents].sort((a, b) => b.version - a.version)[0];
  const [data, setData] = useState<PurchaseProposalData>(
    () => latest?.data ?? createEmptyPurchaseProposalData(),
  );
  const [templateId, setTemplateId] = useState(
    latest?.templateId ?? context.templates[0]?.id ?? "",
  );
  const [document, setDocument] = useState<PurchaseProposalDocument | null>(latest ?? null);
  const [expectedVersion, setExpectedVersion] = useState(latest?.version ?? 0);
  const [draftContractHash, setDraftContractHash] = useState(context.contractHash);
  const [step, setStep] = useState(latest?.status === "generated" && latest.attachmentId ? 3 : 0);
  const [dirty, setDirty] = useState(!latest);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewedDocumentId, setPreviewedDocumentId] = useState<string | null>(null);
  const [previewLabel, setPreviewLabel] = useState("Prévia da proposta técnica de compra");
  const [generatedAwaitingRefresh, setGeneratedAwaitingRefresh] = useState(false);
  const viewAs = readViewAs();
  const canManage =
    allowManage && context.canManage && !viewAs?.readOnly && viewAs?.mode !== "role";
  const contractChanged = context.contractHash !== draftContractHash;
  const canGenerate = canManage && context.canGenerate && !!draftContractHash && !contractChanged;
  const currency = context.contract!.currency;
  const selectedTemplate = context.templates.find((template) => template.id === templateId);
  const parties = document && !dirty ? document.parties : context.parties!;
  const attached = document?.status === "generated" && !!document.attachmentId && !dirty;
  const removedAttachment = document?.status === "generated" && !document.attachmentId && !dirty;
  const remember = (saved: PurchaseProposalDocument) => {
    setDocument(saved);
    setExpectedVersion(saved.version);
    qc.setQueryData<PurchaseProposalContext>(
      queryKey,
      (current) =>
        current && {
          ...current,
          documents: [saved, ...current.documents.filter((row) => row.id !== saved.id)],
        },
    );
  };
  const run = async (action: () => Promise<void>) => {
    onBusyChange(true);
    setError("");
    try {
      await action();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Não foi possível concluir a operação.";
      setError(message);
      toast.error(message);
    } finally {
      onBusyChange(false);
    }
  };
  const changeData = (next: PurchaseProposalData) => {
    setData(next);
    setDirty(true);
    setConfirmed(false);
    setPreviewUrl(null);
    setPreviewedDocumentId(null);
  };
  const saveForReview = () =>
    run(async () => {
      const parsed = purchaseProposalDataSchema.safeParse(data);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        if (issue.path[0] === "milestones")
          throw new Error(
            "Confira os marcos: preencha entregas, critérios, horas e prazos. A soma das horas deve ser igual ao esforço acordado.",
          );
        throw new Error(
          "Preencha o título, o escopo, o aceite, as condições, as horas, o valor-hora e o prazo desta compra.",
        );
      }
      if (!selectedTemplate || !draftContractHash || contractChanged)
        throw new Error("Selecione um modelo disponível e atualize o contrato antes de continuar.");
      const ownTotal = purchaseProposalAmounts(parsed.data).total;
      if (
        context.contract!.totalValue > 0 &&
        Math.abs(ownTotal - context.contract!.totalValue) > 0.009
      )
        throw new Error(
          "O preço fechado da proposta difere do valor do contrato de compra. Confira e ajuste o contrato ou as condições acordadas antes de salvar; o valor não será alterado automaticamente.",
        );
      if (dirty || !document) {
        const saved = await save({
          data: {
            contractId,
            templateId,
            expectedVersion,
            expectedContractHash: draftContractHash,
            data: parsed.data,
          },
        });
        remember(saved);
        setDirty(false);
        setPreviewUrl(null);
        setConfirmed(false);
        setPreviewedDocumentId(null);
      }
      setStep(2);
    });
  const openPreview = (id: string) =>
    run(async () => {
      const result = await preview({ data: { contractId, documentId: id } });
      setPreviewUrl(result.url);
      setPreviewLabel(result.name);
      if (id === document?.id) setPreviewedDocumentId(id);
    });

  return (
    <DialogContent
      className="max-w-6xl"
      onInteractOutside={(event) => {
        if (busy) event.preventDefault();
      }}
      onEscapeKeyDown={(event) => {
        if (busy) event.preventDefault();
      }}
    >
      <DialogHeader>
        <DialogTitle>Proposta técnica de compra</DialogTitle>
        <DialogDescription>
          Fábrica de Software · do modelo ao anexo, com as condições deste fornecimento.
        </DialogDescription>
      </DialogHeader>
      <nav
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        aria-label="Etapas da proposta de compra"
      >
        {steps.map((label, index) => (
          <Button
            key={label}
            variant={step === index ? "secondary" : "ghost"}
            size="sm"
            className="justify-start"
            aria-current={step === index ? "step" : undefined}
            disabled={busy || (index === 2 && (dirty || !document)) || (index === 3 && !attached)}
            onClick={() => {
              setError("");
              setPreviewUrl(null);
              setStep(index);
            }}
          >
            <span className="mr-2 text-xs text-muted-foreground">{index + 1}</span>
            {label}
          </Button>
        ))}
      </nav>
      {context.blockedReason && (
        <p role="status" className="text-sm text-muted-foreground">
          {context.blockedReason}
        </p>
      )}
      {contractChanged && (
        <p role="alert" className="rounded-lg bg-muted/30 p-3 text-sm">
          O contrato ou seus anexos foram alterados durante a edição. Preserve seu rascunho e reabra
          este assistente para conferir a versão atual antes de salvar ou gerar.
        </p>
      )}
      {context.contract!.totalValue === 0 && (
        <p role="status" className="text-sm text-muted-foreground">
          Este contrato está sem valor cadastrado. Preencher a proposta técnica não altera
          automaticamente o valor do contrato.
        </p>
      )}
      {!canManage && (
        <p role="status" className="text-sm text-muted-foreground">
          Consulta disponível. Alterar e gerar documentos exige autorização de gestão desta compra.
        </p>
      )}
      {removedAttachment && (
        <div role="status" className="space-y-2 rounded-lg bg-muted/30 p-3 text-sm">
          <p>O anexo desta versão foi removido do contrato. O documento permanece no histórico.</p>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                setDirty(true);
                setConfirmed(false);
                setPreviewedDocumentId(null);
                setPreviewUrl(null);
                setStep(1);
              }}
            >
              Iniciar nova revisão
            </Button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
        <main className="min-w-0 space-y-5">
          {step === 0 && (
            <>
              <div>
                <h3 className="text-lg font-semibold">Escolha o modelo da compra</h3>
                <p className="text-sm text-muted-foreground">
                  Documento próprio para contratar a empresa prestadora.
                </p>
              </div>
              <div
                className="space-y-3"
                role="group"
                aria-label="Modelos de proposta técnica de compra"
              >
                {context.templates.map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    aria-pressed={templateId === template.id}
                    disabled={busy || !canManage}
                    className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-colors hover:bg-muted/30 disabled:cursor-default ${templateId === template.id ? "border-primary bg-primary/5" : "border-border/60"}`}
                    onClick={() => {
                      if (templateId !== template.id) {
                        setTemplateId(template.id);
                        setDirty(true);
                        setConfirmed(false);
                        setPreviewUrl(null);
                      }
                    }}
                  >
                    <FileText className="h-10 w-10 shrink-0 text-primary" aria-hidden />
                    <span className="flex-1 space-y-1">
                      <span className="block font-medium">{template.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        Modelo visual · revisão {template.revision} · WK contratante
                      </span>
                    </span>
                    {templateId === template.id && (
                      <Check className="h-5 w-5 text-primary" aria-hidden />
                    )}
                  </button>
                ))}
                {!context.templates.length && (
                  <p role="status" className="text-sm text-muted-foreground">
                    Nenhum modelo de compra disponível. Solicite ao administrador a disponibilização
                    do modelo de Fábrica de Software.
                  </p>
                )}
              </div>
              <section className="space-y-3 pt-3">
                <h4 className="font-medium">Partes deste fornecimento</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Contratante</p>
                    <p className="font-medium">{parties.wk.name}</p>
                    <p className="text-xs text-muted-foreground">{parties.wk.cnpj}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Contratada / prestadora</p>
                    <p className="font-medium">{parties.supplier.name}</p>
                    <p className="text-xs text-muted-foreground">{parties.supplier.cnpj}</p>
                  </div>
                </div>
              </section>
            </>
          )}
          {step === 1 && (
            <>
              <div>
                <h3 className="text-lg font-semibold">Defina o que será contratado</h3>
                <p className="text-sm text-muted-foreground">
                  Escopo, horas e prazo são próprios deste fornecimento.
                </p>
              </div>
              <PurchaseProposalFields
                value={data}
                onChange={changeData}
                currency={currency}
                disabled={busy || !canManage}
              />
            </>
          )}
          {step === 2 && document && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Confira o documento para a prestadora</h3>
                  <p className="text-sm text-muted-foreground">
                    Versão {document.version} · {parties.supplier.name}
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void openPreview(document.id)}
                >
                  <Eye className="mr-2 h-4 w-4" aria-hidden />
                  Abrir prévia da proposta
                </Button>
              </div>
              <div className="space-y-4 rounded-xl bg-muted/30 p-5">
                <h4 className="font-semibold">{data.title}</h4>
                <p className="whitespace-pre-wrap text-sm">{data.scope}</p>
                <PurchaseProposalSummary data={data} currency={currency} />
                <ol className="space-y-3 text-sm">
                  {data.milestones.map((milestone, index) => (
                    <li key={milestone.id}>
                      <strong>
                        M{index + 1} · {milestone.title}
                      </strong>
                      <p className="whitespace-pre-wrap text-muted-foreground">
                        {milestone.description}
                      </p>
                      <p>
                        {milestone.hours} h · até {milestone.businessDays} dias úteis
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
              {canGenerate && (
                <div className="flex items-start gap-3 rounded-lg bg-muted/30 p-4">
                  <Checkbox
                    id="purchase-reviewed"
                    checked={confirmed}
                    disabled={busy || previewedDocumentId !== document.id}
                    onCheckedChange={(checked) => setConfirmed(checked === true)}
                  />
                  <Label htmlFor="purchase-reviewed" className="text-sm leading-relaxed">
                    Conferi a prévia, as partes e as condições desta compra. Esta versão poderá
                    acompanhar o contrato destinado à prestadora.
                  </Label>
                </div>
              )}
            </>
          )}
          {step === 3 && document && attached && (
            <>
              <div className="flex items-start gap-3">
                <Check className="mt-1 h-6 w-6 text-primary" aria-hidden />
                <div>
                  <h3 className="text-lg font-semibold">Proposta técnica no contrato</h3>
                  <p className="text-sm text-muted-foreground">
                    O documento foi gerado e incluído como anexo desta compra.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/30 p-4">
                <div>
                  <p className="font-medium">{document.data.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Versão {document.version} · documento preservado
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={busy}
                  onClick={() => void openPreview(document.id)}
                >
                  <Eye className="mr-2 h-4 w-4" aria-hidden />
                  Conferir anexo gerado
                </Button>
              </div>
              <section className="space-y-3">
                <h4 className="font-medium">Próximo passo: assinatura</h4>
                <p className="text-sm text-muted-foreground">
                  Na ficha do contrato, confira os signatários e use a assinatura nativa ou a
                  ForSign. Ambas incluem a versão dos anexos conferida no pacote. A revisão jurídica
                  e as aprovações existentes continuam exigidas.
                </p>
                <p className="text-sm text-muted-foreground">
                  Gerar uma versão nova preserva os anexos anteriores. Antes do envio, confira a
                  lista no contrato e remova os vínculos de versões substituídas que não devem
                  integrar o pacote. Cópias já congeladas e o histórico continuam preservados.
                </p>
                {allowSignaturePreview && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        const result = await signaturePreview({ data: { contractId } });
                        setPreviewUrl(result.url);
                        setPreviewLabel("Pacote do contrato para assinatura");
                      })
                    }
                  >
                    <Eye className="mr-2 h-4 w-4" aria-hidden />
                    Conferir pacote para assinatura
                  </Button>
                )}
              </section>
              <p className="text-xs text-muted-foreground">
                Criar ou anexar este documento não envia convites nem registra aceite, assinatura ou
                movimentação financeira.
              </p>
            </>
          )}
          {generatedAwaitingRefresh && (
            <p role="status" className="rounded-lg bg-muted/30 p-4 text-sm">
              O anexo foi gerado. Feche esta janela e reabra a proposta técnica para conferir a
              versão atualizada.
            </p>
          )}
          {previewUrl && (
            <section className="space-y-2" aria-label="Documento em conferência">
              <p className="text-sm font-medium">{previewLabel}</p>
              <iframe
                className="h-[65vh] w-full rounded-lg border"
                title={previewLabel}
                src={previewUrl}
              />
            </section>
          )}
          {context.documents.length > 0 && (
            <details className="pt-2">
              <summary className="cursor-pointer text-sm font-medium">Histórico de versões</summary>
              <ul className="mt-3 space-y-2">
                {[...context.documents]
                  .sort((a, b) => b.version - a.version)
                  .map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span>
                        Versão {row.version} ·{" "}
                        {row.status === "generated"
                          ? row.attachmentId
                            ? "Anexo gerado"
                            : "Anexo removido · histórico preservado"
                          : "Em preparação"}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => void openPreview(row.id)}
                      >
                        Conferir versão {row.version}
                      </Button>
                    </li>
                  ))}
              </ul>
            </details>
          )}
        </main>
        <aside
          className="space-y-5 rounded-xl bg-muted/20 p-4 lg:self-start"
          aria-label="Resumo desta compra"
        >
          <div>
            <Badge variant="outline">WK contratante</Badge>
            <h4 className="mt-3 font-semibold">Fábrica de Software</h4>
            <p className="mt-1 text-sm text-muted-foreground">{parties.supplier.name}</p>
          </div>
          <PurchaseProposalSummary data={data} currency={currency} compact />
          <p className="text-xs leading-relaxed text-muted-foreground">
            O material da prestadora reúne somente as condições acordadas neste fornecimento.
            Alterações geram uma nova versão; os documentos anteriores permanecem preservados.
          </p>
        </aside>
      </div>
      <DialogFooter className="flex-wrap gap-2">
        <Button variant="ghost" disabled={busy} onClick={onClose}>
          {step === 3 ? "Voltar ao contrato" : "Fechar"}
        </Button>
        {step > 0 && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setError("");
              setPreviewUrl(null);
              setStep(step - 1);
            }}
          >
            Voltar
          </Button>
        )}
        {step === 0 && (
          <Button disabled={busy || !selectedTemplate} onClick={() => setStep(1)}>
            Usar este modelo
          </Button>
        )}
        {step === 1 && canManage && (
          <Button
            disabled={busy || !selectedTemplate || !draftContractHash || contractChanged}
            onClick={() => void saveForReview()}
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}Salvar e conferir
          </Button>
        )}
        {step === 2 &&
          canGenerate &&
          document?.status !== "generated" &&
          !generatedAwaitingRefresh && (
            <Button
              disabled={busy || !confirmed || !document}
              onClick={() =>
                void run(async () => {
                  const result = await generate({
                    data: {
                      contractId,
                      documentId: document!.id,
                      expectedVersion: document!.version,
                      expectedContractHash: draftContractHash!,
                    },
                  });
                  setGeneratedAwaitingRefresh(true);
                  setPreviewUrl(null);
                  await onGenerated?.();
                  const fresh = await get({ data: { contractId } });
                  if (fresh.canView && fresh.contractHash) setDraftContractHash(fresh.contractHash);
                  qc.setQueryData(queryKey, fresh);
                  const generated =
                    fresh.canView &&
                    fresh.documents.find(
                      (row) => row.id === result.documentId && row.status === "generated",
                    );
                  if (generated) {
                    remember(generated);
                    setGeneratedAwaitingRefresh(false);
                    setStep(3);
                  }
                  toast.success("Proposta técnica gerada e anexada ao contrato.");
                })
              }
            >
              <Paperclip className="mr-2 h-4 w-4" aria-hidden />
              {busy ? "Gerando…" : "Gerar documento e anexar"}
            </Button>
          )}
        {step === 2 && attached && (
          <Button disabled={busy} onClick={() => setStep(3)}>
            Ver anexo e assinatura
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
