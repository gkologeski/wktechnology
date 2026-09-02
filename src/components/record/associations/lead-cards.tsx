import { useEffect, useState } from "react";
import { useRefreshCallback } from "@/hooks/use-refresh-callback";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { User, Briefcase, UserSearch } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/crm";
import { ContactPickerPopover } from "@/components/ui/contact-picker";
import { CreateContactDialog } from "@/components/contacts/create-contact-dialog";
import { usePipelines } from "@/lib/pipelines";
import { useLeadStages, resolveLeadStageValue, findLeadStage } from "@/lib/leads/stages";
import {
  AssocCard,
  AssocItemActions,
  DetailRow,
  Empty,
  EntityAvatar,
  ViewAllFooter,
  formatDealDateLong,
  useAssociateWithPeriod,
} from "./primitives";
import { AddAssociation } from "@/components/record/add-association";
import { deniedIfUnaffected } from "@/lib/access-control/rls-denied";


/* ───────────── Lead → Contact / Deal cards (read-only, from conversion) ───────────── */

export function LeadContactsCard({ entityId }: { entityId: string }) {
  const [contact, setContact] = useState<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    mobile_phone: string | null;
    job_title: string | null;
  } | null>(null);
  const [tick, setTick] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  useRefreshCallback(() => setTick((t) => t + 1));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: lead } = await supabase
        .from("leads")
        .select("converted_contact_id")
        .eq("id", entityId)
        .maybeSingle();
      const cid =
        (lead as { converted_contact_id?: string | null } | null)?.converted_contact_id ?? null;
      if (!cid) {
        if (!cancelled) setContact(null);
        return;
      }
      const { data } = await supabase
        .from("contacts")
        .select("id, first_name, last_name, email, phone, mobile_phone, job_title")
        .eq("id", cid)
        .maybeSingle();
      if (!cancelled) setContact((data as typeof contact) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [entityId, tick]);

  const linkContact = async (contactId: string) => {
    const { data: affected, error } = await supabase
      .from("leads")
      .update({ converted_contact_id: contactId })
      .eq("id", entityId)
      .select("id");
    if (error) {
      toast.error(error.message || "Falha ao vincular contato");
      return;
    }
    if (deniedIfUnaffected(affected)) return;
    toast.success("Contato vinculado");
    setTick((t) => t + 1);
  };

  const unlinkContact = async () => {
    const { data: affected, error } = await supabase
      .from("leads")
      .update({ converted_contact_id: null })
      .eq("id", entityId)
      .select("id");
    if (error) {
      toast.error(error.message || "Falha ao remover vínculo");
      return;
    }
    if (deniedIfUnaffected(affected)) return;
    toast.success("Contato removido");

    setTick((t) => t + 1);
  };

  const rows = contact ? [contact] : [];

  const action = !contact ? (
    <ContactPickerPopover
      label="Adicionar contato"
      onPick={(id) => linkContact(id)}
      onCreateNew={() => setCreateOpen(true)}
    />
  ) : null;

  return (
    <>
      <AssocCard
        icon={<User className="w-4 h-4" />}
        title="Contatos"
        count={rows.length}
        action={action}
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
                const phone = c.phone || c.mobile_phone || null;
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
                        </div>
                        {c.job_title && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 break-words">
                            {c.job_title}
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
                      </div>
                      <AssocItemActions
                        link={{ to: "/contacts/$id", params: { id: c.id } }}
                        onUnlink={() => void unlinkContact()}
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
        onCreated={(id) => {
          void linkContact(id);
        }}
      />
    </>
  );
}

