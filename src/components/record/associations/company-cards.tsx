import { useCallback, useEffect, useState } from "react";
import { useRefreshCallback } from "@/hooks/use-refresh-callback";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Building2, User, Briefcase, X } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/crm";
import { AddAssociation } from "@/components/record/add-association";
import { ContactPickerPopover } from "@/components/ui/contact-picker";
import { CreateContactDialog } from "@/components/contacts/create-contact-dialog";
import {
  QuickCreateCompanyDialog,
  QuickCreateDealDialog,
} from "@/components/record/quick-create-dialogs";
import {
  AssocCard,
  AssocItemActions,
  AssocLabelAdder,
  DetailRow,
  Empty,
  EntityAvatar,
  ViewAllFooter,
  emitTimelineRefresh,
  sb,
  useAssociateWithPeriod,
} from "./primitives";
import { deniedIfUnaffected } from "@/lib/access-control/rls-denied";

/* ───────────── Company card (entity = contact|deal) ───────────── */

export function CompanyCard({
  entity,
  entityId,
  companyId,
}: {
  entity: "contact" | "deal" | "ticket" | "lead";
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

  const tableFor = (e: "contact" | "deal" | "ticket" | "lead") =>
    e === "contact" ? "contacts" : e === "deal" ? "deals" : e === "lead" ? "leads" : "tickets";

  const associate = async (id: string) => {
    const patch: Record<string, unknown> = { company_id: id };
    if (entity === "lead") {
      // Preencher company_name apenas se estiver vazio, sem sobrescrever entrada do usuário
      const { data: leadRow } = await supabase
        .from("leads")
        .select("company_name")
        .eq("id", entityId)
        .maybeSingle();
      const currentName = (leadRow as { company_name?: string | null } | null)?.company_name ?? "";
      if (!currentName || !currentName.trim()) {
        const { data: comp } = await supabase
          .from("companies")
          .select("name")
          .eq("id", id)
          .maybeSingle();
        const name = (comp as { name?: string | null } | null)?.name;
        if (name) patch.company_name = name;
      }
    }
    const { data: affected, error } = await sb
      .from(tableFor(entity))
      .update(patch)
      .eq("id", entityId)
      .select("id");
    if (error) return toast.error(error.message);
    if (deniedIfUnaffected(affected)) return;

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
    const { data: affected, error } = await sb
      .from(tableFor(entity))
      .update({ company_id: null })
      .eq("id", entityId)
      .select("id");
    if (error) return toast.error(error.message);
    if (deniedIfUnaffected(affected)) return;

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
                      href={
                        c.domain ? `https://${c.domain.replace(/^https?:\/\//, "")}` : undefined
                      }
                      copyable
                    />
                    <DetailRow label="Telefone" value={c.phone} copyable />
                  </div>
                  <AssocLabelAdder />
                </div>
                <AssocItemActions
                  link={{ to: "/companies/$id", params: { id: c.id } }}
                  onUnlink={unlink}
                />
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

export function ContactsCard({
  entity,
  entityId,
}: {
  entity: "company" | "deal";
  entityId: string;
}) {
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
  const SELECT =
    "id, first_name, last_name, job_title, email, phone, mobile_phone, company:companies(name)";
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  useRefreshCallback(refresh);

  useEffect(() => {
    (async () => {
      if (entity === "company") {
        const { data } = await supabase
          .from("contacts")
          .select(SELECT)
          .eq("company_id", entityId)
          .limit(50);
        setRows((data ?? []) as never as ContactRow[]);
        setPrimaryId(null);
      } else {
        const [dcRes, dealRes] = await Promise.all([
          supabase.from("deal_contacts").select("contact_id").eq("deal_id", entityId).limit(50),
          supabase.from("deals").select("primary_contact_id").eq("id", entityId).maybeSingle(),
        ]);
        const ids = new Set<string>();
        for (const r of dcRes.data ?? []) if (r.contact_id) ids.add(r.contact_id as string);
        const primary =
          (dealRes.data as { primary_contact_id?: string | null } | null)?.primary_contact_id ??
          null;
        if (primary) ids.add(primary);
        setPrimaryId(primary);
        if (ids.size) {
          const { data } = await supabase.from("contacts").select(SELECT).in("id", Array.from(ids));
          setRows((data ?? []) as never as ContactRow[]);
        } else {
          setRows([]);
        }
      }
    })();
  }, [entity, entityId, tick]);

  const associate = async (contactId: string) => {
    if (entity === "company") {
      const { data: affected, error } = await sb
        .from("contacts")
        .update({ company_id: entityId })
        .eq("id", contactId)
        .select("id");
      if (error) return toast.error(error.message);
      if (deniedIfUnaffected(affected)) return;
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
      const { data: affected, error } = await sb
        .from("contacts")
        .update({ company_id: null })
        .eq("id", contactId)
        .select("id");
      if (error) return toast.error(error.message);
      if (deniedIfUnaffected(affected)) return;
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
                const fullName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Sem nome";
                const initials = (
                  (c.first_name?.[0] ?? "?") + (c.last_name?.[0] ?? "")
                ).toUpperCase();
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
                  <li
                    key={c.id}
                    className="rounded-xl border border-border/60 p-3 group hover:border-border transition-colors"
                  >
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

/* ───────────── Single Contact / Deal cards (entity = ticket) ───────────── */

export function SingleContactCard({
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
      .select(
        "id, first_name, last_name, email, phone, mobile_phone, job_title, company:companies(name)",
      )
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
        ) : (
          (() => {
            const fullName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Sem nome";
            const initials = ((c.first_name?.[0] ?? "?") + (c.last_name?.[0] ?? "")).toUpperCase();
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
                      onUnlink={unlink}
                    />
                  </div>
                </div>
                <ViewAllFooter href="/contacts" label="Exibir todos os Contatos associados" />
              </>
            );
          })()
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

export function SingleDealCard({ entityId, dealId }: { entityId: string; dealId: string | null }) {
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
