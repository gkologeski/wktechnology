import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Building2, User, Briefcase, Ticket as TicketIcon, ListTodo, Mail, Paperclip } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/crm";

export type AssociationEntity = "contact" | "lead" | "company" | "deal";

type Props = {
  entity: AssociationEntity;
  entityId: string;
  /** Optional pre-resolved foreign keys to save queries */
  companyId?: string | null;
};

type Counts = {
  contacts?: number;
  companies?: number;
  deals?: number;
  tickets?: number;
  tasks?: number;
  emails?: number;
  whatsapp?: number;
  attachments?: number;
};

export function AssociationsPanel({ entity, entityId, companyId }: Props) {
  const [counts, setCounts] = useState<Counts>({});

  useEffect(() => {
    let cancelled = false;
    const c: Counts = {};
    (async () => {
      const head = { count: "exact" as const, head: true };
      // contacts in scope
      if (entity === "company") {
        const { count } = await supabase.from("contacts").select("*", head).eq("company_id", entityId);
        c.contacts = count ?? 0;
      }
      // companies
      if (entity === "contact" && companyId) c.companies = 1;
      // deals
      if (entity === "company") {
        const { count } = await supabase.from("deals").select("*", head).eq("company_id", entityId);
        c.deals = count ?? 0;
      } else if (entity === "contact") {
        const { count } = await supabase.from("deals").select("*", head).eq("primary_contact_id", entityId);
        c.deals = count ?? 0;
      }
      // tickets
      const tcol = entity === "deal" ? "deal_id" : entity === "company" ? "company_id" : entity === "contact" ? "contact_id" : null;
      if (tcol) {
        const { count } = await supabase.from("tickets").select("*", head).eq(tcol, entityId);
        c.tickets = count ?? 0;
      }
      // open tasks
      const relCol = entity === "deal" ? "related_deal_id" : entity === "company" ? "related_company_id" : entity === "lead" ? "related_lead_id" : "related_contact_id";
      const { count: tasksOpen } = await supabase.from("activities").select("*", head)
        .eq("type", "task").eq(relCol, entityId).eq("completed", false);
      c.tasks = tasksOpen ?? 0;
      // emails (activities of type email)
      const { count: emailsCount } = await supabase.from("activities").select("*", head)
        .eq("type", "email").eq(relCol, entityId);
      c.emails = emailsCount ?? 0;
      // attachments: activities with attachments != []
      const { data: attRows } = await supabase.from("activities").select("attachments")
        .eq(relCol, entityId).not("attachments", "is", null).limit(200);
      const totalAtt = (attRows ?? []).reduce((acc, r) => acc + ((r as { attachments?: unknown[] }).attachments?.length ?? 0), 0);
      c.attachments = totalAtt;

      if (!cancelled) setCounts(c);
    })();
    return () => { cancelled = true; };
  }, [entity, entityId, companyId]);

  return (
    <aside className="space-y-3">
      {/* Empresa (para contato) */}
      {entity === "contact" && companyId && (
        <CompanyCard companyId={companyId} />
      )}

      {/* Contatos (para empresa/negócio) */}
      {(entity === "company" || entity === "deal") && (
        <ContactsCard entity={entity} entityId={entityId} count={counts.contacts} />
      )}

      {/* Negócios */}
      {(entity === "contact" || entity === "company") && (
        <DealsCard entity={entity} entityId={entityId} count={counts.deals} />
      )}

      {/* Tickets */}
      {entity !== "lead" && (
        <TicketsCard entity={entity} entityId={entityId} count={counts.tickets} />
      )}

      <TasksCard entity={entity} entityId={entityId} count={counts.tasks} />
      <EmailsCard entity={entity} entityId={entityId} count={counts.emails} />
      <AttachmentsCard entity={entity} entityId={entityId} count={counts.attachments} />
    </aside>
  );
}

/* ───────────── card primitive ───────────── */

function AssocCard({
  icon, title, count, action, children, defaultOpen = true,
}: { icon: ReactNode; title: string; count?: number; action?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border bg-card">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/40"
      >
        <span className="flex items-center gap-2">
          {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          {icon}
          {title}
          {typeof count === "number" && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs tabular-nums">{count}</Badge>
          )}
        </span>
        {action && <span onClick={e => e.stopPropagation()}>{action}</span>}
      </button>
      {open && <div className="border-t px-3 py-2 text-sm">{children}</div>}
    </div>
  );
}

const EmptyRow = ({ label }: { label: string }) => (
  <p className="text-xs text-muted-foreground py-1">{label}</p>
);

/* ───────────── individual cards ───────────── */

