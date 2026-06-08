import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Building2, User, Briefcase, Ticket as TicketIcon, ListTodo, Mail, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDateTime } from "@/lib/crm";
import { AddAssociation } from "@/components/record/add-association";
import { ContactPickerPopover } from "@/components/ui/contact-picker";
import { CreateContactDialog } from "@/components/contacts/create-contact-dialog";
import {
  QuickCreateCompanyDialog,
  QuickCreateDealDialog,
  QuickCreateTicketDialog,
} from "@/components/record/quick-create-dialogs";

export type AssociationEntity = "contact" | "lead" | "company" | "deal" | "ticket";

type Props = {
  entity: AssociationEntity;
  entityId: string;
  companyId?: string | null;
  contactId?: string | null;
  dealId?: string | null;
};

export function AssociationsPanel({ entity, entityId, companyId, contactId, dealId }: Props) {
  return (
    <>
      {(entity === "contact" || entity === "deal" || entity === "ticket") && (
        <CompanyCard entity={entity} entityId={entityId} companyId={companyId ?? null} />
      )}
      {(entity === "company" || entity === "deal") && (
        <ContactsCard entity={entity} entityId={entityId} />
      )}
      {entity === "ticket" && (
        <SingleContactCard entityId={entityId} contactId={contactId ?? null} />
      )}
      {(entity === "contact" || entity === "company") && (
        <DealsCard entity={entity} entityId={entityId} companyId={companyId} />
      )}
      {entity === "ticket" && (
        <SingleDealCard entityId={entityId} dealId={dealId ?? null} />
      )}
      {entity !== "lead" && entity !== "ticket" && (
        <TicketsCard entity={entity} entityId={entityId} companyId={companyId} />
      )}
      {entity !== "ticket" && <TasksCard entity={entity} entityId={entityId} />}
      {entity !== "ticket" && <EmailsCard entity={entity} entityId={entityId} />}
      {entity !== "ticket" && <AttachmentsCard entity={entity} entityId={entityId} />}
    </>
  );
}

/* ───────────── card primitive ───────────── */

