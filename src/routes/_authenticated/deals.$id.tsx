import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trash2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActivityTimeline } from "@/components/activity-timeline";
import { AiSummaryPanel } from "@/components/ai/ai-summary-panel";
import { PropertiesPanel } from "@/components/properties-panel";
import { RecordLayout } from "@/components/record/record-layout";
import { AssociationsPanel } from "@/components/record/associations-panel";
import { StageTracker } from "@/components/stage-tracker";
import { DEAL_STAGES, formatCurrency } from "@/lib/crm";
import type { Deal } from "@/lib/db-types";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/deals/$id")({
  component: DealDetail,
});

function DealDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [deal, setDeal] = useState<Deal | null>(null);

  const load = async () => {
    const { data } = await supabase.from("deals").select("*").eq("id", id).single();
    setDeal(data as Deal | null);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [id]);

  if (!deal) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const setStage = async (v: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from("deals").update({ stage: v as any }).eq("id", deal.id);
    void load();
  };

  const remove = async () => {
    if (!confirm("Excluir negócio?")) return;
    await supabase.from("deals").delete().eq("id", deal.id);
    toast.success("Excluído");
    navigate({ to: "/deals" });
  };

  const header = (
    <>
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/deals"><ArrowLeft className="h-4 w-4 mr-1" /> Negócios</Link>
        </Button>
        <Button variant="destructive" size="sm" onClick={remove}><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-violet-500/20 text-primary">
              <Briefcase className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{deal.name}</h1>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(deal.value, deal.currency)}
                {deal.expected_close_date && <span> · Fechamento {new Date(deal.expected_close_date).toLocaleDateString("pt-BR")}</span>}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="capitalize">{deal.stage}</Badge>
        </div>
        <div className="mt-4">
          <StageTracker stages={DEAL_STAGES.map(s => ({ value: s.value, label: s.label }))} current={deal.stage} onChange={setStage} />
        </div>
      </div>
    </>
  );

  return (
    <RecordLayout
      header={header}
      left={
        <PropertiesPanel
          entity="deals" table="deals" row={deal as unknown as Record<string, unknown> & { id: string }}
          props={[
            { key: "name", label: "Nome", primary: true },
            { key: "value", label: "Valor", type: "number", primary: true },
            { key: "currency", label: "Moeda", primary: true },
            { key: "stage", label: "Etapa", primary: true },
            { key: "expected_close_date", label: "Fechamento previsto", primary: true },
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
          <h2 className="font-semibold text-sm">Atividades</h2>
          <ActivityTimeline relatedKey="related_deal_id" relatedId={deal.id} />
        </>
      }
      right={<AssociationsPanel entity="deal" entityId={deal.id} companyId={deal.company_id} />}
    />
  );
}
