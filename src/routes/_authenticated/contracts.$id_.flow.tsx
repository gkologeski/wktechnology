// Fluxo do contrato: jornada somente leitura do negócio até o contrato ativo.
// Lê apenas dados já existentes, pelas mesmas permissões (RLS) do usuário.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Circle, CircleDot, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
const fmtDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/contracts/$id_/flow")({
  head: () => ({
    meta: [
      { title: "Fluxo do contrato — TechContracts" },
      { name: "description", content: "Etapas de negociação do negócio até o contrato final." },
      { property: "og:title", content: "Fluxo do contrato — TechContracts" },
      {
        property: "og:description",
        content: "Etapas de negociação do negócio até o contrato final.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContractFlowPage,
});

type StepState = "done" | "current" | "pending" | "blocked";
type FlowItem = { id: string; label: string; status: string; date?: string | null; to?: string };
type FlowStep = {
  key: string;
  title: string;
  state: StepState;
  summary: string;
  items: FlowItem[];
};

const CONTRACT_STATUS: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  in_negotiation: "Em negociação",
  awaiting_signature: "Aguardando assinatura",
  active: "Ativo",
  renewing: "Renovando",
  ended: "Encerrado",
  terminated: "Rescindido",
};
const GENERIC_STATUS: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovado",
  sent: "Enviado",
  accepted: "Aceito",
  rejected: "Recusado",
  expired: "Expirado",
  canceled: "Cancelado",
  published: "Publicado",
  declined: "Recusado",
  pending: "Pendente",
  skipped: "Dispensado",
  partially_signed: "Parcialmente assinado",
  completed: "Concluído",
  new: "Novo",
  qualified: "Qualificado",
  proposal: "Proposta",
  negotiation: "Negociação",
  won: "Ganho",
  lost: "Perdido",
};
const APPROVAL_STAGE: Record<string, string> = {
  legal: "Jurídico",
  finance: "Financeiro",
  purchasing: "Compras",
};
const label = (s?: string | null) => (s ? (GENERIC_STATUS[s] ?? s) : "—");
const ORDER = [
  "draft",
  "in_review",
  "in_negotiation",
  "awaiting_signature",
  "active",
  "renewing",
  "ended",
  "terminated",
];

async function loadFlow(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data: contract, error } = await db
    .from("contracts")
    .select("id,title,number,status,deal_id,signed_at,starts_at,created_at,signature_document_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!contract) return null;
  const dealId = contract.deal_id as string | null;
  const [deal, proposals, quotes, approvals, amendments, esign] = await Promise.all([
    dealId
      ? db.from("deals").select("id,name,stage,created_at,closed_at").eq("id", dealId).maybeSingle()
      : { data: null },
    dealId
      ? db
          .from("proposals")
          .select("id,title,status,sent_at,decided_at,created_at")
          .eq("deal_id", dealId)
      : { data: [] },
    dealId
      ? db.from("quotes").select("id,title,number,status,sent_at,created_at").eq("deal_id", dealId)
      : { data: [] },
    db
      .from("contract_approvals")
      .select("id,stage,status,decided_at,created_at")
      .eq("contract_id", id),
    db
      .from("contracts")
      .select("id,title,number,status,created_at")
      .or(`amendment_of_id.eq.${id},parent_contract_id.eq.${id}`),
    contract.signature_document_id
      ? db
          .from("esign_documents")
          .select("id,title,status,sent_at,completed_at,created_at")
          .eq("id", contract.signature_document_id)
      : dealId
        ? db
            .from("esign_documents")
            .select("id,title,status,sent_at,completed_at,created_at")
            .eq("deal_id", dealId)
        : { data: [] },
  ]);
  return {
    contract,
    deal: deal.data,
    proposals: proposals.data ?? [],
    quotes: quotes.data ?? [],
    approvals: approvals.data ?? [],
    amendments: amendments.data ?? [],
    esign: esign.data ?? [],
  };
}

type FlowData = NonNullable<Awaited<ReturnType<typeof loadFlow>>>;

