import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ACTIVITY_TIME_OPTIONS } from "@/lib/activity-date-time";
import { notificationDeliveryInteractionAllowed } from "@/lib/notification-delivery-interaction";
import {
  notificationDigestSettingsSchema,
  notificationDigestSettingsResultSchema,
  type NotificationDigestSettings,
} from "@/lib/notifications/scheduling-types";

/** Own workspace settings only. The parent keys and revalidates the authenticated context. */
export function NotificationDigestPanel({
  settings,
  revision,
  userId,
  workspaceId,
  canEdit = false,
  onSave,
}: {
  settings: NotificationDigestSettings;
  revision: number;
  userId: string;
  workspaceId: string;
  canEdit?: boolean;
  onSave: (settings: NotificationDigestSettings, revision: number) => Promise<unknown>;
}) {
  const { user } = useAuth();
  const permissions = usePermissions();
  const ownContextReady =
    user?.id === userId &&
    !permissions.isLoading &&
    !permissions.isError &&
    permissions.workspaceId === workspaceId;
  const editable = canEdit && ownContextReady;
  const [editor, setEditor] = useState(() => ({
    baseline: settings,
    draft: structuredClone(settings),
    revision,
  }));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify(editor.draft) !== JSON.stringify(editor.baseline);
  // A confirmed mutation response can arrive before its cache notification. Never regress to older props.
  const conflict = revision > editor.revision;
  useEffect(() => {
    if (conflict && !dirty) {
      setEditor({ baseline: settings, draft: structuredClone(settings), revision });
      setError("");
      setMessage("");
    }
  }, [conflict, dirty, settings, revision]);
  const edit = (patch: Partial<NotificationDigestSettings>) => {
    if (!notificationDeliveryInteractionAllowed(editable, pending) || conflict) return;
    setEditor((current) => ({ ...current, draft: { ...current.draft, ...patch } }));
    setError("");
    setMessage("");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!notificationDeliveryInteractionAllowed(editable, pending) || !dirty || conflict) return;
    const parsed = notificationDigestSettingsSchema.safeParse(editor.draft);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise as opções do resumo.");
      return;
    }
    const snapshot = structuredClone(parsed.data);
    setPending(true);
    setError("");
    setMessage("");
    try {
      const response = notificationDigestSettingsResultSchema.safeParse(
        await onSave(snapshot, editor.revision),
      );
      setEditor((current) => ({
        ...current,
        baseline: snapshot,
        revision:
          response.success &&
          response.data.revision >= current.revision &&
          JSON.stringify(response.data.settings) === JSON.stringify(snapshot)
            ? response.data.revision
            : current.revision,
      }));
      setMessage(
        "Opções do resumo deste workspace salvas. Nenhuma mensagem foi enviada por esta ação.",
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o resumo. Seu rascunho foi preservado.",
      );
    } finally {
      setPending(false);
    }
  };
  const draft = editor.draft;
  const times = ACTIVITY_TIME_OPTIONS.includes(draft.at)
    ? ACTIVITY_TIME_OPTIONS
    : [draft.at, ...ACTIVITY_TIME_OPTIONS];
  if (!ownContextReady)
    return <p role="status">Aguardando confirmação da identidade e do workspace do resumo…</p>;
  return (
    <form
      className="min-w-0 max-w-full space-y-4 border-t border-border pt-6"
      aria-label="Resumo pessoal deste workspace"
      onSubmit={(event) => void submit(event)}
    >
      <div>
        <h2 className="text-lg font-semibold">Receber resumo de notificações</h2>
        <p className="text-sm text-muted-foreground">
          Adesão pessoal, somente neste workspace. Começa desligada e é separada do agrupamento
          visual da central.
        </p>
      </div>
      {conflict && dirty && (
        <p role="alert" className="text-sm text-destructive">
          As opções mudaram em outra sessão. Seu rascunho foi preservado; recarregue antes de salvar
          novamente.
        </p>
      )}
      <fieldset disabled={!editable || pending || conflict} className="min-w-0 space-y-4">
        <legend className="sr-only">Agendar resumo pessoal</legend>
        <div className="flex items-center gap-3">
          <Switch
            id="notification-digest-enabled"
            checked={draft.enabled}
            onCheckedChange={(enabled) => edit({ enabled })}
          />
          <Label htmlFor="notification-digest-enabled">Quero receber o resumo</Label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            Frequência
            <select
              aria-label="Frequência do resumo"
              className="block h-10 w-full rounded-md border border-input bg-background px-3"
              value={draft.frequency}
              onChange={(event) =>
                edit({ frequency: event.target.value as NotificationDigestSettings["frequency"] })
              }
            >
              <option value="daily">Diário</option>
              <option value="weekly">Semanal</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            Horário do resumo
            <select
              aria-label="Horário do resumo"
              className="block h-10 w-full rounded-md border border-input bg-background px-3"
              value={draft.at}
              onChange={(event) => edit({ at: event.target.value })}
            >
              {times.map((at) => (
                <option key={at} value={at}>
                  {at}
                </option>
              ))}
            </select>
          </label>
          {draft.frequency === "weekly" && (
            <label className="space-y-1 text-sm">
              Dia da semana
              <select
                aria-label="Dia do resumo semanal"
                className="block h-10 w-full rounded-md border border-input bg-background px-3"
                value={draft.weekday}
                onChange={(event) => edit({ weekday: Number(event.target.value) })}
              >
                {[
                  "Segunda-feira",
                  "Terça-feira",
                  "Quarta-feira",
                  "Quinta-feira",
                  "Sexta-feira",
                  "Sábado",
                  "Domingo",
                ].map((day, index) => (
                  <option key={day} value={index + 1}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="space-y-1 text-sm">
            Fuso horário IANA
            <Input
              aria-label="Fuso horário do resumo"
              value={draft.timezone}
              onChange={(event) => edit({ timezone: event.target.value })}
            />
          </label>
        </div>
        <fieldset className="space-y-3">
          <legend className="mb-2 text-sm font-medium">Canais escolhidos para o resumo</legend>
          {(
            [
              ["email", "E-mail"],
              ["whatsapp", "WhatsApp oficial"],
            ] as const
          ).map(([channel, label]) => (
            <div key={channel} className="flex items-center gap-3">
              <Switch
                id={`notification-digest-${channel}`}
                checked={draft.channels.includes(channel)}
                onCheckedChange={(checked) =>
                  edit({
                    channels: checked
                      ? [...new Set([...draft.channels, channel])]
                      : draft.channels.filter((current) => current !== channel),
                  })
                }
              />
              <Label htmlFor={`notification-digest-${channel}`}>{label}</Label>
            </div>
          ))}
        </fieldset>
        <p className="text-xs text-muted-foreground">
          Cada canal precisa ser escolhido. Não há fallback automático de WhatsApp para e-mail no
          resumo. A política, suas preferências, o horário de silêncio e o consentimento atual
          continuam valendo. WhatsApp usa somente o modelo neutro aprovado compatível.
        </p>
      </fieldset>
      <p className="text-sm text-muted-foreground">
        O resumo reúne sinais iniciais explicitamente marcados com prioridade baixa por regras
        canônicas elegíveis. A central permanece imediata. Aprovações de solicitações profissionais
        não são agrupadas, e lembretes e escaladas ficam fora do resumo.
      </p>
      <p className="text-xs text-muted-foreground">
        A mensagem externa contém apenas um aviso neutro e acesso à central, sem contagens, títulos
        ou dados dos registros. A composição é conferida novamente antes do envio; não é um
        relatório histórico nem garante que todos os avisos estarão incluídos. Alterar a agenda
        cancela o trabalho pendente anterior, sem recuperar uma sequência de resumos antigos.
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" disabled={!editable || pending || !dirty || conflict}>
          {pending ? "Salvando…" : "Salvar opções do resumo"}
        </Button>
      </div>
    </form>
  );
}
