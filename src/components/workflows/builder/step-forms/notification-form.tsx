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
  onChange,
}: {
  action: Action;
  entity: WorkflowEntity;
  onChange: (action: WorkflowAction) => void;
}) {
  const { data: members = [], isLoading, isError } = useWorkspaceMembers();
  // Merely opening an old workflow does not rewrite it or activate new targeting rules.
  const rules: NotificationRecipientRule[] =
    action.recipients ??
    (action.user_id ? [{ kind: "user", id: action.user_id }] : [{ kind: "workflow_owner" }]);
  const options: Kind[] = ["workflow_owner", "user", "source_responsible", "source_creator"];
  if (["people", "deals", "ats_jobs"].includes(entity)) options.push("area_manager");
  if (entity === "contracts") options.push("pending_approvers");
  if (["projects", "project_tasks", "project_milestones"].includes(entity))
    options.push("project_members");
  const labelFor = (kind: Kind) => {
    if (kind !== "area_manager") return LABELS[kind];
    if (entity === "people") return "Gestor da pessoa";
    if (entity === "deals") return "Líder da equipe do negócio";
    if (entity === "ats_jobs") return "Gestor da área de recrutamento";
    return LABELS[kind];
  };
  const update = (next: NotificationRecipientRule[]) => onChange({ ...action, recipients: next });
  const replace = (index: number, rule: NotificationRecipientRule) =>
    update(rules.map((current, at) => (at === index ? rule : current)));
  const chooseKind = (index: number, kind: Kind) => {
    if (!options.includes(kind)) return;
    replace(index, kind === "user" ? { kind, id: "" } : ({ kind } as NotificationRecipientRule));
  };

  return (
    <div className="space-y-4">
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
              {rule.kind === "user" && (
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
          disabled={rules.length >= 10}
          onClick={() => update([...rules, { kind: "source_responsible" }])}
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar destinatário
        </Button>
        <p className="text-xs text-muted-foreground">
          De 1 a 10 regras. Uma pessoa selecionada por mais de uma regra recebe um único aviso.
        </p>
      </fieldset>
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
