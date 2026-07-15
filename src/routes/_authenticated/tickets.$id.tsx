import { formatDateTime } from "@/lib/crm";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trash2, Ticket as TicketIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActivityTimeline } from "@/components/activity-timeline";
import { AiSummaryPanel } from "@/components/ai/ai-summary-panel";
import { PropertiesPanel } from "@/components/properties-panel";
import { RecordLayout } from "@/components/record/record-layout";
import { AssociationsPanel } from "@/components/record/associations-panel";
import { StageTracker } from "@/components/stage-tracker";
import {
  PRIORITIES,
  PRIORITY_COLOR_VAR,
  STATUSES,
  type TicketRow,
  type TicketStatus,
} from "@/components/tickets/types";

import { usePipelines } from "@/lib/pipelines";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { notifyTicketStatusChange } from "@/lib/tickets-notify.functions";
import { TicketMacrosButton } from "@/components/tickets/ticket-macros-button";
import { KbSuggestions } from "@/components/tickets/kb-suggestions";
import { HtmlContent } from "@/components/rich-html-editor";

export const Route = createFileRoute("/_authenticated/tickets/$id")({
  component: TicketDetail,
});

function TicketDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const notifyStatus = useServerFn(notifyTicketStatusChange);
  const { pipelines } = usePipelines("ticket");
  const [ticket, setTicket] = useState<TicketRow | null>(null);

  const pipeline = useMemo(
    () => pipelines.find((p) => p.id === ticket?.pipeline_id) ?? null,
    [pipelines, ticket?.pipeline_id],
  );
  const currentStageValue = useMemo(() => {
    if (!ticket || !pipeline) return "";
    if (ticket.stage && pipeline.stages.some((s) => s.value === ticket.stage)) return ticket.stage;
    // Compat: fallback ao stage HubSpot legado ou status para pipelines antigos.
    const hs = (ticket.external_ids as { hs_pipeline_stage?: string } | null | undefined)
      ?.hs_pipeline_stage;
    if (hs && pipeline.stages.some((s) => s.value === String(hs))) return String(hs);
    if (pipeline.stages.some((s) => s.value === ticket.status)) return ticket.status;
    return pipeline.stages[0]?.value ?? "";
  }, [ticket, pipeline]);
  const currentStage = pipeline?.stages.find((s) => s.value === currentStageValue) ?? null;

  const load = useCallback(async () => {
    const { data } = await supabase.from("tickets").select("*").eq("id", id).single();
    setTicket(data as TicketRow | null);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ticket) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const setStage = async (v: string) => {
    if (!pipeline) return;
    const stage = pipeline.stages.find((s) => s.value === v);
    if (!stage) return;
    const VALID: TicketStatus[] = ["new", "open", "waiting", "resolved", "closed"];
    const isBuiltInStatus = (VALID as string[]).includes(v);
    const nextStatus: TicketStatus = isBuiltInStatus
      ? (v as TicketStatus)
      : stage.type === "won" || stage.type === "lost"
        ? "closed"
        : "open";
    const patch: Record<string, unknown> = {
      stage: v,
      status: nextStatus,
      pipeline_id: pipeline.id,
    };
    if (nextStatus === "resolved" || nextStatus === "closed") {
      patch.resolved_at = ticket.resolved_at ?? new Date().toISOString();
    } else {
      patch.resolved_at = null;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("tickets").update(patch).eq("id", ticket.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (ticket.status !== nextStatus) {
      notifyStatus({ data: { ticket_id: ticket.id, new_status: nextStatus } }).catch(() => {});
    }
    void load();
  };

  const remove = async () => {
    if (!confirm("Excluir este ticket?")) return;
    const { error } = await supabase.from("tickets").delete().eq("id", ticket.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Excluído");
    navigate({ to: "/tickets" });
  };

  const priorityLabel =
    PRIORITIES.find((p) => p.value === ticket.priority)?.label ?? ticket.priority;
  const stageLabel = currentStage?.label ?? "—";
  const priorityColor = PRIORITY_COLOR_VAR[ticket.priority] ?? "var(--priority-low)";

  const header = (
    <div className="bg-card rounded-2xl shadow-sm border border-border/60 p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-5 min-w-0">
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link to="/tickets">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="w-16 h-16 shrink-0 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-white shadow-lg shadow-primary/20 border-4 border-card">
            <TicketIcon className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground truncate">{ticket.subject}</h1>
              <Badge
                variant="outline"
                className="rounded-full px-3 capitalize bg-primary/10 text-primary border-primary/20"
              >
                {stageLabel}
              </Badge>
              {pipeline && (
                <Badge variant="outline" className="rounded-full px-3 text-muted-foreground">
                  {pipeline.name}
                </Badge>
              )}
              <Badge
                variant="outline"
                className="rounded-full px-3 capitalize"
                style={{
                  background: `color-mix(in oklab, ${priorityColor} 12%, transparent)`,
                  color: priorityColor,
                  borderColor: `color-mix(in oklab, ${priorityColor} 30%, transparent)`,
                }}
              >
                {priorityLabel}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Criado em {formatDateTime(ticket.created_at)}
              {ticket.due_at && <span> · Vence {formatDateTime(ticket.due_at)}</span>}
              {ticket.resolved_at && <span> · Resolvido {formatDateTime(ticket.resolved_at)}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TicketMacrosButton
            ticket={{
              id: ticket.id,
              contact_id: ticket.contact_id,
              company_id: ticket.company_id,
              deal_id: ticket.deal_id,
            }}
            onApplied={load}
          />
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
            onClick={remove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {pipeline && pipeline.stages.length > 0 && (
        <StageTracker
          stages={pipeline.stages.map((s) => ({ value: s.value, label: s.label }))}
          current={currentStageValue}
          onChange={setStage}
        />
      )}
    </div>
  );

  return (
    <RecordLayout
      header={header}
      left={
        <PropertiesPanel
          entity="tickets"
          table="tickets"
          row={ticket as unknown as Record<string, unknown> & { id: string }}
          props={[
            { key: "subject", label: "Assunto", primary: true },
            {
              key: "status",
              label: "Status",
              primary: true,
              options: STATUSES.map((s) => ({ value: s.value, label: s.label })),
            },
            {
              key: "priority",
              label: "Prioridade",
              primary: true,
              options: PRIORITIES.map((p) => ({ value: p.value, label: p.label })),
            },
            { key: "source", label: "Origem", primary: true },
            { key: "due_at", label: "Vencimento", type: "datetime", primary: true },
            { key: "description", label: "Descrição" },

          ]}
          onSaved={load}
        />
      }
      center={
        <>
          <AiSummaryPanel entity="ticket" entityId={ticket.id} />
          <KbSuggestions subject={ticket.subject} description={ticket.description} />
          {ticket.description && (
            <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/60">
              <h3 className="text-sm font-bold mb-3">Descrição</h3>
              <HtmlContent html={ticket.description} className="text-sm text-muted-foreground" />
            </div>
          )}
          <ActivityTimeline relatedKey="related_ticket_id" relatedId={ticket.id} />
        </>
      }
      right={
        <AssociationsPanel
          entity="ticket"
          entityId={ticket.id}
          companyId={ticket.company_id}
          contactId={ticket.contact_id}
          dealId={ticket.deal_id}
        />
      }
    />
  );
}