function buildSteps(d: FlowData): FlowStep[] {
  const idx = ORDER.indexOf(d.contract.status);
  const reached = (s: string) => idx >= ORDER.indexOf(s);
  const terminated = d.contract.status === "terminated";
  const commercial = [...d.proposals, ...d.quotes];
  const approvalsDone =
    d.approvals.length > 0 && d.approvals.every((a: { status: string }) => a.status !== "pending");
  const rejected = d.approvals.some((a: { status: string }) => a.status === "rejected");
  const esignDone =
    d.esign.some((e: { status: string }) => e.status === "completed") || !!d.contract.signed_at;

  return [
    {
      key: "deal",
      title: "Negócio",
      state: d.deal
        ? d.deal.stage === "won"
          ? "done"
          : d.deal.stage === "lost"
            ? "blocked"
            : "current"
        : "pending",
      summary: d.deal ? `${d.deal.name} · ${label(d.deal.stage)}` : "Sem negócio vinculado",
      items: d.deal
        ? [
            {
              id: d.deal.id,
              label: d.deal.name,
              status: label(d.deal.stage),
              date: d.deal.closed_at ?? d.deal.created_at,
              to: "deal",
            },
          ]
        : [],
    },
    {
      key: "commercial",
      title: "Proposta / Cotação",
      state: commercial.some((p: { status: string }) => p.status === "accepted")
        ? "done"
        : commercial.length
          ? "current"
          : "pending",
      summary: commercial.length
        ? `${commercial.length} documento(s) comercial(is)`
        : "Não iniciada",
      items: [
        ...d.proposals.map(
          (p: {
            id: string;
            title: string;
            status: string;
            decided_at: string | null;
            created_at: string;
          }) => ({
            id: p.id,
            label: `Proposta · ${p.title}`,
            status: label(p.status),
            date: p.decided_at ?? p.created_at,
          }),
        ),
        ...d.quotes.map(
          (q: {
            id: string;
            title: string;
            number: string | null;
            status: string;
            created_at: string;
          }) => ({
            id: q.id,
            label: `Cotação · ${q.number ?? q.title}`,
            status: label(q.status),
            date: q.created_at,
          }),
        ),
      ],
    },
    {
      key: "approval",
      title: "Aprovação",
      state: rejected
        ? "blocked"
        : approvalsDone
          ? "done"
          : d.approvals.length
            ? "current"
            : reached("awaiting_signature")
              ? "done"
              : "pending",
      summary: d.approvals.length
        ? `${d.approvals.length} aprovação(ões)`
        : "Sem aprovações registradas",
      items: d.approvals.map(
        (a: {
          id: string;
          stage: string;
          status: string;
          decided_at: string | null;
          created_at: string;
        }) => ({
          id: a.id,
          label: APPROVAL_STAGE[a.stage] ?? a.stage,
          status: label(a.status),
          date: a.decided_at ?? a.created_at,
        }),
      ),
    },
    {
      key: "draft",
      title: "Minuta do contrato",
      state: reached("in_review") ? "done" : "current",
      summary: `${d.contract.number ?? "Sem número"} · ${CONTRACT_STATUS[d.contract.status] ?? d.contract.status}`,
      items: [
        {
          id: d.contract.id,
          label: d.contract.title,
          status: CONTRACT_STATUS[d.contract.status] ?? d.contract.status,
          date: d.contract.created_at,
        },
      ],
    },
    {
      key: "review",
      title: "Revisão / Aditivos",
      state: reached("awaiting_signature") ? "done" : reached("in_review") ? "current" : "pending",
      summary: d.amendments.length
        ? `${d.amendments.length} vínculo(s) ou aditivo(s)`
        : "Sem aditivos",
      items: d.amendments.map(
        (a: {
          id: string;
          title: string;
          number: string | null;
          status: string;
          created_at: string;
        }) => ({
          id: a.id,
          label: a.number ? `${a.number} · ${a.title}` : a.title,
          status: CONTRACT_STATUS[a.status] ?? a.status,
          date: a.created_at,
          to: "contract",
        }),
      ),
    },
    {
      key: "signature",
      title: "Assinatura",
      state:
        esignDone || reached("active")
          ? "done"
          : d.contract.status === "awaiting_signature" || d.esign.length
            ? "current"
            : "pending",
      summary: d.contract.signed_at
        ? `Assinado em ${fmtDate(d.contract.signed_at)}`
        : d.esign.length
          ? "Documento de assinatura em andamento"
          : "Não iniciada",
      items: d.esign.map(
        (e: {
          id: string;
          title: string;
          status: string;
          completed_at: string | null;
          sent_at: string | null;
          created_at: string;
        }) => ({
          id: e.id,
          label: e.title,
          status: label(e.status),
          date: e.completed_at ?? e.sent_at ?? e.created_at,
        }),
      ),
    },
    {
      key: "active",
      title: "Contrato ativo",
      state: terminated ? "blocked" : reached("active") ? "done" : "pending",
      summary: reached("active") ? CONTRACT_STATUS[d.contract.status] : "Não iniciada",
      items: [],
    },
  ];
}

