/**
 * Cards de associação exclusivos do Lead que complementam Empresa/Contato/Negócio:
 * formulários enviados, agendamentos, conversas de e-mail, campanhas e prospecção.
 *
 * Somente leitura, sempre com o client autenticado do browser (RLS do usuário).
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CalendarClock, FileText, Mails, Megaphone, Radar } from "lucide-react";
import { formatDateTime } from "@/lib/crm";
import { useRefreshCallback } from "@/hooks/use-refresh-callback";
import { AssocCard, Empty, ViewAllFooter } from "./primitives";

/* ───────────── helpers ───────────── */

function useLeadRelated<T>(
  entityId: string,
  load: (leadId: string) => Promise<T[]>,
): { rows: T[]; loading: boolean; error: string | null } {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useRefreshCallback(() => setTick((t) => t + 1));

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    load(entityId)
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Falha ao carregar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `load` é estável por card (função de módulo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, tick]);

  return { rows, loading, error };
}

function CardBody({
  loading,
  error,
  empty,
  emptyLabel,
  children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true">
        <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
      </div>
    );
  }
  if (error) {
    return (
      <p className="text-xs text-destructive" role="alert">
        Não foi possível carregar. Atualize a página para tentar novamente.
      </p>
    );
  }
  if (empty) return <Empty label={emptyLabel} />;
  return <>{children}</>;
}

const ItemTitle = ({ children }: { children: React.ReactNode }) => (
  <p className="text-xs font-semibold text-foreground break-words">{children}</p>
);

const ItemMeta = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] text-muted-foreground break-words">{children}</p>
);

const List = ({ children }: { children: React.ReactNode }) => (
  <ul className="space-y-2">{children}</ul>
);

/* ───────────── formulários ───────────── */

type SubmissionRow = {
  id: string;
  created_at: string;
  form_id: string | null;
  forms: { id: string; name: string | null } | null;
};

async function loadSubmissions(leadId: string): Promise<SubmissionRow[]> {
  const { data, error } = await supabase
    .from("form_submissions")
    .select("id, created_at, form_id, forms(id, name)")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as SubmissionRow[];
}

export function LeadFormSubmissionsCard({ entityId }: { entityId: string }) {
  const { rows, loading, error } = useLeadRelated(entityId, loadSubmissions);
  return (
    <AssocCard
      icon={<FileText className="w-4 h-4" />}
      title="Formulários enviados"
      count={rows.length}
    >
      <CardBody
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyLabel="Nenhum formulário enviado."
      >
        <List>
          {rows.map((s) => (
            <li key={s.id} className="rounded-xl border border-border/60 p-3">
              <ItemTitle>{s.forms?.name || "Formulário"}</ItemTitle>
              <ItemMeta>Enviado em {formatDateTime(s.created_at)}</ItemMeta>
            </li>
          ))}
        </List>
        <ViewAllFooter href="/forms" label="Exibir todos os Formulários" />
      </CardBody>
    </AssocCard>
  );
}

/* ───────────── agendamentos ───────────── */

type BookingRow = {
  id: string;
  start_at: string;
  end_at: string | null;
  status: string | null;
  invitee_name: string | null;
  invitee_email: string | null;
  meet_link: string | null;
  booking_pages: { id: string; title: string | null } | null;
};

async function loadBookings(leadId: string): Promise<BookingRow[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, start_at, end_at, status, invitee_name, invitee_email, meet_link, booking_pages(id, title)",
    )
    .eq("lead_id", leadId)
    .order("start_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as BookingRow[];
}

const BOOKING_STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmado",
  canceled: "Cancelado",
};