function AssocCard({
  icon, title, count, action, children,
}: { icon: ReactNode; title: string; count?: number; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/60 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          {typeof count === "number" && (
            <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums">{count}</span>
          )}
        </div>
        {action}
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

/* ───────────── Company card (entity = contact|deal) ───────────── */

function CompanyCard({
  entity, entityId, companyId,
}: { entity: "contact" | "deal" | "ticket"; entityId: string; companyId: string | null }) {
  const [c, setC] = useState<{ id: string; name: string; industry: string | null; domain: string | null } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(companyId);

  const load = useCallback(async (id: string | null) => {
    if (!id) { setC(null); return; }
    const { data } = await supabase.from("companies").select("id, name, industry, domain").eq("id", id).maybeSingle();
    setC(data as never);
  }, []);

  useEffect(() => { setCurrentId(companyId); }, [companyId]);
  useEffect(() => { void load(currentId); }, [currentId, load]);

  const tableFor = (e: "contact" | "deal" | "ticket") =>
    e === "contact" ? "contacts" : e === "deal" ? "deals" : "tickets";

  const associate = async (id: string) => {
    const { error } = await sb.from(tableFor(entity)).update({ company_id: id }).eq("id", entityId);
    if (error) return toast.error(error.message);
    toast.success("Empresa vinculada");
    setCurrentId(id);
  };

  const unlink = async () => {
    const { error } = await sb.from(tableFor(entity)).update({ company_id: null }).eq("id", entityId);
    if (error) return toast.error(error.message);
    toast.success("Empresa desvinculada");
    setCurrentId(null);
  };


  return (
    <>
      <AssocCard
        icon={<Building2 className="w-4 h-4" />}
        title="Empresa"
        count={c ? 1 : 0}
        action={
          <AddAssociation
            entity="companies"
            select="id, name, domain"
            searchColumn="name"
            labelFrom={(r) => String((r as { name?: string }).name ?? "—")}
            hintFrom={(r) => (r as { domain?: string }).domain ?? null}
            placeholder="Buscar empresa…"
            onPick={associate}
            onCreateNew={() => setCreateOpen(true)}
            label={c ? "Trocar" : "Adicionar"}
          />
        }
      >
        {!c ? <Empty label="Nenhuma empresa vinculada." /> : (
          <div className="flex items-center gap-3 group">
            <Link to="/companies/$id" params={{ id: c.id }} className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-bold text-muted-foreground shrink-0">
                {c.name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground group-hover:text-primary truncate">{c.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">{c.domain || c.industry || "—"}</p>
              </div>
            </Link>
            <button onClick={unlink} className="p-1 text-muted-foreground hover:text-destructive rounded" aria-label="Remover">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </AssocCard>
      <QuickCreateCompanyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => void associate(id)}
      />
    </>
  );
}

/* ───────────── Contacts card (entity = company|deal) ───────────── */

function ContactsCard({ entity, entityId }: { entity: "company" | "deal"; entityId: string }) {
  const [rows, setRows] = useState<{ id: string; first_name: string; last_name: string | null; job_title: string | null }[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    (async () => {
      if (entity === "company") {
        const { data } = await supabase.from("contacts").select("id, first_name, last_name, job_title").eq("company_id", entityId).limit(50);
        setRows((data ?? []) as never);
      } else {
        const [dcRes, dealRes] = await Promise.all([
          supabase.from("deal_contacts").select("contact_id").eq("deal_id", entityId).limit(50),
          supabase.from("deals").select("primary_contact_id").eq("id", entityId).maybeSingle(),
        ]);
        const ids = new Set<string>();
        for (const r of (dcRes.data ?? [])) if (r.contact_id) ids.add(r.contact_id as string);
        const primary = (dealRes.data as { primary_contact_id?: string | null } | null)?.primary_contact_id;
        if (primary) ids.add(primary);
        if (ids.size) {
          const { data } = await supabase.from("contacts").select("id, first_name, last_name, job_title").in("id", Array.from(ids));
          setRows((data ?? []) as never);
        } else { setRows([]); }
      }
    })();
  }, [entity, entityId, tick]);

  const associate = async (contactId: string) => {
    if (entity === "company") {
      const { error } = await sb.from("contacts").update({ company_id: entityId }).eq("id", contactId);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await sb.from("deal_contacts").insert({ deal_id: entityId, contact_id: contactId });
      if (error && error.code !== "23505") return toast.error(error.message);
    }
    toast.success("Contato vinculado");
    refresh();
  };

  const unlink = async (contactId: string) => {
    if (entity === "company") {
      const { error } = await sb.from("contacts").update({ company_id: null }).eq("id", contactId);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await sb.from("deal_contacts").delete().eq("deal_id", entityId).eq("contact_id", contactId);
      if (error) return toast.error(error.message);
    }
    refresh();
  };

  return (
    <>
      <AssocCard
        icon={<User className="w-4 h-4" />}
        title="Contatos"
        count={rows.length}
        action={
          <ContactPickerPopover
            placeholder="Buscar contato…"
            onPick={associate}
            onCreateNew={() => setCreateOpen(true)}
          />
        }
      >
        {rows.length === 0 ? <Empty label="Nenhum contato vinculado." /> : (
          <ul className="space-y-2">
            {rows.map((c) => (
              <li key={c.id} className="flex items-center gap-2.5 group">
                <Link to="/contacts/$id" params={{ id: c.id }} className="flex items-center gap-2.5 min-w-0 flex-1">
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
                <button onClick={() => unlink(c.id)} className="p-1 text-muted-foreground hover:text-destructive rounded" aria-label="Remover">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </AssocCard>
      <CreateContactDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => void associate(id)}
      />
    </>
  );
}

/* ───────────── Deals card (entity = contact|company) ───────────── */

function DealsCard({
  entity, entityId, companyId,
}: { entity: "contact" | "company"; entityId: string; companyId?: string | null }) {
  const [rows, setRows] = useState<{ id: string; name: string; value: number; stage: string; currency: string }[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    (async () => {
      if (entity === "company") {
        const { data } = await supabase.from("deals").select("id, name, value, stage, currency").eq("company_id", entityId).limit(50);
        setRows((data ?? []) as never);
        return;
      }
      const primaryP = supabase.from("deals").select("id, name, value, stage, currency").eq("primary_contact_id", entityId).limit(50);
      const companyP = companyId
        ? supabase.from("deals").select("id, name, value, stage, currency").eq("company_id", companyId).limit(50)
        : Promise.resolve({ data: [] as { id: string; name: string; value: number; stage: string; currency: string }[] });
      const linkedP = supabase.from("deal_contacts").select("deal_id").eq("contact_id", entityId).limit(100);
      const [primaryRes, companyRes, linkedRes] = await Promise.all([primaryP, companyP, linkedP]);
      const linkedIds = (linkedRes.data ?? []).map((r) => r.deal_id).filter(Boolean);
      let extra: typeof rows = [];
      if (linkedIds.length) {
        const { data } = await supabase.from("deals").select("id, name, value, stage, currency").in("id", linkedIds);
        extra = (data ?? []) as typeof extra;
      }
      const map = new Map<string, typeof rows[number]>();
      for (const d of [...(primaryRes.data ?? []), ...(companyRes.data ?? []), ...extra]) map.set(d.id, d);
      setRows(Array.from(map.values()).slice(0, 50));
    })();
  }, [entity, entityId, companyId, tick]);

  const associate = async (dealId: string) => {
    if (entity === "company") {
      const { error } = await sb.from("deals").update({ company_id: entityId }).eq("id", dealId);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await sb.from("deal_contacts").insert({ deal_id: dealId, contact_id: entityId });
      if (error && error.code !== "23505") return toast.error(error.message);
    }
    toast.success("Negócio vinculado");
    refresh();
  };

  return (
    <>
      <AssocCard
        icon={<Briefcase className="w-4 h-4" />}
        title="Negócios"
        count={rows.length}
        action={
          <AddAssociation
            entity="deals"
            select="id, name, value, currency"
            searchColumn="name"
            labelFrom={(r) => String((r as { name?: string }).name ?? "—")}
            hintFrom={(r) => {
              const x = r as { value?: number; currency?: string };
              return x.value != null ? formatCurrency(x.value, x.currency ?? "BRL") : null;
            }}
            placeholder="Buscar negócio…"
            onPick={associate}
            onCreateNew={() => setCreateOpen(true)}
          />
        }
      >
        {rows.length === 0 ? <Empty label="Nenhum negócio." /> : (
          <ul className="space-y-2">
            {rows.map((d) => (
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
      <QuickCreateDealDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultCompanyId={entity === "company" ? entityId : companyId ?? null}
        defaultContactId={entity === "contact" ? entityId : null}
        onCreated={() => refresh()}
      />
    </>
  );
}

/* ───────────── Tickets card ───────────── */

function TicketsCard({
  entity, entityId, companyId,
}: { entity: AssociationEntity; entityId: string; companyId?: string | null }) {
  const [rows, setRows] = useState<{ id: string; subject: string; status: string; priority: string }[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    (async () => {
      const col = entity === "deal" ? "deal_id" : entity === "company" ? "company_id" : "contact_id";
      const { data: direct } = await supabase.from("tickets").select("id, subject, status, priority").eq(col, entityId).limit(50);
      let companyRows: typeof direct = [];
      if (entity === "contact" && companyId) {
        const { data } = await supabase.from("tickets").select("id, subject, status, priority").eq("company_id", companyId).limit(50);
        companyRows = data ?? [];
      }
      const map = new Map<string, NonNullable<typeof direct>[number]>();
      for (const t of [...(direct ?? []), ...(companyRows ?? [])]) map.set(t.id, t);
      setRows(Array.from(map.values()).slice(0, 50) as never);
    })();
  }, [entity, entityId, companyId, tick]);

  const fkCol = entity === "deal" ? "deal_id" : entity === "company" ? "company_id" : "contact_id";

  const associate = async (ticketId: string) => {
    const { error } = await sb.from("tickets").update({ [fkCol]: entityId }).eq("id", ticketId);
    if (error) return toast.error(error.message);
    toast.success("Ticket vinculado");
    refresh();
  };

  const unlink = async (ticketId: string) => {
    const { error } = await sb.from("tickets").update({ [fkCol]: null }).eq("id", ticketId);
    if (error) return toast.error(error.message);
    refresh();
  };

  return (
    <>
      <AssocCard
        icon={<TicketIcon className="w-4 h-4" />}
        title="Tickets"
        count={rows.length}
        action={
          entity === "lead" ? undefined : (
            <AddAssociation
              entity="tickets"
              select="id, subject, status, priority"
              searchColumn="subject"
              labelFrom={(r) => String((r as { subject?: string }).subject ?? "—")}
              hintFrom={(r) => {
                const x = r as { status?: string; priority?: string };
                return [x.status, x.priority].filter(Boolean).join(" · ") || null;
              }}
              placeholder="Buscar ticket…"
              onPick={associate}
              onCreateNew={() => setCreateOpen(true)}
            />
          )
        }
      >
        {rows.length === 0 ? <Empty label="Nenhum ticket." /> : (
          <ul className="space-y-2">
            {rows.map((t) => (
              <li key={t.id} className="text-xs flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">{t.subject}</p>
                  <p className="text-[10px] text-muted-foreground">{t.status} · {t.priority}</p>
                </div>
                <button onClick={() => unlink(t.id)} className="p-1 text-muted-foreground hover:text-destructive rounded" aria-label="Remover">
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </AssocCard>
      <QuickCreateTicketDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultCompanyId={entity === "company" ? entityId : companyId ?? null}
        defaultContactId={entity === "contact" ? entityId : null}
        defaultDealId={entity === "deal" ? entityId : null}
        onCreated={() => refresh()}
      />
    </>
  );
}


/* ───────────── Single Contact / Deal cards (entity = ticket) ───────────── */

function SingleContactCard({ entityId, contactId }: { entityId: string; contactId: string | null }) {
  const [c, setC] = useState<{ id: string; first_name: string | null; last_name: string | null; email: string | null; job_title: string | null } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(contactId);

  const load = useCallback(async (id: string | null) => {
    if (!id) { setC(null); return; }
    const { data } = await supabase.from("contacts").select("id, first_name, last_name, email, job_title").eq("id", id).maybeSingle();
    setC(data as never);
  }, []);

  useEffect(() => { setCurrentId(contactId); }, [contactId]);
  useEffect(() => { void load(currentId); }, [currentId, load]);

  const associate = async (id: string) => {
    const { error } = await sb.from("tickets").update({ contact_id: id }).eq("id", entityId);
    if (error) return toast.error(error.message);
    toast.success("Contato vinculado");
    setCurrentId(id);
  };

  const unlink = async () => {
    const { error } = await sb.from("tickets").update({ contact_id: null }).eq("id", entityId);
    if (error) return toast.error(error.message);
    toast.success("Contato desvinculado");
    setCurrentId(null);
  };

  return (
    <>
      <AssocCard
        icon={<User className="w-4 h-4" />}
        title="Contato"
        count={c ? 1 : 0}
        action={
          <ContactPickerPopover
            placeholder="Buscar contato…"
            onPick={associate}
            onCreateNew={() => setCreateOpen(true)}
            label={c ? "Trocar" : "Adicionar"}
          />
        }
      >
        {!c ? <Empty label="Nenhum contato vinculado." /> : (
          <div className="flex items-center gap-3 group">
            <Link to="/contacts/$id" params={{ id: c.id }} className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center font-bold text-muted-foreground shrink-0">
                {(c.first_name?.[0] ?? "?").toUpperCase()}{(c.last_name?.[0] ?? "").toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground group-hover:text-primary truncate">
                  {`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Sem nome"}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{c.email || c.job_title || "—"}</p>
              </div>
            </Link>
            <button onClick={unlink} className="p-1 text-muted-foreground hover:text-destructive rounded" aria-label="Remover">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </AssocCard>
      <CreateContactDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => void associate(id)}
      />
    </>
  );
}

function SingleDealCard({ entityId, dealId }: { entityId: string; dealId: string | null }) {
  const [d, setD] = useState<{ id: string; name: string; value: number | null; stage: string | null; currency: string | null } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(dealId);

  const load = useCallback(async (id: string | null) => {
    if (!id) { setD(null); return; }
    const { data } = await supabase.from("deals").select("id, name, value, stage, currency").eq("id", id).maybeSingle();
    setD(data as never);
  }, []);

  useEffect(() => { setCurrentId(dealId); }, [dealId]);
  useEffect(() => { void load(currentId); }, [currentId, load]);

  const associate = async (id: string) => {
    const { error } = await sb.from("tickets").update({ deal_id: id }).eq("id", entityId);
    if (error) return toast.error(error.message);
    toast.success("Negócio vinculado");
    setCurrentId(id);
  };

  const unlink = async () => {
    const { error } = await sb.from("tickets").update({ deal_id: null }).eq("id", entityId);
    if (error) return toast.error(error.message);
    toast.success("Negócio desvinculado");
    setCurrentId(null);
  };

  return (
    <>
      <AssocCard
        icon={<Briefcase className="w-4 h-4" />}
        title="Negócio"
        count={d ? 1 : 0}
        action={
          <AddAssociation
            entity="deals"
            select="id, name, value, currency"
            searchColumn="name"
            labelFrom={(r) => String((r as { name?: string }).name ?? "—")}
            hintFrom={(r) => {
              const x = r as { value?: number; currency?: string };
              return x.value != null ? formatCurrency(x.value, x.currency ?? "BRL") : null;
            }}
            placeholder="Buscar negócio…"
            onPick={associate}
            onCreateNew={() => setCreateOpen(true)}
            label={d ? "Trocar" : "Adicionar"}
          />
        }
      >
        {!d ? <Empty label="Nenhum negócio vinculado." /> : (
          <div className="flex items-center gap-3 group">
            <Link to="/deals/$id" params={{ id: d.id }} className="block p-3 border border-border/60 rounded-xl hover:bg-muted/40 transition-colors flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground mb-1 truncate">{d.name}</p>
              <div className="flex justify-between items-center gap-2">
                <span className="text-[10px] text-muted-foreground tabular-nums">{d.value != null ? formatCurrency(d.value, d.currency ?? "BRL") : "—"}</span>
                {d.stage && <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-md font-medium capitalize">{d.stage}</span>}
              </div>
            </Link>
            <button onClick={unlink} className="p-1 text-muted-foreground hover:text-destructive rounded" aria-label="Remover">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </AssocCard>
      <QuickCreateDealDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => void associate(id)}
      />
    </>
  );
}

/* ───────────── unchanged read-only cards ───────────── */

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
          {rows.map((t) => (
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
          {rows.map((e) => (
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