const STATE_META: Record<StepState, { label: string; icon: typeof Circle; tone: string }> = {
  done: { label: "Concluída", icon: CheckCircle2, tone: "text-primary" },
  current: { label: "Em andamento", icon: CircleDot, tone: "text-foreground" },
  pending: { label: "Não iniciada", icon: Circle, tone: "text-muted-foreground" },
  blocked: { label: "Interrompida", icon: AlertTriangle, tone: "text-destructive" },
};

function ContractFlowPage() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["contract-flow", id], queryFn: () => loadFlow(id) });

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/contracts/$id" params={{ id }}>
          <ArrowLeft className="mr-1 h-4 w-4" aria-hidden /> Voltar ao contrato
        </Link>
      </Button>
      <PageHeader
        title="Fluxo do contrato"
        description={
          q.data ? q.data.contract.title : "Etapas de negociação, do negócio ao contrato final."
        }
      />
      {q.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : q.isError ? (
        <div role="alert" className="rounded-lg border bg-card p-8 text-center">
          <p className="font-medium">Não foi possível carregar o fluxo.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Verifique sua conexão e tente novamente.
          </p>
          <Button className="mt-4" variant="outline" onClick={() => q.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : !q.data ? (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="font-medium">Contrato não encontrado</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ele pode ter sido excluído ou você não tem acesso.
          </p>
        </div>
      ) : (
        <ol className="relative space-y-3" aria-label="Etapas do contrato">
          {buildSteps(q.data).map((step, i, all) => {
            const meta = STATE_META[step.state];
            const Icon = meta.icon;
            return (
              <li key={step.key} className="relative flex gap-3">
                <div className="flex flex-col items-center">
                  <Icon className={cn("h-5 w-5 shrink-0", meta.tone)} aria-hidden />
                  {i < all.length - 1 ? (
                    <span className="mt-1 w-px flex-1 bg-border" aria-hidden />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1 rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold">{step.title}</h2>
                    <Badge
                      variant={
                        step.state === "blocked"
                          ? "destructive"
                          : step.state === "done"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{step.summary}</p>
                  {step.items.length > 0 ? (
                    <ul className="mt-3 divide-y rounded-md border">
                      {step.items.map((it) => (
                        <li
                          key={it.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                          {it.to === "deal" ? (
                            <Link
                              to="/deals/$id"
                              params={{ id: it.id }}
                              className="truncate hover:underline"
                            >
                              {it.label}
                            </Link>
                          ) : it.to === "contract" ? (
                            <Link
                              to="/contracts/$id"
                              params={{ id: it.id }}
                              className="truncate hover:underline"
                            >
                              {it.label}
                            </Link>
                          ) : (
                            <span className="truncate">{it.label}</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {it.status}
                            {it.date ? ` · ${fmtDate(it.date)}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
