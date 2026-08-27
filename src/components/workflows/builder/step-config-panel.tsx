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

// ============================================================================
// Configuração de ação: atualizar substatus
// ============================================================================
function SetSubstatusForm({
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

// ============================================================================
// Fase 2 — helpers de UI para associações/campos/templates
// ============================================================================
function AssociationSelect({
  entity,
  value,
  onChange,
}: {
  entity: WorkflowEntity;
  value: string;
  onChange: (v: string) => void;
}) {
  const [assocs, setAssocs] = useState<Array<{ key: string; label: string; target_table: string }>>(
    [],
  );
  useEffect(() => {
    let alive = true;
    import("@/lib/workflows/associations").then((m) => {
      if (alive) {
        setAssocs(
          (m.ENTITY_ASSOCIATIONS[entity] ?? []).map((a) => ({
            key: a.key,
            label: a.label,
            target_table: a.target_table,
          })),
        );
      }
    });
    return () => {
      alive = false;
    };
  }, [entity]);
  if (assocs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Esta entidade não tem associações configuráveis.
      </p>
    );
  }
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Escolha a associação" />
      </SelectTrigger>
      <SelectContent>
        {assocs.map((a) => (
          <SelectItem key={a.key} value={a.key}>
            {a.label} <span className="text-muted-foreground text-xs">({a.target_table})</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FieldSelect({
  entity,
  value,
  onChange,
}: {
  entity: WorkflowEntity;
  value: string;
  onChange: (v: string) => void;
}) {
  const fields = useEntityFieldOptions(entity);
  if (fields.length === 0) {
    return <Input value={value} onChange={(e) => onChange(e.target.value)} />;
  }
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Escolha um campo" />
      </SelectTrigger>
      <SelectContent>
        {fields.map((f) => (
          <SelectItem key={f.name} value={f.name}>
            {f.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CopyFromAssociationForm({
  entity,
  action,
  onChange,
}: {
  entity: WorkflowEntity;
  action: Extract<WorkflowAction, { type: "copy_field_from_association" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs">Associação de origem</Label>
        <AssociationSelect
          entity={entity}
          value={action.association}
          onChange={(v) => onChange({ ...action, association: v })}
        />
      </div>
      <div>
        <Label className="text-xs">Campo de origem</Label>
        <Input
          value={action.source_field}
          onChange={(e) => onChange({ ...action, source_field: e.target.value })}
          placeholder="ex: industry"
        />
      </div>
      <div>
        <Label className="text-xs">Campo de destino (nesta entidade)</Label>
        <FieldSelect
          entity={entity}
          value={action.target_field}
          onChange={(v) => onChange({ ...action, target_field: v })}
        />
      </div>
    </div>
  );
}

function AssociateRecordsForm({
  entity,
  action,
  onChange,
}: {
  entity: WorkflowEntity;
  action: Extract<WorkflowAction, { type: "associate_records" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-xs">Associação</Label>
        <AssociationSelect
          entity={entity}
          value={action.association}
          onChange={(v) => onChange({ ...action, association: v })}
        />
      </div>
      <div>
        <Label className="text-xs">ID do registro alvo</Label>
        <TokenInput
          value={action.target_id}
          onValueChange={(v) => onChange({ ...action, target_id: v })}
          placeholder="uuid ou {{company_id}}"
        />
      </div>
    </div>
  );
}

function DisassociateRecordsForm({
  entity,
  action,
  onChange,
}: {
  entity: WorkflowEntity;
  action: Extract<WorkflowAction, { type: "disassociate_records" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div>
      <Label className="text-xs">Associação a remover</Label>
      <AssociationSelect
        entity={entity}
        value={action.association}
        onChange={(v) => onChange({ ...action, association: v })}
      />
    </div>
  );
}

function EmailTemplatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { data: templates = [] } = useQuery({
    queryKey: ["email-templates-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });
  if (templates.length === 0) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="UUID do template"
      />
    );
  }
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Nenhum (assunto/corpo abaixo)" />
      </SelectTrigger>
      <SelectContent>
        {templates.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            {t.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ============================================================================
// Fase 3 — forms para switch_by_value / branch_multi / delay_until_date
// ============================================================================
function SwitchByValueForm({
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

function BranchMultiForm({
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

function DelayUntilDateForm({
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

// ============================================================================
// Pickers reaproveitados
// ============================================================================
function UserPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: members = [], nameFor } = useWorkspaceMembers();
  if (members.length === 0) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="UUID do usuário"
      />
    );
  }
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Escolha um membro" />
      </SelectTrigger>
      <SelectContent>
        {members.map((m) => (
          <SelectItem key={m.user_id} value={m.user_id}>
            {nameFor(m.user_id)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RotationRulePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: rules = [] } = useQuery({
    queryKey: ["rotation-rules-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rotation_rules")
        .select("id, name, entity")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string; entity: string }>;
    },
  });
  if (rules.length === 0) {
    return (
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="UUID da regra" />
    );
  }
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Escolha uma regra" />
      </SelectTrigger>
      <SelectContent>
        {rules.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            {r.name}
            <span className="text-muted-foreground text-xs ml-1">({r.entity})</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SequencePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { data: seqs = [] } = useQuery({
    queryKey: ["sequences-picker"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sequences").select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
  });
  if (seqs.length === 0) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="UUID da sequência"
      />
    );
  }
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Escolha uma sequência" />
      </SelectTrigger>
      <SelectContent>
        {seqs.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ============================================================================
// Helpers
function FormatDataForm({
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

/** Ação "Criar pesquisa (atividade)": escolhe o questionário/modelo de pesquisa. */
function CreateSurveyActivityForm({
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

function SendSlackForm({
  action,
  onChange,
}: {
  action: Extract<WorkflowAction, { type: "send_slack" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Canal (opcional)</Label>
        <Input
          value={action.channel ?? ""}
          onChange={(e) => onChange({ ...action, channel: e.target.value })}
          placeholder="C0123ABCD ou #geral (usa canal padrão se vazio)"
        />
      </div>
      <div className="space-y-1">
        <Label>Mensagem</Label>
        <TokenTextarea
          value={action.text}
          onValueChange={(v) => onChange({ ...action, text: v })}
          rows={4}
          placeholder="Aceita tokens {{campo}} e {{vars.NOME}}"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Requer o Slack conectado nas integrações do workspace.
      </p>
    </div>
  );
}

function SendTeamsForm({
  action,
  onChange,
}: {
  action: Extract<WorkflowAction, { type: "send_teams" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Webhook URL do Teams</Label>
        <Input
          value={action.webhook_url}
          onChange={(e) => onChange({ ...action, webhook_url: e.target.value })}
          placeholder="https://outlook.office.com/webhook/..."
        />
        <p className="text-xs text-muted-foreground">
          Crie um "Incoming Webhook" no canal do Teams e cole a URL aqui.
        </p>
      </div>
      <div className="space-y-1">
        <Label>Título (opcional)</Label>
        <TokenInput
          value={action.title ?? ""}
          onValueChange={(v) => onChange({ ...action, title: v })}
        />
      </div>
      <div className="space-y-1">
        <Label>Mensagem</Label>
        <TokenTextarea
          value={action.text}
          onValueChange={(v) => onChange({ ...action, text: v })}
          rows={4}
          placeholder="Aceita tokens {{campo}} e {{vars.NOME}}"
        />
      </div>
    </div>
  );
}

function ApprovalStepForm({
  action,
  onChange,
}: {
  action: Extract<WorkflowAction, { type: "approval_step" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Título da aprovação</Label>
        <TokenInput
          value={action.title}
          onValueChange={(v) => onChange({ ...action, title: v })}
          placeholder="Aprovar desconto de {{name}}"
        />
      </div>
      <div className="space-y-1">
        <Label>Contexto para o aprovador (opcional)</Label>
        <TokenTextarea
          value={action.note ?? ""}
          onValueChange={(v) => onChange({ ...action, note: v })}
          rows={3}
          placeholder="Detalhes que o aprovador precisa ver."
        />
      </div>
      <div className="space-y-1">
        <Label>Aprovador (deixe vazio para o dono do workflow)</Label>
        <UserPicker
          value={action.approver_user_id ?? ""}
          onChange={(v) => onChange({ ...action, approver_user_id: v || undefined })}
        />
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Switch
          checked={action.halt_on_reject ?? true}
          onCheckedChange={(v) => onChange({ ...action, halt_on_reject: v })}
          id="halt_on_reject"
        />
        <Label htmlFor="halt_on_reject" className="text-xs">
          Interromper workflow em caso de rejeição
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        O workflow pausa aqui. O aprovador recebe uma notificação e decide em Configurações →
        Workflows → Aprovações pendentes.
      </p>
    </div>
  );
}
