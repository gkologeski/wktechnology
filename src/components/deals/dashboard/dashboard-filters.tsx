// Filtros do painel: período, pipelines, canal e responsável.
import { DateRangePicker } from "@/components/date-range-picker";
import { AssigneeFilter, ASSIGNEE_ME } from "@/components/entity/assignee-filter";
import type { DateRange, PresetKey } from "@/lib/date-presets";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PipelineOption, LeadChannel } from "@/lib/deals/sales-dashboard.types";

export interface DashboardFiltersProps {
  range: DateRange;
  onRangeChange: (range: DateRange, presetKey?: PresetKey) => void;
  pipelines: PipelineOption[];
  pipelineId: string | null;
  onPipelineChange: (v: string | null) => void;
  leadPipelines: PipelineOption[];
  leadPipelineId: string | null;
  onLeadPipelineChange: (v: string | null) => void;
  channel: LeadChannel | null;
  onChannelChange: (v: LeadChannel | null) => void;
  assignee: string;
  onAssigneeChange: (v: string) => void;
  canViewTeam: boolean;
  disabled?: boolean;
}

export function DashboardFilters({
  range,
  onRangeChange,
  pipelines,
  pipelineId,
  onPipelineChange,
  leadPipelines,
  leadPipelineId,
  onLeadPipelineChange,
  channel,
  onChannelChange,
  assignee,
  onAssigneeChange,
  canViewTeam,
  disabled = false,
}: DashboardFiltersProps) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-product-divider bg-product-toolbar p-3">
      <div className="min-w-[14rem]">
        <span className="text-xs text-text-secondary">Período</span>
        <div className="mt-1">
          <DateRangePicker
            value={range}
            onChange={onRangeChange}
            defaultPreset="last30"
            align="start"
            ariaLabel="Período do painel"
            className="h-9 w-full justify-start"
          />
        </div>
      </div>

      <div className="min-w-[12rem]">
        <Label htmlFor="dash-pipeline" className="text-xs text-text-secondary">
          Pipeline de Negócios
        </Label>
        <Select
          value={pipelineId ?? "__default__"}
          onValueChange={(v) => onPipelineChange(v === "__default__" ? null : v)}
          disabled={disabled || pipelines.length === 0}
        >
          <SelectTrigger id="dash-pipeline" className="mt-1 h-9 w-full">
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

      <div className="min-w-[12rem]">
        <Label htmlFor="dash-lead-pipeline" className="text-xs text-text-secondary">
          Funil de Leads
        </Label>
        <Select
          value={leadPipelineId ?? "__default__"}
          onValueChange={(v) => onLeadPipelineChange(v === "__default__" ? null : v)}
          disabled={disabled || leadPipelines.length === 0}
        >
          <SelectTrigger id="dash-lead-pipeline" className="mt-1 h-9 w-full">
            <SelectValue placeholder="Funil padrão" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__default__">Funil padrão</SelectItem>
            {leadPipelines.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-[11rem]">
        <Label htmlFor="dash-channel" className="text-xs text-text-secondary">
          Canal
        </Label>
        <Select
          value={channel ?? "__all__"}
          onValueChange={(v) => onChannelChange(v === "__all__" ? null : (v as LeadChannel))}
          disabled={disabled}
        >
          <SelectTrigger id="dash-channel" className="mt-1 h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os canais</SelectItem>
            <SelectItem value="prospecting">Prospecção</SelectItem>
            <SelectItem value="website">Site e formulários</SelectItem>
            <SelectItem value="paid">Mídia paga</SelectItem>
            <SelectItem value="organic">Orgânico</SelectItem>
            <SelectItem value="referral">Indicação</SelectItem>
            <SelectItem value="offline">Eventos e offline</SelectItem>
            <SelectItem value="import">Importação</SelectItem>
            <SelectItem value="other">Outros</SelectItem>
            <SelectItem value="unknown">Sem origem</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-[12rem]">
        <span className="text-xs text-text-secondary">Responsável</span>
        <div className="mt-1">
          <AssigneeFilter
            value={canViewTeam ? assignee : ASSIGNEE_ME}
            onChange={onAssigneeChange}
            allowAll={canViewTeam}
            disabled={disabled || !canViewTeam}
            className="w-full"
          />
        </div>
      </div>
    </div>
  );
}