export function LeadDealsCard({ entityId }: { entityId: string }) {
  const [deal, setDeal] = useState<{
    id: string;
    name: string | null;
    value: number | null;
    currency: string | null;
    stage: string | null;
    stage_id: string | null;
    expected_close_date: string | null;
    pipeline_id: string | null;
  } | null>(null);
  const [tick, setTick] = useState(0);
  useRefreshCallback(() => setTick((t) => t + 1));
  const { pipelines } = usePipelines("deal");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: lead } = await supabase
        .from("leads")
        .select("converted_deal_id")
        .eq("id", entityId)
        .maybeSingle();
      const did = (lead as { converted_deal_id?: string | null } | null)?.converted_deal_id ?? null;
      if (!did) {
        if (!cancelled) setDeal(null);
        return;
      }
      const { data } = await supabase
        .from("deals")
        .select("id, name, value, currency, stage, stage_id, expected_close_date, pipeline_id")
        .eq("id", did)
        .maybeSingle();
      if (!cancelled) setDeal((data as typeof deal) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [entityId, tick]);

  const linkDeal = async (dealId: string) => {
    const { data: affected, error } = await supabase
      .from("leads")
      .update({ converted_deal_id: dealId })
      .eq("id", entityId)
      .select("id");
    if (error) {
      toast.error(error.message || "Falha ao vincular negócio");
      return;
    }
    if (deniedIfUnaffected(affected)) return;
    toast.success("Negócio vinculado");
    setTick((t) => t + 1);
  };

  const unlinkDeal = async () => {
    const { data: affected, error } = await supabase
      .from("leads")
      .update({ converted_deal_id: null })
      .eq("id", entityId)
      .select("id");
    if (error) {
      toast.error(error.message || "Falha ao remover vínculo");
      return;
    }
    if (deniedIfUnaffected(affected)) return;
    toast.success("Negócio removido");
    setTick((t) => t + 1);
  };

  const associate = useAssociateWithPeriod({
    sourceKind: "lead",
    sourceId: entityId,
    targetKind: "deal",
    doAssociate: (id) => linkDeal(id),
    title: "Vincular negócio ao lead",
  });

  const rows = deal ? [deal] : [];

  const action = !deal ? (
    <AddAssociation
      entity="deals"
      select="id, name, value, currency"
      searchColumn="name"
      labelFrom={(r) => String(r["name"] ?? "Sem nome")}
      placeholder="Buscar negócio…"
      label="Adicionar negócio"
      onPick={(id) => associate.request(id)}
    />
  ) : null;

  return (
    <AssocCard
      icon={<Briefcase className="w-4 h-4" />}
      title="Negócios"
      count={rows.length}
      action={action}
    >

      {rows.length === 0 ? (
        <Empty label="Nenhum negócio vinculado." />
      ) : (
        <>
          <ul className="space-y-2">
            {rows.map((d) => {
              const pipeline = pipelines.find((p) => p.id === d.pipeline_id);
              const stages = pipeline?.stages ?? [];
              const stageLabel =
                stages.find((s) => s.value === (d.stage_id ?? d.stage))?.label ?? d.stage ?? "—";
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
                          {d.name ?? "Sem nome"}
                        </Link>
                      </div>
                      <div className="mt-2 space-y-2">
                        <DetailRow
                          label="Valor"
                          value={
                            d.value != null ? formatCurrency(d.value, d.currency ?? "BRL") : null
                          }
                        />
                        <DetailRow
                          label="Data de fechamento"
                          value={formatDealDateLong(d.expected_close_date)}
                        />
                        <DetailRow label="Pipeline" value={pipeline?.name ?? "—"} />
                        <DetailRow label="Fase" value={stageLabel} />
                      </div>
                    </div>
                    <AssocItemActions
                      link={{ to: "/deals/$id", params: { id: d.id } }}
                      onUnlink={() => void unlinkDeal()}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <ViewAllFooter href="/deals" label="Exibir todos os Negócios associados" />
        </>
      )}
      {associate.dialog}
    </AssocCard>
  );
}


/* ───────────── Contact/Company → Leads card (read-only) ───────────── */

type LeadRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company_name: string | null;
  stage_id: string | null;
  status: string | null;
};

/**
 * Leads associados a um contato (via `converted_contact_id`) ou a uma empresa
 * (via `company_id`). Somente leitura — o vínculo é gerenciado no próprio lead.
 */
export function RecordLeadsCard({
  entity,
  entityId,
}: {
  entity: "contact" | "company";
  entityId: string;
}) {
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [tick, setTick] = useState(0);
  useRefreshCallback(() => setTick((t) => t + 1));
  const { stages } = useLeadStages();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const col = entity === "contact" ? "converted_contact_id" : "company_id";
      const { data } = await supabase
        .from("leads")
        .select("id, first_name, last_name, email, company_name, stage_id, status")
        .eq(col, entityId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!cancelled) setRows(((data as LeadRow[] | null) ?? []) as LeadRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [entity, entityId, tick]);

  return (
    <AssocCard icon={<UserSearch className="w-4 h-4" />} title="Leads" count={rows.length}>
      {rows.length === 0 ? (
        <Empty label="Nenhum lead vinculado." />
      ) : (
        <>
          <ul className="space-y-2">
            {rows.map((l) => {
              const fullName = `${l.first_name ?? ""} ${l.last_name ?? ""}`.trim() || "Sem nome";
              const initials = (
                (l.first_name?.[0] ?? "?") + (l.last_name?.[0] ?? "")
              ).toUpperCase();
              const stageValue = resolveLeadStageValue(l, stages);
              const stageLabel = findLeadStage(stages, stageValue)?.label ?? stageValue;
              return (
                <li
                  key={l.id}
                  className="rounded-xl border border-border/60 p-3 group hover:border-border transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <EntityAvatar initials={initials} tone="primary" />
                    <div className="min-w-0 flex-1">
                      <Link
                        to="/leads/$id"
                        params={{ id: l.id }}
                        className="text-sm font-semibold text-primary hover:underline break-words min-w-0"
                      >
                        {fullName}
                      </Link>
                      <div className="mt-2 space-y-1">
                        <DetailRow label="Etapa" value={stageLabel} />
                        <DetailRow
                          label="E-mail"
                          value={l.email}
                          href={l.email ? `mailto:${l.email}` : undefined}
                          copyable
                        />
                        {entity === "contact" && (
                          <DetailRow label="Empresa" value={l.company_name} />
                        )}
                      </div>
                    </div>
                    <AssocItemActions link={{ to: "/leads/$id", params: { id: l.id } }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <ViewAllFooter href="/leads" label="Exibir todos os Leads associados" />
        </>
      )}
    </AssocCard>
  );
}