export function LeadBookingsCard({ entityId }: { entityId: string }) {
  const { rows, loading, error } = useLeadRelated(entityId, loadBookings);
  return (
    <AssocCard
      icon={<CalendarClock className="w-4 h-4" />}
      title="Agendamentos"
      count={rows.length}
    >
      <CardBody
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyLabel="Nenhum agendamento."
      >
        <List>
          {rows.map((b) => (
            <li key={b.id} className="rounded-xl border border-border/60 p-3">
              <ItemTitle>{b.booking_pages?.title || "Reunião agendada"}</ItemTitle>
              <ItemMeta>
                {formatDateTime(b.start_at)}
                {b.status ? ` · ${BOOKING_STATUS_LABEL[b.status] ?? b.status}` : ""}
              </ItemMeta>
              {b.meet_link && (
                <a
                  href={b.meet_link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-primary hover:underline"
                >
                  Abrir link da reunião
                </a>
              )}
            </li>
          ))}
        </List>
      </CardBody>
    </AssocCard>
  );
}

/* ───────────── conversas de e-mail (threads) ───────────── */

type ThreadRow = {
  id: string;
  subject: string | null;
  snippet: string | null;
  message_count: number | null;
  last_message_at: string | null;
  created_at: string;
};

async function loadThreads(leadId: string): Promise<ThreadRow[]> {
  const { data, error } = await supabase
    .from("email_threads")
    .select("id, subject, snippet, message_count, last_message_at, created_at")
    .eq("lead_id", leadId)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(5);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ThreadRow[];
}

export function LeadEmailThreadsCard({ entityId }: { entityId: string }) {
  const { rows, loading, error } = useLeadRelated(entityId, loadThreads);
  return (
    <AssocCard icon={<Mails className="w-4 h-4" />} title="Conversas de e-mail" count={rows.length}>
      <CardBody
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyLabel="Nenhuma conversa de e-mail."
      >
        <List>
          {rows.map((t) => (
            <li key={t.id} className="rounded-xl border border-border/60 p-3">
              <ItemTitle>{t.subject || "(sem assunto)"}</ItemTitle>
              {t.snippet && <ItemMeta>{t.snippet}</ItemMeta>}
              <ItemMeta>
                {formatDateTime(t.last_message_at ?? t.created_at)}
                {t.message_count ? ` · ${t.message_count} mensagem(ns)` : ""}
              </ItemMeta>
            </li>
          ))}
        </List>
        <ViewAllFooter href="/inbox/email" label="Abrir caixa de entrada" />
      </CardBody>
    </AssocCard>
  );
}

/* ───────────── campanhas de e-mail ───────────── */

type BroadcastRecipientRow = {
  id: string;
  status: string | null;
  sent_at: string | null;
  error: string | null;
  created_at: string;
  email_broadcasts: { id: string; name: string | null; subject: string | null } | null;
};

async function loadBroadcasts(leadId: string): Promise<BroadcastRecipientRow[]> {
  const { data, error } = await supabase
    .from("email_broadcast_recipients")
    .select("id, status, sent_at, error, created_at, email_broadcasts(id, name, subject)")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as BroadcastRecipientRow[];
}

const RECIPIENT_STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  sent: "Enviado",
  failed: "Falhou",
  skipped: "Ignorado",
  unsubscribed: "Descadastrado",
};

export function LeadBroadcastsCard({ entityId }: { entityId: string }) {
  const { rows, loading, error } = useLeadRelated(entityId, loadBroadcasts);
  return (
    <AssocCard
      icon={<Megaphone className="w-4 h-4" />}
      title="Campanhas de e-mail"
      count={rows.length}
    >
      <CardBody
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyLabel="Nenhuma campanha enviada."
      >
        <List>
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-border/60 p-3">
              <ItemTitle>
                {r.email_broadcasts?.name || r.email_broadcasts?.subject || "Campanha"}
              </ItemTitle>
              <ItemMeta>
                {r.status ? (RECIPIENT_STATUS_LABEL[r.status] ?? r.status) : "—"}
                {r.sent_at ? ` · ${formatDateTime(r.sent_at)}` : ""}
              </ItemMeta>
              {r.error && <ItemMeta>Erro: {r.error}</ItemMeta>}
            </li>
          ))}
        </List>
        <ViewAllFooter href="/campaigns/email" label="Exibir todas as Campanhas" />
      </CardBody>
    </AssocCard>
  );
}

/* ───────────── prospecção (origem, cadências e filas) ───────────── */

type ProspectingBundle = {
  kind: "origin" | "enrollment" | "queue";
  id: string;
  title: string;
  meta: string | null;
};

const ENROLLMENT_STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  paused: "Pausada",
  completed: "Concluída",
  handoff: "Repassada",
};

