import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRefreshCallback } from "@/hooks/use-refresh-callback";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  Building2,
  User,
  Briefcase,
  Ticket as TicketIcon,
  ListTodo,
  Mail,
  Paperclip,
  X,
  Eye,
  MoreHorizontal,
  Copy,
  ArrowRight,
  Tag,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const emitTimelineRefresh = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("timeline:refresh"));
  }
};

import { formatCurrency, formatDateTime } from "@/lib/crm";
import { AddAssociation } from "@/components/record/add-association";
import { ContactPickerPopover } from "@/components/ui/contact-picker";
import { CreateContactDialog } from "@/components/contacts/create-contact-dialog";
import {
  QuickCreateCompanyDialog,
  QuickCreateDealDialog,
  QuickCreateTicketDialog,
} from "@/components/record/quick-create-dialogs";
import {
  AssociatePeriodDialog,
  periodToDays,
  type AssociationPeriod,
} from "@/components/associations/associate-period-dialog";
import { propagateAssociationHistory } from "@/lib/associations.functions";
import { usePipelines, type PipelineStage } from "@/lib/pipelines";
import type { AssociationKind } from "@/lib/associations.functions";

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
      {entity === "lead" && <ConvertedFromLeadCard entityId={entityId} />}
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
      {entity === "ticket" && <SingleDealCard entityId={entityId} dealId={dealId ?? null} />}
      {entity !== "lead" && entity !== "ticket" && (
        <TicketsCard entity={entity} entityId={entityId} companyId={companyId} />
      )}
      {entity !== "ticket" && <TasksCard entity={entity} entityId={entityId} />}
      {entity !== "ticket" && <EmailsCard entity={entity} entityId={entityId} />}
      {entity !== "ticket" && <AttachmentsCard entity={entity} entityId={entityId} />}
    </>
  );
}

/* ───────────── Converted-from-lead card (entity = lead) ───────────── */

