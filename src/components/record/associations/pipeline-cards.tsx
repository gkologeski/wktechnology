import type { AssociationEntity } from "../associations-panel";
import { useEffect, useState } from "react";
import { useRefreshCallback } from "@/hooks/use-refresh-callback";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Briefcase, Ticket as TicketIcon } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/crm";
import { AddAssociation } from "@/components/record/add-association";
import {
  QuickCreateDealDialog,
  QuickCreateTicketDialog,
} from "@/components/record/quick-create-dialogs";
import { usePipelines } from "@/lib/pipelines";
import {
  AssocCard,
  AssocItemActions,
  AssocLabelAdder,
  DEAL_SELECT,
  type DealRow,
  DetailRow,
  Empty,
  EntityAvatar,
  StagePicker,
  ViewAllFooter,
  emitTimelineRefresh,
  formatDealDateLong,
  sb,
  useAssociateWithPeriod,
} from "./primitives";

export function DealsCard({
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
  useRefreshCallback(refresh);
  const { pipelines } = usePipelines("deal");

  useEffect(() => {
    (async () => {
      if (entity === "company") {
        const { data } = await supabase
          .from("deals")
          .select(DEAL_SELECT)
          .eq("company_id", entityId)
          .limit(50);
        setRows((data ?? []) as never as DealRow[]);
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
        extra = (data ?? []) as never as DealRow[];
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
                              d.value != null ? formatCurrency(d.value, d.currency ?? "BRL") : null
                            }
                          />
                          <DetailRow
                            label="Data de fechamento"
                            value={formatDealDateLong(d.expected_close_date)}
                          />
                          <DetailRow label="Pipeline" value={pipeline?.name ?? "—"} />
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

export function TicketsCard({
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
  useRefreshCallback(refresh);
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
        companyRows = (data ?? []) as never as TicketRow[];
      }
      const map = new Map<string, TicketRow>();
      for (const t of [...((direct ?? []) as never as TicketRow[]), ...companyRows])
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