function CompanyCard({ companyId }: { companyId: string }) {
  const [c, setC] = useState<{ id: string; name: string; industry: string | null; domain: string | null } | null>(null);
  useEffect(() => {
    supabase.from("companies").select("id, name, industry, domain").eq("id", companyId).maybeSingle()
      .then(({ data }) => setC(data as never));
  }, [companyId]);
  return (
    <AssocCard icon={<Building2 className="h-4 w-4 text-muted-foreground" />} title="Empresa">
      {c ? (
        <div className="space-y-0.5">
          <Link to="/companies/$id" params={{ id: c.id }} className="text-primary hover:underline font-medium">{c.name}</Link>
          {c.industry && <p className="text-xs text-muted-foreground">{c.industry}</p>}
          {c.domain && <p className="text-xs text-muted-foreground">{c.domain}</p>}
        </div>
      ) : <EmptyRow label="Carregando..." />}
    </AssocCard>
  );
}

function ContactsCard({ entity, entityId, count }: { entity: AssociationEntity; entityId: string; count?: number }) {
  const [rows, setRows] = useState<{ id: string; first_name: string; last_name: string | null; email: string | null; job_title: string | null }[]>([]);
  useEffect(() => {
    (async () => {
      if (entity === "company") {
        const { data } = await supabase.from("contacts").select("id, first_name, last_name, email, job_title").eq("company_id", entityId).limit(10);
        setRows((data ?? []) as never);
      } else if (entity === "deal") {
        const { data: dc } = await supabase.from("deal_contacts").select("contact_id").eq("deal_id", entityId).limit(10);
        const ids = (dc ?? []).map(r => r.contact_id);
        if (ids.length) {
          const { data } = await supabase.from("contacts").select("id, first_name, last_name, email, job_title").in("id", ids);
          setRows((data ?? []) as never);
        }
      }
    })();
  }, [entity, entityId]);
  return (
    <AssocCard icon={<User className="h-4 w-4 text-muted-foreground" />} title="Contatos" count={count ?? rows.length}>
      {rows.length === 0 ? <EmptyRow label="Nenhum contato vinculado." /> : (
        <ul className="space-y-1.5">
          {rows.map(c => (
            <li key={c.id} className="text-sm">
              <Link to="/contacts/$id" params={{ id: c.id }} className="text-primary hover:underline">
                {`${c.first_name} ${c.last_name ?? ""}`.trim() || "Sem nome"}
              </Link>
              {c.job_title && <span className="text-xs text-muted-foreground"> · {c.job_title}</span>}
            </li>
          ))}
        </ul>
      )}
    </AssocCard>
  );
}

function DealsCard({ entity, entityId, count }: { entity: AssociationEntity; entityId: string; count?: number }) {
  const [rows, setRows] = useState<{ id: string; name: string; value: number; stage: string; currency: string }[]>([]);
  useEffect(() => {
    (async () => {
      const col = entity === "company" ? "company_id" : "primary_contact_id";
      const { data } = await supabase.from("deals").select("id, name, value, stage, currency").eq(col, entityId).limit(10);
      setRows((data ?? []) as never);
    })();
  }, [entity, entityId]);
  return (
    <AssocCard icon={<Briefcase className="h-4 w-4 text-muted-foreground" />} title="Negócios" count={count ?? rows.length}>
      {rows.length === 0 ? <EmptyRow label="Nenhum negócio." /> : (
        <ul className="space-y-1.5">
          {rows.map(d => (
            <li key={d.id} className="text-sm">
              <Link to="/deals/$id" params={{ id: d.id }} className="text-primary hover:underline">{d.name}</Link>
              <div className="text-xs text-muted-foreground">{formatCurrency(d.value, d.currency)} · {d.stage}</div>
            </li>
          ))}
        </ul>
      )}
    </AssocCard>
  );
}

function TicketsCard({ entity, entityId, count }: { entity: AssociationEntity; entityId: string; count?: number }) {
  const [rows, setRows] = useState<{ id: string; subject: string; status: string; priority: string }[]>([]);
  useEffect(() => {
    const col = entity === "deal" ? "deal_id" : entity === "company" ? "company_id" : "contact_id";
    supabase.from("tickets").select("id, subject, status, priority").eq(col, entityId).limit(10)
      .then(({ data }) => setRows((data ?? []) as never));
  }, [entity, entityId]);
  return (
    <AssocCard icon={<TicketIcon className="h-4 w-4 text-muted-foreground" />} title="Tickets" count={count ?? rows.length} defaultOpen={false}>
      {rows.length === 0 ? <EmptyRow label="Nenhum ticket." /> : (
        <ul className="space-y-1.5">
          {rows.map(t => (
            <li key={t.id} className="text-sm">
              <Link to="/tickets" className="text-primary hover:underline">{t.subject}</Link>
              <div className="text-xs text-muted-foreground">{t.status} · {t.priority}</div>
            </li>
          ))}
        </ul>
      )}
    </AssocCard>
  );
}

