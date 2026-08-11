import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateDealFromLeadDialog } from "@/components/leads/create-deal-from-lead-dialog";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StageTracker } from "@/components/stage-tracker";
import { ActivityTimeline } from "@/components/activity-timeline";
import { AiSummaryPanel } from "@/components/ai/ai-summary-panel";
import { PropertiesPanel } from "@/components/properties-panel";
import { deleteLeadsByIds } from "@/lib/lead-delete";
import { RecordLayout } from "@/components/record/record-layout";
import { AssociationsPanel } from "@/components/record/associations-panel";
import { useRealtimeInvalidate } from "@/hooks/use-realtime-invalidate";
import { qk } from "@/lib/entity-queries";

import {
  useLeadStages,
  resolveLeadStageValue,
  deriveLeadStatus,
  findLeadStage,
} from "@/lib/leads/stages";

import type { Lead } from "@/lib/db-types";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useCanDelete, DELETE_NOT_ALLOWED_TITLE } from "@/lib/access-control/use-can-delete";

export const Route = createFileRoute("/_authenticated/leads/$id")({
  component: LeadDetail,
});

function LeadDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user: _user } = useAuth();
  const qc = useQueryClient();
  const [createDealOpen, setCreateDealOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: lead } = useQuery({
    queryKey: qk.lead(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return (data as Lead | null) ?? null;
    },
  });
  const load = () => qc.invalidateQueries({ queryKey: qk.lead(id) });

  useRealtimeInvalidate([
    { table: "leads", queryKeys: [qk.lead(id)] },
    { table: "activities", queryKeys: [qk.activities("related_lead_id", id)] },
  ]);

  const { canDeleteRecord, isLoading: deletePermLoading } = useCanDelete("techsales.leads");
  const canDelete = !deletePermLoading && canDeleteRecord(lead);
  const { stages, pipelineId, isLoading: stagesLoading } = useLeadStages();

  if (!lead) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const currentStageValue = resolveLeadStageValue(
    lead as unknown as { stage_id?: string | null; status?: string | null },
    stages,
  );
  const currentStage = findLeadStage(stages, currentStageValue);

  const setStage = async (v: string) => {
    if (v === currentStageValue) return;
    const stage = findLeadStage(stages, v);
    // Etapa "Qualificado" exige preenchimento do questionário de qualificação.
    if (stage && (stage.value === "qualified" || stage.type === "won")) {
      setQualifyOpen(true);
      return;
    }
    const { error } = await supabase
      .from("leads")
      .update({
        stage_id: v,
        ...(pipelineId ? { pipeline_id: pipelineId } : {}),
        status: deriveLeadStatus(stage),
      } as never)
      .eq("id", lead.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void load();
  };


  const doDelete = async () => {
    if (!canDelete) {
      toast.error(DELETE_NOT_ALLOWED_TITLE);
      setConfirmDelete(false);
      return;
    }
    setBusy(true);
    try {
      await deleteLeadsByIds(supabase, [lead.id]);
      toast.success("Excluído");
      qc.removeQueries({ queryKey: qk.lead(id) });
      await qc.invalidateQueries({ queryKey: ["leads"] });
      navigate({ to: "/leads" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  const header = (
    <div className="bg-card rounded-2xl shadow-sm border border-border/60 p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-5 min-w-0">
          <Button variant="ghost" size="icon" asChild className="rounded-full">
            <Link to="/leads">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="w-16 h-16 shrink-0 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-primary/20 border-4 border-card">
            {(lead.first_name?.[0] ?? "?").toUpperCase()}
            {(lead.last_name?.[0] ?? "").toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground truncate">
                {lead.first_name} {lead.last_name ?? ""}
              </h1>
              <Badge
                variant="outline"
                className="rounded-full px-3 bg-primary/10 text-primary border-primary/20"
              >
                Score: {lead.score ?? 0}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {lead.company_name && <span>{lead.company_name} · </span>}
              {lead.email ?? "sem email"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setCreateDealOpen(true)}>
            Criar negócio
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
            onClick={() => setConfirmDelete(true)}
            disabled={!canDelete}
            aria-disabled={!canDelete}
            title={canDelete ? "Excluir lead" : DELETE_NOT_ALLOWED_TITLE}
            aria-label="Excluir lead"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <StageTracker
        stages={stages.map((s) => ({ value: s.value, label: s.label }))}
        current={currentStageValue}
        onChange={setStage}
        disabled={stagesLoading}
        activeClassName={
          currentStage?.type === "won"
            ? "bg-green-600 text-white"
            : currentStage?.type === "lost"
              ? "bg-red-600 text-white"
              : "bg-slate-700 text-white"
        }
      />
    </div>
  );

  return (
    <>
      <RecordLayout
        header={header}
        left={
          <PropertiesPanel
            entity="leads"
            table="leads"
            row={lead as unknown as Record<string, unknown> & { id: string }}
            props={[
              { key: "first_name", label: "Nome", primary: true },
              { key: "last_name", label: "Sobrenome", primary: true },
              { key: "email", label: "Email", type: "email", primary: true },
              { key: "phone", label: "Telefone", type: "tel", primary: true },
              { key: "company_name", label: "Empresa", type: "company", primary: true },
              { key: "source", label: "Fonte", primary: true },
              { key: "label", label: "Label" },
              { key: "score", label: "Score", type: "number" },
              { key: "notes", label: "Notas" },
            ]}
            onSaved={load}
          />
        }
        center={
          <>
            <AiSummaryPanel entity="lead" entityId={lead.id} />
            <ActivityTimeline relatedKey="related_lead_id" relatedId={lead.id} />
          </>
        }
        right={
          <>
            <AssociationsPanel
              entity="lead"
              entityId={lead.id}
              companyId={(lead as unknown as { company_id?: string | null }).company_id ?? null}
            />
          </>
        }
      />

      <CreateDealFromLeadDialog
        open={createDealOpen}
        onOpenChange={setCreateDealOpen}
        lead={lead}
        onCreated={() => void load()}
      />

      <AlertDialog open={confirmDelete} onOpenChange={(v) => !busy && setConfirmDelete(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lead</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
