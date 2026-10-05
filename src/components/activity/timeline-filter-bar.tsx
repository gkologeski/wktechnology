// Barra de filtros da timeline no padrão HubSpot: abas por tipo, busca,
// Atividade, período, responsável e expandir/recolher. Substitui o antigo
// TimelineRail preservando Resumo IA e o indicador de atualização.
import { useState } from "react";
import { ChevronDown, Loader2, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AiSummaryPanel } from "@/components/ai/ai-summary-panel";
import { DateRangeFilter } from "@/components/date-range-filter";
import { ActivityTypeFilter } from "@/components/activity/activity-type-filter";
import type { CustomRange, DatePreset } from "@/lib/date-presets";
import type { RelatedKey, TeamMember } from "@/components/activity/timeline-shared";
import {
  TIMELINE_TABS,
  UNASSIGNED,
  type TimelineCategory,
  type TimelineFilters,
} from "@/lib/timeline/timeline-filters";
import { cn } from "@/lib/utils";

const AI_ENTITY: Partial<Record<RelatedKey, "lead" | "contact" | "deal">> = {
  related_lead_id: "lead",
  related_contact_id: "contact",
  related_deal_id: "deal",
};

export function TimelineFilterBar({
  relatedKey,
  relatedId,
  filters,
  onFiltersChange,
  counts,
  total,
  datePreset,
  dateCustom,
  onDateChange,
  team,
  currentUserId,
  onExpandAll,
  refreshing,
}: {
  relatedKey: RelatedKey;
  relatedId: string;
  filters: TimelineFilters;
  onFiltersChange: (f: TimelineFilters) => void;
  counts: Map<TimelineCategory, number>;
  total: number;
  datePreset: DatePreset;
  dateCustom: CustomRange;
  onDateChange: (preset: DatePreset, custom: CustomRange) => void;
  team: TeamMember[];
  currentUserId?: string;
  onExpandAll: (expanded: boolean) => void;
  refreshing: boolean;
}) {
  const aiEntity = AI_ENTITY[relatedKey];
  const set = (patch: Partial<TimelineFilters>) => onFiltersChange({ ...filters, ...patch });

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-label="Tipos de atividade"
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {TIMELINE_TABS.map((t) => {
          const active = filters.tab === t.key;
          const n = t.key === "all" ? total : (counts.get(t.key) ?? 0);
          return (
            <button
              key={t.key}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => set({ tab: t.key })}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span className="ml-1 text-muted-foreground">({n})</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 [&>*]:min-w-0">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder="Pesquisar atividades"
            aria-label="Pesquisar atividades"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <ActivityTypeFilter
          value={filters.categories}
          onChange={(categories) => set({ categories })}
        />
        <DateRangeFilter
          className="h-8 flex-none text-xs"
          value={{ preset: datePreset, custom: dateCustom }}
          onChange={(v) => onDateChange(v.preset, v.custom ?? {})}
        />
        <AssigneeFilter
          team={team}
          currentUserId={currentUserId}
          value={filters.assignees}
          onChange={(assignees) => set({ assignees })}
        />
        <div className="ml-auto flex items-center gap-2">
          {refreshing && (
            <span
              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
              aria-live="polite"
            >
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Atualizando…
            </span>
          )}
          {aiEntity && (
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <Sparkles className="h-3 w-3 text-primary" aria-hidden />
                  Resumo IA
                </Button>
              </SheetTrigger>
              <SheetContent className="w-[480px] overflow-y-auto sm:max-w-[480px]">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" aria-hidden /> Resumo IA
                  </SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <AiSummaryPanel entity={aiEntity} entityId={relatedId} />
                </div>
              </SheetContent>
            </Sheet>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs font-semibold">
                Expandir tudo <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onExpandAll(true)}>Expandir tudo</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onExpandAll(false)}>Recolher tudo</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

function AssigneeFilter({
  team,
  currentUserId,
  value,
  onChange,
}: {
  team: TeamMember[];
  currentUserId?: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const selected = new Set(value);
  const me = team.find((m) => m.id === currentUserId);
  const options = [
    ...(me ? [{ id: me.id, name: `Eu (${me.name})` }] : []),
    { id: UNASSIGNED, name: "Sem responsável" },
    ...team.filter((m) => m.id !== currentUserId).sort((a, b) => a.name.localeCompare(b.name)),
  ].filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onChange([...next]);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs font-semibold">
          Atividade atribuída a{value.length ? ` (${value.length})` : ""}
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="border-b border-border p-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar"
            aria-label="Pesquisar responsáveis"
            className="h-8 text-sm"
          />
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto p-2">
          {options.map((o) => (
            <label key={o.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm">
              <Checkbox
                checked={selected.has(o.id)}
                onCheckedChange={(v) => toggle(o.id, v === true)}
              />
              <span className="truncate">{o.name}</span>
            </label>
          ))}
          {!options.length && (
            <p className="px-1 text-sm text-muted-foreground">Ninguém encontrado.</p>
          )}
        </div>
        {value.length > 0 && (
          <div className="border-t border-border p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => onChange([])}
            >
              Mostrar todos
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
