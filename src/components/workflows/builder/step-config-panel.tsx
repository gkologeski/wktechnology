import type { FieldOpt } from "./step-tree";
import {
  countSteps,
  describeAction,
  defaultActionOfType,
  ACTION_ICONS,
  getBranchList,
  setBranchList,
  isBranchKey,
} from "./step-tree";
import { useEntityFieldOptions } from "./use-entity-field-options";
import {
  ConditionListEditor,
  FieldValueEditor,
  newLeafCondition,
  normalizeTopGroup,
  denormalizeTopGroup,
} from "./conditions-editor";
import { EntityPickerDialog } from "./entity-picker-dialog";
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
import { ExtraFieldsEditor, FkPicker } from "../extra-fields-editor";
import { GenericRecordForm } from "../generic-record-form";
import { TokenInput, TokenTextarea } from "../token-input";
import { useWorkspaceSubstatuses } from "@/lib/pipelines/substatuses";
import { ActionTemplatesBar } from "../action-templates-bar";
import { ACTION_LABELS, type WorkflowEntity, type WorkflowAction } from "@/lib/workflows/types";
import { useServerFn } from "@tanstack/react-start";
import { listAvailableSurveys } from "@/lib/surveys/survey-activity.functions";

import {
  AssociationSelect,
  FieldSelect,
  EmailTemplatePicker,
  UserPicker,
  RotationRulePicker,
  SequencePicker,
} from "./step-forms/pickers";
import {
  CopyFromAssociationForm,
  AssociateRecordsForm,
  DisassociateRecordsForm,
} from "./step-forms/association-forms";
import {
  SwitchByValueForm,
  BranchMultiForm,
  DelayUntilDateForm,
} from "./step-forms/flow-forms";
import {
  SetSubstatusForm,
  FormatDataForm,
  CreateSurveyActivityForm,
} from "./step-forms/data-forms";
import { SendSlackForm, SendTeamsForm } from "./step-forms/messaging-forms";
import { ApprovalStepForm } from "./step-forms/approval-form";
export function StepConfigPanel({
  action,
  entity,
  entityFields,
  priorFields = [],
  onChange,
}: {
  action: WorkflowAction;
  entity: WorkflowEntity;
  entityFields: FieldOpt[];
  priorFields?: FieldOpt[];
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">{ACTION_LABELS[action.type]}</h3>
        <p className="text-xs text-muted-foreground mt-1">Configure os detalhes deste passo.</p>
      </div>
      <ActionTemplatesBar action={action} entity={entity} onApply={onChange} />
      <StepConfigForm
        action={action}
        entity={entity}
        entityFields={entityFields}
        priorFields={priorFields}
        onChange={onChange}
      />
    </div>
  );
}

