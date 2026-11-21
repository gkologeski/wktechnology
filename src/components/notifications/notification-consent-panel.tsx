import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { isValidE164 } from "@/lib/phone/e164";
import type { NotificationDeliveryConsent } from "@/lib/notifications/delivery-types";
import { notificationDeliveryInteractionAllowed } from "@/lib/notification-delivery-interaction";

export function NotificationConsentPanel({
  data,
  onSave,
  onUpdatePhone,
  canEdit = false,
}: {
  data: NotificationDeliveryConsent & {
    deliveryAvailable?: boolean;
    senderDisplay?: string | null;
  };
  onSave: (input: { granted: boolean; phone: string; revision: number }) => Promise<unknown>;
  onUpdatePhone: (input: { phone: string; expectedPhone: string | null }) => Promise<unknown>;
  canEdit?: boolean;
}) {
  const active = Boolean(
    data.phone &&
    data.consent?.phone === data.phone &&
    data.consent.grantedAt &&
    !data.consent.revokedAt,
  );
  const [granted, setGranted] = useState(active);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [phoneDraft, setPhoneDraft] = useState(data.phone ?? "");
  const phoneChanged = phoneDraft !== (data.phone ?? "");
  useEffect(() => {
    setGranted(active);
    setError("");
    setMessage("");
  }, [active, data.phone, data.consent?.revision]);
  useEffect(() => {
    setPhoneDraft(data.phone ?? "");
  }, [data.phone]);
  const updatePhone = async () => {
    if (
      !notificationDeliveryInteractionAllowed(canEdit, pending) ||
      !isValidE164(phoneDraft) ||
      !phoneChanged
    )
      return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await onUpdatePhone({ phone: phoneDraft, expectedPhone: data.phone });
      setMessage("Telefone atualizado no perfil. Confirme uma nova autorização para este número.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o telefone.");
    } finally {
      setPending(false);
    }
  };
  const save = async (value: boolean) => {
    if (!notificationDeliveryInteractionAllowed(canEdit, pending)) return;
    if (value && (!data.phone || phoneChanged)) return;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await onSave({
        granted: value,
        phone: data.phone ?? data.consent?.phone ?? "",
        revision: data.consent?.revision ?? 0,
      });
      setGranted(value);
      setMessage(
        value
          ? "Sua autorização foi registrada. A entrega ainda depende das condições do canal."
          : "Sua autorização de WhatsApp foi revogada.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar sua escolha.");
    } finally {
      setPending(false);
    }
  };
  return (
    <section
      className="min-w-0 space-y-4 border-t border-border pt-6"
      aria-label="Autorização pessoal de WhatsApp"
    >
      <div>
        <h2 className="text-lg font-semibold">WhatsApp para seus avisos</h2>
        <p className="text-sm text-muted-foreground">
          Esta escolha vale somente para você neste workspace. Um administrador não pode autorizar
          por você.
        </p>
      </div>
      <p className="text-sm">
        Número do seu perfil: <strong>{data.phone ?? "Não informado"}</strong>
      </p>
      <div className="max-w-md space-y-2">
        <Label htmlFor="notification-personal-phone">Seu telefone no perfil</Label>
        <PhoneInput
          id="notification-personal-phone"
          value={phoneDraft}
          onChange={setPhoneDraft}
          disabled={!canEdit || pending}
        />
        <Button
          type="button"
          variant="outline"
          disabled={!canEdit || pending || !phoneChanged || !isValidE164(phoneDraft)}
          onClick={() => void updatePhone()}
        >
          Atualizar telefone no perfil
        </Button>
        <p className="text-xs text-muted-foreground">
          A alteração atualiza seu telefone pessoal e revoga autorizações antigas de WhatsApp.
          Depois, confirme novamente para este número. O telefone não é salvo ao apenas marcar a
          autorização.
        </p>
      </div>
      {data.consent?.grantedAt && data.consent.phone !== data.phone && (
        <p className="text-sm text-muted-foreground">
          O número mudou. A autorização anterior não vale para o número atual.
        </p>
      )}
      {data.deliveryAvailable === false && (
        <p className="text-sm text-muted-foreground">
          O WhatsApp de notificações está indisponível neste workspace. Sua autorização não ativa o
          canal.
        </p>
      )}
      {data.senderDisplay && (
        <p className="text-sm text-muted-foreground">Remetente configurado: {data.senderDisplay}</p>
      )}
      <div className="flex items-start gap-3">
        <Checkbox
          id="notification-wa-consent"
          checked={granted}
          disabled={!canEdit || pending || !data.phone || phoneChanged}
          onCheckedChange={(value) => setGranted(value === true)}
        />
        <Label htmlFor="notification-wa-consent" className="text-sm leading-6">
          Quero receber avisos de Workflows deste workspace neste WhatsApp e sou titular ou tenho
          autorização para usar este número.
        </Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Você pode revogar a autorização aqui. Isso não altera tarefas, prazos ou permissões. O envio
        exige canal habilitado, modelo aprovado, preferência, cota e condições válidas do provedor.
        Esta opção não verifica a posse por SMS.
      </p>
      {data.consent && (
        <p className="text-xs text-muted-foreground">
          Finalidade: avisos de Workflows · versão {data.consent.version}.{" "}
          {active
            ? "Autorização vigente para este número."
            : "Sem autorização vigente para o número atual."}
        </p>
      )}
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
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={
            !canEdit || pending || granted === active || (granted && (!data.phone || phoneChanged))
          }
          onClick={() => void save(granted)}
        >
          {pending ? "Salvando…" : "Salvar minha escolha"}
        </Button>
        {data.consent?.grantedAt && !data.consent.revokedAt && (
          <Button
            type="button"
            variant="outline"
            disabled={!canEdit || pending}
            onClick={() => void save(false)}
          >
            Revogar autorização
          </Button>
        )}
      </div>
    </section>
  );
}