function ConvertedFromLeadCard({ entityId }: { entityId: string }) {
  const [state, setState] = useState<{
    convertedAt: string | null;
    deal: { id: string; name: string | null; value: number | null; currency: string | null; stage: string | null } | null;
    contact: { id: string; first_name: string | null; last_name: string | null } | null;
    dealMissing: boolean;
    hasConversion: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: lead } = await supabase
        .from("leads")
        .select("converted_contact_id, converted_deal_id, converted_at")
        .eq("id", entityId)
        .maybeSingle();
      const dealId = (lead as { converted_deal_id?: string | null } | null)?.converted_deal_id ?? null;
      const contactId = (lead as { converted_contact_id?: string | null } | null)?.converted_contact_id ?? null;
      const convertedAt = (lead as { converted_at?: string | null } | null)?.converted_at ?? null;
      if (!dealId && !contactId && !convertedAt) {
        if (!cancelled) setState({ convertedAt: null, deal: null, contact: null, dealMissing: false, hasConversion: false });
        return;
      }
      let deal: { id: string; name: string | null; value: number | null; currency: string | null; stage: string | null } | null = null;
      let dealMissing = false;
      if (dealId) {
        const { data: d } = await supabase
          .from("deals")
          .select("id, name, value, currency, stage")
          .eq("id", dealId)
          .maybeSingle();
        deal = (d as typeof deal) ?? null;
        dealMissing = !deal;
      }
      let contact: { id: string; first_name: string | null; last_name: string | null } | null = null;
      if (contactId) {
        const { data: c } = await supabase
          .from("contacts")
          .select("id, first_name, last_name")
          .eq("id", contactId)
          .maybeSingle();
        contact = (c as typeof contact) ?? null;
      }
      if (!cancelled) setState({ convertedAt, deal, contact, dealMissing, hasConversion: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  if (!state || !state.hasConversion) return null;
  const { deal, contact, convertedAt, dealMissing } = state;

  return (
    <AssocCard icon={<Briefcase className="w-4 h-4" />} title="Convertido em negócio" count={deal ? 1 : 0}>
      <div className="space-y-3">
        {deal ? (
          <div className="rounded-xl border border-border/60 p-3 group hover:border-border transition-colors">
            <div className="flex items-start gap-3">
              <EntityAvatar initials={(deal.name?.[0] ?? "N").toUpperCase()} tone="primary" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    to="/deals/$id"
                    params={{ id: deal.id }}
                    className="text-sm font-semibold text-primary hover:underline break-words min-w-0"
                  >
                    {deal.name ?? "Sem nome"}
                  </Link>
                  {deal.stage && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-muted text-foreground font-medium">
                      {deal.stage}
                    </span>
                  )}
                </div>
                {typeof deal.value === "number" && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatCurrency(deal.value, deal.currency ?? "BRL")}
                  </div>
                )}
              </div>
              <AssocItemActions link={{ to: "/deals/$id", params: { id: deal.id } }} />
            </div>
          </div>
        ) : dealMissing ? (
          <Empty label="Negócio removido." />
        ) : null}

        {contact && (
          <div className="rounded-xl border border-border/60 p-3 group hover:border-border transition-colors">
            <div className="flex items-start gap-3">
              <EntityAvatar
                initials={((contact.first_name?.[0] ?? "?") + (contact.last_name?.[0] ?? "")).toUpperCase()}
              />
              <div className="min-w-0 flex-1">
                <Link
                  to="/contacts/$id"
                  params={{ id: contact.id }}
                  className="text-sm font-semibold text-primary hover:underline break-words min-w-0"
                >
                  {`${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Sem nome"}
                </Link>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mt-0.5">
                  Contato criado
                </div>
              </div>
              <AssocItemActions link={{ to: "/contacts/$id", params: { id: contact.id } }} />
            </div>
          </div>
        )}

        {convertedAt && (
          <p className="text-[11px] text-muted-foreground">
            Convertido em {formatDateTime(convertedAt)}
          </p>
        )}
      </div>
    </AssocCard>
  );
}


/* ───────────── card primitive ───────────── */

function AssocCard({
  icon,
  title,
  count,
  action,
  children,
}: {
  icon: ReactNode;
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/60 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          {typeof count === "number" && (
            <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-[10px] font-bold tabular-nums">
              {count}
            </span>
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

function CopyButton({ value, label }: { value: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(value).then(
          () => toast.success(`${label ?? "Valor"} copiado`),
          () => toast.error("Falha ao copiar"),
        );
      }}
      className="inline-flex items-center justify-center p-1 text-muted-foreground hover:text-primary rounded transition-colors"
      aria-label={`Copiar ${label ?? "valor"}`}
    >
      <Copy className="h-3 w-3" />
    </button>
  );
}

function DetailRow({
  label,
  value,
  href,
  copyable,
}: {
  label: string;
  value: string | null | undefined;
  href?: string;
  copyable?: boolean;
}) {
  const v = value && String(value).trim() ? String(value).trim() : null;
  if (!v) return null;
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </div>
      <div className="flex items-center justify-between gap-2 min-w-0">
        {href ? (
          <a
            href={href}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-foreground hover:text-primary hover:underline break-words min-w-0 flex-1"
          >
            {v}
          </a>
        ) : (
          <span className="text-xs text-foreground break-words min-w-0 flex-1">{v}</span>
        )}
        {copyable && <CopyButton value={v} label={label} />}
      </div>
    </div>
  );
}

type AssocLinkTarget =
  | { to: "/companies/$id"; params: { id: string } }
  | { to: "/contacts/$id"; params: { id: string } }
  | { to: "/deals/$id"; params: { id: string } }
  | { to: "/tickets/$id"; params: { id: string } };


function AssocItemActions({
  link,
  onUnlink,
}: {
  link?: AssocLinkTarget;
  onUnlink?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      data-state={open ? "open" : "closed"}
      className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 data-[state=open]:opacity-100 transition-opacity"
    >
      {link && (
        <Link
          {...(link as { to: "/companies/$id"; params: { id: string } })}
          onClick={(e) => e.stopPropagation()}
          className="p-1 text-muted-foreground hover:text-primary hover:bg-muted rounded transition-colors"
          aria-label="Abrir"
          title="Abrir registro"
        >
          <Eye className="h-3.5 w-3.5" />
        </Link>
      )}
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
            aria-label="Mais ações"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {link && (
            <DropdownMenuItem asChild>
              <Link {...(link as { to: "/companies/$id"; params: { id: string } })}>
                Abrir registro
              </Link>
            </DropdownMenuItem>
          )}
          {onUnlink && (
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={onUnlink}
            >
              Remover associação
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}


function AssocLabelAdder() {
  return (
    <button
      type="button"
      onClick={() => toast.message("Rótulos de associação em breve")}
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors mt-2"
    >
      <Tag className="h-3 w-3" />
      Adicionar rótulo
    </button>
  );
}

function ViewAllFooter({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      {label}
      <ArrowRight className="h-3 w-3" />
    </a>
  );
}

function EntityAvatar({ initials, tone = "muted" }: { initials: string; tone?: "muted" | "primary" }) {
  return (
    <div
      className={
        "w-9 h-9 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 " +
        (tone === "primary"
          ? "bg-primary/10 text-primary"
          : "bg-muted text-muted-foreground")
      }
    >
      {initials}
    </div>
  );
}



const relCol = (entity: AssociationEntity) =>
  entity === "deal"
    ? "related_deal_id"
    : entity === "company"
      ? "related_company_id"
      : entity === "lead"
        ? "related_lead_id"
        : "related_contact_id";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

/**
 * Hook que adiciona o diálogo "vincular com janela de histórico" (estilo HubSpot)
 * em torno de uma operação de associação. Após o vínculo, propaga retroativamente
 * as FKs `related_*` nas atividades existentes nas duas pontas, dentro da janela.
 */
function useAssociateWithPeriod(opts: {
  sourceKind: AssociationKind;
  sourceId: string;
  targetKind: AssociationKind;
  doAssociate: (targetId: string) => Promise<unknown> | unknown;
  title?: string;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const propagate = useServerFn(propagateAssociationHistory);

  const onConfirm = async (period: AssociationPeriod) => {
    const targetId = pendingId;
    if (!targetId) return;
    await opts.doAssociate(targetId);
    try {
      const r = await propagate({
        data: {
          sourceKind: opts.sourceKind,
          sourceId: opts.sourceId,
          targetKind: opts.targetKind,
          targetId,
          windowDays: periodToDays(period),
        },
      });
      const total = (r?.propagatedFromSource ?? 0) + (r?.propagatedFromTarget ?? 0);
      if (total > 0) toast.success(`${total} atividade(s) trazidas para a timeline`);
    } catch (e) {
      toast.error("Falha ao propagar histórico: " + (e as Error).message);
    }
    setPendingId(null);
  };

  const dialog = (
    <AssociatePeriodDialog
      open={!!pendingId}
      onOpenChange={(o) => {
        if (!o) setPendingId(null);
      }}
      title={opts.title}
      onConfirm={onConfirm}
    />
  );

  return { request: (id: string) => setPendingId(id), dialog };
}


/* ───────────── Company card (entity = contact|deal) ───────────── */

function CompanyCard({
  entity,
  entityId,
  companyId,
}: {
  entity: "contact" | "deal" | "ticket";
  entityId: string;
  companyId: string | null;
}) {
  const [c, setC] = useState<{
    id: string;
    name: string;
    industry: string | null;
    domain: string | null;
    phone: string | null;
  } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(companyId);

  const load = useCallback(async (id: string | null) => {
    if (!id) {
      setC(null);
      return;
    }
    const { data } = await supabase
      .from("companies")
      .select("id, name, industry, domain, phone")
      .eq("id", id)
      .maybeSingle();
    setC(data as never);
  }, []);

  useEffect(() => {
    setCurrentId(companyId);
  }, [companyId]);
  useEffect(() => {
    void load(currentId);
  }, [currentId, load]);

  const tableFor = (e: "contact" | "deal" | "ticket") =>
    e === "contact" ? "contacts" : e === "deal" ? "deals" : "tickets";

  const associate = async (id: string) => {
    const { error } = await sb.from(tableFor(entity)).update({ company_id: id }).eq("id", entityId);
    if (error) return toast.error(error.message);
    toast.success("Empresa vinculada");
    emitTimelineRefresh();
    setCurrentId(id);
  };

  const { request, dialog } = useAssociateWithPeriod({
    sourceKind: entity,
    sourceId: entityId,
    targetKind: "company",
    doAssociate: associate,
    title: "Vincular empresa",
  });

  const unlink = async () => {
    const { error } = await sb
      .from(tableFor(entity))
      .update({ company_id: null })
      .eq("id", entityId);
    if (error) return toast.error(error.message);
    toast.success("Empresa desvinculada");
    emitTimelineRefresh();
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
            searchColumns={["name", "domain"]}
            labelFrom={(r) => String((r as { name?: string }).name ?? "—")}
            hintFrom={(r) => (r as { domain?: string }).domain ?? null}
            placeholder="Buscar empresa…"
            onPick={request}
            onCreateNew={() => setCreateOpen(true)}
            label={c ? "Trocar" : "Adicionar"}
          />
        }
      >
        {!c ? (
          <Empty label="Nenhuma empresa vinculada." />
        ) : (
          <>
            <div className="rounded-xl border border-border/60 p-3 group hover:border-border transition-colors">
              <div className="flex items-start gap-3">
                <EntityAvatar initials={(c.name?.[0] ?? "?").toUpperCase()} tone="primary" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to="/companies/$id"
                      params={{ id: c.id }}
                      className="text-sm font-semibold text-primary hover:underline break-words min-w-0"
                    >
                      {c.name}
                    </Link>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-muted text-foreground font-medium">
                      Principal
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    <DetailRow
                      label="Domínio"
                      value={c.domain}
                      href={c.domain ? `https://${c.domain.replace(/^https?:\/\//, "")}` : undefined}
                      copyable
                    />
                    <DetailRow label="Telefone" value={c.phone} copyable />
                  </div>
                  <AssocLabelAdder />
                </div>
                <AssocItemActions link={{ to: "/companies/$id", params: { id: c.id } }} onUnlink={unlink} />
              </div>
            </div>
            <ViewAllFooter href="/companies" label="Exibir todas as Empresas associadas" />
          </>
        )}
      </AssocCard>
      <QuickCreateCompanyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => request(id)}
      />
      {dialog}
    </>
  );
}

