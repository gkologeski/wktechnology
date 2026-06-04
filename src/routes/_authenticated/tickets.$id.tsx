import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trash2, Ticket as TicketIcon, Building2, User as UserIcon, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActivityTimeline } from "@/components/activity-timeline";
import { AiSummaryPanel } from "@/components/ai/ai-summary-panel";
import { PropertiesPanel } from "@/components/properties-panel";
import { RecordLayout } from "@/components/record/record-layout";
import { StageTracker } from "@/components/stage-tracker";
import { PRIORITIES, PRIORITY_COLOR_VAR, type TicketRow, type TicketStatus } from "@/components/tickets/types";
import { usePipelines } from "@/lib/pipelines";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { notifyTicketStatusChange } from "@/lib/tickets-notify.functions";

export const Route = createFileRoute("/_authenticated/tickets/$id")({
  component: TicketDetail,
});

type LinkedContact = { id: string; first_name: string | null; last_name: string | null; email: string | null };
type LinkedCompany = { id: string; name: string; industry: string | null };
type LinkedDeal = { id: string; name: string };

function TicketDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const notifyStatus = useServerFn(notifyTicketStatusChange);
  const [ticket, setTicket] = useState<TicketRow | null>(null);
  const [contact, setContact] = useState<LinkedContact | null>(null);
  const [company, setCompany] = useState<LinkedCompany | null>(null);
  const [deal, setDeal] = useState<LinkedDeal | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("tickets").select("*").eq("id", id).single();
    const t = data as TicketRow | null;
    setTicket(t);
    if (t?.contact_id) {
      const { data: c } = await supabase.from("contacts").select("id,first_name,last_name,email").eq("id", t.contact_id).maybeSingle();
      setContact((c as LinkedContact | null) ?? null);
    } else setContact(null);
    if (t?.company_id) {
      const { data: c } = await supabase.from("companies").select("id,name,industry").eq("id", t.company_id).maybeSingle();
      setCompany((c as LinkedCompany | null) ?? null);
    } else setCompany(null);
    if (t?.deal_id) {
      const { data: d } = await supabase.from("deals").select("id,name").eq("id", t.deal_id).maybeSingle();
      setDeal((d as LinkedDeal | null) ?? null);
    } else setDeal(null);
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  if (!ticket) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const setStatus = async (v: string) => {
    const newStatus = v as TicketStatus;
    const patch: Record<string, unknown> = { status: newStatus };
    if (newStatus === "resolved" || newStatus === "closed") {
      patch.resolved_at = ticket.resolved_at ?? new Date().toISOString();
    } else {
      patch.resolved_at = null;
    }
    const { error } = await (supabase as unknown as { from: (t: string) => { update: (p: Record<string, unknown>) => { eq: (k: string, v: string) => Promise<{ error: { message: string } | null }> } } }).from("tickets").update(patch).eq("id", ticket.id);
    if (error) { toast.error(error.message); return; }
    if (ticket.status !== newStatus) {
      notifyStatus({ data: { ticket_id: ticket.id, new_status: newStatus } }).catch(() => {});
    }
    void load();
  };

  const remove = async () => {
    if (!confirm("Excluir este ticket?")) return;
    const { error } = await supabase.from("tickets").delete().eq("id", ticket.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Excluído");
    navigate({ to: "/tickets" });
  };

  const priorityLabel = PRIORITIES.find((p) => p.value === ticket.priority)?.label ?? ticket.priority;
  const statusLabel = STATUSES.find((s) => s.value === ticket.status)?.label ?? ticket.status;
  const priorityColor = PRIORITY_COLOR_VAR[ticket.priority] ?? "var(--priority-low)";

  const header = (
    <div className="bg-card rounded-2xl shadow-sm border border-border/60 p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-5 min-w-0">
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link to="/tickets"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="w-16 h-16 shrink-0 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-white shadow-lg shadow-primary/20 border-4 border-card">
            <TicketIcon className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground truncate">{ticket.subject}</h1>
              <Badge variant="outline" className="rounded-full px-3 capitalize bg-primary/10 text-primary border-primary/20">{statusLabel}</Badge>
              <Badge
                variant="outline"
                className="rounded-full px-3 capitalize"
                style={{ background: `color-mix(in oklab, ${priorityColor} 12%, transparent)`, color: priorityColor, borderColor: `color-mix(in oklab, ${priorityColor} 30%, transparent)` }}
              >
                {priorityLabel}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Criado em {new Date(ticket.created_at).toLocaleDateString("pt-BR")}
              {ticket.due_at && <span> · Vence {new Date(ticket.due_at).toLocaleDateString("pt-BR")}</span>}
              {ticket.resolved_at && <span> · Resolvido {new Date(ticket.resolved_at).toLocaleDateString("pt-BR")}</span>}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg" onClick={remove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <StageTracker
        stages={STATUSES.map((s) => ({ value: s.value, label: s.label }))}
        current={ticket.status}
        onChange={setStatus}
      />
    </div>
  );

  const right = (
    <>
      {company && (
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/60">
          <div className="flex items-center gap-2 mb-3">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-bold">Empresa</h3>
          </div>
          <Link to="/companies/$id" params={{ id: company.id }} className="text-sm font-medium text-primary hover:underline">
            {company.name}
          </Link>
          {company.industry && <p className="text-xs text-muted-foreground mt-1">{company.industry}</p>}
        </div>
      )}
      {contact && (
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/60">
          <div className="flex items-center gap-2 mb-3">
            <UserIcon className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-bold">Contato</h3>
          </div>
          <Link to="/contacts/$id" params={{ id: contact.id }} className="text-sm font-medium text-primary hover:underline">
            {`${contact.first_name ?? ""} ${contact.last_name ?? ""}`.trim() || "Sem nome"}
          </Link>
          {contact.email && <p className="text-xs text-muted-foreground mt-1 truncate">{contact.email}</p>}
        </div>
      )}
      {deal && (
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/60">
          <div className="flex items-center gap-2 mb-3">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-bold">Negócio</h3>
          </div>
          <Link to="/deals/$id" params={{ id: deal.id }} className="text-sm font-medium text-primary hover:underline">
            {deal.name}
          </Link>
        </div>
      )}
      {!company && !contact && !deal && (
        <div className="bg-card rounded-2xl p-5 shadow-sm border border-border/60">
          <p className="text-xs text-muted-foreground">Sem associações.</p>
        </div>
      )}
    </>
  );

  const timelineKey = ticket.deal_id ? "related_deal_id"
    : ticket.contact_id ? "related_contact_id"
    : ticket.company_id ? "related_company_id"
    : "related_contact_id";
  const timelineId = ticket.deal_id ?? ticket.contact_id ?? ticket.company_id ?? "";

  return (
    <RecordLayout
      header={header}
      left={
        <PropertiesPanel
          entity="tickets" table="tickets" row={ticket as unknown as Record<string, unknown> & { id: string }}
          props={[
            { key: "subject", label: "Assunto", primary: true },
            { key: "status", label: "Status", primary: true },
            { key: "priority", label: "Prioridade", primary: true },
            { key: "source", label: "Origem", primary: true },
            { key: "due_at", label: "Vencimento", primary: true },
            { key: "description", label: "Descrição" },
          ]}
          onSaved={load}
        />
      }
      center={
        <>
          <AiSummaryPanel entity="ticket" entityId={ticket.id} />
          {ticket.description && (
            <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/60">
              <h3 className="text-sm font-bold mb-3">Descrição</h3>
              <p className="text-sm whitespace-pre-wrap text-muted-foreground">{ticket.description}</p>
            </div>
          )}
          {timelineId && <ActivityTimeline relatedKey={timelineKey} relatedId={timelineId} />}
        </>
      }
      right={right}
    />
  );
}
