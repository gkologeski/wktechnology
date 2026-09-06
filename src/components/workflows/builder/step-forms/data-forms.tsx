import { FieldSelect, AssociationSelect } from "./pickers";
import type { FieldOpt } from "../step-tree";
import {
  countSteps,
  describeAction,
  defaultActionOfType,
  ACTION_ICONS,
  getBranchList,
  setBranchList,
  isBranchKey,
} from "../step-tree";
import { useEntityFieldOptions } from "../use-entity-field-options";
import {
  ConditionListEditor,
  FieldValueEditor,
  newLeafCondition,
  normalizeTopGroup,
  denormalizeTopGroup,
} from "../conditions-editor";
import { EntityPickerDialog } from "../entity-picker-dialog";
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

export function SetSubstatusForm({
  action,
  onChange,
}: {
  action: Extract<WorkflowAction, { type: "set_substatus" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  const { data: substatuses = [], isLoading } = useWorkspaceSubstatuses();

  const active = substatuses.filter((s) => s.is_active);

  // Agrupa por pipeline para facilitar a navegação.
  const byPipeline = active.reduce<Record<string, typeof active>>((acc, s) => {
    if (!acc[s.pipeline_id]) acc[s.pipeline_id] = [];
    acc[s.pipeline_id].push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      <Label>Substatus</Label>
      <Select
        value={action.substatus_id}
        onValueChange={(v) => onChange({ type: "set_substatus", substatus_id: v })}
        disabled={isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecione um substatus" />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(byPipeline).map(([pipelineId, list]) => (
            <div key={pipelineId}>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Pipeline {pipelineId.slice(0, 8)}
              </div>
              {list.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: s.color ?? "#94a3b8" }}
                    />
                    {s.name}
                    <span className="text-muted-foreground">({s.stage_value})</span>
                  </span>
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function FormatDataForm({
  action,
  onChange,
}: {
  action: Extract<WorkflowAction, { type: "format_data" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  const showSource = action.op !== "template_string";
  const showFormat = action.op === "date_format";
  const showAmount = action.op === "date_add" || action.op === "number_round";
  const showUnit = action.op === "date_add";
  const showTemplate = action.op === "template_string";
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Operação</Label>
        <Select
          value={action.op}
          onValueChange={(v) => onChange({ ...action, op: v as typeof action.op })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upper">Maiúsculas</SelectItem>
            <SelectItem value="lower">Minúsculas</SelectItem>
            <SelectItem value="trim">Remover espaços</SelectItem>
            <SelectItem value="date_add">Somar tempo à data</SelectItem>
            <SelectItem value="date_format">Formatar data</SelectItem>
            <SelectItem value="number_round">Arredondar número</SelectItem>
            <SelectItem value="template_string">Concatenar (template)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {showSource && (
        <div className="space-y-1">
          <Label>Campo de origem</Label>
          <Input
            value={action.source_field ?? ""}
            onChange={(e) => onChange({ ...action, source_field: e.target.value })}
            placeholder="ex: name, created_at, value"
          />
        </div>
      )}
      {showTemplate && (
        <div className="space-y-1">
          <Label>Template</Label>
          <TokenTextarea
            value={action.template ?? ""}
            onValueChange={(v) => onChange({ ...action, template: v })}
            placeholder="Ex: {{first_name}} <{{email}}> — score {{vars.score_pct}}"
            rows={3}
          />
        </div>
      )}
      {showFormat && (
        <div className="space-y-1">
          <Label>Formato</Label>
          <Input
            value={action.format ?? "yyyy-MM-dd"}
            onChange={(e) => onChange({ ...action, format: e.target.value })}
            placeholder="yyyy-MM-dd HH:mm"
          />
          <p className="text-xs text-muted-foreground">Tokens: yyyy, MM, dd, HH, mm, ss.</p>
        </div>
      )}
      {showAmount && (
        <div className="space-y-1">
          <Label>{action.op === "number_round" ? "Casas decimais" : "Quantidade"}</Label>
          <Input
            type="number"
            value={action.amount ?? 0}
            onChange={(e) => onChange({ ...action, amount: Number(e.target.value) })}
          />
        </div>
      )}
      {showUnit && (
        <div className="space-y-1">
          <Label>Unidade</Label>
          <Select
            value={action.unit ?? "days"}
            onValueChange={(v) => onChange({ ...action, unit: v as "minutes" | "hours" | "days" })}
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
      )}
      <div className="space-y-1">
        <Label>Salvar em variável</Label>
        <Input
          value={action.target_var}
          onChange={(e) => onChange({ ...action, target_var: e.target.value })}
          placeholder="ex: score_pct"
        />
        <p className="text-xs text-muted-foreground">
          Use nas ações seguintes como{" "}
          <code>{"{{vars." + (action.target_var || "nome") + "}}"}</code>.
        </p>
      </div>
    </div>
  );
}

export function CreateSurveyActivityForm({
  action,
  onChange,
}: {
  action: Extract<WorkflowAction, { type: "create_survey_activity" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  const listFn = useServerFn(listAvailableSurveys);
  const available = useQuery({
    queryKey: ["survey-activity", "available"],
    queryFn: () => listFn(),
  });

  const options = [
    ...(available.data?.questionnaires ?? []).map((q) => ({
      value: `prospecting_questionnaire:${q.id}`,
      label: `${q.name} (vendas)`,
    })),
    ...(available.data?.templates ?? []).map((t) => ({
      value: `survey_template:${t.id}`,
      label: `${t.name} (${String(t.kind ?? "form").toUpperCase()})`,
    })),
  ];

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="wf-survey-source">Pesquisa</Label>
        {available.isLoading ? (
          <p className="text-xs text-muted-foreground">Carregando pesquisas…</p>
        ) : available.isError ? (
          <p className="text-xs text-destructive" role="alert">
            Não foi possível carregar as pesquisas.
          </p>
        ) : options.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma pesquisa ativa. Crie um questionário em Configurações → Prospecção.
          </p>
        ) : (
          <Select
            value={action.source_id ? `${action.source}:${action.source_id}` : ""}
            onValueChange={(v) => {
              const [source, id] = v.split(":");
              if (source !== "survey_template" && source !== "prospecting_questionnaire") return;
              onChange({ ...action, source, source_id: id });
            }}
          >
            <SelectTrigger id="wf-survey-source">
              <SelectValue placeholder="Selecione a pesquisa…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="space-y-1">
        <Label>Assunto (opcional)</Label>
        <TokenInput
          value={action.subject ?? ""}
          onValueChange={(v) => onChange({ ...action, subject: v || undefined })}
          placeholder="Pesquisa — nome da pesquisa"
        />
      </div>
      <div className="space-y-1">
        <Label>Observação (opcional)</Label>
        <TokenTextarea
          value={action.body ?? ""}
          onValueChange={(v) => onChange({ ...action, body: v || undefined })}
          rows={3}
          placeholder="Instruções para quem vai responder"
        />
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-xs">Vence em (dias)</Label>
        <Input
          type="number"
          min={0}
          max={365}
          className="w-24"
          value={action.due_in_days ?? ""}
          onChange={(e) =>
            onChange({
              ...action,
              due_in_days: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        />
      </div>
      <p className="text-xs text-muted-foreground">
        A atividade de pesquisa fica pendente na timeline do registro e é respondida em Pesquisas.
      </p>
    </div>
  );
}
