import { NOTIFICATION_UPDATE_TEXT } from "@/lib/notifications/delivery-content";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TokenInput, TokenTextarea } from "../../token-input";
import type { WorkflowAction } from "@/lib/workflows/types";

export function SendSlackForm({
  action,
  onChange,
}: {
  action: Extract<WorkflowAction, { type: "send_slack" }>;
  onChange: (a: WorkflowAction) => void;
}) {
  const permissions = usePermissions();
  const canEdit =
    !permissions.isLoading &&
    !permissions.isError &&
    permissions.canAny([
      "system.workflows.manage.workspace",
      "system.workflows.update.workspace",
      "system.workflows.create.workspace",
    ]);
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Aviso coletivo no canal fixo da conexão escolhida em Notificações → Modelos e canais.
      </p>
      <div className="rounded-md bg-muted p-3 text-sm">
        {NOTIFICATION_UPDATE_TEXT}
        <p className="mt-1 text-muted-foreground">
          Abrir a central de notificações (acesso autenticado).
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Uma mensagem por ocorrência. O envio exige política Slack habilitada e cota disponível. O
        histórico do workspace registra a aceitação pelo provedor, sem presumir leitura pessoal.
      </p>
      {action.channel?.trim() && (
        <div className="space-y-2" role="alert">
          <p className="text-sm">
            Esta ação possui um canal antigo que o Incoming Webhook não consegue sobrescrever. O
            envio ficará bloqueado até removê-lo.
          </p>
          <Button
            type="button"
            variant="outline"
            disabled={!canEdit}
            onClick={() => {
              if (canEdit) onChange({ ...action, channel: undefined });
            }}
          >
            Remover canal antigo
          </Button>
        </div>
      )}
      {action.text && action.text !== NOTIFICATION_UPDATE_TEXT && (
        <p className="text-xs text-muted-foreground">
          O texto antigo foi preservado no rascunho. O envio usa somente o modelo protegido acima,
          sem variáveis ou dados do registro.
        </p>
      )}
    </div>
  );
}

export function SendTeamsForm({
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
          placeholder="Aceita variáveis {{campo}} e {{variaveis.nome}}"
        />
      </div>
    </div>
  );
}