/* ───────────── Contacts card (entity = company|deal) ───────────── */

function ContactsCard({ entity, entityId }: { entity: "company" | "deal"; entityId: string }) {
  type ContactRow = {
    id: string;
    first_name: string | null;
    last_name: string | null;
    job_title: string | null;
    email: string | null;
    phone: string | null;
    mobile_phone: string | null;
    company: { name: string | null } | null;
  };
  const SELECT = "id, first_name, last_name, job_title, email, phone, mobile_phone, company:companies(name)";
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    (async () => {
      if (entity === "company") {
        const { data } = await supabase
          .from("contacts")
          .select(SELECT)
          .eq("company_id", entityId)
          .limit(50);
        setRows(((data ?? []) as never) as ContactRow[]);
        setPrimaryId(null);
      } else {
        const [dcRes, dealRes] = await Promise.all([
          supabase.from("deal_contacts").select("contact_id").eq("deal_id", entityId).limit(50),
          supabase.from("deals").select("primary_contact_id").eq("id", entityId).maybeSingle(),
        ]);
        const ids = new Set<string>();
        for (const r of dcRes.data ?? []) if (r.contact_id) ids.add(r.contact_id as string);
        const primary = (dealRes.data as { primary_contact_id?: string | null } | null)
          ?.primary_contact_id ?? null;
        if (primary) ids.add(primary);
        setPrimaryId(primary);
        if (ids.size) {
          const { data } = await supabase
            .from("contacts")
            .select(SELECT)
            .in("id", Array.from(ids));
          setRows(((data ?? []) as never) as ContactRow[]);
        } else {
          setRows([]);
        }
      }
    })();
  }, [entity, entityId, tick]);

  const associate = async (contactId: string) => {
    if (entity === "company") {
      const { error } = await sb
        .from("contacts")
        .update({ company_id: entityId })
        .eq("id", contactId);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await sb
        .from("deal_contacts")
        .insert({ deal_id: entityId, contact_id: contactId });
      if (error && error.code !== "23505") return toast.error(error.message);
    }
    toast.success("Contato vinculado");
    emitTimelineRefresh();
    refresh();
  };

  const { request, dialog } = useAssociateWithPeriod({
    sourceKind: entity,
    sourceId: entityId,
    targetKind: "contact",
    doAssociate: associate,
    title: "Vincular contato",
  });

  const unlink = async (contactId: string) => {
    if (entity === "company") {
      const { error } = await sb.from("contacts").update({ company_id: null }).eq("id", contactId);
      if (error) return toast.error(error.message);
    } else {
      // Remove vínculo many-to-many
      const { error } = await sb
        .from("deal_contacts")
        .delete()
        .eq("deal_id", entityId)
        .eq("contact_id", contactId);
      if (error) return toast.error(error.message);
      // Se for o contato primário do negócio, limpa também
      const { data: deal } = await supabase
        .from("deals")
        .select("primary_contact_id")
        .eq("id", entityId)
        .maybeSingle();
      if (
        (deal as { primary_contact_id?: string | null } | null)?.primary_contact_id === contactId
      ) {
        await sb.from("deals").update({ primary_contact_id: null }).eq("id", entityId);
      }
    }
    toast.success("Contato desvinculado");
    emitTimelineRefresh();
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
            onPick={request}
            onCreateNew={() => setCreateOpen(true)}
          />
        }
      >
        {rows.length === 0 ? (
          <Empty label="Nenhum contato vinculado." />
        ) : (
          <>
            <ul className="space-y-2">
              {rows.map((c) => {
                const fullName =
                  `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Sem nome";
                const initials =
                  ((c.first_name?.[0] ?? "?") + (c.last_name?.[0] ?? "")).toUpperCase();
                const companyName = c.company?.name ?? null;
                const role = c.job_title
                  ? companyName
                    ? `${c.job_title} na ${companyName}`
                    : c.job_title
                  : companyName
                    ? `Contato de ${companyName}`
                    : null;
                const phone = c.phone || c.mobile_phone || null;
                const isPrimary = entity === "deal" && primaryId === c.id;
                return (
                  <li key={c.id} className="rounded-xl border border-border/60 p-3 group hover:border-border transition-colors">
                    <div className="flex items-start gap-3">
                      <EntityAvatar initials={initials} tone="primary" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to="/contacts/$id"
                            params={{ id: c.id }}
                            className="text-sm font-semibold text-primary hover:underline break-words min-w-0"
                          >
                            {fullName}
                          </Link>
                          {isPrimary && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-muted text-foreground font-medium">
                              Principal
                            </span>
                          )}
                        </div>
                        {role && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 break-words">
                            {role}
                          </p>
                        )}
                        <div className="mt-2 space-y-1">
                          <DetailRow
                            label="E-mail"
                            value={c.email}
                            href={c.email ? `mailto:${c.email}` : undefined}
                            copyable
                          />
                          <DetailRow
                            label="Telefone"
                            value={phone}
                            href={phone ? `tel:${phone}` : undefined}
                            copyable
                          />
                        </div>
                        <AssocLabelAdder />
                      </div>
                      <AssocItemActions
                        link={{ to: "/contacts/$id", params: { id: c.id } }}
                        onUnlink={() => unlink(c.id)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <ViewAllFooter href="/contacts" label="Exibir todos os Contatos associados" />
          </>
        )}
      </AssocCard>
      <CreateContactDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => request(id)}
      />
      {dialog}
    </>
  );
}

/* ───────────── Deals card (entity = contact|company) ───────────── */

type DealRow = {
  id: string;
  name: string;
  value: number | null;
  stage: string;
  stage_id: string | null;
  currency: string;
  expected_close_date: string | null;
  pipeline_id: string | null;
};

const DEAL_SELECT =
  "id, name, value, stage, stage_id, currency, expected_close_date, pipeline_id";


function formatDealDateLong(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function StagePicker({
  dealId,
  stage,
  stages,
  onChange,
}: {
  dealId: string;
  stage: string;
  stages: PipelineStage[];
  onChange: (value: string) => void;
}) {
  const current = stages.find((s) => s.value === stage);
  const label = current?.label ?? stage;
  if (!stages.length) {
    return <span className="text-xs text-foreground">{label}</span>;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs font-semibold text-foreground hover:text-primary transition-colors"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 overflow-auto">
        {stages.map((s) => (
          <DropdownMenuItem
            key={s.value}
            onClick={() => onChange(s.value)}
            className={s.value === stage ? "font-semibold" : undefined}
          >
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DealsCard({
  entity,
  entityId,
  companyId,
}: {
  entity: "contact" | "company";
  entityId: string;
  companyId?: string | null;
}) {
  const [rows, setRows] = useState<DealRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const { pipelines } = usePipelines("deal");

  useEffect(() => {
    (async () => {
      if (entity === "company") {
        const { data } = await supabase
          .from("deals")
          .select(DEAL_SELECT)
          .eq("company_id", entityId)
          .limit(50);
        setRows(((data ?? []) as never) as DealRow[]);
        return;
      }
      const primaryP = supabase
        .from("deals")
        .select(DEAL_SELECT)
        .eq("primary_contact_id", entityId)
        .limit(50);
      const companyP = companyId
        ? supabase.from("deals").select(DEAL_SELECT).eq("company_id", companyId).limit(50)
        : Promise.resolve({ data: [] as DealRow[] });
      const linkedP = supabase
        .from("deal_contacts")
        .select("deal_id")
        .eq("contact_id", entityId)
        .limit(100);
      const [primaryRes, companyRes, linkedRes] = await Promise.all([primaryP, companyP, linkedP]);
      const linkedIds = (linkedRes.data ?? []).map((r) => r.deal_id).filter(Boolean);
      let extra: DealRow[] = [];
      if (linkedIds.length) {
        const { data } = await supabase.from("deals").select(DEAL_SELECT).in("id", linkedIds);
        extra = ((data ?? []) as never) as DealRow[];
      }
      const map = new Map<string, DealRow>();
      for (const d of [
        ...((primaryRes.data ?? []) as DealRow[]),
        ...((companyRes.data ?? []) as DealRow[]),
        ...extra,
      ])
        map.set(d.id, d);
      setRows(Array.from(map.values()).slice(0, 50));
    })();
  }, [entity, entityId, companyId, tick]);

  const associate = async (dealId: string) => {
    if (entity === "company") {
      const { error } = await sb.from("deals").update({ company_id: entityId }).eq("id", dealId);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await sb
        .from("deal_contacts")
        .insert({ deal_id: dealId, contact_id: entityId });
      if (error && error.code !== "23505") return toast.error(error.message);
    }
    toast.success("Negócio vinculado");
    emitTimelineRefresh();
    refresh();
  };

  const { request, dialog } = useAssociateWithPeriod({
    sourceKind: entity,
    sourceId: entityId,
    targetKind: "deal",
    doAssociate: associate,
    title: "Vincular negócio",
  });

  const unlink = async (dealId: string) => {
    if (entity === "company") {
      const { error } = await sb.from("deals").update({ company_id: null }).eq("id", dealId);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await sb
        .from("deal_contacts")
        .delete()
        .eq("deal_id", dealId)
        .eq("contact_id", entityId);
      if (error) return toast.error(error.message);
      const { data: deal } = await supabase
        .from("deals")
        .select("primary_contact_id")
        .eq("id", dealId)
        .maybeSingle();
      if (
        (deal as { primary_contact_id?: string | null } | null)?.primary_contact_id === entityId
      ) {
        await sb.from("deals").update({ primary_contact_id: null }).eq("id", dealId);
      }
    }
    toast.success("Negócio desvinculado");
    emitTimelineRefresh();
    refresh();
  };

  const changeStage = async (dealId: string, value: string) => {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === dealId ? { ...r, stage_id: value } : r)));
    const { error } = await sb.from("deals").update({ stage_id: value }).eq("id", dealId);
    if (error) {
      setRows(prev);
      toast.error(error.message);
      return;
    }
    toast.success("Etapa atualizada");
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
            onPick={request}
            onCreateNew={() => setCreateOpen(true)}
          />
        }
      >
        {rows.length === 0 ? (
          <Empty label="Nenhum negócio." />
        ) : (
          <>
            <ul className="space-y-2">
              {rows.map((d) => {
                const pipeline = pipelines.find((p) => p.id === d.pipeline_id);
                const stages = pipeline?.stages ?? [];
                return (
                  <li
                    key={d.id}
                    className="rounded-xl border border-border/60 p-3 group hover:border-border transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <EntityAvatar initials="" tone="primary" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to="/deals/$id"
                            params={{ id: d.id }}
                            className="text-sm font-semibold text-primary hover:underline break-words min-w-0"
                          >
                            {d.name}
                          </Link>
                        </div>
                        <div className="mt-2 space-y-2">
                          <DetailRow
                            label="Valor"
                            value={
                              d.value != null
                                ? formatCurrency(d.value, d.currency ?? "BRL")
                                : null
                            }
                          />
                          <DetailRow
                            label="Data de fechamento"
                            value={formatDealDateLong(d.expected_close_date)}
                          />
                          <DetailRow
                            label="Pipeline"
                            value={pipeline?.name ?? "—"}
                          />
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                              Fase
                            </div>
                            <div className="mt-0.5">
                              <StagePicker
                                dealId={d.id}
                                stage={d.stage_id ?? d.stage}
                                stages={stages}
                                onChange={(v) => changeStage(d.id, v)}
                              />

                            </div>
                          </div>

                        </div>
                        <AssocLabelAdder />
                      </div>
                      <AssocItemActions
                        link={{ to: "/deals/$id", params: { id: d.id } }}
                        onUnlink={() => unlink(d.id)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <ViewAllFooter href="/deals" label="Exibir todos os Negócios associados" />
          </>
        )}
      </AssocCard>
      <QuickCreateDealDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultCompanyId={entity === "company" ? entityId : (companyId ?? null)}
        defaultContactId={entity === "contact" ? entityId : null}
        onCreated={() => refresh()}
      />
      {dialog}
    </>
  );
}


/* ───────────── Tickets card ───────────── */

function TicketsCard({
  entity,
  entityId,
  companyId,
}: {
  entity: AssociationEntity;
  entityId: string;
  companyId?: string | null;
}) {
  type TicketRow = {
    id: string;
    subject: string;
    status: string;
    priority: string;
    due_at: string | null;
    pipeline_id: string | null;
  };
  const TICKET_SELECT = "id, subject, status, priority, due_at, pipeline_id";
  const [rows, setRows] = useState<TicketRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  const { pipelines } = usePipelines("ticket");

  useEffect(() => {
    (async () => {
      const col =
        entity === "deal" ? "deal_id" : entity === "company" ? "company_id" : "contact_id";
      const { data: direct } = await supabase
        .from("tickets")
        .select(TICKET_SELECT)
        .eq(col, entityId)
        .limit(50);
      let companyRows: TicketRow[] = [];
      if (entity === "contact" && companyId) {
        const { data } = await supabase
          .from("tickets")
          .select(TICKET_SELECT)
          .eq("company_id", companyId)
          .limit(50);
        companyRows = ((data ?? []) as never) as TicketRow[];
      }
      const map = new Map<string, TicketRow>();
      for (const t of [...(((direct ?? []) as never) as TicketRow[]), ...companyRows])
        map.set(t.id, t);
      setRows(Array.from(map.values()).slice(0, 50));
    })();
  }, [entity, entityId, companyId, tick]);

  const fkCol = entity === "deal" ? "deal_id" : entity === "company" ? "company_id" : "contact_id";

  const associate = async (ticketId: string) => {
    const { data, error } = await sb
      .from("tickets")
      .update({ [fkCol]: entityId })
      .eq("id", ticketId)
      .select("id");
    if (error) return toast.error(error.message);
    if (!data || data.length === 0) {
      return toast.error("Sem permissão para vincular este ticket.");
    }
    toast.success("Ticket vinculado");
    emitTimelineRefresh();
    refresh();
  };

  const { request, dialog } = useAssociateWithPeriod({
    sourceKind: entity === "lead" ? "contact" : entity,
    sourceId: entityId,
    targetKind: "ticket",
    doAssociate: associate,
    title: "Vincular ticket",
  });

  const unlink = async (ticketId: string) => {
    const { error } = await sb
      .from("tickets")
      .update({ [fkCol]: null })
      .eq("id", ticketId);
    if (error) return toast.error(error.message);
    toast.success("Ticket desvinculado");
    emitTimelineRefresh();
    refresh();
  };

  const changeStatus = async (ticketId: string, value: string) => {
    const prev = rows;
    setRows((rs) => rs.map((r) => (r.id === ticketId ? { ...r, status: value } : r)));
    const { error } = await sb
      .from("tickets")
      .update({ status: value as never })
      .eq("id", ticketId);
    if (error) {
      setRows(prev);
      toast.error(error.message);
      return;
    }
    toast.success("Status atualizado");
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
              searchColumns={["subject", "description"]}
              labelFrom={(r) => String((r as { subject?: string }).subject ?? "—")}
              hintFrom={(r) => {
                const x = r as { status?: string; priority?: string };
                return [x.status, x.priority].filter(Boolean).join(" · ") || null;
              }}
              placeholder="Buscar ticket…"
              onPick={request}
              onCreateNew={() => setCreateOpen(true)}
            />
          )
        }
      >
        {rows.length === 0 ? (
          <Empty label="Nenhum ticket." />
        ) : (
          <>
            <ul className="space-y-2">
              {rows.map((t) => {
                const pipeline = pipelines.find((p) => p.id === t.pipeline_id);
                const stages = pipeline?.stages ?? [];
                return (
                  <li
                    key={t.id}
                    className="rounded-xl border border-border/60 p-3 group hover:border-border transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <EntityAvatar initials="" tone="primary" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to="/tickets/$id"
                            params={{ id: t.id }}
                            className="text-sm font-semibold text-primary hover:underline break-words min-w-0"
                          >
                            {t.subject}
                          </Link>
                        </div>
                        <div className="mt-2 space-y-2">
                          <DetailRow label="Prioridade" value={t.priority ?? null} />
                          <DetailRow
                            label="Data de vencimento"
                            value={formatDealDateLong(t.due_at)}
                          />
                          <DetailRow label="Pipeline" value={pipeline?.name ?? "—"} />
                          <div className="min-w-0">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                              Fase
                            </div>
                            <div className="mt-0.5">
                              <StagePicker
                                dealId={t.id}
                                stage={t.status}
                                stages={stages}
                                onChange={(v) => changeStatus(t.id, v)}
                              />
                            </div>
                          </div>
                        </div>
                        <AssocLabelAdder />
                      </div>
                      <AssocItemActions
                        link={{ to: "/tickets/$id", params: { id: t.id } }}
                        onUnlink={() => unlink(t.id)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
            <ViewAllFooter href="/tickets" label="Exibir todos os Tickets associados" />
          </>
        )}
      </AssocCard>
      <QuickCreateTicketDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultCompanyId={entity === "company" ? entityId : (companyId ?? null)}
        defaultContactId={entity === "contact" ? entityId : null}
        defaultDealId={entity === "deal" ? entityId : null}
        onCreated={() => refresh()}
      />
      {dialog}
    </>
  );
}


/* ───────────── Single Contact / Deal cards (entity = ticket) ───────────── */

function SingleContactCard({
  entityId,
  contactId,
}: {
  entityId: string;
  contactId: string | null;
}) {
  const [c, setC] = useState<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    mobile_phone: string | null;
    job_title: string | null;
    company: { name: string | null } | null;
  } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(contactId);

  const load = useCallback(async (id: string | null) => {
    if (!id) {
      setC(null);
      return;
    }
    const { data } = await supabase
      .from("contacts")
      .select("id, first_name, last_name, email, phone, mobile_phone, job_title, company:companies(name)")
      .eq("id", id)
      .maybeSingle();
    setC(data as never);
  }, []);

  useEffect(() => {
    setCurrentId(contactId);
  }, [contactId]);
  useEffect(() => {
    void load(currentId);
  }, [currentId, load]);

  const associate = async (id: string) => {
    const { error } = await sb.from("tickets").update({ contact_id: id }).eq("id", entityId);
    if (error) return toast.error(error.message);
    toast.success("Contato vinculado");
    emitTimelineRefresh();
    setCurrentId(id);
  };

  const { request, dialog } = useAssociateWithPeriod({
    sourceKind: "ticket",
    sourceId: entityId,
    targetKind: "contact",
    doAssociate: associate,
    title: "Vincular contato",
  });

  const unlink = async () => {
    const { error } = await sb.from("tickets").update({ contact_id: null }).eq("id", entityId);
    if (error) return toast.error(error.message);
    toast.success("Contato desvinculado");
    emitTimelineRefresh();
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
            onPick={request}
            onCreateNew={() => setCreateOpen(true)}
            label={c ? "Trocar" : "Adicionar"}
          />
        }
      >
        {!c ? (
          <Empty label="Nenhum contato vinculado." />
        ) : (() => {
          const fullName =
            `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Sem nome";
          const initials =
            ((c.first_name?.[0] ?? "?") + (c.last_name?.[0] ?? "")).toUpperCase();
          const companyName = c.company?.name ?? null;
          const role = c.job_title
            ? companyName
              ? `${c.job_title} na ${companyName}`
              : c.job_title
            : companyName;
          const phone = c.phone || c.mobile_phone || null;
          return (
            <>
              <div className="rounded-xl border border-border/60 p-3 group hover:border-border transition-colors">
                <div className="flex items-start gap-3">
                  <EntityAvatar initials={initials} tone="primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        to="/contacts/$id"
                        params={{ id: c.id }}
                        className="text-sm font-semibold text-primary hover:underline break-words min-w-0"
                      >
                        {fullName}
                      </Link>
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-muted text-foreground font-medium">
                        Principal
                      </span>
                    </div>
                    {role && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 break-words">{role}</p>
                    )}
                    <div className="mt-2 space-y-1">
                      <DetailRow
                        label="E-mail"
                        value={c.email}
                        href={c.email ? `mailto:${c.email}` : undefined}
                        copyable
                      />
                      <DetailRow
                        label="Telefone"
                        value={phone}
                        href={phone ? `tel:${phone}` : undefined}
                        copyable
                      />
                    </div>
                    <AssocLabelAdder />
                  </div>
                  <AssocItemActions link={{ to: "/contacts/$id", params: { id: c.id } }} onUnlink={unlink} />
                </div>
              </div>
              <ViewAllFooter href="/contacts" label="Exibir todos os Contatos associados" />
            </>
          );
        })()}
      </AssocCard>
      <CreateContactDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => request(id)}
      />
      {dialog}
    </>
  );
}

