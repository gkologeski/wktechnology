import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Building2, User, Briefcase, Ticket as TicketIcon, ListTodo, Mail, Paperclip } from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/crm";

export type AssociationEntity = "contact" | "lead" | "company" | "deal";

type Props = {
  entity: AssociationEntity;
  entityId: string;
  companyId?: string | null;
};

export function AssociationsPanel({ entity, entityId, companyId }: Props) {
  return (
    <>
      {entity === "contact" && companyId && <CompanyCard companyId={companyId} />}
      {(entity === "company" || entity === "deal") && <ContactsCard entity={entity} entityId={entityId} />}
      {(entity === "contact" || entity === "company") && <DealsCard entity={entity} entityId={entityId} companyId={companyId} />}
      {entity !== "lead" && <TicketsCard entity={entity} entityId={entityId} companyId={companyId} />}
      <TasksCard entity={entity} entityId={entityId} />
      <EmailsCard entity={entity} entityId={entityId} />
      <AttachmentsCard entity={entity} entityId={entityId} />
    </>
  );
}

/* ───────────── card primitive ───────────── */

function AssocCard({
  icon, title, count, children,
}: { icon: ReactNode; title: string; count?: number; children: ReactNode }) {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/60 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
        </div>
        {typeof count === "number" && (
          <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums">{count}</span>
        )}
      </div>
      {children}
    </div>
  );
}

const Empty = ({ label }: { label: string }) => (
  <p className="text-xs text-muted-foreground">{label}</p>
);

const relCol = (entity: AssociationEntity) =>
  entity === "deal" ? "related_deal_id"
  : entity === "company" ? "related_company_id"
  : entity === "lead" ? "related_lead_id"
  : "related_contact_id";

/* ───────────── cards ───────────── */

