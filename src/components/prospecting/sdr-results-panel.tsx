import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarCheck,
  FileText,
  MessageSquareReply,
  RefreshCw,
  Send,
  ShieldOff,
  UserRound,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  EmptyState,
  MetricCard,
  MetricsGridSkeleton,
  SectionHeader,
  StatusBadge,
} from "@/components/techhire/ui";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { leadScoreBandLabel, LEAD_SCORE_MAX } from "@/lib/prospecting/lead-score";
import { getSdrResults } from "@/lib/sdr-agent.functions";
import { retrySdrMeetingSync } from "@/lib/prospecting/sdr.functions";
import {
  buildSdrFunnel,
  commercialStageLabel,
  enrollmentDisplayName,
  formatMeetingTime,
  meetingStatusDisplay,
  qualificationDecisionLabel,
} from "./sdr-operation-display";

type Results = Awaited<ReturnType<typeof getSdrResults>>;
type Person = { first_name: string | null; last_name: string | null; company_name: string | null };

const RETRY_KEYS = [
  "techsales.marketing.sdr_agent.update.workspace",
  "techsales.marketing.sdr_agent.manage.workspace",
];

const nameLink =
  "font-medium text-foreground hover:underline focus-visible:underline focus-visible:outline-none";

function PersonCell({
  person,
  phone,
  contactId,
  leadId,
}: {
  person: Person | null;
  phone: string | null | undefined;
  contactId: string | null;
  leadId: string | null;
}) {
  const name = enrollmentDisplayName(person, phone);
  const extra = [person?.company_name, person && phone && name !== phone ? phone : null].filter(
    Boolean,
  );
  return (
    <>
      {contactId ? (
        <Link to="/contacts/$id" params={{ id: contactId }} className={nameLink}>
          {name}
        </Link>
      ) : leadId ? (
        <Link to="/leads/$id" params={{ id: leadId }} className={nameLink}>
          {name}
        </Link>
      ) : (
        <span className="font-medium text-foreground">{name}</span>
      )}
      {extra.length ? (
        <span className="block text-xs text-muted-foreground">{extra.join(" · ")}</span>
      ) : null}
    </>
  );
}