function TasksCard({ entity, entityId, count }: { entity: AssociationEntity; entityId: string; count?: number }) {
  const [rows, setRows] = useState<{ id: string; subject: string | null; due_date: string | null; task_status: string | null }[]>([]);
  useEffect(() => {
    const col = entity === "deal" ? "related_deal_id" : entity === "company" ? "related_company_id" : entity === "lead" ? "related_lead_id" : "related_contact_id";
    supabase.from("activities").select("id, subject, due_date, task_status").eq("type", "task").eq("completed", false).eq(col, entityId)
      .order("due_date", { ascending: true }).limit(10)
      .then(({ data }) => setRows((data ?? []) as never));
  }, [entity, entityId]);
  return (
    <AssocCard icon={<ListTodo className="h-4 w-4 text-muted-foreground" />} title="Tarefas abertas" count={count ?? rows.length} defaultOpen={false}>
      {rows.length === 0 ? <EmptyRow label="Nenhuma tarefa aberta." /> : (
        <ul className="space-y-1.5">
          {rows.map(t => (
            <li key={t.id} className="text-sm">
              <Link to="/tasks/$id" params={{ id: t.id }} className="text-primary hover:underline">{t.subject || "(sem assunto)"}</Link>
              {t.due_date && <div className="text-xs text-muted-foreground">Vence {formatDateTime(t.due_date)}</div>}
            </li>
          ))}
        </ul>
      )}
    </AssocCard>
  );
}

function EmailsCard({ entity, entityId, count }: { entity: AssociationEntity; entityId: string; count?: number }) {
  const [rows, setRows] = useState<{ id: string; subject: string | null; created_at: string; hs_createdate: string | null }[]>([]);
  useEffect(() => {
    const col = entity === "deal" ? "related_deal_id" : entity === "company" ? "related_company_id" : entity === "lead" ? "related_lead_id" : "related_contact_id";
    supabase.from("activities").select("id, subject, created_at, hs_createdate").eq("type", "email").eq(col, entityId)
      .order("hs_createdate", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(5)
      .then(({ data }) => setRows((data ?? []) as never));
  }, [entity, entityId]);
  return (
    <AssocCard icon={<Mail className="h-4 w-4 text-muted-foreground" />} title="Emails recentes" count={count ?? rows.length} defaultOpen={false}>
      {rows.length === 0 ? <EmptyRow label="Nenhum email." /> : (
        <ul className="space-y-1.5">
          {rows.map(e => (
            <li key={e.id} className="text-sm">
              <span className="font-medium">{e.subject || "(sem assunto)"}</span>
              <div className="text-xs text-muted-foreground">{formatDateTime(e.hs_createdate ?? e.created_at)}</div>
            </li>
          ))}
        </ul>
      )}
    </AssocCard>
  );
}

function AttachmentsCard({ entity, entityId, count }: { entity: AssociationEntity; entityId: string; count?: number }) {
  const [rows, setRows] = useState<{ name: string; path: string }[]>([]);
  useEffect(() => {
    const col = entity === "deal" ? "related_deal_id" : entity === "company" ? "related_company_id" : entity === "lead" ? "related_lead_id" : "related_contact_id";
    supabase.from("activities").select("attachments").eq(col, entityId).not("attachments", "is", null).limit(100)
      .then(({ data }) => {
        const flat: { name: string; path: string }[] = [];
        for (const r of data ?? []) {
          const atts = (r as { attachments?: { name: string; path: string }[] }).attachments ?? [];
          for (const a of atts) flat.push({ name: a.name, path: a.path });
        }
        setRows(flat.slice(0, 10));
      });
  }, [entity, entityId]);
  const open = async (path: string) => {
    const { data } = await supabase.storage.from("notes-attachments").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };
  return (
    <AssocCard icon={<Paperclip className="h-4 w-4 text-muted-foreground" />} title="Anexos" count={count ?? rows.length} defaultOpen={false}>
      {rows.length === 0 ? <EmptyRow label="Nenhum anexo." /> : (
        <ul className="space-y-1">
          {rows.map((a, i) => (
            <li key={i}>
              <button onClick={() => open(a.path)} className="text-sm text-primary hover:underline truncate text-left w-full">{a.name}</button>
            </li>
          ))}
        </ul>
      )}
    </AssocCard>
  );
}