function StepConfigForm({
  action,
  entity,
  entityFields,
  priorFields = [],
  onChange,
}: {
  action: WorkflowAction;
  entity: WorkflowEntity;
  entityFields: FieldOpt[];
  priorFields?: FieldOpt[];
  onChange: (a: WorkflowAction) => void;
}) {
  switch (action.type) {
    case "set_field":
      return (
        <div className="grid grid-cols-2 gap-2">
          <Select value={action.field} onValueChange={(v) => onChange({ ...action, field: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {entityFields.map((f) => (
                <SelectItem key={f.name} value={f.name}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldValueEditor
            field={entityFields.find((f) => f.name === action.field)}
            value={action.value}
            onChange={(v) => onChange({ ...action, value: v })}
            placeholder="novo valor"
          />
        </div>
      );
    case "set_substatus":
      return <SetSubstatusForm action={action} onChange={onChange} />;
    case "create_activity":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <TokenInput
              value={action.subject}
              onValueChange={(v) => onChange({ ...action, subject: v })}
              placeholder="Assunto"
            />
            <Select
              value={action.activity_type ?? "task"}
              onValueChange={(v) => onChange({ ...action, activity_type: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="task">Tarefa</SelectItem>
                <SelectItem value="note">Nota</SelectItem>
                <SelectItem value="call">Ligação</SelectItem>
                <SelectItem value="meeting">Reunião</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <TokenTextarea
            value={action.body ?? ""}
            onValueChange={(v) => onChange({ ...action, body: v })}
            placeholder="Descrição (opcional)"
            rows={3}
          />
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
        </div>
      );
    case "assign_to":
      return (
        <UserPicker value={action.user_id} onChange={(v) => onChange({ ...action, user_id: v })} />
      );
    case "rotate_assign":
      return (
        <div className="space-y-1">
          <RotationRulePicker
            value={action.rule_id}
            onChange={(v) => onChange({ ...action, rule_id: v })}
          />
          <p className="text-xs text-muted-foreground">
            Configure regras em Configurações → Distribuição.
          </p>
        </div>
      );
    case "add_to_sequence":
      return (
        <SequencePicker
          value={action.sequence_id}
          onChange={(v) => onChange({ ...action, sequence_id: v })}
        />
      );
    case "send_notification":
      return (
        <div className="space-y-2">
          <TokenInput
            value={action.title}
            onValueChange={(v) => onChange({ ...action, title: v })}
            placeholder="Título"
          />
          <TokenTextarea
            value={action.body ?? ""}
            onValueChange={(v) => onChange({ ...action, body: v })}
            placeholder="Corpo (opcional)"
            rows={2}
          />
          <div>
            <Label className="text-xs">Notificar (opcional — padrão: você)</Label>
            <UserPicker
              value={action.user_id ?? ""}
              onChange={(v) => onChange({ ...action, user_id: v })}
            />
          </div>
        </div>
      );
    case "webhook":
      return (
        <div className="space-y-2">
          <Input
            value={action.url}
            onChange={(e) => onChange({ ...action, url: e.target.value })}
            placeholder="https://..."
          />
          <Textarea
            value={JSON.stringify(action.payload ?? {}, null, 2)}
            onChange={(e) => {
              try {
                onChange({ ...action, payload: JSON.parse(e.target.value) });
              } catch {
                /* ignore */
              }
            }}
            placeholder='{"foo": "bar"}'
            rows={3}
            className="font-mono text-xs"
          />
        </div>
      );
    case "delay":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_140px] gap-2">
            <Input
              type="number"
              min={1}
              value={action.amount}
              onChange={(e) =>
                onChange({ ...action, amount: Math.max(1, Number(e.target.value) || 1) })
              }
            />
            <Select
              value={action.unit}
              onValueChange={(v) =>
                onChange({ ...action, unit: v as "minutes" | "hours" | "days" })
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
          <p className="text-xs text-muted-foreground">
            Esperar {action.amount}{" "}
            {action.unit === "minutes"
              ? "minuto(s)"
              : action.unit === "hours"
                ? "hora(s)"
                : "dia(s)"}{" "}
            antes de executar as próximas ações.
          </p>
        </div>
      );
    case "branch_if":
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            O ramo <strong>Sim</strong> é executado quando as condições abaixo passam; caso
            contrário, executa o ramo <strong>Não</strong>. Adicione passos filhos diretamente no
            canvas.
          </p>
          <div className="flex items-center justify-between">
            <Label className="text-xs">Condições</Label>
          </div>
          {action.filters.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Sem condições — sempre executa o ramo Sim.
            </p>
          )}
          <ConditionListEditor
            value={action.filters}
            fields={entityFields}
            priorFields={priorFields}
            defaultField={entityFields[0]?.name ?? ""}
            onChange={(next) => onChange({ ...action, filters: next })}
          />
        </div>
      );
    case "create_ats_job":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Título da vaga</Label>
            <TokenInput
              value={action.title}
              onValueChange={(v) => onChange({ ...action, title: v })}
              placeholder="Vaga para {{name}}"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Departamento</Label>
              <Input
                value={action.department ?? ""}
                onChange={(e) => onChange({ ...action, department: e.target.value })}
                placeholder="Ex: Engenharia"
              />
            </div>
            <div>
              <Label className="text-xs">Quantidade</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={action.headcount ?? 1}
                onChange={(e) =>
                  onChange({ ...action, headcount: Math.max(1, Number(e.target.value) || 1) })
                }
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Hiring manager (opcional)</Label>
            <UserPicker
              value={action.hiring_manager_id ?? ""}
              onChange={(v) => onChange({ ...action, hiring_manager_id: v })}
            />
          </div>
          <div>
            <Label className="text-xs">Notificar aprovador</Label>
            <UserPicker
              value={action.notify_user_id ?? ""}
              onChange={(v) => onChange({ ...action, notify_user_id: v })}
            />
          </div>
        </div>
      );
    case "advance_ats_application_stage":
      return (
        <div className="space-y-2">
          <Label className="text-xs">Nova etapa da candidatura</Label>
          <FieldValueEditor
            field={
              entityFields.find((f) => f.name === "stage_value") ??
              entityFields.find((f) => f.name === "stage")
            }
            value={action.stage_value}
            onChange={(v) => onChange({ ...action, stage_value: String(v) })}
            placeholder="ex: entrevista, contratado, rejeitado"
          />
        </div>
      );
    case "create_ats_candidate":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Nome completo</Label>
            <TokenInput
              value={action.full_name}
              onValueChange={(v) => onChange({ ...action, full_name: v })}
              placeholder="{{full_name}}"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Email</Label>
              <TokenInput
                value={action.email ?? ""}
                onValueChange={(v) => onChange({ ...action, email: v })}
              />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <TokenInput
                value={action.phone ?? ""}
                onValueChange={(v) => onChange({ ...action, phone: v })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Origem</Label>
            <TokenInput
              value={action.source ?? ""}
              onValueChange={(v) => onChange({ ...action, source: v })}
              placeholder="workflow"
            />
          </div>
        </div>
      );
    case "assign_recruiter":
      return (
        <div className="space-y-2">
          <Label className="text-xs">Recrutador / responsável</Label>
          <UserPicker
            value={action.user_id}
            onChange={(v) => onChange({ ...action, user_id: v })}
          />
          <Label className="text-xs">Alvo</Label>
          <Select
            value={action.target ?? "auto"}
            onValueChange={(v) =>
              onChange({
                ...action,
                target: v as "auto" | "job" | "candidate" | "application" | "interview",
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Automático</SelectItem>
              <SelectItem value="job">Vaga</SelectItem>
              <SelectItem value="candidate">Candidato</SelectItem>
              <SelectItem value="application">Aplicação</SelectItem>
              <SelectItem value="interview">Entrevista</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    case "create_lead":
      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Use <code className="text-[11px]">{`{{campo}}`}</code> para puxar valores do registro
            que disparou o workflow.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Nome *</Label>
              <TokenInput
                value={action.first_name}
                onValueChange={(v) => onChange({ ...action, first_name: v })}
                placeholder="{{first_name}}"
              />
            </div>
            <div>
              <Label className="text-xs">Sobrenome</Label>
              <TokenInput
                value={action.last_name ?? ""}
                onValueChange={(v) => onChange({ ...action, last_name: v })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Email</Label>
              <TokenInput
                value={action.email ?? ""}
                onValueChange={(v) => onChange({ ...action, email: v })}
              />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <TokenInput
                value={action.phone ?? ""}
                onValueChange={(v) => onChange({ ...action, phone: v })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Empresa</Label>
              <TokenInput
                value={action.company_name ?? ""}
                onValueChange={(v) => onChange({ ...action, company_name: v })}
              />
            </div>
            <div>
              <Label className="text-xs">Origem</Label>
              <TokenInput
                value={action.source ?? ""}
                onValueChange={(v) => onChange({ ...action, source: v })}
                placeholder="workflow"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Responsável (opcional)</Label>
            <UserPicker
              value={action.owner_id ?? ""}
              onChange={(v) => onChange({ ...action, owner_id: v })}
            />
          </div>
          <ExtraFieldsEditor
            entity="leads"
            extraFields={action.extra_fields}
            hiddenKeys={[
              "first_name",
              "last_name",
              "email",
              "phone",
              "company_name",
              "source",
              "owner_id",
              "status",
            ]}
            triggerEntity={entity}
            onChange={(v) => onChange({ ...action, extra_fields: v })}
          />
        </div>
      );
    case "create_contact":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Nome *</Label>
              <TokenInput
                value={action.first_name}
                onValueChange={(v) => onChange({ ...action, first_name: v })}
                placeholder="{{first_name}}"
              />
            </div>
            <div>
              <Label className="text-xs">Sobrenome</Label>
              <TokenInput
                value={action.last_name ?? ""}
                onValueChange={(v) => onChange({ ...action, last_name: v })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Email</Label>
              <TokenInput
                value={action.email ?? ""}
                onValueChange={(v) => onChange({ ...action, email: v })}
              />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <TokenInput
                value={action.phone ?? ""}
                onValueChange={(v) => onChange({ ...action, phone: v })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Cargo</Label>
              <TokenInput
                value={action.job_title ?? ""}
                onValueChange={(v) => onChange({ ...action, job_title: v })}
              />
            </div>
            <div>
              <Label className="text-xs">Empresa</Label>
              <TokenInput
                value={action.company_name ?? ""}
                onValueChange={(v) => onChange({ ...action, company_name: v })}
              />
            </div>
          </div>
          <ExtraFieldsEditor
            entity="contacts"
            extraFields={action.extra_fields}
            hiddenKeys={[
              "first_name",
              "last_name",
              "email",
              "phone",
              "job_title",
              "company_name",
              "owner_id",
            ]}
            triggerEntity={entity}
            onChange={(v) => onChange({ ...action, extra_fields: v })}
          />
        </div>
      );
    case "create_company":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Nome *</Label>
            <TokenInput
              value={action.name}
              onValueChange={(v) => onChange({ ...action, name: v })}
              placeholder="{{company_name}}"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Domínio</Label>
              <TokenInput
                value={action.domain ?? ""}
                onValueChange={(v) => onChange({ ...action, domain: v })}
                placeholder="exemplo.com"
              />
            </div>
            <div>
              <Label className="text-xs">Setor</Label>
              <TokenInput
                value={action.industry ?? ""}
                onValueChange={(v) => onChange({ ...action, industry: v })}
              />
            </div>
          </div>
          <ExtraFieldsEditor
            entity="companies"
            extraFields={action.extra_fields}
            hiddenKeys={["name", "domain", "industry", "owner_id"]}
            triggerEntity={entity}
            onChange={(v) => onChange({ ...action, extra_fields: v })}
          />
        </div>
      );
    case "create_deal":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Nome do negócio *</Label>
            <TokenInput
              value={action.name}
              onValueChange={(v) => onChange({ ...action, name: v })}
              placeholder="Negócio com {{name}}"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Valor</Label>
              <Input
                type="number"
                value={action.value ?? ""}
                onChange={(e) =>
                  onChange({
                    ...action,
                    value: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Moeda</Label>
              <Input
                value={action.currency ?? "BRL"}
                onChange={(e) => onChange({ ...action, currency: e.target.value })}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Pipeline padrão será usado se não for especificado. Contato/empresa são associados
            automaticamente quando o workflow dispara neles.
          </p>
          <ExtraFieldsEditor
            entity="deals"
            extraFields={action.extra_fields}
            hiddenKeys={["name", "value", "currency", "pipeline_id", "stage_id", "owner_id"]}
            triggerEntity={entity}
            onChange={(v) => onChange({ ...action, extra_fields: v })}
          />
        </div>
      );
    case "create_ticket":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Assunto *</Label>
            <TokenInput
              value={action.subject}
              onValueChange={(v) => onChange({ ...action, subject: v })}
              placeholder="Chamado sobre {{name}}"
            />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <TokenTextarea
              value={action.description ?? ""}
              onValueChange={(v) => onChange({ ...action, description: v })}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select
                value={action.priority ?? "normal"}
                onValueChange={(v) => onChange({ ...action, priority: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Responsável</Label>
              <UserPicker
                value={action.assignee_id ?? ""}
                onChange={(v) => onChange({ ...action, assignee_id: v })}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Pipeline</Label>
            <FkPicker
              kind="pipeline"
              value={(action.extra_fields?.pipeline_id as string) ?? ""}
              onChange={(v) =>
                onChange({
                  ...action,
                  extra_fields: { ...(action.extra_fields ?? {}), pipeline_id: v || undefined },
                })
              }
            />
          </div>
          <ExtraFieldsEditor
            entity="tickets"
            extraFields={action.extra_fields}
            hiddenKeys={["subject", "description", "priority", "pipeline_id", "assignee_id"]}
            triggerEntity={entity}
            onChange={(v) => onChange({ ...action, extra_fields: v })}
          />
        </div>
      );
    case "create_task":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Assunto *</Label>
            <TokenInput
              value={action.subject}
              onValueChange={(v) => onChange({ ...action, subject: v })}
              placeholder="Ligar para {{first_name}}"
            />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <TokenTextarea
              value={action.body ?? ""}
              onValueChange={(v) => onChange({ ...action, body: v })}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Vence em (dias)</Label>
              <Input
                type="number"
                min={0}
                max={365}
                value={action.due_in_days ?? ""}
                onChange={(e) =>
                  onChange({
                    ...action,
                    due_in_days: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Responsável</Label>
              <UserPicker
                value={action.assignee_id ?? ""}
                onChange={(v) => onChange({ ...action, assignee_id: v })}
              />
            </div>
          </div>
          <ExtraFieldsEditor
            entity="activities"
            extraFields={action.extra_fields}
            hiddenKeys={[
              "subject",
              "body",
              "type",
              "due_date",
              "owner_id",
              "related_lead_id",
              "related_contact_id",
              "related_company_id",
              "related_deal_id",
            ]}
            triggerEntity={entity}
            onChange={(v) => onChange({ ...action, extra_fields: v })}
          />
        </div>
      );

    case "copy_field_from_association":
      return <CopyFromAssociationForm entity={entity} action={action} onChange={onChange} />;
    case "associate_records":
      return <AssociateRecordsForm entity={entity} action={action} onChange={onChange} />;
    case "disassociate_records":
      return <DisassociateRecordsForm entity={entity} action={action} onChange={onChange} />;
    case "clear_field":
      return (
        <div className="space-y-2">
          <Label className="text-xs">Campo a limpar</Label>
          <FieldSelect
            entity={entity}
            value={action.field}
            onChange={(v) => onChange({ ...action, field: v })}
          />
        </div>
      );
    case "increment_field":
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Campo numérico</Label>
            <FieldSelect
              entity={entity}
              value={action.field}
              onChange={(v) => onChange({ ...action, field: v })}
            />
          </div>
          <div>
            <Label className="text-xs">Incrementar em</Label>
            <Input
              type="number"
              value={action.amount}
              onChange={(e) => onChange({ ...action, amount: Number(e.target.value) || 0 })}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Use valores negativos para decrementar.
            </p>
          </div>
        </div>
      );
    case "send_email":
      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Fica na caixa de saída (email_messages) como outbound; a entrega ocorre pela conta de
            email configurada.
          </p>
          <div>
            <Label className="text-xs">Template (opcional)</Label>
            <EmailTemplatePicker
              value={action.template_id ?? ""}
              onChange={(v) => onChange({ ...action, template_id: v || undefined })}
            />
          </div>
          <div>
            <Label className="text-xs">Assunto *</Label>
            <TokenInput
              value={action.subject}
              onValueChange={(v) => onChange({ ...action, subject: v })}
              placeholder="Olá {{first_name}}"
            />
          </div>
          <div>
            <Label className="text-xs">Corpo *</Label>
            <TokenTextarea
              value={action.body}
              onValueChange={(v) => onChange({ ...action, body: v })}
              rows={5}
            />
          </div>
          <div>
            <Label className="text-xs">Campo com email do destinatário</Label>
            <Input
              value={action.to_field ?? ""}
              onChange={(e) => onChange({ ...action, to_field: e.target.value })}
              placeholder="email"
            />
          </div>
        </div>
      );
    case "send_whatsapp":
      return (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Enfileira em whatsapp_messages (outbound, status queued). Entrega depende do provedor
            configurado.
          </p>
          <div>
            <Label className="text-xs">Template (opcional)</Label>
            <Input
              value={action.template_name ?? ""}
              onChange={(e) => onChange({ ...action, template_name: e.target.value || undefined })}
              placeholder="nome_do_template_aprovado"
            />
          </div>
          <div>
            <Label className="text-xs">Corpo (se não usar template)</Label>
            <TokenTextarea
              value={action.body ?? ""}
              onValueChange={(v) => onChange({ ...action, body: v })}
              rows={3}
              placeholder="Olá {{first_name}}, ..."
            />
          </div>
          <div>
            <Label className="text-xs">Campo com telefone do destinatário</Label>
            <Input
              value={action.to_field ?? ""}
              onChange={(e) => onChange({ ...action, to_field: e.target.value })}
              placeholder="phone"
            />
          </div>
        </div>
      );
    case "switch_by_value":
      return (
        <SwitchByValueForm
          entity={entity}
          entityFields={entityFields}
          action={action}
          onChange={onChange}
        />
      );
    case "branch_multi":
      return (
        <BranchMultiForm
          entity={entity}
          entityFields={entityFields}
          priorFields={priorFields}
          action={action}
          onChange={onChange}
        />
      );
    case "create_survey_activity":
      return <CreateSurveyActivityForm action={action} onChange={onChange} />;
    case "open_deal_dialog":
      return (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Pipeline de negócios</Label>
            <FkPicker
              kind="pipeline"
              value={action.pipeline_id ?? ""}
              onChange={(v) => onChange({ ...action, pipeline_id: v || undefined })}
            />
            <p className="text-xs text-muted-foreground">
              Em branco usa o pipeline padrão de negócios.
            </p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="wf-open-deal-stage">
              Estágio inicial (opcional)
            </Label>
            <Input
              id="wf-open-deal-stage"
              value={action.stage_value ?? ""}
              onChange={(e) => onChange({ ...action, stage_value: e.target.value || undefined })}
              placeholder="ex: scope/solution"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data de previsão sugerida</Label>
            <Select
              value={action.due_rule ?? "last_business_day_of_month"}
              onValueChange={(v) =>
                onChange({
                  ...action,
                  due_rule: v === "none" ? "none" : "last_business_day_of_month",
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="last_business_day_of_month">
                  Último dia útil do mês corrente
                </SelectItem>
                <SelectItem value="none">Não sugerir</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Título da pendência (opcional)</Label>
            <TokenInput
              value={action.subject ?? ""}
              onValueChange={(v) => onChange({ ...action, subject: v || undefined })}
              placeholder="Criar oportunidade"
            />
          </div>
        </div>
      );
    case "delay_until_date":
      return <DelayUntilDateForm entity={entity} action={action} onChange={onChange} />;
    case "format_data":
      return <FormatDataForm action={action} onChange={onChange} />;
    case "send_slack":
      return <SendSlackForm action={action} onChange={onChange} />;
    case "send_teams":
      return <SendTeamsForm action={action} onChange={onChange} />;
    case "approval_step":
      return <ApprovalStepForm action={action} onChange={onChange} />;
    case "create_record":
    case "update_record":
    case "delete_record":
      return <GenericRecordForm action={action} onChange={onChange} triggerEntity={entity} />;
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
      return null;
    }
  }
}
