import { lazy, Suspense, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, FileText, Loader2, LockKeyhole, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { readViewAs } from "@/lib/view-as-client";
import {
  getDealContractingJourney,
  prepareDealContractDraft,
} from "@/lib/deals/contracting-journey.functions";
import { JOURNEY_STEPS, journeyOrigins, selectJourney } from "@/lib/deals/contracting-journey";
import {
  CONTRACT_DRAFT_STATUS_LABEL,
  type ContractDraftStatus,
} from "@/lib/contracts/contract-draft-status";
import { getContractSignature } from "@/lib/hiring/signature.functions";
import { createContractFromSales } from "@/lib/sales-flow.functions";
import { formatCurrency, formatDateTime, formatDateOnly } from "@/lib/crm";
import { cn } from "@/lib/utils";
import { DealQuotes } from "./deal-quotes";
import { DealProposals } from "./deal-proposals";
import { DealContracts } from "@/components/contracts/deal-contracts";
import { QuoteInternalPreview } from "./quote-internal-preview";
import { ContractWizard, type ContractWizardSource } from "@/components/contracts/contract-wizard";

const QuoteWizard = lazy(() => import("./quote-wizard").then((m) => ({ default: m.QuoteWizard })));
const ProposalWizard = lazy(() =>
  import("@/components/proposals/proposal-wizard").then((m) => ({ default: m.ProposalWizard })),
);
const DraftReview = lazy(() =>
  import("@/components/contracts/contract-draft-review-page").then((m) => ({
    default: m.ContractDraftReviewPage,
  })),
);
const SignatureCard = lazy(() =>
  import("@/components/hiring/contract-signature-card").then((m) => ({
    default: m.ContractSignatureCard,
  })),
);
const ApprovalsPanel = lazy(() =>
  import("@/components/contracts/contract-approvals-panel").then((m) => ({
    default: m.ContractApprovalsPanel,
  })),
);
const ContractServices = lazy(() =>
  import("@/components/services/contract-services").then((m) => ({ default: m.ContractServices })),
);
const DeliveryPanel = lazy(() =>
  import("./deal-delivery-panel").then((m) => ({ default: m.DealDeliveryPanel })),
);
const loading = (
  <p role="status" className="p-4 text-sm text-muted-foreground">
    Carregando…
  </p>
);
const scopeKeys = (r: string, a: string) =>
  ["own", "team", "workspace"].map((s) => `${r}.${a}.${s}`);

function useJourney(dealId: string, origin: string | null) {
  const permissions = usePermissions();
  const get = useServerFn(getDealContractingJourney);
  const q = useQuery({
    queryKey: ["deal-contracting-journey", permissions.workspaceId, dealId],
    queryFn: () => get({ data: { dealId } }),
    enabled: !!permissions.workspaceId && !permissions.isLoading && !permissions.isError,
    refetchOnWindowFocus: true,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  const j = q.data ? selectJourney(q.data, origin) : null;
  const signatureFn = useServerFn(getContractSignature);
  const signature = useQuery({
    queryKey: ["contract-signature", j?.contract?.id, "journey", j?.contract?.updated_at],
    queryFn: () => signatureFn({ data: { contractId: j!.contract!.id } }),
    enabled:
      !!j?.contract &&
      !j.ambiguous &&
      permissions.can("techcontracts.signature_evidence.view.workspace"),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  return { q, j, permissions, signature };
}
const titles = [
  "Apresente os valores ao cliente",
  "Formalize as condições comerciais",
  "Minuta para avaliação das cláusulas",
  "Contrato e assinaturas",
  "Início do serviço",
];
const explanations = [
  "Envie a cotação para o cliente conhecer o escopo e o investimento. Após a concordância, prepare a proposta.",
  "A assinatura da proposta confirma as condições comerciais. O serviço ainda depende do contrato definitivo.",
  "A revisão jurídica acontece antes do envio. O cliente aprova as cláusulas ou solicita ajustes; esse aceite não é a assinatura do contrato.",
  "Após o aceite da minuta, o Financeiro confere a versão final e conduz as assinaturas de cliente e WK.",
  "A execução depende da assinatura verificável da versão atual e das demais aprovações operacionais. O fechamento financeiro é mensal; o faturamento depende das horas aprovadas.",
];
type Props = {
  dealId: string;
  companyId?: string | null;
  origin: string | null;
  onOriginChange: (v: string) => void;
};

export function DealContractingJourney({ dealId, companyId, origin, onOriginChange }: Props) {
  const { q, j, permissions: p, signature } = useJourney(dealId, origin);
  const qc = useQueryClient();
  const prepare = useServerFn(prepareDealContractDraft),
    create = useServerFn(createContractFromSales);
  const [viewed, setViewed] = useState<number | null>(null),
    [tab, setTab] = useState("journey"),
    [sheet, setSheet] = useState<
      "quote" | "draft" | "contract" | "prepare-contract" | "other" | null
    >(null);
  const [quoteOpen, setQuoteOpen] = useState(false),
    [proposalSource, setProposalSource] = useState<
      import("@/components/proposals/proposal-wizard").ProposalSource | null
    >(null),
    [quotePreview, setQuotePreview] = useState<string | null>(null),
    [wizard, setWizard] = useState<ContractWizardSource | null>(null),
    [busy, setBusy] = useState(false);
  const writable =
    !readViewAs()?.readOnly && readViewAs()?.mode !== "role" && !p.isLoading && !p.isError;
  const canCreateContract =
    writable &&
    p.canAny(scopeKeys("techcontracts.contracts", "create")) &&
    p.canAny(scopeKeys("techcontracts.contracts", "view"));
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["deal-contracting-journey"] });
    void qc.invalidateQueries({ queryKey: ["deal-contracts", dealId] });
  };
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir a operação.");
    } finally {
      setBusy(false);
    }
  };
  const ready =
    !!j?.contract &&
    !j.ambiguous &&
    p.can("techcontracts.signature_evidence.view.workspace") &&
    signature.isSuccess &&
    signature.data.reason === null;
  const stage = j ? (ready ? 4 : j.stage) : 0;
  const viewedStage = viewed ?? stage;
  if (p.isError || q.isError)
    return (
      <Card>
        <CardContent className="space-y-3 p-5" role="alert">
          <p>Não foi possível carregar a jornada comercial.</p>
          <Button
            variant="outline"
            onClick={() => {
              p.refetch();
              void q.refetch();
            }}
          >
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  if (!q.data || !j)
    return (
      <Card>
        <CardContent className="p-5" aria-busy="true">
          Carregando jornada comercial…
        </CardContent>
      </Card>
    );
  const d = q.data,
    origins = journeyOrigins(d);
  const restricted = Object.values(d.access).some((a) => !a);
  const changeOrigin = (v: string) => {
    onOriginChange(v);
    setViewed(null);
    setSheet(null);
  };
  const openDraft = () => setSheet("draft");
  const createDraft = () =>
    void run(async () => {
      await prepare({ data: { proposalId: j.proposal!.id } });
      await q.refetch();
      setSheet("draft");
      toast.success("Minuta preparada para revisão jurídica.");
    });
  const finalContract = () =>
    void run(async () => {
      const r = await create({
        data: {
          proposalId: j.proposal!.id,
          ...(j.proposal!.legal_entity_id
            ? { contractingLegalEntityId: j.proposal!.legal_entity_id }
            : {}),
        },
      });
      await q.refetch();
      setSheet("contract");
      toast.success(
        r.reused
          ? "Contrato existente carregado; nada foi duplicado."
          : "Contrato preparado a partir da minuta aceita.",
      );
    });
  const doc = j.contract ?? j.draft ?? j.proposal ?? j.quote;
  const heading =
    stage === 3 && !j.contract
      ? "Tudo pronto para o Financeiro"
      : stage === 2 && j.draft
        ? ({
            pending_legal: "Minuta aguardando revisão jurídica",
            approved: "Minuta pronta para enviar ao cliente",
            sent: "Minuta em avaliação pelo cliente",
            changes_requested: "O cliente solicitou ajustes",
            accepted: "Tudo pronto para o Financeiro",
            rejected: "Minuta recusada pelo Jurídico",
            canceled: "Minuta cancelada",
          }[j.draft.status] ?? titles[stage])
        : titles[stage];
  const currentAction = () => {
    if (stage === 0)
      return (
        <div className="flex flex-wrap gap-2">
          {j.quote ? (
            <Button onClick={() => setSheet("quote")}>Gerenciar cotação e envio</Button>
          ) : writable && p.canAny(scopeKeys("techsales.quotes", "create")) ? (
            <Button onClick={() => setQuoteOpen(true)}>Preparar cotação</Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Solicite ao Comercial a preparação da cotação.
            </p>
          )}
        </div>
      );
    if (stage === 1)
      return (
        <div className="flex flex-wrap gap-2">
          {j.proposal ? (
            <Button asChild>
              <Link to="/proposals/$id" params={{ id: j.proposal.id }}>
                Acompanhar proposta
              </Link>
            </Button>
          ) : writable && p.canAny(scopeKeys("techsales.proposals", "create")) ? (
            <Button
              onClick={() => setProposalSource(j.quote ? { quoteId: j.quote.id } : { dealId })}
            >
              Preparar proposta
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Solicite acesso para preparar a proposta.
            </p>
          )}
        </div>
      );
    if (stage === 2)
      return (
        <div className="flex flex-wrap gap-2">
          {j.draft ? (
            <Button onClick={openDraft}>
              {j.draft.status === "accepted"
                ? "Conferir minuta aprovada"
                : ["changes_requested", "pending_legal"].includes(j.draft.status)
                  ? "Conferir revisão da minuta"
                  : "Acompanhar minuta e retorno"}
            </Button>
          ) : writable &&
            d.access.drafts &&
            p.can("techcontracts.contract_drafts.create.workspace") ? (
            <Button disabled={busy} onClick={createDraft}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}Preparar minuta para revisão
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              A minuta aguarda preparação pelo workflow ou por quem tem “Preparar minuta de proposta
              aceita”.
            </p>
          )}
          {j.clausesApproved && canCreateContract && (
            <Button onClick={() => setSheet("prepare-contract")}>
              Conferir e preparar contrato
            </Button>
          )}
        </div>
      );
    if (stage === 3 && !j.contract)
      return canCreateContract ? (
        <Button onClick={() => setSheet("prepare-contract")}>Conferir e preparar contrato</Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Minuta aceita. O Financeiro precisa de acesso para preparar o contrato.
        </p>
      );
    if (stage === 3)
      return (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setSheet("contract")}>Conferir aprovações e assinaturas</Button>
          {j.contract && (
            <Button asChild variant="outline">
              <Link to="/contracts/$id/flow" params={{ id: j.contract.id }}>
                Ver fluxo do contrato
              </Link>
            </Button>
          )}
        </div>
      );
    return (
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setTab("delivery")}>Organizar início e entrega</Button>
        {j.contract && (
          <Button asChild variant="outline">
            <Link to="/contracts/$id/flow" params={{ id: j.contract.id }}>
              Consultar fluxo do contrato
            </Link>
          </Button>
        )}
      </div>
    );
  };
  return (
    <>
      <Card className="overflow-hidden" aria-label="Jornada comercial e contratação">
        <CardHeader className="gap-3 border-b">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Jornada comercial e contratação</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Da ciência dos valores à liberação do serviço.
              </p>
            </div>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Atualizar jornada"
              onClick={() => {
                void q.refetch();
                if (j.contract && p.can("techcontracts.signature_evidence.view.workspace"))
                  void signature.refetch();
              }}
            >
              <RefreshCw className={cn("size-4", q.isFetching && "animate-spin")} />
            </Button>
          </div>
          {origins.length > 1 && (
            <div className="space-y-1">
              <Label htmlFor="journey-origin" className="text-xs">
                Origem desta jornada
              </Label>
              <Select value={j.chosen ?? undefined} onValueChange={changeOrigin}>
                <SelectTrigger id="journey-origin">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {origins.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Cada origem mantém seus próprios documentos e aprovações.
              </p>
            </div>
          )}
        </CardHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-none border-b bg-transparent px-4">
            <TabsTrigger value="journey">Jornada</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
            <TabsTrigger value="activity">Histórico</TabsTrigger>
            {(ready || p.canAny(scopeKeys("techprojects.projects", "view"))) && (
              <TabsTrigger value="delivery">Entrega</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="journey" className="m-0 p-5">
            <ol
              className="mb-6 flex overflow-x-auto border-b pb-5"
              aria-label="Etapas da contratação"
            >
              {JOURNEY_STEPS.map((name, i) => {
                const done = [
                  j.quote?.status === "accepted",
                  j.proposalSigned,
                  j.clausesApproved,
                  ready,
                  false,
                ][i];
                return (
                  <li key={name} className="min-w-[78px] flex-1">
                    <button
                      type="button"
                      onClick={() => setViewed(i)}
                      aria-current={i === stage ? "step" : undefined}
                      className={cn(
                        "w-full space-y-2 text-left text-xs",
                        viewedStage === i && "font-semibold text-primary",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-7 items-center justify-center rounded-full border bg-muted text-muted-foreground",
                          done && "border-primary/30 bg-primary/10 text-primary",
                          i === stage && "border-primary bg-primary text-primary-foreground",
                        )}
                      >
                        {done ? <Check className="size-3.5" /> : i + 1}
                      </span>
                      <span className="block">{name}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        {done
                          ? "Concluída"
                          : i === stage
                            ? "Etapa atual"
                            : i < stage
                              ? "Origem anterior"
                              : "A seguir"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            {restricted && (
              <div className="mb-4 rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
                <LockKeyhole className="mr-1 inline size-3.5" />
                Alguns documentos não são consultáveis com seu acesso. A ausência na lista não
                confirma que não existam.
              </div>
            )}
            {d.truncated && (
              <p role="alert" className="mb-4 text-sm text-destructive">
                Há mais de 100 documentos em uma categoria. Consulte a listagem completa antes de
                escolher a origem.
              </p>
            )}
            {j.ambiguous && (
              <p role="alert" className="mb-4 rounded-md border p-3 text-sm">
                Há mais de um contrato principal nesta origem. Abra Documentos para conferir cada
                vínculo; a jornada não presume qual assinatura libera a operação.
              </p>
            )}
            {viewedStage !== stage ? (
              <div className="space-y-4">
                <Badge variant="outline">
                  {viewedStage > stage ? "Próxima etapa" : "Etapa anterior"}
                </Badge>
                <h3 className="text-xl font-semibold">{titles[viewedStage]}</h3>
                <p className="text-sm text-muted-foreground">{explanations[viewedStage]}</p>
                <p className="text-sm">
                  {viewedStage > stage
                    ? `Conclua ${JOURNEY_STEPS[stage].toLowerCase()} antes de avançar. As etapas não são alteradas por este indicador.`
                    : "Consulte os documentos e seus estados registrados. Nenhum aceite ausente é reconstruído automaticamente."}
                </p>
                <Button onClick={() => setViewed(null)}>Voltar à etapa atual</Button>
              </div>
            ) : (
              <div className="space-y-5">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Etapa {stage + 1} de 5 ·{" "}
                  {stage === 3
                    ? "Financeiro"
                    : stage === 4
                      ? "Operações"
                      : stage === 2
                        ? "Comercial + Jurídico"
                        : "Comercial"}
                </p>
                <div>
                  <Badge variant="secondary">
                    {ready
                      ? "Assinatura válida para a versão atual"
                      : j.draft && stage === 2
                        ? (CONTRACT_DRAFT_STATUS_LABEL[j.draft.status as ContractDraftStatus] ??
                          j.draft.status)
                        : doc?.status === "draft"
                          ? "Em preparação"
                          : "Acompanhamento"}
                  </Badge>
                  <h3 className="mt-3 text-xl font-semibold tracking-tight">{heading}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {explanations[stage]}
                  </p>
                </div>
                {j.historical && (
                  <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                    Contrato de origem histórica ou com proposta restrita. As etapas comerciais
                    anteriores não foram presumidas como aprovadas.
                  </p>
                )}
                {j.draft?.client_note && (
                  <div className="rounded-md border bg-muted/40 p-3 text-sm">
                    <strong>Retorno do cliente</strong>
                    <p className="mt-1 whitespace-pre-wrap">{j.draft.client_note}</p>
                  </div>
                )}
                {doc && (
                  <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-4">
                    <FileText className="size-8 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium">
                        {doc.title || "Documento da jornada"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {j.contract
                          ? j.contract.number
                          : j.draft
                            ? `Revisão ${j.draft.revision}`
                            : j.proposal
                              ? `Versão ${j.proposal.version}`
                              : j.quote?.number}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (j.contract) setSheet("contract");
                        else if (j.draft) openDraft();
                        else if (j.proposal) setTab("documents");
                        else if (j.quote) setQuotePreview(j.quote.id);
                      }}
                    >
                      Visualizar
                    </Button>
                  </div>
                )}
                {j.contract &&
                  p.can("techcontracts.signature_evidence.view.workspace") &&
                  signature.isError && (
                    <div role="alert" className="space-y-2 text-sm">
                      <p>
                        Não foi possível conferir a evidência da assinatura. O serviço não será
                        considerado liberado.
                      </p>
                      <Button size="sm" variant="outline" onClick={() => void signature.refetch()}>
                        Tentar novamente
                      </Button>
                    </div>
                  )}
                {j.contract && !p.can("techcontracts.signature_evidence.view.workspace") && (
                  <p className="text-sm text-muted-foreground">
                    A consulta da assinatura exige acesso às evidências. Status “Ativo” isoladamente
                    não comprova assinatura.
                  </p>
                )}
                {p.can("techcontracts.signature_evidence.view.workspace") &&
                  signature.data?.reason && (
                    <p className="rounded-md border p-3 text-sm">{signature.data.reason}</p>
                  )}
                {currentAction()}
                <p className="text-xs text-muted-foreground">
                  {stage === 3
                    ? "Responsável pelo envio: Financeiro. Cada ação depende das permissões e alçadas configuradas."
                    : stage === 2
                      ? "Somente os aprovadores jurídicos configurados podem revisar e liberar o envio da minuta."
                      : "Os próximos passos respeitam as permissões e os vínculos desta origem."}
                </p>
                {stage < 4 && (
                  <div className="flex gap-3 border-t pt-4">
                    <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Depois desta etapa</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {
                          [
                            "Com os valores aceitos, prepare a proposta para assinatura.",
                            "Com a proposta aceita, prepare a minuta para revisão jurídica e avaliação das cláusulas.",
                            "Com a minuta aceita pelo cliente, o Financeiro prepara o contrato definitivo.",
                            "Após a assinatura verificável e as aprovações, Operações organiza o início do serviço.",
                          ][stage]
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            <details className="mt-6 border-t pt-4">
              <summary className="cursor-pointer text-xs font-medium">
                Documentos e operações anteriores
              </summary>
              <div className="mt-3 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Consulte as versões e os vínculos originais na aba Documentos.
                </p>
                <Button variant="outline" size="sm" onClick={() => setTab("documents")}>
                  Consultar documentos
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSheet("other")}>
                  Outras operações: aditivo, renovação e avulso
                </Button>
              </div>
            </details>
          </TabsContent>
          <TabsContent value="documents" className="m-0 space-y-6 p-5">
            <p className="text-sm text-muted-foreground">
              Documentos do negócio, com os vínculos e permissões originais. Use a seleção de origem
              da jornada para acompanhá-los sem misturar versões.
            </p>
            {d.access.quotes && (
              <section className="space-y-3">
                <h3 className="font-semibold">Cotações · ciência dos valores</h3>
                <DealQuotes dealId={dealId} />
              </section>
            )}
            {d.access.proposals && (
              <section className="space-y-3 border-t pt-5">
                <h3 className="font-semibold">Propostas · aceite comercial</h3>
                <DealProposals dealId={dealId} companyId={companyId} />
              </section>
            )}
            {d.access.drafts && (
              <section className="space-y-3 border-t pt-5">
                <h3 className="font-semibold">Minutas · avaliação das cláusulas</h3>
                {d.drafts.length ? (
                  d.drafts.map((x) => (
                    <div
                      key={x.id}
                      className="flex items-center justify-between gap-3 rounded-md border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{x.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Revisão {x.revision} ·{" "}
                          {CONTRACT_DRAFT_STATUS_LABEL[x.status as ContractDraftStatus] ?? x.status}
                        </p>
                      </div>
                      <Button size="sm" asChild variant="outline">
                        <Link to="/contracts/drafts/$id" params={{ id: x.id }}>
                          Abrir
                        </Link>
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma minuta visível.</p>
                )}
              </section>
            )}
            {d.access.contracts && (
              <section className="space-y-3 border-t pt-5">
                <h3 className="font-semibold">Contratos · formalização</h3>
                <DealContracts dealId={dealId} companyId={companyId} />
              </section>
            )}
          </TabsContent>
          <TabsContent value="activity" className="m-0 space-y-4 p-5">
            <h3 className="font-semibold">Marcos registrados nesta origem</h3>
            <ul className="space-y-4 border-l pl-4 text-sm">
              {j.quote && (
                <li>
                  Cotação: {j.quote.title || j.quote.number} · {j.quote.status}
                </li>
              )}
              {j.proposal && (
                <li>
                  Proposta v{j.proposal.version}:{" "}
                  {j.proposalSigned
                    ? `Aceita em ${formatDateTime(j.proposal.decided_at!)}`
                    : j.proposal.status}
                </li>
              )}
              {j.draft && (
                <li>
                  Minuta, revisão {j.draft.revision}:{" "}
                  {CONTRACT_DRAFT_STATUS_LABEL[j.draft.status as ContractDraftStatus]}
                  {j.draft.client_decided_at &&
                    ` · Resposta em ${formatDateTime(j.draft.client_decided_at)}`}
                  <Button size="sm" variant="link" onClick={openDraft}>
                    Ver eventos e versões da minuta
                  </Button>
                </li>
              )}
              {j.contract && (
                <li>
                  Contrato {j.contract.number}: {j.contract.status}
                  {ready
                    ? " · Evidência válida da versão atual"
                    : " · Conferir assinatura e aprovações"}
                </li>
              )}
            </ul>
            <p className="text-xs text-muted-foreground">
              O histórico completo de atividades e comunicações continua abaixo, na timeline do
              negócio.
            </p>
          </TabsContent>
          {(ready || p.canAny(scopeKeys("techprojects.projects", "view"))) && (
            <TabsContent value="delivery" className="m-0 p-4">
              <Suspense fallback={loading}>
                {ready && j.contract && p.canAny(scopeKeys("techservice.services", "view")) && (
                  <section className="mb-6 space-y-3">
                    <h3 className="font-semibold">Iniciar serviços do contrato</h3>
                    <p className="text-sm text-muted-foreground">
                      Confira cada serviço e sua data de início antes de ativar. A ativação usa as
                      validações financeiras e de assinatura existentes.
                    </p>
                    <ContractServices contractId={j.contract.id} />
                  </section>
                )}
                <DeliveryPanel dealId={dealId} />
              </Suspense>
            </TabsContent>
          )}
        </Tabs>
      </Card>
      <Sheet
        open={sheet !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSheet(null);
            refresh();
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle>
              {sheet === "quote"
                ? "Cotação e envio"
                : sheet === "draft"
                  ? "Minuta: revisão e avaliação"
                  : sheet === "prepare-contract"
                    ? "Conferência do Financeiro"
                    : sheet === "other"
                      ? "Outras operações"
                      : "Contrato e assinaturas"}
            </SheetTitle>
            <SheetDescription>
              {sheet === "prepare-contract"
                ? "Condições herdadas da proposta. As cláusulas finais serão as da minuta aceita pelo cliente."
                : "As ações usam os documentos reais e as permissões atuais do TechERP."}
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            <Suspense fallback={loading}>
              {sheet === "quote" && d.access.quotes && <DealQuotes dealId={dealId} />}
              {sheet === "draft" && j.draft && <DraftReview id={j.draft.id} embedded />}
              {sheet === "prepare-contract" && (
                <>
                  <div className="rounded-md border bg-muted/30 p-4">
                    <p className="font-medium">{j.proposal?.title}</p>
                    <p className="mt-2 text-sm">
                      Proposta v{j.proposal?.version} ·{" "}
                      {j.proposal?.total_amount != null
                        ? formatCurrency(
                            Number(j.proposal.total_amount),
                            j.proposal.currency ?? "BRL",
                          )
                        : "Valor não informado na proposta"}
                    </p>
                    <p className="mt-2 text-sm">Minuta aceita · revisão {j.draft?.revision}</p>
                    {j.draft?.prepared_terms?.starts_at && (
                      <p className="mt-2 text-sm">
                        Vigência conferida: {formatDateOnly(j.draft.prepared_terms.starts_at)} a{" "}
                        {formatDateOnly(j.draft.prepared_terms.ends_at)}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      Cliente, prestadora, itens e pagamento são herdados da origem aprovada.
                      Signatários serão conferidos antes do envio para assinatura.
                    </p>
                  </div>
                  {!j.proposal?.legal_entity_id && (
                    <p role="alert" className="text-sm text-destructive">
                      Defina a empresa prestadora WK na proposta antes de preparar o contrato.
                    </p>
                  )}
                  <Button
                    disabled={
                      busy ||
                      !j.clausesApproved ||
                      !canCreateContract ||
                      !j.proposal?.legal_entity_id ||
                      j.proposal?.total_amount == null
                    }
                    onClick={finalContract}
                  >
                    {busy && <Loader2 className="mr-2 size-4 animate-spin" />}Preparar contrato da
                    minuta aceita
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Não envia automaticamente. Aprovações e assinaturas são conferidas no próximo
                    passo.
                  </p>
                </>
              )}
              {sheet === "contract" && j.contract && (
                <>
                  <Button asChild variant="outline">
                    <Link to="/contracts/$id" params={{ id: j.contract.id }}>
                      Abrir ficha completa do contrato
                    </Link>
                  </Button>
                  <ApprovalsPanel contractId={j.contract.id} />
                  {p.can("techcontracts.signature_evidence.view.workspace") && (
                    <SignatureCard
                      contractId={j.contract.id}
                      revisionKey={j.contract.updated_at ?? j.contract.created_at}
                    />
                  )}
                </>
              )}
              {sheet === "other" && (
                <>
                  <p className="text-sm text-muted-foreground">
                    Aditivos e renovações começam pelo contrato existente. Não substituem o aceite
                    de uma nova contratação.
                  </p>
                  {d.contracts
                    .filter((c) => c.document_kind !== "amendment")
                    .map((c) => (
                      <div key={c.id} className="space-y-3 rounded-md border p-4">
                        <p className="font-medium">{c.title || c.number}</p>
                        <div className="flex flex-wrap gap-2">
                          {canCreateContract && (
                            <Button
                              size="sm"
                              onClick={() => setWizard({ dealId, companyId, mainContractId: c.id })}
                            >
                              Preparar aditivo
                            </Button>
                          )}
                          <Button size="sm" variant="outline" asChild>
                            <Link to="/contracts/$id" params={{ id: c.id }}>
                              Renovação e condições do contrato
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  {d.contracts.length === 0 && (
                    <p className="text-sm">
                      Nenhum contrato principal visível para aditivo ou renovação.
                    </p>
                  )}
                  <Button asChild variant="outline">
                    <Link to="/contracts" search={{} as never}>
                      Contratos avulsos no TechContracts
                    </Link>
                  </Button>
                </>
              )}
            </Suspense>
          </div>
        </SheetContent>
      </Sheet>
      <Suspense fallback={loading}>
        <QuoteWizard
          dealId={dealId}
          open={quoteOpen}
          onOpenChange={(open) => {
            setQuoteOpen(open);
            if (!open) refresh();
          }}
        />
        <ProposalWizard
          source={proposalSource}
          onOpenChange={(open) => {
            if (!open) {
              setProposalSource(null);
              refresh();
            }
          }}
          onDone={refresh}
        />
      </Suspense>
      <QuoteInternalPreview id={quotePreview} onClose={() => setQuotePreview(null)} />
      <ContractWizard
        source={wizard}
        onOpenChange={(open) => {
          if (!open) {
            setWizard(null);
            refresh();
          }
        }}
      />
    </>
  );
}

export function DealJourneySummary({ dealId, origin }: { dealId: string; origin: string | null }) {
  const { j, q, signature, permissions } = useJourney(dealId, origin);
  if (!j || q.isError || permissions.isError || permissions.isLoading) return null;
  const ready =
    !!j.contract &&
    !j.ambiguous &&
    permissions.can("techcontracts.signature_evidence.view.workspace") &&
    signature.isSuccess &&
    signature.data.reason === null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Próximo passo da contratação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium">
          {ready
            ? "Operações"
            : j.stage === 3
              ? "Financeiro"
              : j.stage === 2
                ? "Comercial + Jurídico"
                : "Comercial"}
        </p>
        <ul className="space-y-2 text-xs">
          {[
            [j.proposalSigned, "Proposta aceita pelo cliente"],
            [j.clausesApproved, "Cláusulas aprovadas"],
            [ready, "Assinatura verificável da versão atual"],
          ].map(([done, label]) => (
            <li key={String(label)} className="flex gap-2">
              {done ? (
                <Check className="size-4 shrink-0 text-primary" />
              ) : (
                <span className="size-4 text-center text-muted-foreground">○</span>
              )}
              <span>{label}</span>
            </li>
          ))}
        </ul>
        <p className="rounded-md border-l-2 border-primary/30 bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
          {ready
            ? "Assinatura válida. Recrutamento e execução ainda respeitam as aprovações e alocações aplicáveis."
            : "O status do negócio ou do contrato não substitui a assinatura. Consulte a jornada para conferir as pendências."}
        </p>
      </CardContent>
    </Card>
  );
}