function CompanyCard({ companyId }: { companyId: string }) {
  const [c, setC] = useState<{ id: string; name: string; industry: string | null; domain: string | null } | null>(null);
  useEffect(() => {
    supabase.from("companies").select("id, name, industry, domain").eq("id", companyId).maybeSingle()
      .then(({ data }) => setC(data as never));
  }, [companyId]);
  return (
    <AssocCard icon={<Building2 className="w-4 h-4" />} title="Empresa" count={c ? 1 : 0}>
      {!c ? <Empty label="—" /> : (
        <Link to="/companies/$id" params={{ id: c.id }} className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-bold text-muted-foreground shrink-0">
            {c.name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground group-hover:text-primary truncate">{c.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{c.domain || c.industry || "—"}</p>
          </div>
        </Link>
      )}
    </AssocCard>
  );
}

function ContactsCard({ entity, entityId }: { entity: AssociationEntity; entityId: string }) {
  const [rows, setRows] = useState<{ id: string; first_name: string; last_name: string | null; job_title: string | null }[]>([]);
  useEffect(() => {
    (async () => {
      if (entity === "company") {
        const { data } = await supabase.from("contacts").select("id, first_name, last_name, job_title").eq("company_id", entityId).limit(10);
        setRows((data ?? []) as never);
      } else if (entity === "deal") {
        const { data: dc } = await supabase.from("deal_contacts").select("contact_id").eq("deal_id", entityId).limit(10);
        const ids = (dc ?? []).map(r => r.contact_id);
        if (ids.length) {
          const { data } = await supabase.from("contacts").select("id, first_name, last_name, job_title").in("id", ids);
          setRows((data ?? []) as never);
        }
      }
    })();
  }, [entity, entityId]);
  return (
    <AssocCard icon={<User className="w-4 h-4" />} title="Contatos" count={rows.length}>
      {rows.length === 0 ? <Empty label="Nenhum contato vinculado." /> : (
        <ul className="space-y-2">
          {rows.map(c => (
            <li key={c.id}>
              <Link to="/contacts/$id" params={{ id: c.id }} className="flex items-center gap-2.5 group">
                <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                  {(c.first_name?.[0] ?? "?").toUpperCase()}{(c.last_name?.[0] ?? "").toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground group-hover:text-primary truncate">
                    {`${c.first_name} ${c.last_name ?? ""}`.trim() || "Sem nome"}
                  </p>
                  {c.job_title && <p className="text-[10px] text-muted-foreground truncate">{c.job_title}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AssocCard>
  );
}

function DealsCard({ entity, entityId }: { entity: AssociationEntity; entityId: string }) {
  const [rows, setRows] = useState<{ id: string; name: string; value: number; stage: string; currency: string }[]>([]);
  useEffect(() => {
    (async () => {
      if (entity === "company") {
        const { data } = await supabase.from("deals").select("id, name, value, stage, currency").eq("company_id", entityId).limit(20);
        setRows((data ?? []) as never);
        return;
      }
      // contact: combine deals where contact is primary OR linked via deal_contacts
      const [{ data: primary }, { data: linked }] = await Promise.all([
        supabase.from("deals").select("id, name, value, stage, currency").eq("primary_contact_id", entityId).limit(20),
        supabase.from("deal_contacts").select("deal_id").eq("contact_id", entityId).limit(50),
      ]);
      const linkedIds = (linked ?? []).map(r => r.deal_id).filter(Boolean);
      let extra: typeof primary = [];
      if (linkedIds.length) {
        const { data } = await supabase.from("deals").select("id, name, value, stage, currency").in("id", linkedIds);
        extra = data ?? [];
      }
      const map = new Map<string, NonNullable<typeof primary>[number]>();
      for (const d of [...(primary ?? []), ...(extra ?? [])]) map.set(d.id, d);
      setRows(Array.from(map.values()).slice(0, 20) as never);
    })();
  }, [entity, entityId]);
  return (
    <AssocCard icon={<Briefcase className="w-4 h-4" />} title="Negócios" count={rows.length}>
      {rows.length === 0 ? <Empty label="Nenhum negócio." /> : (
        <ul className="space-y-2">
          {rows.map(d => (
            <li key={d.id}>
              <Link to="/deals/$id" params={{ id: d.id }}
                className="block p-3 border border-border/60 rounded-xl hover:bg-muted/40 transition-colors">
                <p className="text-xs font-semibold text-foreground mb-1 truncate">{d.name}</p>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground tabular-nums">{formatCurrency(d.value, d.currency)}</span>
                  <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-md font-medium capitalize">{d.stage}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AssocCard>
  );
}

function TicketsCard({ entity, entityId }: { entity: AssociationEntity; entityId: string }) {
  const [rows, setRows] = useState<{ id: string; subject: string; status: string; priority: string }[]>([]);
  useEffect(() => {
    const col = entity === "deal" ? "deal_id" : entity === "company" ? "company_id" : "contact_id";
    supabase.from("tickets").select("id, subject, status, priority").eq(col, entityId).limit(10)
      .then(({ data }) => setRows((data ?? []) as never));
  }, [entity, entityId]);
  return (
    <AssocCard icon={<TicketIcon className="w-4 h-4" />} title="Tickets" count={rows.length}>
      {rows.length === 0 ? <Empty label="Nenhum ticket." /> : (
        <ul className="space-y-2">
          {rows.map(t => (
            <li key={t.id} className="text-xs">
              <p className="font-semibold text-foreground truncate">{t.subject}</p>
              <p className="text-[10px] text-muted-foreground">{t.status} · {t.priority}</p>
            </li>
          ))}
        </ul>
      )}
    </AssocCard>
  );
}

function TasksCard({ entity, entityId }: { entity: AssociationEntity; entityId: string }) {
  const [rows, setRows] = useState<{ id: string; subject: string | null; due_date: string | null }[]>([]);
  useEffect(() => {
    supabase.from("activities").select("id, subject, due_date").eq("type", "task").eq("completed", false).eq(relCol(entity), entityId)
      .order("due_date", { ascending: true }).limit(10)
      .then(({ data }) => setRows((data ?? []) as never));
  }, [entity, entityId]);
  return (
    <AssocCard icon={<ListTodo className="w-4 h-4" />} title="Tarefas abertas" count={rows.length}>
      {rows.length === 0 ? <Empty label="Nenhuma tarefa aberta." /> : (
        <ul className="space-y-2">
          {rows.map(t => (
            <li key={t.id}>
              <Link to="/tasks/$id" params={{ id: t.id }} className="block group">
                <p className="text-xs font-semibold text-foreground group-hover:text-primary truncate">{t.subject || "(sem assunto)"}</p>
                {t.due_date && <p className="text-[10px] text-muted-foreground">Vence {formatDateTime(t.due_date)}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AssocCard>
  );
}

function EmailsCard({ entity, entityId }: { entity: AssociationEntity; entityId: string }) {
  const [rows, setRows] = useState<{ id: string; subject: string | null; created_at: string; hs_createdate: string | null }[]>([]);
  useEffect(() => {
    supabase.from("activities").select("id, subject, created_at, hs_createdate").eq("type", "email").eq(relCol(entity), entityId)
      .order("hs_createdate", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(5)
      .then(({ data }) => setRows((data ?? []) as never));
  }, [entity, entityId]);
  return (
    <AssocCard icon={<Mail className="w-4 h-4" />} title="Emails recentes" count={rows.length}>
      {rows.length === 0 ? <Empty label="Nenhum email." /> : (
        <ul className="space-y-2">
          {rows.map(e => (
            <li key={e.id} className="text-xs">
              <p className="font-semibold text-foreground truncate">{e.subject || "(sem assunto)"}</p>
              <p className="text-[10px] text-muted-foreground">{formatDateTime(e.hs_createdate ?? e.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </AssocCard>
  );
}

function AttachmentsCard({ entity, entityId }: { entity: AssociationEntity; entityId: string }) {
  const [rows, setRows] = useState<{ name: string; path: string; type?: string }[]>([]);
  useEffect(() => {
    supabase.from("activities").select("attachments").eq(relCol(entity), entityId).not("attachments", "is", null).limit(100)
      .then(({ data }) => {
        const flat: { name: string; path: string; type?: string }[] = [];
        for (const r of data ?? []) {
          const atts = (r as { attachments?: { name: string; path: string; type?: string }[] }).attachments ?? [];
          for (const a of atts) flat.push(a);
        }
        setRows(flat.slice(0, 10));
      });
  }, [entity, entityId]);
  const open = async (path: string) => {
    const { data } = await supabase.storage.from("notes-attachments").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };
  const ext = (n: string) => n.split(".").pop()?.toUpperCase().slice(0, 4) || "FILE";
  return (
    <AssocCard icon={<Paperclip className="w-4 h-4" />} title="Anexos" count={rows.length}>
      {rows.length === 0 ? <Empty label="Nenhum anexo." /> : (
        <ul className="space-y-2">
          {rows.map((a, i) => (
            <li key={i}>
              <button onClick={() => open(a.path)} className="flex items-center gap-2 text-xs text-muted-foreground group w-full text-left">
                <span className="w-6 h-6 rounded bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold shrink-0">{ext(a.name)}</span>
                <span className="group-hover:text-primary truncate">{a.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </AssocCard>
  );
}