async function loadProspecting(leadId: string): Promise<ProspectingBundle[]> {
  const [origin, enrollments, queueItems] = await Promise.all([
    supabase
      .from("prospecting_results")
      .select("id, contact_name, company_name, source, imported_at")
      .eq("imported_lead_id", leadId)
      .limit(3),
    supabase
      .from("sdr_enrollments")
      .select("id, status, messages_sent, last_action_at, created_at, sdr_playbooks(id, name)")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("task_queue_items")
      .select("id, completed_at, skipped_at, created_at, task_queues(id, name)")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);
  const firstError = origin.error ?? enrollments.error ?? queueItems.error;
  if (firstError) throw new Error(firstError.message);

  const out: ProspectingBundle[] = [];
  for (const r of (origin.data ?? []) as unknown as {
    id: string;
    company_name: string | null;
    contact_name: string | null;
    source: string | null;
    imported_at: string | null;
  }[]) {
    out.push({
      kind: "origin",
      id: r.id,
      title: `Origem: ${r.contact_name || r.company_name || "prospect importado"}`,
      meta: [r.source, r.imported_at ? formatDateTime(r.imported_at) : null]
        .filter(Boolean)
        .join(" · "),
    });
  }
  for (const e of (enrollments.data ?? []) as unknown as {
    id: string;
    status: string | null;
    messages_sent: number | null;
    last_action_at: string | null;
    created_at: string;
    sdr_playbooks: { id: string; name: string | null } | null;
  }[]) {
    out.push({
      kind: "enrollment",
      id: e.id,
      title: `Cadência: ${e.sdr_playbooks?.name || "sem nome"}`,
      meta: [
        e.status ? (ENROLLMENT_STATUS_LABEL[e.status] ?? e.status) : null,
        e.messages_sent ? `${e.messages_sent} mensagem(ns)` : null,
        formatDateTime(e.last_action_at ?? e.created_at),
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }
  for (const q of (queueItems.data ?? []) as unknown as {
    id: string;
    completed_at: string | null;
    skipped_at: string | null;
    created_at: string;
    task_queues: { id: string; name: string | null } | null;
  }[]) {
    out.push({
      kind: "queue",
      id: q.id,
      title: `Fila: ${q.task_queues?.name || "sem nome"}`,
      meta: [
        q.completed_at ? "Concluído" : q.skipped_at ? "Ignorado" : "Pendente",
        formatDateTime(q.completed_at ?? q.skipped_at ?? q.created_at),
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }
  return out;
}

export function LeadProspectingCard({ entityId }: { entityId: string }) {
  const { rows, loading, error } = useLeadRelated(entityId, loadProspecting);
  return (
    <AssocCard icon={<Radar className="w-4 h-4" />} title="Prospecção" count={rows.length}>
      <CardBody
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyLabel="Nenhuma atividade de prospecção."
      >
        <List>
          {rows.map((r) => (
            <li key={`${r.kind}-${r.id}`} className="rounded-xl border border-border/60 p-3">
              <ItemTitle>{r.title}</ItemTitle>
              {r.meta && <ItemMeta>{r.meta}</ItemMeta>}
            </li>
          ))}
        </List>
        <ViewAllFooter href="/prospecting" label="Abrir Prospecção" />
      </CardBody>
    </AssocCard>
  );
}

/* ───────────── Negócio → Lead de origem ───────────── */

type OriginLeadRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company_name: string | null;
  status: string | null;
};

async function loadOriginLead(dealId: string): Promise<OriginLeadRow[]> {
  const { data, error } = await supabase
    .from("leads")
    .select("id, first_name, last_name, email, company_name, status")
    .eq("converted_deal_id", dealId)
    .is("deleted_at", null)
    .limit(5);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as OriginLeadRow[];
}

/** Lead que originou o negócio (via `leads.converted_deal_id`). Somente leitura. */
export function DealOriginLeadCard({ entityId }: { entityId: string }) {
  const { rows, loading, error } = useLeadRelated(entityId, loadOriginLead);
  return (
    <AssocCard icon={<Radar className="w-4 h-4" />} title="Lead de origem" count={rows.length}>
      <CardBody
        loading={loading}
        error={error}
        empty={rows.length === 0}
        emptyLabel="Nenhum lead de origem."
      >
        <List>
          {rows.map((l) => (
            <li key={l.id} className="rounded-xl border border-border/60 p-3">
              <Link
                to="/leads/$id"
                params={{ id: l.id }}
                className="text-xs font-semibold text-primary hover:underline break-words"
              >
                {`${l.first_name ?? ""} ${l.last_name ?? ""}`.trim() || l.email || "Sem nome"}
              </Link>
              <ItemMeta>{[l.company_name, l.email].filter(Boolean).join(" · ") || "—"}</ItemMeta>
            </li>
          ))}
        </List>
      </CardBody>
    </AssocCard>
  );
}
