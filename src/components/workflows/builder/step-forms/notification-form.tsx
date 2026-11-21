import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  notificationFollowupEventAllowed,
  notificationFollowupProblem,
} from "@/lib/notifications/scheduling-types";
import type { NotificationDeliveryConfig } from "@/lib/notifications/delivery-types";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import type { NotificationRecipientRule } from "@/lib/notification-recipients";
import type { WorkflowAction, WorkflowEntity } from "@/lib/workflows/types";
import { TokenInput, TokenTextarea } from "../../token-input";
import { UserPicker } from "./pickers";
import { NotificationDeliveryChoice } from "./notification-delivery-choice";
import { usePermissions } from "@/lib/access-control/use-permissions";

type Action = Extract<WorkflowAction, { type: "send_notification" }>;
type Kind = NotificationRecipientRule["kind"];
const LABELS: Record<Kind, string> = {
  workflow_owner: "Executor do workflow",
  user: "Membro específico",
  source_responsible: "Responsável pelo registro",
  source_creator: "Criador do registro",
  area_manager: "Gestor da área",
  pending_approvers: "Aprovadores da etapa atual",
  project_members: "Membros do projeto",
  team: "Equipe configurada",
  job_role: "Cargo configurado",
  followers: "Seguidores do registro",
};

export function NotificationForm({
  action,
  entity,
  notificationEventKey,
  onChange,
}: {
  action: Action;
  entity: WorkflowEntity;
  notificationEventKey?: string;
  onChange: (action: WorkflowAction) => void;
}) {
  const { data: members = [], isLoading, isError } = useWorkspaceMembers();
  const permissions = usePermissions();
  const preparationApproval = entity === "hiring_preparation_requests";
  const canEditDelivery =
    !permissions.isLoading &&
    !permissions.isError &&
    Boolean(permissions.workspaceId) &&
    permissions.canAny(
      ["create", "update", "manage"].flatMap((action) =>
        ["own", "team", "workspace"].map((scope) => `system.workflows.${action}.${scope}`),
      ),
    );
  // Merely opening an old workflow does not rewrite it or activate new targeting rules.
  const rules: NotificationRecipientRule[] =
    action.recipients ??
    (action.user_id ? [{ kind: "user", id: action.user_id }] : [{ kind: "workflow_owner" }]);
  const options: Kind[] = preparationApproval
    ? ["pending_approvers"]
    : ["workflow_owner", "user", "source_responsible", "source_creator"];
  if (["people", "deals", "ats_jobs"].includes(entity)) options.push("area_manager");
  if (entity === "contracts") options.push("pending_approvers");
  if (["projects", "project_tasks", "project_milestones"].includes(entity))
    options.push("project_members");
  const labelFor = (kind: Kind) => {
    if (entity === "hiring_fiscal_documents" && kind === "source_responsible")
      return "Responsável Financeiro da formalização";
    if (entity === "hiring_fiscal_documents" && kind === "source_creator")
      return "Quem enviou a nota (escolha explícita)";
    if (preparationApproval && kind === "pending_approvers")
      return "Aprovador nomeado da etapa vigente";
    if (kind !== "area_manager") return LABELS[kind];
    if (entity === "people") return "Gestor da pessoa";
    if (entity === "deals") return "Líder da equipe do negócio";
    if (entity === "ats_jobs") return "Gestor da área de recrutamento";
    return LABELS[kind];
  };
  const update = (next: NotificationRecipientRule[]) => {
    if (preparationApproval) {
      const { user_id: _legacyUser, ...current } = action;
      onChange({ ...current, recipients: next });
    } else onChange({ ...action, recipients: next });
  };
  const replace = (index: number, rule: NotificationRecipientRule) =>
    update(rules.map((current, at) => (at === index ? rule : current)));
  const chooseKind = (index: number, kind: Kind) => {
    if (!options.includes(kind)) return;
    replace(index, kind === "user" ? { kind, id: "" } : ({ kind } as NotificationRecipientRule));
  };

  const delivery: NotificationDeliveryConfig = action.delivery ?? {
    channels: ["inapp"],
    fallback: "none",
  };
  const followup = delivery.followup;
  const followupAllowed = notificationFollowupEventAllowed(notificationEventKey);
  const canConfigureFollowup =
    canEditDelivery && followupAllowed && delivery.channels.includes("inapp");
  const setFollowup = (next: NotificationDeliveryConfig["followup"]) => {
    if (!canEditDelivery) return;
    const nextDelivery = { ...delivery };
    if (!next || (!next.reminder && !next.escalation)) delete nextDelivery.followup;
    else nextDelivery.followup = next;
    onChange({ ...action, delivery: nextDelivery });
  };
  const followupIssue = followup
    ? notificationFollowupProblem(notificationEventKey, delivery)
    : null;

  return (
    <div className="space-y-4">
      {preparationApproval ? (
        <p className="text-sm text-muted-foreground">
          O aviso canônico da solicitação profissional já existe no aplicativo, independentemente
          desta regra, e será reaproveitado sem outra cópia. O texto do processo é preservado.
          Desligar esta regra ou sua preferência de evento não remove esse aviso de processo. Canais
          adicionais explícitos continuam sujeitos ao aprovador vigente, acesso e política.
        </p>
      ) : (
        <>
          <div className="space-y-1">
            <Label htmlFor="notification-title">Título</Label>
            <TokenInput
              id="notification-title"
              value={action.title}
              onValueChange={(title) => onChange({ ...action, title })}
              placeholder="Título"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="notification-body">Corpo (opcional)</Label>
            <TokenTextarea
              id="notification-body"
              value={action.body ?? ""}
              onValueChange={(body) => onChange({ ...action, body })}
              placeholder="Corpo (opcional)"
              rows={2}
            />
          </div>
        </>
      )}
      {entity === "hiring_fiscal_documents" && (
        <p className="text-sm text-muted-foreground">
          Executor do workflow usa o executor da regra, ainda sujeito ao acesso fiscal. Responsável
          pelo registro é somente o responsável Financeiro da formalização vigente, resolvido na
          origem, sem CEO ou substituto presumido. Quem enviou a nota recebe apenas quando escolhido
          explicitamente; envio não o torna aprovador.
        </p>
      )}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Quem recebe o aviso</legend>
        {rules.map((rule, index) => {
          const supported = options.includes(rule.kind);
          return (
            <div key={index} className="space-y-2">
              <div className="flex items-center gap-2">
                <Select value={rule.kind} onValueChange={(kind) => chooseKind(index, kind as Kind)}>
                  <SelectTrigger aria-label={`Destinatário ${index + 1}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {!supported && (
                      <SelectItem value={rule.kind} disabled>
                        {labelFor(rule.kind)} · preservado
                      </SelectItem>
                    )}
                    {options.map((kind) => (
                      <SelectItem key={kind} value={kind}>
                        {labelFor(kind)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover destinatário ${index + 1}`}
                  disabled={rules.length <= 1}
                  onClick={() => update(rules.filter((_, at) => at !== index))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {!supported && (
                <p className="text-xs text-muted-foreground" role="status">
                  Destino salvo preservado. Esta opção ainda não pode ser configurada neste
                  formulário. A entrega depende de uma fonte válida e da leitura do registro; não há
                  destinatário alternativo automático.
                </p>
              )}
              {rule.kind === "user" && !preparationApproval && (
                <div className="space-y-1">
                  <Label className="text-xs">Membro do workspace</Label>
                  {members.length > 0 ? (
                    <UserPicker
                      value={rule.id}
                      onChange={(id) => replace(index, { kind: "user", id })}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground" role="status">
                      {isLoading
                        ? "Carregando membros…"
                        : isError
                          ? "Não foi possível carregar os membros. Recarregue antes de escolher."
                          : "Nenhum membro disponível para seleção."}
                    </p>
                  )}
                  {rule.id &&
                    !isLoading &&
                    !members.some((member) => member.user_id === rule.id) && (
                      <p className="text-xs text-muted-foreground">
                        O membro anteriormente configurado está indisponível. O vínculo foi
                        preservado para revisão.
                      </p>
                    )}
                  {!rule.id && (
                    <p className="text-xs text-muted-foreground">
                      Selecione um membro antes de salvar o workflow.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={preparationApproval || rules.length >= 10}
          onClick={() => update([...rules, { kind: "source_responsible" }])}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar destinatário
        </Button>
        <p className="text-xs text-muted-foreground">
          De 1 a 10 regras. Uma pessoa selecionada por mais de uma regra recebe um único aviso.
        </p>
      </fieldset>
      <NotificationDeliveryChoice
        action={action}
        onChange={onChange}
        canEdit={canEditDelivery}
        notificationEventKey={notificationEventKey}
      />
      {(followupAllowed || followup) && (
        <section
          className="space-y-3 border-t border-border pt-4"
          aria-label="Acompanhamento do aviso"
        >
          <h3 className="text-sm font-medium">Lembretes e escalonamento</h3>
          <p className="text-xs text-muted-foreground">
            Começam desligados. Só acompanham este aviso enquanto ele existe, continua não lido e a
            pendência atual permanece válida. Ler interrompe estes acompanhamentos; não resolve,
            aprova ou paga o registro. Outros passos do Workflow não são repetidos.
          </p>
          {!delivery.channels.includes("inapp") && (
            <p className="text-sm text-muted-foreground">
              Inclua o canal No app para configurar acompanhamento.
            </p>
          )}
          <fieldset className="space-y-3" disabled={!canEditDelivery}>
            <legend className="sr-only">Configurar lembretes e escalonamento</legend>
            <div className="flex items-center gap-3">
              <Checkbox
                id="notification-reminder"
                checked={Boolean(followup?.reminder)}
                disabled={!canConfigureFollowup && !followup?.reminder}
                onCheckedChange={(checked) =>
                  setFollowup({
                    ...followup,
                    reminder:
                      checked === true ? { interval_hours: 0, max_occurrences: 1 } : undefined,
                  })
                }
              />
              <Label htmlFor="notification-reminder">Lembrar o destinatário original</Label>
            </div>
            {followup?.reminder && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  Intervalo em horas
                  <Input
                    aria-label="Intervalo do lembrete em horas"
                    type="number"
                    min={1}
                    max={168}
                    required
                    value={followup.reminder.interval_hours || ""}
                    onChange={(event) =>
                      setFollowup({
                        ...followup,
                        reminder: {
                          ...followup.reminder!,
                          interval_hours: Number(event.target.value),
                        },
                      })
                    }
                  />
                </label>
                <label className="space-y-1 text-sm">
                  Quantidade máxima de lembretes
                  <select
                    aria-label="Quantidade máxima de lembretes"
                    className="block h-10 w-full rounded-md border border-input bg-background px-3"
                    value={followup.reminder.max_occurrences}
                    onChange={(event) =>
                      setFollowup({
                        ...followup,
                        reminder: {
                          ...followup.reminder!,
                          max_occurrences: Number(event.target.value),
                        },
                      })
                    }
                  >
                    {[1, 2, 3].map((count) => (
                      <option key={count} value={count}>
                        {count}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
            {preparationApproval ? (
              <p className="text-xs text-muted-foreground">
                Esta aprovação não é agrupada em resumo. O lembrete mantém somente o aprovador
                vigente; escalonamento não é permitido.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="notification-escalation"
                    checked={Boolean(followup?.escalation)}
                    disabled={!canConfigureFollowup && !followup?.escalation}
                    onCheckedChange={(checked) =>
                      setFollowup({
                        ...followup,
                        escalation:
                          checked === true
                            ? { after_hours: 0, recipient: { kind: "user", id: "" } }
                            : undefined,
                      })
                    }
                  />
                  <Label htmlFor="notification-escalation">
                    Avisar um destinatário de escalonamento
                  </Label>
                </div>
                {followup?.escalation && (
                  <div className="space-y-3">
                    <label className="block space-y-1 text-sm">
                      Escalonar após quantas horas
                      <Input
                        aria-label="Prazo do escalonamento em horas"
                        type="number"
                        min={1}
                        max={168}
                        required
                        value={followup.escalation.after_hours || ""}
                        onChange={(event) =>
                          setFollowup({
                            ...followup,
                            escalation: {
                              ...followup.escalation!,
                              after_hours: Number(event.target.value),
                            },
                          })
                        }
                      />
                    </label>
                    <label className="block space-y-1 text-sm">
                      Destinatário explícito do escalonamento
                      <select
                        aria-label="Destinatário do escalonamento"
                        className="block h-10 w-full rounded-md border border-input bg-background px-3"
                        value={followup.escalation.recipient.kind}
                        onChange={(event) => {
                          const kind = event.target.value as Kind;
                          if (options.includes(kind))
                            setFollowup({
                              ...followup,
                              escalation: {
                                ...followup.escalation!,
                                recipient:
                                  kind === "user"
                                    ? { kind, id: "" }
                                    : ({ kind } as NotificationRecipientRule),
                              },
                            });
                        }}
                      >
                        {!options.includes(followup.escalation.recipient.kind) && (
                          <option value={followup.escalation.recipient.kind} disabled>
                            Destino salvo · requer revisão
                          </option>
                        )}
                        {options.map((kind) => (
                          <option key={kind} value={kind}>
                            {labelFor(kind)}
                          </option>
                        ))}
                      </select>
                    </label>
                    {followup.escalation.recipient.kind === "user" && (
                      <UserPicker
                        value={followup.escalation.recipient.id}
                        onChange={(id) =>
                          setFollowup({
                            ...followup,
                            escalation: {
                              ...followup.escalation!,
                              recipient: { kind: "user", id },
                            },
                          })
                        }
                      />
                    )}
                    <p className="text-xs text-muted-foreground">
                      Uma única escalada. Revalida vínculo, acesso e canais atuais; não troca o
                      aprovador da origem nem presume gestor, CEO ou substituto.
                    </p>
                  </div>
                )}
              </>
            )}
            {followup && (
              <Button type="button" variant="ghost" onClick={() => setFollowup(undefined)}>
                Desativar acompanhamento deste passo
              </Button>
            )}
          </fieldset>
          <p className="text-xs text-muted-foreground">
            Intervalo de 1 a 168 horas, até 3 lembretes; intervalo × quantidade e prazo de
            escalonamento não podem ultrapassar 168 horas. Canais e fallback seguem este passo;
            lembretes não entram no resumo. Exige política e cota de acompanhamento do workspace.
          </p>
          {entity === "hiring_fiscal_documents" && (
            <p className="text-xs text-muted-foreground">
              A NF precisa continuar registrada e aguardando conferência. Conferência ou rejeição
              encerra o acompanhamento.
            </p>
          )}
          {followupIssue && (
            <p role="alert" className="text-sm text-destructive">
              {followupIssue}
            </p>
          )}
        </section>
      )}
      <p className="text-xs text-muted-foreground">
        Somente membros ativos do mesmo workspace e com leitura do registro de origem podem receber.
        Gestor ou aprovador ausente não encaminha o aviso automaticamente ao CEO. Ler o aviso não
        aprova nem conclui a tarefa.
      </p>
      <p className="text-xs text-muted-foreground">
        Textos com variáveis são enviados como aviso neutro; consulte os detalhes no TechERP, para
        preservar dados privados. Título e corpo sem variáveis são mantidos. Não inclua informações
        sensíveis no texto do aviso.
      </p>
    </div>
  );
}
