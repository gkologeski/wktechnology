import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { notificationDeliveryInteractionAllowed } from "@/lib/notification-delivery-interaction";
import {
  NOTIFICATION_UPDATE_TEXT,
  notificationCentralUrl,
} from "@/lib/notifications/delivery-content";
import type {
  NotificationSlackPolicy,
  NotificationSlackSettings,
} from "@/lib/notifications/delivery-types";

export function NotificationSlackPolicyPanel({
  settings,
  canEdit = false,
  onSave,
}: {
  settings: NotificationSlackSettings;
  canEdit?: boolean;
  onSave: (policy: NotificationSlackPolicy, revision: number) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState(settings.policy);
  const [baseline, setBaseline] = useState(settings.policy);
  const [revision, setRevision] = useState(settings.revision);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const editable = canEdit === true && settings.canManage === true;
  const selected = settings.integrations.find((item) => item.id === draft.integration_id);
  useEffect(() => {
    if (settings.revision !== revision && !dirty) {
      setDraft(settings.policy);
      setBaseline(settings.policy);
      setRevision(settings.revision);
      setAcknowledged(false);
    }
  }, [settings.policy, settings.revision, revision, dirty]);
  const edit = (patch: Partial<NotificationSlackPolicy>) => {
    if (!notificationDeliveryInteractionAllowed(editable, pendingRef.current)) return;
    setDraft((current) => ({ ...current, ...patch }));
    setAcknowledged(false);
    setError("");
    setMessage("");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!notificationDeliveryInteractionAllowed(editable, pendingRef.current) || !dirty) return;
    if (
      !Number.isInteger(draft.daily_limit) ||
      draft.daily_limit < 0 ||
      draft.daily_limit > 10000
    ) {
      setError("Informe um limite diário inteiro entre 0 e 10.000.");
      return;
    }
    if (draft.enabled && (!draft.daily_limit || !selected || !acknowledged)) {
      setError(
        "Selecione uma conexão autorizada, defina um limite positivo e confirme o público do canal.",
      );
      return;
    }
    pendingRef.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await onSave({ ...draft, template_version: "neutral-v1" }, revision);
      setBaseline(draft);
      setAcknowledged(false);
      setMessage(
        "Política coletiva do Slack salva. O envio depende de uma regra de Workflow ativa.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar. Seu rascunho foi preservado.",
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };
  return (
    <section className="min-w-0 space-y-5 border-t border-border pt-6" aria-label="Slack coletivo">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Slack · avisos para um canal compartilhado</h2>
        <p className="text-sm text-muted-foreground">
          As pessoas com acesso ao canal do Slack podem ver o aviso. Este canal não corresponde a
          uma entrega pessoal nem substitui as permissões do TechERP.
        </p>
      </div>
      <div
        className="space-y-3 rounded-lg bg-muted/30 p-5"
        aria-label="Prévia do aviso coletivo do Slack"
      >
        <p className="text-xs text-muted-foreground">Modelo fixo neutral-v1 · prévia sem envio</p>
        <p className="break-words">
          {NOTIFICATION_UPDATE_TEXT} Acesse a central de notificações:{" "}
          <span className="break-all">{notificationCentralUrl()}</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Destino: /notifications. Cada pessoa precisa entrar no TechERP e ter acesso ao registro. O
          aviso não leva nomes, valores, documentos ou detalhes do evento ao Slack.
        </p>
      </div>
      <form className="space-y-4" onSubmit={(event) => void submit(event)}>
        <fieldset disabled={!editable || pending} className="min-w-0 space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              id="notification-policy-slack"
              checked={draft.enabled}
              onCheckedChange={(enabled) => edit({ enabled })}
            />
            <Label htmlFor="notification-policy-slack">Permitir avisos coletivos no Slack</Label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="min-w-0 space-y-1 text-sm">
              Conexão do workspace
              <select
                aria-label="Conexão do Slack"
                className="h-10 w-full rounded-md border border-input bg-background px-3"
                value={draft.integration_id ?? ""}
                onChange={(event) => edit({ integration_id: event.target.value || null })}
              >
                <option value="">Selecione uma conexão autorizada</option>
                {settings.integrations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.team_name || "Slack"}
                    {item.default_channel_name
                      ? ` · #${item.default_channel_name}`
                      : " · destino do webhook"}
                  </option>
                ))}
              </select>
            </label>
            <div className="space-y-1">
              <Label htmlFor="notification-slack-limit">Limite diário de avisos</Label>
              <Input
                id="notification-slack-limit"
                type="number"
                min={0}
                max={10000}
                step={1}
                value={draft.daily_limit}
                onChange={(event) => edit({ daily_limit: Number(event.target.value) })}
              />
            </div>
          </div>
          {draft.enabled && (
            <label className="flex items-start gap-3 text-sm">
              <input
                aria-label="Confirmar público compartilhado do Slack"
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => {
                  if (notificationDeliveryInteractionAllowed(editable, pendingRef.current))
                    setAcknowledged(event.target.checked);
                }}
                className="mt-1 accent-primary"
              />
              Confirmo que o aviso será visível ao público do canal configurado no Slack e que esse
              destino é adequado para a regra.
            </label>
          )}
        </fieldset>
        {!selected && draft.integration_id && (
          <p role="alert" className="text-sm text-destructive">
            A conexão selecionada não está disponível com seu acesso atual.
          </p>
        )}
        {!settings.integrations.length && (
          <p className="text-sm text-muted-foreground">
            Nenhuma conexão autorizada disponível. Consulte a configuração do Slack com um
            administrador de integrações.
          </p>
        )}
        {!editable && (
          <p className="text-sm text-muted-foreground">
            Consulta apenas. A alteração exige permissão de notificações e de gerenciamento desta
            integração.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
        <Button type="submit" disabled={!editable || pending || !dirty}>
          {pending ? "Salvando…" : "Salvar política do Slack"}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Use a ação Slack do motor de Workflows. O destino é fixado pela conexão; regras antigas de
        canal não o sobrescrevem. Aceitação pelo Slack não comprova entrega ou leitura. O histórico
        fica no escopo autorizado do workspace.
      </p>
    </section>
  );
}