function Funnel({ totals }: { totals: Results["totals"] }) {
  const steps = buildSdrFunnel(totals);
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <section aria-labelledby="sdr-funnel-title" className="rounded-lg border bg-card p-4">
      <h3 id="sdr-funnel-title" className="text-sm font-semibold text-foreground">
        Funil de conversão
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Percentual sobre as conversas iniciadas. Cada etapa é contada pela situação atual do
        atendimento.
      </p>
      <ol className="mt-4 space-y-3">
        {steps.map((s) => (
          <li key={s.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-foreground">{s.label}</span>
              <span className="tabular-nums text-foreground">
                {s.value.toLocaleString("pt-BR")}
                <span className="ml-2 text-xs text-muted-foreground">
                  {s.pct == null ? "—" : `${s.pct}%`}
                </span>
              </span>
            </div>
            <div
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${s.label}: ${s.value} (${s.pct == null ? "sem conversas" : `${s.pct}%`})`}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${s.value === 0 ? 0 : Math.max(2, (s.value / max) * 100)}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function MeetingsTable({ rows }: { rows: Results["meetings"] }) {
  if (rows.length === 0)
    return (
      <EmptyState
        icon={CalendarCheck}
        title="Nenhuma reunião no período"
        description="Reuniões marcadas pelo agente aparecem aqui com data, anfitrião e situação."
        compact
      />
    );
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">Reuniões marcadas pelo Agente SDR</caption>
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="p-3 font-medium">Contato</th>
            <th scope="col" className="p-3 font-medium">Data e hora</th>
            <th scope="col" className="p-3 font-medium">Anfitrião</th>
            <th scope="col" className="p-3 font-medium">Agente</th>
            <th scope="col" className="p-3 font-medium">Situação</th>
            <th scope="col" className="p-3">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((m) => {
            const st = meetingStatusDisplay(m.status);
            return (
              <tr key={m.id} className="align-top hover:bg-muted/40">
                <td className="p-3">
                  <PersonCell
                    person={m.person}
                    phone={null}
                    contactId={m.contact_id}
                    leadId={m.lead_id}
                  />
                </td>
                <td className="whitespace-nowrap p-3 tabular-nums">
                  {formatMeetingTime(m.start_at, m.timezone)}
                </td>
                <td className="p-3 text-muted-foreground">{m.host_name ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{m.agent_name ?? "—"}</td>
                <td className="p-3">
                  <StatusBadge status={st.tone} label={st.label} />
                </td>
                <td className="p-3 text-right">
                  {m.meet_link && /^https:\/\//.test(m.meet_link) ? (
                    <Button asChild size="sm" variant="ghost">
                      <a href={m.meet_link} target="_blank" rel="noopener noreferrer">
                        <Video className="mr-1 h-4 w-4" aria-hidden="true" />
                        Entrar
                        <span className="sr-only"> na reunião (abre em nova aba)</span>
                      </a>
                    </Button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PendingMeetings({ rows }: { rows: Results["pendingMeetings"] }) {
  const canRetry = usePermissions().canAny(RETRY_KEYS);
  const retry = useServerFn(retrySdrMeetingSync);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (enrollmentId: string) => retry({ data: { enrollmentId } }),
    onSuccess: (x) => {
      if (x.status === "confirmed") toast.success("Reunião confirmada no Google");
      else toast.error("O Google ainda recusou a reunião");
      return Promise.all([
        qc.invalidateQueries({ queryKey: ["sdr-results"] }),
        qc.invalidateQueries({ queryKey: ["sdr-overview"] }),
      ]);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">Reuniões aguardando ação</h3>
      <ul className="divide-y rounded-lg border bg-card">
        {rows.map((e) => {
          const st = meetingStatusDisplay(e.meeting_status);
          return (
            <li key={e.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
              <div className="min-w-0 flex-1">
                <PersonCell
                  person={e.person}
                  phone={e.contact_phone}
                  contactId={e.contact_id}
                  leadId={e.lead_id}
                />
              </div>
              <span className="text-xs text-muted-foreground">{e.agent_name ?? "—"}</span>
              <StatusBadge status={st.tone} label={st.label} />
              {e.meeting_status === "sync_failed" && e.booking_id && canRetry ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={m.isPending}
                  onClick={() => m.mutate(e.id)}
                >
                  <RefreshCw className="mr-1 h-3 w-3" aria-hidden="true" />
                  Reenviar ao Google
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function QualificationsTable({ rows }: { rows: Results["qualifications"] }) {
  if (rows.length === 0)
    return (
      <EmptyState
        icon={FileText}
        title="Nenhuma qualificação no período"
        description="Quando o agente preencher o questionário, a nota aparece aqui."
        compact
      />
    );
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">Qualificações feitas pelo Agente SDR</caption>
        <thead className="text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="p-3 font-medium">Contato</th>
            <th scope="col" className="p-3 font-medium">Agente</th>
            <th scope="col" className="p-3 font-medium">Etapa</th>
            <th scope="col" className="p-3 text-right font-medium">Nota</th>
            <th scope="col" className="p-3 font-medium">Faixa</th>
            <th scope="col" className="p-3 font-medium">Decisão</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((q) => (
            <tr key={q.id} className="align-top hover:bg-muted/40">
              <td className="p-3">
                <PersonCell
                  person={q.person}
                  phone={q.contact_phone}
                  contactId={q.contact_id}
                  leadId={q.lead_id}
                />
              </td>
              <td className="p-3 text-muted-foreground">{q.agent_name ?? "—"}</td>
              <td className="whitespace-nowrap p-3">{commercialStageLabel(q.commercial_stage)}</td>
              <td className="whitespace-nowrap p-3 text-right tabular-nums" title={q.questionnaire ?? undefined}>
                {q.total}/{LEAD_SCORE_MAX}
              </td>
              <td className="p-3">{leadScoreBandLabel(q.total)}</td>
              <td className="p-3">{qualificationDecisionLabel(q.decision)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Resultados dos últimos 30 dias: indicadores, funil, reuniões e qualificações. */
export function SdrResultsPanel() {
  const fetchResults = useServerFn(getSdrResults);
  const q = useQuery({ queryKey: ["sdr-results"], queryFn: () => fetchResults() });

  if (q.isLoading)
    return (
      <div className="space-y-4" role="status" aria-label="Carregando resultados">
        <MetricsGridSkeleton />
        <div className="h-64 animate-pulse rounded-lg border bg-muted/40" />
      </div>
    );
  if (q.error || !q.data)
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Não foi possível carregar os resultados"
        description={(q.error as Error | null)?.message || "Tente novamente em instantes."}
        action={<Button onClick={() => q.refetch()}>Tentar novamente</Button>}
      />
    );

  const { totals, meetings, pendingMeetings, qualifications } = q.data;
  const fmt = (v: number) => v.toLocaleString("pt-BR");
  return (
    <div className="space-y-6">
      <SectionHeader
        title="Resultados (últimos 30 dias)"
        description="Números contados no banco para todas as conversas do período, não só as da tela."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Mensagens enviadas" value={fmt(totals.messagesSent)} icon={Send} />
        <MetricCard
          label="Responderam"
          value={fmt(totals.replied)}
          hint={`de ${fmt(totals.started)} conversas`}
          icon={MessageSquareReply}
          tone="positive"
        />
        <MetricCard
          label="Reuniões confirmadas"
          value={fmt(totals.meetingConfirmed)}
          icon={CalendarCheck}
          tone="positive"
        />
        <MetricCard label="Com humano" value={fmt(totals.handoff)} icon={UserRound} />
        <MetricCard label="Recusas" value={fmt(totals.optedOut)} icon={ShieldOff} />
        <MetricCard label="Materiais enviados" value={fmt(totals.materialsSent)} icon={FileText} />
        <MetricCard
          label="Falhas de envio"
          value={fmt(totals.sendFailures)}
          icon={AlertTriangle}
          tone={totals.sendFailures > 0 ? "negative" : "neutral"}
        />
        <MetricCard label="Qualificados" value={fmt(totals.qualified)} tone="ai" />
      </div>

      <Funnel totals={totals} />

      <div className="space-y-3">
        <SectionHeader
          title="Reuniões"
          description="Reuniões marcadas pelo agente no período, com horário no fuso da reunião."
        />
        <MeetingsTable rows={meetings} />
        <PendingMeetings rows={pendingMeetings} />
      </div>

      <div className="space-y-3">
        <SectionHeader
          title="Qualificações"
          description="Nota e decisão do questionário preenchido pelo agente (as 100 mais recentes)."
        />
        <QualificationsTable rows={qualifications} />
      </div>
    </div>
  );
}
