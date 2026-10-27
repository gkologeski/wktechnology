import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileEdit, MessageSquare, MessagesSquare, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, MetricCard, SectionHeader, StatusBadge } from "@/components/techhire/ui";
import { RowSkeleton } from "@/components/techhire/ui";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { listEnrollments } from "@/lib/sdr-agent.functions";
import { getSdrOverview } from "@/lib/prospecting/sdr.functions";
import {
  commercialStageLabel,
  enrollmentDisplayName,
  enrollmentStatusDisplay,
  ENROLLMENT_FILTERS,
  FILTER_LABELS,
  supervisionCounts,
  type EnrollmentFilter,
} from "./sdr-operation-display";

type EnrollmentsResult = Awaited<ReturnType<typeof listEnrollments>>;

const INBOX_VIEW_KEYS = [
  "techsales.inbox.whatsapp.view.own",
  "techsales.inbox.whatsapp.view.team",
  "techsales.inbox.whatsapp.view.workspace",
];

function useEnrollments(status?: EnrollmentFilter) {
  const fn = useServerFn(listEnrollments);
  return useQuery({
    queryKey: ["sdr-enrollments", status ?? "all"],
    queryFn: () => fn({ data: status ? { status } : {} }) as Promise<EnrollmentsResult>,
  });
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const cardLink =
  "block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Indicadores do topo da Operação; cada cartão leva à fila correspondente. */
export function SdrOperationSummary() {
  const fetchOverview = useServerFn(getSdrOverview);
  const overview = useQuery({ queryKey: ["sdr-overview"], queryFn: () => fetchOverview() });
  const enrollments = useEnrollments();
  const jobs = overview.data ? supervisionCounts(overview.data.jobs) : null;
  const counts = enrollments.data?.counts ?? null;
  const unavailable = "Indisponível";

  return (
    <section
      aria-label="Indicadores da Operação"
      className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <Link
        to="/agents/sdr"
        search={{ section: "sdr-supervision" }}
        replace
        resetScroll={false}
        className={cardLink}
      >
        <MetricCard
          label="Para revisar"
          value={jobs ? jobs.toReview : "—"}
          hint={overview.error ? unavailable : "Rascunhos aguardando aprovação"}
          icon={FileEdit}
          tone={jobs && jobs.toReview > 0 ? "warning" : "neutral"}
          loading={overview.isLoading}
        />
      </Link>
      <Link
        to="/agents/sdr"
        search={{ section: "sdr-supervision" }}
        replace
        resetScroll={false}
        className={cardLink}
      >
        <MetricCard
          label="Falhas a resolver"
          value={jobs ? jobs.failed : "—"}
          hint={
            overview.error
              ? unavailable
              : jobs
                ? `${jobs.processing} em processamento`
                : "Envios que precisam de ação"
          }
          icon={AlertTriangle}
          tone={jobs && jobs.failed > 0 ? "negative" : "neutral"}
          loading={overview.isLoading}
        />
      </Link>
      <Link
        to="/agents/sdr"
        search={{ section: "enrollments", status: "active" }}
        replace
        resetScroll={false}
        className={cardLink}
      >
        <MetricCard
          label="Em conversa"
          value={counts ? counts.active : "—"}
          hint={
            enrollments.error || (enrollments.data && !counts)
              ? unavailable
              : "Atendidos pelo agente agora"
          }
          icon={MessagesSquare}
          tone="positive"
          loading={enrollments.isLoading}
        />
      </Link>
      <Link
        to="/agents/sdr"
        search={{ section: "enrollments", status: "handoff" }}
        replace
        resetScroll={false}
        className={cardLink}
      >
        <MetricCard
          label="Com humano"
          value={counts ? counts.handoff : "—"}
          hint={
            enrollments.error || (enrollments.data && !counts)
              ? unavailable
              : "Passados para a equipe"
          }
          icon={UserRound}
          loading={enrollments.isLoading}
        />
      </Link>
    </section>
  );
}

/** Lista "Em atendimento": nome, agente, situação e etapa em português. */
export function SdrEnrollmentsPanel({
  status,
  onStatusChange,
}: {
  status?: EnrollmentFilter;
  onStatusChange: (next: EnrollmentFilter | undefined) => void;
}) {
  const q = useEnrollments(status);
  const all = useEnrollments();
  // Atalho para a Inbox só aparece para quem pode ver conversas de WhatsApp
  // (a própria Inbox revalida no servidor e no banco).
  const canOpenInbox = usePermissions().canAny(INBOX_VIEW_KEYS);
  const counts = all.data?.counts ?? null;
  const items = q.data?.items ?? [];
  const filterTotal = counts ? (status ? counts[status] : counts.total) : null;

  const filters: Array<{ id: EnrollmentFilter | undefined; label: string; count: number | null }> =
    [
      { id: undefined, label: "Todos", count: counts?.total ?? null },
      ...ENROLLMENT_FILTERS.map((f) => ({
        id: f,
        label: FILTER_LABELS[f],
        count: counts?.[f] ?? null,
      })),
    ];

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Em atendimento"
        description="Quem o agente está atendendo, em que situação e etapa cada conversa está."
      />
      <div role="group" aria-label="Filtrar por situação" className="flex flex-wrap gap-2">
        {filters.map((f) => {
          const active = f.id === status;
          return (
            <Button
              key={f.id ?? "all"}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              aria-pressed={active}
              onClick={() => onStatusChange(f.id)}
            >
              {f.label}
              {f.count != null ? (
                <span
                  className={cn(
                    "ml-1.5 tabular-nums",
                    active ? "opacity-90" : "text-muted-foreground",
                  )}
                >
                  {f.count.toLocaleString("pt-BR")}
                </span>
              ) : null}
            </Button>
          );
        })}
      </div>

      {q.isLoading ? (
        <div
          className="space-y-2 rounded-lg border bg-card p-3"
          role="status"
          aria-label="Carregando atendimentos"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <RowSkeleton key={i} />
          ))}
        </div>
      ) : q.error ? (
        <EmptyState
          title="Não foi possível carregar os atendimentos"
          description={(q.error as Error).message || "Tente novamente em instantes."}
          action={<Button onClick={() => q.refetch()}>Tentar novamente</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title={
            status ? `Nenhum atendimento em "${FILTER_LABELS[status]}"` : "Nenhum atendimento ainda"
          }
          description={
            status
              ? "Escolha outra situação para ver os demais atendimentos."
              : "Quando uma campanha usar o agente, as conversas aparecem aqui."
          }
        />
      ) : (
        <>
          <div className="relative overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <caption className="sr-only">Atendimentos do Agente SDR</caption>
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="p-3 font-medium">
                    Contato
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    Agente
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    Situação
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    Etapa
                  </th>
                  <th scope="col" className="p-3 text-right font-medium">
                    Mensagens
                  </th>
                  <th scope="col" className="p-3 text-right font-medium">
                    Nota
                  </th>
                  <th scope="col" className="p-3 font-medium">
                    Última ação
                  </th>
                  <th scope="col" className="p-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((e) => {
                  const st = enrollmentStatusDisplay(e.status);
                  const name = enrollmentDisplayName(e.person, e.contact_phone);
                  const showPhone = !!e.person && !!e.contact_phone && name !== e.contact_phone;
                  return (
                    <tr key={e.id} className="align-top hover:bg-muted/40">
                      <td className="p-3">
                        {e.contact_id ? (
                          <Link
                            to="/contacts/$id"
                            params={{ id: e.contact_id }}
                            className="font-medium text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
                          >
                            {name}
                          </Link>
                        ) : e.lead_id ? (
                          <Link
                            to="/leads/$id"
                            params={{ id: e.lead_id }}
                            className="font-medium text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
                          >
                            {name}
                          </Link>
                        ) : (
                          <span className="font-medium text-foreground">{name}</span>
                        )}
                        {e.person?.company_name || showPhone ? (
                          <span className="block text-xs text-muted-foreground">
                            {[e.person?.company_name, showPhone ? e.contact_phone : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3 text-muted-foreground">{e.agent_name ?? "—"}</td>
                      <td className="p-3">
                        <StatusBadge status={st.tone} label={st.label} />
                      </td>
                      <td className="whitespace-nowrap p-3">
                        {commercialStageLabel(e.commercial_stage)}
                      </td>
                      <td className="p-3 text-right tabular-nums">{e.messages_sent ?? 0}</td>
                      <td className="p-3 text-right tabular-nums">
                        {e.qualification_score == null ? "—" : e.qualification_score}
                      </td>
                      <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
                        {fmtDate(e.last_action_at ?? e.created_at)}
                      </td>
                      <td className="p-3 text-right">
                        {e.conversation_id && canOpenInbox ? (
                          <Button asChild size="sm" variant="ghost">
                            <Link to="/inbox/whatsapp" search={{ conversation: e.conversation_id }}>
                              Abrir conversa
                            </Link>
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {filterTotal != null && filterTotal > items.length
              ? `Mostrando os ${items.length} atendimentos mais recentes de ${filterTotal.toLocaleString("pt-BR")}.`
              : `${items.length} atendimento${items.length === 1 ? "" : "s"}.`}
          </p>
        </>
      )}
    </div>
  );
}