function SingleDealCard({ entityId, dealId }: { entityId: string; dealId: string | null }) {
  const [d, setD] = useState<{
    id: string;
    name: string;
    value: number | null;
    stage: string | null;
    currency: string | null;
  } | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(dealId);

  const load = useCallback(async (id: string | null) => {
    if (!id) {
      setD(null);
      return;
    }
    const { data } = await supabase
      .from("deals")
      .select("id, name, value, stage, currency")
      .eq("id", id)
      .maybeSingle();
    setD(data as never);
  }, []);

  useEffect(() => {
    setCurrentId(dealId);
  }, [dealId]);
  useEffect(() => {
    void load(currentId);
  }, [currentId, load]);

  const associate = async (id: string) => {
    const { error } = await sb.from("tickets").update({ deal_id: id }).eq("id", entityId);
    if (error) return toast.error(error.message);
    toast.success("Negócio vinculado");
    emitTimelineRefresh();
    setCurrentId(id);
  };

  const { request, dialog } = useAssociateWithPeriod({
    sourceKind: "ticket",
    sourceId: entityId,
    targetKind: "deal",
    doAssociate: associate,
    title: "Vincular negócio",
  });

  const unlink = async () => {
    const { error } = await sb.from("tickets").update({ deal_id: null }).eq("id", entityId);
    if (error) return toast.error(error.message);
    toast.success("Negócio desvinculado");
    emitTimelineRefresh();
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
            onPick={request}
            onCreateNew={() => setCreateOpen(true)}
            label={d ? "Trocar" : "Adicionar"}
          />
        }
      >
        {!d ? (
          <Empty label="Nenhum negócio vinculado." />
        ) : (
          <div className="flex items-center gap-3 group">
            <Link
              to="/deals/$id"
              params={{ id: d.id }}
              className="block p-3 border border-border/60 rounded-xl hover:bg-muted/40 transition-colors flex-1 min-w-0"
            >
              <p className="text-xs font-semibold text-foreground mb-1 break-words">{d.name}</p>
              <div className="flex justify-between items-center gap-2">
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {d.value != null ? formatCurrency(d.value, d.currency ?? "BRL") : "—"}
                </span>
                {d.stage && (
                  <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-md font-medium capitalize">
                    {d.stage}
                  </span>
                )}
              </div>
            </Link>
            <button
              onClick={unlink}
              className="p-1 text-muted-foreground hover:text-destructive rounded"
              aria-label="Remover"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </AssocCard>
      <QuickCreateDealDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => request(id)}
      />
      {dialog}
    </>
  );
}

