// Painel lateral de configuração do gatilho do workflow (evento, tempo,
// condições, reinscrição e critérios de meta).
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Target } from "lucide-react";
import {
  ENTITY_LABELS,
  EVENT_LABELS,
  type WorkflowCondition,
  type WorkflowEntity,
  type WorkflowEventType,
  type WorkflowTrigger,
} from "@/lib/workflows/types";
import type { FieldOpt } from "./step-tree";
import { ConditionListEditor, conditionsIncludeField } from "./conditions-editor";

// ============================================================================
// Right-panel: Trigger config
// ============================================================================
export function TriggerConfigPanel({
  entity,
  trigger,
  fields,
  onEntityClick,
  onChange,
}: {
  entity: WorkflowEntity;
  trigger: WorkflowTrigger;
  fields: FieldOpt[];
  onEntityClick: () => void;
  onChange: (fn: (t: WorkflowTrigger) => WorkflowTrigger) => void;
}) {
  const setFilters = (fn: (f: WorkflowCondition[]) => WorkflowCondition[]) =>
    onChange((t) => ({ ...t, filters: fn(t.filters ?? []) }));
  const defaultField = fields[0]?.name ?? "";

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold">Gatilho de entrada</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Quando esta condição for atendida, o registro entra no workflow.
        </p>
      </div>

      <div>
        <Label className="text-xs">Tipo de objeto</Label>
        <button
          type="button"
          onClick={onEntityClick}
          className="w-full mt-1 rounded-md border bg-card px-3 py-2 text-sm text-left hover:border-primary"
        >
          {ENTITY_LABELS[entity]}
          <span className="text-xs text-muted-foreground ml-2">(alterar)</span>
        </button>
      </div>

      <div>
        <Label className="text-xs">Evento</Label>
        <Select
          value={trigger.event}
          onValueChange={(v) => onChange((t) => ({ ...t, event: v as WorkflowEventType }))}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(EVENT_LABELS) as WorkflowEventType[]).map((e) => (
              <SelectItem key={e} value={e}>
                {EVENT_LABELS[e]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {trigger.event === "updated" &&
          conditionsIncludeField(trigger.filters, ["stage_id", "stage"]) && (
            <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
              Para reagir a mudanças de etapa do pipeline, use o evento{" "}
              <strong>Mudou de etapa</strong>. O evento <em>Atualizado</em> não dispara em
              transições de etapa.
            </p>
          )}
      </div>

      <div className="rounded-md border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-xs">Gatilho baseado em tempo</Label>
            <p className="text-[11px] text-muted-foreground">
              Dispara periodicamente para registros que atendem à condição temporal.
            </p>
          </div>
          <Switch
            checked={!!trigger.time_based}
            onCheckedChange={(v) =>
              onChange((t) => ({
                ...t,
                time_based: v
                  ? { kind: "time_since_field", field: "created_at", amount: 1, unit: "days" }
                  : undefined,
              }))
            }
          />
        </div>
        {trigger.time_based && (
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <Label className="text-xs">Tipo</Label>
              <Select
                value={trigger.time_based.kind}
                onValueChange={(v) =>
                  onChange((t) => ({
                    ...t,
                    time_based: {
                      ...(t.time_based ?? { amount: 1, unit: "days" }),
                      kind: v as never,
                    },
                  }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time_since_field">Tempo desde campo (data)</SelectItem>
                  <SelectItem value="no_activity_for">Sem atividade há…</SelectItem>
                  <SelectItem value="stuck_in_stage_for">Parado na etapa há…</SelectItem>
                  <SelectItem value="field_unchanged_for">Campo inalterado há…</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(trigger.time_based.kind === "time_since_field" ||
              trigger.time_based.kind === "field_unchanged_for") && (
              <div className="col-span-2">
                <Label className="text-xs">Campo (data)</Label>
                <Input
                  value={trigger.time_based.field ?? ""}
                  onChange={(e) =>
                    onChange((t) => ({
                      ...t,
                      time_based: {
                        ...(t.time_based ?? { kind: "time_since_field", amount: 1, unit: "days" }),
                        field: e.target.value,
                      },
                    }))
                  }
                  placeholder="created_at"
                />
              </div>
            )}
            <div>
              <Label className="text-xs">Quantidade</Label>
              <Input
                type="number"
                min={1}
                value={trigger.time_based.amount}
                onChange={(e) =>
                  onChange((t) => ({
                    ...t,
                    time_based: {
                      ...(t.time_based ?? { kind: "time_since_field", unit: "days" }),
                      amount: Math.max(1, parseInt(e.target.value) || 1),
                    },
                  }))
                }
              />
            </div>
            <div>
              <Label className="text-xs">Unidade</Label>
              <Select
                value={trigger.time_based.unit}
                onValueChange={(v) =>
                  onChange((t) => ({
                    ...t,
                    time_based: {
                      ...(t.time_based ?? { kind: "time_since_field", amount: 1 }),
                      unit: v as "minutes" | "hours" | "days",
                    },
                  }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">minutos</SelectItem>
                  <SelectItem value="hours">horas</SelectItem>
                  <SelectItem value="days">dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="col-span-2 text-[11px] text-muted-foreground">
              Varredura executa a cada 15 min. Cada registro dispara no máximo uma vez até o campo
              de referência mudar.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Condições</Label>
            <Badge variant="secondary" className="text-[10px] font-normal">
              opcional
            </Badge>
          </div>
        </div>
        {(trigger.filters ?? []).length === 0 && (
          <p className="text-xs text-muted-foreground">
            Sem condições, todos os registros que dispararem o evento entram no workflow.
          </p>
        )}
        <ConditionListEditor
          value={trigger.filters}
          fields={fields}
          defaultField={defaultField}
          onChange={(next) => setFilters(() => next)}
        />
      </div>

      {/* Reinscrição */}
      <div className="rounded-md border p-3 space-y-3 bg-muted/20">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Reinscrição</Label>
            <p className="text-xs text-muted-foreground">
              Permite que o mesmo registro entre no workflow mais de uma vez.
            </p>
          </div>
          <Switch
            checked={trigger.reenroll?.enabled ?? false}
            onCheckedChange={(v) =>
              onChange((t) => ({
                ...t,
                reenroll: { enabled: v, events: t.reenroll?.events ?? [] },
              }))
            }
          />
        </div>
        {trigger.reenroll?.enabled && (
          <div className="space-y-2">
            <Label className="text-xs">Reinscrever quando</Label>
            {(Object.keys(EVENT_LABELS) as WorkflowEventType[]).map((e) => {
              const list = trigger.reenroll?.events ?? [];
              const checked = list.includes(e);
              return (
                <label key={e} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) =>
                      onChange((t) => {
                        const cur = t.reenroll?.events ?? [];
                        const next = v ? [...cur, e] : cur.filter((x) => x !== e);
                        return {
                          ...t,
                          reenroll: { enabled: true, events: next },
                        };
                      })
                    }
                  />
                  {EVENT_LABELS[e]}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Critérios de meta (goal) */}
      <div className="rounded-md border p-3 space-y-2 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm">Critérios de meta</Label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Se todos os critérios passarem no processamento do evento, o registro é considerado no
          objetivo e não recebe novas execuções.
        </p>
        <ConditionListEditor
          value={trigger.goal_filters}
          fields={fields}
          defaultField={defaultField}
          onChange={(next) => onChange((t) => ({ ...t, goal_filters: next }))}
        />
      </div>
    </div>
  );
}
