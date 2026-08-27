// Filtros do painel: período, pipeline e escopo (meus / equipe).
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  PipelineOption,
  SalesDashboardPeriodDays,
  SalesDashboardScope,
} from "@/lib/deals/sales-dashboard.types";

export interface DashboardFiltersProps {
  periodDays: SalesDashboardPeriodDays;
  onPeriodChange: (v: SalesDashboardPeriodDays) => void;
  pipelines: PipelineOption[];
  pipelineId: string | null;
  onPipelineChange: (v: string | null) => void;
  scope: SalesDashboardScope;
  onScopeChange: (v: SalesDashboardScope) => void;
  canViewTeam: boolean;
  disabled?: boolean;
}

export function DashboardFilters({
  periodDays,
  onPeriodChange,
  pipelines,
  pipelineId,
  onPipelineChange,
  scope,
  onScopeChange,
  canViewTeam,
  disabled = false,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[9rem]">
        <Label htmlFor="dash-period" className="text-xs text-text-secondary">
          Período
        </Label>
        <Select
          value={String(periodDays)}
          onValueChange={(v) => onPeriodChange(Number(v) as SalesDashboardPeriodDays)}
          disabled={disabled}
        >
          <SelectTrigger id="dash-period" size="sm" className="mt-1 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-[12rem]">
        <Label htmlFor="dash-pipeline" className="text-xs text-text-secondary">
          Pipeline
        </Label>
        <Select
          value={pipelineId ?? "__default__"}
          onValueChange={(v) => onPipelineChange(v === "__default__" ? null : v)}
          disabled={disabled || pipelines.length === 0}
        >
          <SelectTrigger id="dash-pipeline" size="sm" className="mt-1 w-full">
            <SelectValue placeholder="Pipeline padrão" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__">Pipeline padrão</SelectItem>
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-[9rem]">
        <Label htmlFor="dash-scope" className="text-xs text-text-secondary">
          Escopo
        </Label>
        <Select
          value={scope}
          onValueChange={(v) => onScopeChange(v as SalesDashboardScope)}
          disabled={disabled || !canViewTeam}
        >
          <SelectTrigger id="dash-scope" size="sm" className="mt-1 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="me">Meus registros</SelectItem>
            <SelectItem value="team" disabled={!canViewTeam}>
              Equipe
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