/* ───────────── unchanged read-only cards ───────────── */

function TasksCard({ entity, entityId }: { entity: AssociationEntity; entityId: string }) {
  const [rows, setRows] = useState<
    { id: string; subject: string | null; due_date: string | null }[]
  >([]);
  const fetchRows = useCallback(() => {
    supabase
      .from("activities")
      .select("id, subject, due_date")
      .eq("type", "task")
      .eq("completed", false)
      .eq(relCol(entity), entityId)
      .order("due_date", { ascending: true })
      .limit(10)
      .then(({ data }) => setRows((data ?? []) as never));
  }, [entity, entityId]);
  useEffect(() => {
    fetchRows();
    const handler = () => fetchRows();
    window.addEventListener("activities:changed", handler);
    return () => window.removeEventListener("activities:changed", handler);
  }, [fetchRows]);
  return (
    <AssocCard icon={<ListTodo className="w-4 h-4" />} title="Tarefas abertas" count={rows.length}>
      {rows.length === 0 ? (
        <Empty label="Nenhuma tarefa aberta." />
      ) : (
        <ul className="space-y-2">
          {rows.map((t) => (
            <li key={t.id}>
              <Link to="/tasks/$id" params={{ id: t.id }} className="block group">
                <p className="text-xs font-semibold text-foreground group-hover:text-primary break-words">
                  {t.subject || "(sem assunto)"}
                </p>
                {t.due_date && (
                  <p className="text-[10px] text-muted-foreground">
                    Vence {formatDateTime(t.due_date)}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AssocCard>
  );
}

function EmailsCard({ entity, entityId }: { entity: AssociationEntity; entityId: string }) {
  const [rows, setRows] = useState<
    { id: string; subject: string | null; created_at: string; hs_createdate: string | null }[]
  >([]);
  const fetchRows = useCallback(() => {
    supabase
      .from("activities")
      .select("id, subject, created_at, hs_createdate")
      .eq("type", "email")
      .eq(relCol(entity), entityId)
      .order("hs_createdate", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setRows((data ?? []) as never));
  }, [entity, entityId]);
  useEffect(() => {
    fetchRows();
    const handler = () => fetchRows();
    window.addEventListener("activities:changed", handler);
    return () => window.removeEventListener("activities:changed", handler);
  }, [fetchRows]);
  return (
    <AssocCard icon={<Mail className="w-4 h-4" />} title="Emails recentes" count={rows.length}>
      {rows.length === 0 ? (
        <Empty label="Nenhum email." />
      ) : (
        <ul className="space-y-2">
          {rows.map((e) => (
            <li key={e.id} className="text-xs">
              <p className="font-semibold text-foreground break-words">
                {e.subject || "(sem assunto)"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {formatDateTime(e.hs_createdate ?? e.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </AssocCard>
  );
}

function AttachmentsCard({ entity, entityId }: { entity: AssociationEntity; entityId: string }) {
  const [rows, setRows] = useState<{ name: string; path: string; type?: string }[]>([]);
  const fetchRows = useCallback(() => {
    supabase
      .from("activities")
      .select("attachments")
      .eq(relCol(entity), entityId)
      .not("attachments", "is", null)
      .limit(100)
      .then(({ data }) => {
        const flat: { name: string; path: string; type?: string }[] = [];
        for (const r of data ?? []) {
          const raw = (r as { attachments?: unknown }).attachments;
          const atts = Array.isArray(raw)
            ? (raw as { name: string; path: string; type?: string }[])
            : [];
          for (const a of atts) {
            if (a && typeof a === "object" && "path" in a && "name" in a) flat.push(a);
          }
        }
        setRows(flat.slice(0, 10));
      });
  }, [entity, entityId]);
  useEffect(() => {
    fetchRows();
    const handler = () => fetchRows();
    window.addEventListener("activities:changed", handler);
    return () => window.removeEventListener("activities:changed", handler);
  }, [fetchRows]);
  const open = async (path: string) => {
    const { data } = await supabase.storage.from("notes-attachments").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };
  const ext = (n: string) => n.split(".").pop()?.toUpperCase().slice(0, 4) || "FILE";
  return (
    <AssocCard icon={<Paperclip className="w-4 h-4" />} title="Anexos" count={rows.length}>
      {rows.length === 0 ? (
        <Empty label="Nenhum anexo." />
      ) : (
        <ul className="space-y-2">
          {rows.map((a, i) => (
            <li key={i}>
              <button
                onClick={() => open(a.path)}
                className="flex items-center gap-2 text-xs text-muted-foreground group w-full text-left"
              >
                <span className="w-6 h-6 rounded bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold shrink-0">
                  {ext(a.name)}
                </span>
                <span className="group-hover:text-primary truncate">{a.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </AssocCard>
  );
}

