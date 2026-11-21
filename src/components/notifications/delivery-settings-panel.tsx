import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  notificationDeliveryPolicySchema,
  type NotificationDeliveryPolicy,
} from "@/lib/notifications/delivery-types";
import type { NotificationTemplateOption } from "./delivery-models-panel";
import { notificationDeliveryInteractionAllowed } from "@/lib/notification-delivery-interaction";

export type NotificationSenderOption = {
  id: string;
  label: string;
  phone: string;
  available: boolean;
  quality: string | null;
  eligible?: boolean;
  reason?: string | null;
  status?: string | null;
  syncedAt?: string | null;
};
const SENDER_REASON: Record<string, string> = {
  sender_unavailable: "O remetente está indisponível.",
  quality_not_high: "A qualidade sincronizada não é alta. O remetente não está elegível.",
  connection_unavailable: "A conexão oficial está indisponível.",
  webhook_unverified: "A conexão oficial ainda não possui webhook verificado.",
};
export function DeliverySettingsPanel({
  policy,
  revision,
  canEdit,
  canConfigureWhatsApp,
  senders,
  templates,
  templatesLoading,
  templatesError,
  onSenderChange,
  onSave,
}: {
  policy: NotificationDeliveryPolicy;
  revision: number;
  canEdit: boolean;
  canConfigureWhatsApp: boolean;
  senders: NotificationSenderOption[];
  templates: NotificationTemplateOption[];
  templatesLoading: boolean;
  templatesError?: string | null;
  onSenderChange: (id: string | null) => void;
  onSave: (policy: NotificationDeliveryPolicy, revision: number) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState(policy);
  const [baseline, setBaseline] = useState(policy);
  const [editRevision, setEditRevision] = useState(revision);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const selectedSender = senders.find((sender) => sender.id === draft.wa_sender_id);
  useEffect(() => {
    if (revision !== editRevision && !dirty) {
      setDraft(policy);
      setBaseline(policy);
      setEditRevision(revision);
    }
  }, [revision, editRevision, dirty, policy]);
  const edit = (patch: Partial<NotificationDeliveryPolicy>) => {
    if (!notificationDeliveryInteractionAllowed(canEdit, pending)) return;
    const whatsappChange = Object.keys(patch).some(
      (key) => key.startsWith("wa_") || key.startsWith("whatsapp_") || key === "currency",
    );
    if (whatsappChange && !notificationDeliveryInteractionAllowed(canConfigureWhatsApp, pending))
      return;
    setDraft((current) => ({ ...current, ...patch }));
    setError("");
    setMessage("");
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!notificationDeliveryInteractionAllowed(canEdit, pending) || !dirty) return;
    const result = notificationDeliveryPolicySchema.safeParse(draft);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Revise a política.");
      return;
    }
    const whatsappChanged = Object.keys(draft).some(
      (key) =>
        (key.startsWith("wa_") || key.startsWith("whatsapp_") || key === "currency") &&
        draft[key as keyof NotificationDeliveryPolicy] !==
          baseline[key as keyof NotificationDeliveryPolicy],
    );
    if (
      whatsappChanged &&
      draft.whatsapp_enabled &&
      (!selectedSender?.available ||
        selectedSender.eligible === false ||
        templatesLoading ||
        templatesError ||
        !templates.some(
          (entry) =>
            entry.name === draft.wa_template_name &&
            entry.language === draft.wa_template_language &&
            entry.compatible &&
            entry.preview,
        ))
    ) {
      setError(
        "Confirme um remetente elegível e um modelo aprovado compatível antes de habilitar WhatsApp.",
      );
      return;
    }
    setPending(true);
    setError("");
    setMessage("");
    try {
      await onSave(result.data, editRevision);
      setBaseline(result.data);
      setMessage("Política de notificações salva.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar. Seu rascunho foi preservado.",
      );
    } finally {
      setPending(false);
    }
  };
  const costValue = (value: number) => value / 1_000_000;
  const micros = (value: string) => Math.round(Number(value) * 1_000_000);
  return (
    <form
      className="min-w-0 max-w-full space-y-5 border-t border-border pt-6"
      onSubmit={(event) => void submit(event)}
      aria-label="Política de canais de notificações"
    >
      <div>
        <h2 className="text-lg font-semibold">Política de canais do workspace</h2>
        <p className="text-sm text-muted-foreground">
          Canais externos começam desativados. Cotas e orçamento limitam a elegibilidade; não
          substituem o consentimento pessoal ou a permissão sobre a origem.
        </p>
      </div>
      {!canEdit && (
        <p className="text-sm text-muted-foreground">
          Você pode consultar esta política, mas não alterá-la.
        </p>
      )}
      {revision !== editRevision && dirty && (
        <p role="alert" className="text-sm text-destructive">
          A política mudou em outra sessão. Seu rascunho foi preservado; recarregue antes de salvar
          novamente.
        </p>
      )}
      <fieldset disabled={pending || !canEdit} className="min-w-0 space-y-4">
        <legend className="mb-2 font-medium">E-mail</legend>
        <div className="flex items-center gap-3">
          <Switch
            id="notification-policy-email"
            checked={draft.email_enabled}
            onCheckedChange={(email_enabled) => edit({ email_enabled })}
          />
          <Label htmlFor="notification-policy-email">Permitir avisos por e-mail</Label>
        </div>
        <label className="block max-w-sm space-y-1 text-sm">
          Cota diária de e-mail
          <Input
            aria-label="Cota diária de e-mail"
            type="number"
            min={0}
            max={10000}
            value={draft.email_daily_limit}
            onChange={(event) => edit({ email_daily_limit: Number(event.target.value) })}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          O destinatário vem da identidade confirmada do usuário, nunca de um campo livre do
          registro. O modelo externo é neutro.
        </p>
      </fieldset>
      <fieldset
        disabled={pending || !canEdit || !canConfigureWhatsApp}
        className="min-w-0 space-y-4"
      >
        <legend className="mb-2 font-medium">WhatsApp oficial</legend>
        {!canConfigureWhatsApp && (
          <p className="text-sm text-muted-foreground">
            A configuração do WhatsApp também exige autorização sobre esse canal.
          </p>
        )}
        <div className="flex items-center gap-3">
          <Switch
            id="notification-policy-wa"
            checked={draft.whatsapp_enabled}
            onCheckedChange={(whatsapp_enabled) => edit({ whatsapp_enabled })}
          />
          <Label htmlFor="notification-policy-wa">Permitir avisos por WhatsApp</Label>
        </div>
        <label className="block space-y-1 text-sm">
          Remetente fixo
          <select
            aria-label="Remetente fixo de WhatsApp"
            className="block h-10 w-full max-w-full rounded-md border border-input bg-background px-3"
            value={draft.wa_sender_id ?? ""}
            onChange={(event) => {
              if (!notificationDeliveryInteractionAllowed(canEdit && canConfigureWhatsApp, pending))
                return;
              const id = event.target.value || null;
              if (
                id &&
                !senders.some(
                  (sender) => sender.id === id && sender.available && sender.eligible !== false,
                )
              )
                return;
              edit({ wa_sender_id: id, wa_template_name: null, wa_template_language: null });
              onSenderChange(id);
            }}
          >
            <option value="">Selecionar número conectado</option>
            {draft.wa_sender_id && !senders.some((sender) => sender.id === draft.wa_sender_id) && (
              <option value={draft.wa_sender_id} disabled>
                Remetente salvo indisponível
              </option>
            )}
            {senders.map((sender) => (
              <option
                key={sender.id}
                value={sender.id}
                disabled={!sender.available || sender.eligible === false}
              >
                {sender.label} · {sender.phone}
                {sender.available && sender.eligible !== false ? "" : " · não elegível"}
              </option>
            ))}
          </select>
        </label>
        {selectedSender && (
          <div
            className="space-y-1 text-xs text-muted-foreground"
            aria-label="Condições sincronizadas do remetente"
          >
            <p>
              Qualidade sincronizada: {selectedSender.quality ?? "Não confirmada"} · Estado:{" "}
              {selectedSender.status ?? "Não confirmado"}.
            </p>
            <p>
              {selectedSender.syncedAt
                ? `Última sincronização: ${selectedSender.syncedAt}.`
                : "Horário da sincronização não informado."}{" "}
              As condições atuais são conferidas novamente antes do envio.
            </p>
            {selectedSender.eligible === false && (
              <p>
                {SENDER_REASON[selectedSender.reason ?? ""] ??
                  "O remetente não atende às condições do WhatsApp oficial."}
              </p>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Um único remetente por política. Não há rodízio automático para contornar bloqueios,
          qualidade ou falta de autorização.
        </p>
        <label className="block space-y-1 text-sm">
          Modelo e idioma
          <select
            aria-label="Modelo aprovado para notificações"
            className="block h-10 w-full max-w-full rounded-md border border-input bg-background px-3"
            value={
              draft.wa_template_name && draft.wa_template_language
                ? `${draft.wa_template_name}:${draft.wa_template_language}`
                : ""
            }
            disabled={!draft.wa_sender_id || templatesLoading || Boolean(templatesError)}
            onChange={(event) => {
              const option = templates.find(
                (entry) => `${entry.name}:${entry.language}` === event.target.value,
              );
              if (option && (!option.compatible || !option.preview)) return;
              edit({
                wa_template_name: option?.name ?? null,
                wa_template_language: option?.language ?? null,
              });
            }}
          >
            <option value="">
              {templatesLoading ? "Consultando modelos…" : "Selecionar modelo compatível"}
            </option>
            {draft.wa_template_name &&
              !templates.some(
                (entry) =>
                  entry.name === draft.wa_template_name &&
                  entry.language === draft.wa_template_language,
              ) && (
                <option value={`${draft.wa_template_name}:${draft.wa_template_language}`} disabled>
                  Modelo salvo ainda não confirmado
                </option>
              )}
            {templates.map((entry) => (
              <option
                key={`${entry.name}:${entry.language}`}
                value={`${entry.name}:${entry.language}`}
                disabled={!entry.compatible || !entry.preview}
              >
                {entry.name} · {entry.language}
                {entry.compatible ? "" : " · não elegível"}
              </option>
            ))}
          </select>
        </label>
        {templatesError && (
          <p role="alert" className="text-sm text-destructive">
            Não foi possível confirmar os modelos. {templatesError}
          </p>
        )}
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            Cota diária de WhatsApp
            <Input
              aria-label="Cota diária de WhatsApp"
              type="number"
              min={0}
              max={10000}
              value={draft.whatsapp_daily_limit}
              onChange={(event) => edit({ whatsapp_daily_limit: Number(event.target.value) })}
            />
          </label>
          <label className="space-y-1 text-sm">
            Moeda
            <select
              aria-label="Moeda do orçamento estimado"
              className="block h-10 w-full rounded-md border border-input bg-background px-3"
              value={draft.currency}
              onChange={(event) =>
                edit({ currency: event.target.value as NotificationDeliveryPolicy["currency"] })
              }
            >
              <option value="BRL">BRL</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            Estimativa por mensagem
            <Input
              aria-label="Estimativa por mensagem"
              type="number"
              min={0}
              step="0.000001"
              value={costValue(draft.wa_estimated_unit_micros)}
              onChange={(event) => edit({ wa_estimated_unit_micros: micros(event.target.value) })}
            />
          </label>
          <label className="space-y-1 text-sm">
            Orçamento diário estimado
            <Input
              aria-label="Orçamento diário estimado"
              type="number"
              min={0}
              step="0.000001"
              value={costValue(draft.wa_daily_budget_micros)}
              onChange={(event) => edit({ wa_daily_budget_micros: micros(event.target.value) })}
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Os valores são estimativas configuradas para limitar o consumo. Não representam a tarifa
          oficial nem uma garantia sobre a cobrança do provedor. O envio revalida modelo, remetente,
          qualidade, opt-in e restrições aplicáveis.
        </p>
      </fieldset>
      <fieldset
        disabled={!canEdit || pending}
        className="min-w-0 space-y-4 border-t border-border pt-4"
      >
        <legend className="mb-3 font-medium">Resumos e acompanhamentos</legend>
        <div className="flex items-center gap-3">
          <Switch
            id="notification-policy-digest"
            checked={draft.digest_enabled ?? false}
            onCheckedChange={(digest_enabled) => edit({ digest_enabled })}
          />
          <Label htmlFor="notification-policy-digest">Disponibilizar resumos pessoais</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="notification-policy-followups"
            checked={draft.followups_enabled ?? false}
            onCheckedChange={(followups_enabled) => edit({ followups_enabled })}
          />
          <Label htmlFor="notification-policy-followups">
            Disponibilizar lembretes e escalonamento
          </Label>
        </div>
        <label className="block space-y-1 text-sm">
          Cota diária de acompanhamentos
          <Input
            aria-label="Cota diária de acompanhamentos"
            type="number"
            min={0}
            max={10000}
            value={draft.followup_daily_limit ?? 0}
            onChange={(event) => edit({ followup_daily_limit: Number(event.target.value) })}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          As modalidades começam desligadas, com cota de acompanhamento zero. Disponibilizar não
          cria adesão pessoal, altera a prioridade de passos existentes ou ativa regras. O
          acompanhamento exige cota positiva e configuração publicada; os limites de cada canal
          continuam valendo.
        </p>
      </fieldset>
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
        <Button type="submit" disabled={!canEdit || pending || !dirty}>
          {pending ? "Salvando…" : "Salvar política de notificações"}
        </Button>
      </div>
    </form>
  );
}
