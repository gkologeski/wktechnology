// Faixa de controles acima da lista: título, Resumo IA, filtro de período,
// alternância do histórico e indicador de atualização.
// Extraído de `activity-timeline.tsx` sem mudança de comportamento.
import { History, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AiSummaryPanel } from "@/components/ai/ai-summary-panel";
import { DateRangeFilter } from "@/components/date-range-filter";
import type { CustomRange, DatePreset } from "@/lib/date-presets";
import type { RelatedKey } from "@/components/activity/timeline-shared";

const AI_ENTITY: Partial<Record<RelatedKey, "lead" | "contact" | "deal">> = {
  related_lead_id: "lead",
  related_contact_id: "contact",
  related_deal_id: "deal",
};

export function TimelineRail({
  relatedKey,
  relatedId,
  datePreset,
  dateCustom,
  onDateChange,
  showHistory,
  onToggleHistory,
  refreshing,
}: {
  relatedKey: RelatedKey;
  relatedId: string;
  datePreset: DatePreset;
  dateCustom: CustomRange;
  onDateChange: (preset: DatePreset, custom: CustomRange) => void;
  showHistory: boolean;
  onToggleHistory: () => void;
  refreshing: boolean;
}) {
  const aiEntity = AI_ENTITY[relatedKey];

  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-border/60" />
      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
        Timeline
      </span>
      {aiEntity && (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5">
              <Sparkles className="h-3 w-3 text-primary" />
              Resumo IA
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[480px] sm:max-w-[480px] overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Resumo IA
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <AiSummaryPanel entity={aiEntity} entityId={relatedId} />
            </div>
          </SheetContent>
        </Sheet>
      )}
      <div className="h-px flex-1 bg-border/60" />
      <DateRangeFilter
        className="h-8 flex-none text-xs"
        value={{ preset: datePreset, custom: dateCustom }}
        onChange={(v) => onDateChange(v.preset, v.custom ?? {})}
      />
      <Button
        variant={showHistory ? "secondary" : "outline"}
        size="sm"
        className="gap-2 h-8 text-xs"
        aria-pressed={showHistory}
        onClick={onToggleHistory}
      >
        <History className="h-3.5 w-3.5" />
        Histórico
      </Button>
      {refreshing && (
        <span
          className="inline-flex items-center gap-1 text-xs text-muted-foreground ml-1"
          aria-live="polite"
        >
          <Loader2 className="h-3 w-3 animate-spin" />
          Atualizando…
        </span>
      )}
    </div>
  );
}
