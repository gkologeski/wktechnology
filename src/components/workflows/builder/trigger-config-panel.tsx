import { workflowNotificationEventFieldAllowed } from "@/lib/workflows/notification-events";
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
  WORKFLOW_READONLY_SOURCE_TABLES,
  type WorkflowCondition,
  type WorkflowEntity,
  type WorkflowEventType,
  type WorkflowTrigger,
} from "@/lib/workflows/types";
import type { FieldOpt } from "./step-tree";
import { ConditionListEditor, conditionsIncludeField } from "./conditions-editor";
import { WhatsAppInboundFilters } from "./whatsapp-inbound-filters";
import { InboxChannelFilters } from "./inbox-channel-filters";
import {
  inboxEventChannel,
  INBOX_CHANNEL_RUNTIME_READY,
} from "@/lib/workflows/inbox-channel-events";
import {
  WORKFLOW_NOTIFICATION_EVENTS,
  getWorkflowNotificationEvent,
  workflowNotificationEventTrigger,
} from "@/lib/workflows/notification-events";

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
  fields = fields.filter((field) =>
    workflowNotificationEventFieldAllowed(trigger.notification_event?.key, field.name),
  );
  const defaultField = fields[0]?.name ?? "";
  const notificationEvent = getWorkflowNotificationEvent(trigger.notification_event?.key);
  const readOnlySource = WORKFLOW_READONLY_SOURCE_TABLES.some((source) => source === entity);
  const eventOptions = WORKFLOW_NOTIFICATION_EVENTS.filter(
    (event) =>
      event.entity === entity &&
      (INBOX_CHANNEL_RUNTIME_READY || event.entity !== "inbox_channel_occurrences"),
  );

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
        <Label className="text-xs">Evento de negócio</Label>
        <select
          aria-label="Evento de negócio do Workflow"
          className="mt-1 block h-10 w-full max-w-full rounded-md border border-input bg-background px-3 text-sm"
          value={trigger.notification_event?.key ?? ""}
          onChange={(event) => {
            if (readOnlySource && !event.target.value) return;
            const definition = getWorkflowNotificationEvent(event.target.value);
            if (event.target.value && (!definition || definition.entity !== entity)) return;
            onChange((current) => {
              const { notification_event: _event, time_based: _time, ...generic } = current;
              return definition
                ? {
                    ...generic,
                    ...workflowNotificationEventTrigger(definition.key),
                    filters: current.filters ?? [],
                  }
                : { ...current, notification_event: undefined };
            });
          }}
        >
          <option value="" disabled={readOnlySource}>
            {readOnlySource ? "Selecione o evento compatível" : "Evento genérico do objeto"}
          </option>
          {trigger.notification_event &&
            !eventOptions.some((event) => event.key === trigger.notification_event!.key) && (
              <option value={trigger.notification_event.key} disabled>
                Evento salvo incompatível com este objeto
              </option>
            )}
          {[
            { prefix: "shared.", label: "Atendimento" },
            { prefix: "crm.", label: "TechSales" },
            { prefix: "contracts.", label: "TechContracts" },
            { prefix: "projects.", label: "TechProjects" },
            { prefix: "ats.", label: "TechHire" },
            { prefix: "people.", label: "TechPeople" },
            { prefix: "finance.", label: "TechFinance" },
          ].map((group) => {
            const entries = eventOptions.filter((event) => event.key.startsWith(group.prefix));
            return entries.length ? (
              <optgroup label={group.label} key={group.prefix}>
                {entries.map((event) => (
                  <option value={event.key} key={event.key}>
                    {event.label}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </select>
        {readOnlySource && (
          <p className="mt-2 text-xs text-muted-foreground">
            Esta origem é somente leitura no Workflow e exige o evento de negócio compatível. Ações
            genéricas não podem criar, alterar ou excluir esse registro.
          </p>
        )}
        {notificationEvent && (
          <div className="mt-2 space-y-2 text-xs text-muted-foreground">
            <p>{notificationEvent.description} A seleção não publica nem ativa o Workflow.</p>
            {inboxEventChannel(notificationEvent.key) && trigger.notification_event && (
              <InboxChannelFilters
                key={notificationEvent.key}
                selection={trigger.notification_event}
                onChange={(selection) =>
                  onChange((current) => ({ ...current, notification_event: selection }))
                }
              />
            )}
            {notificationEvent.key === "shared.message.received" && (
              <>
                <p>
                  Cada nova mensagem recebida por Cloud API ou Lovable gera uma ocorrência própria.
                  A mesma entrega do provedor não deve repetir o gatilho. Histórico importado,
                  mensagens enviadas, ligações e recibos de entrega não entram. O aviso direto da
                  Inbox é preservado; destinatários e canais desta regra continuam explícitos.
                </p>
                <WhatsAppInboundFilters
                  selection={trigger.notification_event!}
                  onChange={(selection) =>
                    onChange((current) => ({ ...current, notification_event: selection }))
                  }
                />
              </>
            )}
            {notificationEvent.key === "projects.project.started" && (
              <p>
                Somente a mudança de Planejamento para Ativo. Criar ou importar um projeto já ativo,
                alterar a data de início ou retomar um projeto Em espera não dispara este evento.
              </p>
            )}
            {notificationEvent.moduleKey === "ats" && (
              <p>
                O aviso acompanha a ocorrência comprovada, sem contratar o candidato, aprovar uma
                oferta ou enviar convite por esta seleção. Salário, pareceres, currículo, links
                públicos e dados privados não são copiados automaticamente para a notificação.
              </p>
            )}
            {notificationEvent.key === "people.employment.started" && (
              <p>
                Confirma uma admissão canônica ou um início direto autorizado no fluxo governado.
                Pode conter data futura; não comprova dia trabalhado, pagamento nem acesso
                concedido. Status e datas isolados não geram esta ocorrência.
              </p>
            )}
            {notificationEvent.key === "people.approval.pending" && (
              <p>
                Somente solicitações profissionais da preparação, na etapa atual liberada ao
                aprovador nomeado. Não inclui vagas, fornecedores ou todas as alçadas de RH. O aviso
                existente no aplicativo é reaproveitado, sem outra cópia implícita. Ler o aviso não
                aprova, contrata ou inicia a execução.
              </p>
            )}
            {notificationEvent.moduleKey === "finance" && (
              <p>
                O aviso não paga, recebe, cancela, concilia ou emite documentos. Valores, saldo,
                notas, CNPJ, dados bancários e arquivos permanecem nas telas autorizadas, sem cópia
                para o aviso.
              </p>
            )}
            {(notificationEvent.key === "finance.payable.due" ||
              notificationEvent.key === "finance.receivable.due") && (
              <p>
                Conta do dia: vencimento na data atual do calendário de São Paulo, com saldo em
                aberto. Não há antecedência configurável nem cobrança automática.
              </p>
            )}
            {notificationEvent.key === "finance.invoice.received" && (
              <p>
                Somente NF-e ou NFS-e de contratação registrada no fluxo canônico privado. Recebida
                não significa conferida pelo Financeiro. Não inclui emissão, fatura de cliente, RPA,
                recibo ou evidência de folha; o link não baixa o arquivo nem registra conferência.
              </p>
            )}
            {notificationEvent.scheduling === "overdue" && (
              <p>
                O atraso é detectado no dia seguinte ao prazo, pelo calendário de São Paulo. Não há
                antecedência nem lembrete diário: cada prazo gera uma única ocorrência por regra.
                Prazos vencidos antes da publicação não entram; uma verificação posterior pode
                recuperar os que venceram após a publicação.
              </p>
            )}
            {notificationEvent.deadline && (
              <>
                <Label htmlFor="notification-event-days-before" className="text-xs">
                  Antecedência em dias
                </Label>
                <Input
                  id="notification-event-days-before"
                  aria-label="Antecedência do aviso em dias"
                  type="number"
                  min={1}
                  max={365}
                  step={1}
                  value={trigger.notification_event?.days_before ?? ""}
                  onChange={(event) =>
                    onChange((current) => ({
                      ...current,
                      notification_event: {
                        key: notificationEvent.key,
                        days_before: Number(event.target.value),
                      },
                    }))
                  }
                />
                <p>
                  {notificationEvent.key === "people.document.expiring"
                    ? "O prazo é a validade do documento, pelo calendário de São Paulo. A janela usa a data atual, sem depender de um status antigo. Documentos sem validade, ausentes ou de pessoa arquivada não entram. O aviso não renova o documento."
                    : notificationEvent.key === "projects.milestone.due"
                      ? "O prazo é a data do marco pendente ou em andamento, ainda não concluído, de um projeto em Planejamento, Ativo ou Em espera. O aviso não conclui o marco nem gera cobrança."
                      : notificationEvent.key === "contracts.contract.renewal_due"
                        ? "O prazo de aviso é o fim da vigência menos o aviso prévio cadastrado. Exige renovação automática e aviso prévio válido; o aviso não renova o contrato."
                        : "O prazo é a data de término da vigência cadastrada; o aviso não encerra o contrato."}{" "}
                  A janela começa com a antecedência escolhida e termina no prazo. Prazos já
                  vencidos não entram.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {!trigger.notification_event && !readOnlySource && (
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
      )}

      {!trigger.notification_event && !readOnlySource && (
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
                          ...(t.time_based ?? {
                            kind: "time_since_field",
                            amount: 1,
                            unit: "days",
                          }),
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
      )}

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
          entity={entity}
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
          entity={entity}
          defaultField={defaultField}
          onChange={(next) => onChange((t) => ({ ...t, goal_filters: next }))}
        />
      </div>
    </div>
  );
}
