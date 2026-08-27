import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trash2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActivityTimeline } from "@/components/activity-timeline";
import { AiSummaryPanel } from "@/components/ai/ai-summary-panel";
import { PropertiesPanel } from "@/components/properties-panel";
import { RecordLayout } from "@/components/record/record-layout";
import { AssociationsPanel } from "@/components/record/associations-panel";

import { StageTracker } from "@/components/stage-tracker";
import { SubstatusSelect } from "@/components/pipelines/substatus-select";
import {
  DealLineItems,
  DealLineItemsEditor,
  DealLineItemsCount,
} from "@/components/deals/deal-line-items";
import { DealQuotes } from "@/components/deals/deal-quotes";
import { DealContracts } from "@/components/contracts/deal-contracts";
import { DealDeliveryPanel } from "@/components/deals/deal-delivery-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEAL_STAGES, formatCurrency, formatDateTime } from "@/lib/crm";
import { usePipelines } from "@/lib/pipelines";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { qk } from "@/lib/entity-queries";
import type { Deal } from "@/lib/db-types";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useAuth } from "@/lib/auth";
import { useCanDelete } from "@/lib/access-control/use-can-delete";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/deals/$id")({
  component: DealDetail,
});

function DealDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { pipelines } = usePipelines("deal");
  const { can } = usePermissions();
  const { user } = useAuth();
  const { canDeleteRecord, isLoading: deletePermLoading } = useCanDelete("techsales.deals");

  const { data: deal } = useQuery({
    queryKey: qk.deal(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as Deal | null) ?? null;
    },
  });
  const load = () => qc.invalidateQueries({ queryKey: qk.deal(id) });

  useRealtimeInvalidate([
    { table: "deals", queryKeys: [qk.deal(id)] },
    { table: "deal_line_items", queryKeys: [qk.deal(id), qk.dealLineItems(id)] },
    { table: "activities", queryKeys: [qk.activities("related_deal_id", id)] },
  ]);

  useEffect(() => {
    function onChanged(e: Event) {
      const detail = (e as CustomEvent<{ dealId?: string }>).detail;
      if (!detail?.dealId || detail.dealId === id) void load();
    }
    window.addEventListener("deal:line-items-changed", onChanged);
    return () => window.removeEventListener("deal:line-items-changed", onChanged);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const dealPipeline = useMemo(() => {
    if (!deal) return null;
    const pid = (deal as unknown as { pipeline_id?: string | null }).pipeline_id;
    return (
      pipelines.find((p) => p.id === pid) ??
      pipelines.find((p) => p.is_default) ??
      pipelines[0] ??
      null
    );
  }, [deal, pipelines]);

  const stages = useMemo(
    () =>
      dealPipeline
        ? dealPipeline.stages.map((s) => ({ value: s.value, label: s.label }))
        : DEAL_STAGES.map((s) => ({ value: s.value, label: s.label })),
    [dealPipeline],
  );

  if (!deal) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const currentStage = deal.stage_id || (deal.stage as string);

  const setStage = async (v: string) => {
    const legacyEnum = ["new", "qualified", "proposal", "negotiation", "won", "lost"];
    const payload: Record<string, unknown> = { stage_id: v };
    if (legacyEnum.includes(v)) payload.stage = v;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("deals").update(payload).eq("id", deal.id);
    void load();
  };

  /** O substatus precisa pertencer à etapa atual (validado por gatilho no banco). */
  const setSubstatus = async (substatusId: string | null) => {
    const { error } = await supabase
      .from("deals")
      .update({ stage_substatus_id: substatusId } as never)
      .eq("id", deal.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void load();
  };

  const setPipeline = async (pipelineId: string) => {
    const next = pipelines.find((p) => p.id === pipelineId);
    const firstStage = next?.stages[0]?.value ?? "new";
    const legacyEnum = ["new", "qualified", "proposal", "negotiation", "won", "lost"];
    const payload: Record<string, unknown> = {
      pipeline_id: pipelineId,
      stage_id: firstStage,
    };
    if (legacyEnum.includes(firstStage)) payload.stage = firstStage;
    else {
      const type = next?.stages[0]?.type;
      payload.stage = type === "won" ? "won" : type === "lost" ? "lost" : "new";
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("deals").update(payload).eq("id", deal.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Funil atualizado");
    void load();
  };

  const canDelete =
    !deletePermLoading && canDeleteRecord(deal as Parameters<typeof canDeleteRecord>[0]);

  const remove = async () => {
    if (!canDelete) {
      toast.error("Você não tem permissão para excluir este negócio.");
      return;
    }
    if (!(await confirmDialog("Excluir negócio?"))) return;
    const { data: deleted, error } = await supabase
      .from("deals")
      .delete()
      .eq("id", deal.id)
      .select("id");
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!deleted || deleted.length === 0) {
      toast.error("Você não tem permissão para excluir este negócio.");
      return;
    }
    toast.success("Excluído");
    qc.removeQueries({ queryKey: qk.deal(id) });
    await qc.invalidateQueries({ queryKey: ["deals"] });
    navigate({ to: "/deals" });
  };

  const header = (
    <div className="bg-card rounded-2xl shadow-sm border border-border/60 p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-5 min-w-0">
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link to="/deals">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="w-16 h-16 shrink-0 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-white shadow-lg shadow-primary/20 border-4 border-card">
            <Briefcase className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground truncate">{deal.name}</h1>
              <Badge
                variant="outline"
                className="rounded-full px-3 capitalize bg-primary/10 text-primary border-primary/20"
              >
                {stages.find((s) => s.value === currentStage)?.label ?? deal.stage}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {formatCurrency(deal.value, deal.currency)}
              {deal.expected_close_date && (
                <span> · Fechamento {formatDateTime(deal.expected_close_date)}</span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {pipelines.length > 0 && (
            <Select
              value={(deal as unknown as { pipeline_id?: string | null }).pipeline_id ?? ""}
              onValueChange={setPipeline}
            >
              <SelectTrigger className="h-9 w-[200px]">
                <SelectValue placeholder="Selecione o funil" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg disabled:opacity-50"
                    onClick={remove}
                    disabled={!canDelete}
                    aria-label="Excluir negócio"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </TooltipTrigger>
              {!canDelete && (
                <TooltipContent>Você não tem permissão para excluir este negócio.</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <StageTracker stages={stages} current={currentStage} onChange={setStage} />
      <SubstatusSelect
        pipelineId={dealPipeline?.id ?? null}
        stageValue={currentStage}
        value={(deal as unknown as { stage_substatus_id?: string | null }).stage_substatus_id}
        onChange={setSubstatus}
        className="max-w-xs space-y-1"
      />
    </div>
  );

  return (
    <>
      <RecordLayout
        header={header}
        left={
          <PropertiesPanel
            entity="deals"
            table="deals"
            row={deal as unknown as Record<string, unknown> & { id: string }}
            props={[
              { key: "name", label: "Nome", primary: true },
              { key: "value", label: "Valor", type: "currency", primary: true },
              { key: "currency", label: "Moeda", primary: true },
              { key: "stage", label: "Etapa", primary: true },
              {
                key: "expected_close_date",
                label: "Fechamento previsto",
                type: "date",
                primary: true,
              },
              { key: "dealtype", label: "Tipo" },
              { key: "hs_priority", label: "Prioridade" },
              { key: "description", label: "Descrição" },
              { key: "notes", label: "Notas" },
            ]}
            onSaved={load}
          />
        }
        center={
          <>
            <AiSummaryPanel entity="deal" entityId={deal.id} />
            <DealDeliveryPanel dealId={deal.id} />
            <ActivityTimeline relatedKey="related_deal_id" relatedId={deal.id} />
          </>
        }
        right={
          <>
            <AssociationsPanel entity="deal" entityId={deal.id} companyId={deal.company_id} />
            <Card>
              <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">
                  Itens de linha (<DealLineItemsCount dealId={deal.id} />)
                </CardTitle>
                <DealLineItemsEditor
                  dealId={deal.id}
                  ownerId={deal.owner_id}
                  currency={deal.currency ?? "BRL"}
                  trigger={
                    <Button variant="link" size="sm" className="h-auto p-0">
                      Editar
                    </Button>
                  }
                />
              </CardHeader>
              <CardContent>
                <DealLineItems
                  dealId={deal.id}
                  ownerId={deal.owner_id}
                  currency={deal.currency ?? "BRL"}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Cotações</CardTitle>
              </CardHeader>
              <CardContent>
                <DealQuotes dealId={deal.id} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Contratos</CardTitle>
              </CardHeader>
              <CardContent>
                <DealContracts dealId={deal.id} companyId={deal.company_id ?? null} />
              </CardContent>
            </Card>
          </>
        }
      />
    </>
  );
}
