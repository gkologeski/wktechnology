import { FieldSelect } from "./pickers";
import type { FieldOpt } from "../../step-tree";
import {
  countSteps,
  describeAction,
  defaultActionOfType,
  ACTION_ICONS,
  getBranchList,
  setBranchList,
  isBranchKey,
} from "../../step-tree";
import { useEntityFieldOptions } from "../../use-entity-field-options";
import {
  ConditionListEditor,
  FieldValueEditor,
  newLeafCondition,
  normalizeTopGroup,
  denormalizeTopGroup,
} from "../../conditions-editor";
import { EntityPickerDialog } from "../../entity-picker-dialog";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Webhook, X, ArrowUp, ArrowDown } from "lucide-react";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ExtraFieldsEditor, FkPicker } from "../../extra-fields-editor";
import { GenericRecordForm } from "../../generic-record-form";
import { TokenInput, TokenTextarea } from "../../token-input";
import { useWorkspaceSubstatuses } from "@/lib/pipelines/substatuses";
import { ActionTemplatesBar } from "../../action-templates-bar";
import { ACTION_LABELS, type WorkflowEntity, type WorkflowAction } from "@/lib/workflows/types";
import { useServerFn } from "@tanstack/react-start";
import { listAvailableSurveys } from "@/lib/surveys/survey-activity.functions";


export function SwitchByValueForm({
  entity,
  entityFields,
  action,
  onChange,
}: {
  entity: WorkflowEntity;
  entityFields: FieldOpt[];
  action: Extract<WorkflowAction, { type: "switch_by_value" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  const setCases = (next: typeof action.cases) => onChange({ ...action, cases: next });
  const cases = action.cases ?? [];
  const selectedField = entityFields.find((f) => f.name === action.field);
  const moveCase = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= cases.length) return;
    const copy = [...cases];
    const [item] = copy.splice(i, 1);
    copy.splice(j, 0, item);
    setCases(copy);
  };
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Executa o primeiro <em>case</em> cujo valor bate com o campo. Se nenhum bater, executa a
        coluna <strong>Padrão</strong>. As ações de cada case são montadas nas colunas do canvas.
      </p>
      <div>
        <Label className="text-xs">Campo</Label>
        <FieldSelect
          entity={entity}
          value={action.field}
          onChange={(v) => onChange({ ...action, field: v })}
        />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Cases</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCases([...cases, { value: "", actions: [] }])}
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar case
          </Button>
        </div>
        {cases.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum case; executa apenas o padrão.</p>
        )}
        {cases.map((c, i) => (
          <div key={i} className="rounded-md border p-2 space-y-2 bg-muted/10">
            <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
              <div>
                <Label className="text-[11px]">Valor</Label>
                <FieldValueEditor
                  field={selectedField}
                  value={c.value}
                  onChange={(v) =>
                    setCases(cases.map((x, idx) => (idx === i ? { ...x, value: v } : x)))
                  }
                />
              </div>
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Mover case para a esquerda"
                  disabled={i === 0}
                  onClick={() => moveCase(i, -1)}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Mover case para a direita"
                  disabled={i === cases.length - 1}
                  onClick={() => moveCase(i, 1)}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Remover case"
                  onClick={() => setCases(cases.filter((_, idx) => idx !== i))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-[11px]">Rótulo da coluna (opcional)</Label>
              <Input
                value={c.label ?? ""}
                placeholder="Ex.: Contrato assinado"
                onChange={(e) =>
                  setCases(cases.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))
                }
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {(c.actions ?? []).length} passo(s) nesta coluna.
            </p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Coluna padrão: {(action.default ?? []).length} passo(s).
      </p>
    </div>
  );
}

export function BranchMultiForm({
  entity,
  entityFields,
  priorFields = [],
  action,
  onChange,
}: {
  entity: WorkflowEntity;
  entityFields: FieldOpt[];
  priorFields?: FieldOpt[];
  action: Extract<WorkflowAction, { type: "branch_multi" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  void entity;
  const setBranches = (next: typeof action.branches) => onChange({ ...action, branches: next });
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Executa a 1ª ramificação cujos filtros passam. Se nenhuma bater, executa o ramo "senão".
        Ações filhas são configuradas via JSON até o editor visual completo estar pronto.
      </p>
      <div className="flex items-center justify-between">
        <Label className="text-xs">Ramificações</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            setBranches([
              ...action.branches,
              { label: `Branch ${action.branches.length + 1}`, filters: [], actions: [] },
            ])
          }
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
        </Button>
      </div>
      {action.branches.map((b, i) => (
        <div key={i} className="rounded-md border p-2 space-y-2 bg-muted/10">
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <Label className="text-[11px]">Rótulo</Label>
              <Input
                value={b.label ?? ""}
                onChange={(e) =>
                  setBranches(
                    action.branches.map((x, idx) =>
                      idx === i ? { ...x, label: e.target.value } : x,
                    ),
                  )
                }
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Remover ramificação"
              onClick={() => setBranches(action.branches.filter((_, idx) => idx !== i))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-[11px]">Condições</Label>
            </div>
            <ConditionListEditor
              value={b.filters}
              fields={entityFields}
              priorFields={priorFields}
              defaultField={entityFields[0]?.name ?? ""}
              onChange={(next) =>
                setBranches(
                  action.branches.map((x, idx) => (idx === i ? { ...x, filters: next } : x)),
                )
              }
            />
          </div>
          <div>
            <Label className="text-[11px]">Ações (JSON)</Label>
            <Textarea
              rows={3}
              className="font-mono text-xs"
              value={JSON.stringify(b.actions ?? [], null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  if (Array.isArray(parsed)) {
                    setBranches(
                      action.branches.map((x, idx) => (idx === i ? { ...x, actions: parsed } : x)),
                    );
                  }
                } catch {
                  /* ignore */
                }
              }}
            />
          </div>
        </div>
      ))}
      <div>
        <Label className="text-xs">Senão (JSON de ações)</Label>
        <Textarea
          rows={3}
          className="font-mono text-xs"
          value={JSON.stringify(action.else ?? [], null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              if (Array.isArray(parsed)) onChange({ ...action, else: parsed });
            } catch {
              /* ignore */
            }
          }}
        />
      </div>
    </div>
  );
}

export function DelayUntilDateForm({
  entity,
  action,
  onChange,
}: {
  entity: WorkflowEntity;
  action: Extract<WorkflowAction, { type: "delay_until_date" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Espera até a data de um campo do registro. Use offset negativo para disparar antes (ex: -3
        dias). Se a data já passou, segue direto para a próxima ação.
      </p>
      <div>
        <Label className="text-xs">Campo de data</Label>
        <FieldSelect
          entity={entity}
          value={action.field}
          onChange={(v) => onChange({ ...action, field: v })}
        />
      </div>
      <div className="grid grid-cols-[1fr_140px] gap-2">
        <div>
          <Label className="text-xs">Offset</Label>
          <Input
            type="number"
            value={action.offset_amount ?? 0}
            onChange={(e) => onChange({ ...action, offset_amount: Number(e.target.value) || 0 })}
          />
        </div>
        <div>
          <Label className="text-xs">Unidade</Label>
          <Select
            value={action.offset_unit ?? "days"}
            onValueChange={(v) =>
              onChange({ ...action, offset_unit: v as "minutes" | "hours" | "days" })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">Minutos</SelectItem>
              <SelectItem value="hours">Horas</SelectItem>
              <SelectItem value="days">Dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
