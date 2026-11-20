import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { notificationDeliveryInteractionAllowed } from "@/lib/notification-delivery-interaction";
import {
  NOTIFICATION_UPDATE_SUBJECT,
  NOTIFICATION_UPDATE_TEXT,
  NEUTRAL_NOTIFICATION_TEMPLATE_BODIES,
  type NotificationTemplatePreview,
} from "@/lib/notifications/delivery-content";

export type NotificationTemplateOption = {
  name: string;
  language: string;
  body: string;
  compatible: boolean;
  reason?: string | null;
  status?: string | null;
  category?: string | null;
  preview?: NotificationTemplatePreview | null;
};
const TEMPLATE_REASON: Record<string, string> = {
  template_identity_mismatch: "O nome ou o idioma do modelo difere da configuração.",
  template_not_approved: "O modelo ainda não está aprovado pelo provedor.",
  template_not_utility: "O modelo não pertence à categoria UTILITY exigida pela central.",
  template_components_invalid: "Os componentes do modelo não atendem ao formato da central.",
  template_body_not_neutral: "O texto não atende ao formato neutro de notificações.",
  template_header_unsupported: "O cabeçalho não atende ao formato neutro da central.",
  template_footer_unsupported: "O rodapé não atende ao formato neutro da central.",
  template_buttons_unsupported: "O botão não aponta para o destino autorizado da central.",
};
export function DeliveryModelsPanel({
  templates,
  loading,
  error,
  onRetry,
  canRead = false,
  canRetryWhatsApp = false,
}: {
  templates: NotificationTemplateOption[];
  loading: boolean;
  error?: string | null;
  onRetry: () => void;
  canRead?: boolean;
  canRetryWhatsApp?: boolean;
}) {
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [selected, setSelected] = useState("");
  const template = templates.find((entry) => `${entry.name}:${entry.language}` === selected);
  if (!notificationDeliveryInteractionAllowed(canRead))
    return <p>Sem permissão para consultar os modelos.</p>;
  return (
    <section className="min-w-0 space-y-4" aria-label="Modelos de avisos externos">
      <div>
        <h2 className="text-lg font-semibold">Modelos com o contexto essencial</h2>
        <p className="text-sm text-muted-foreground">
          O aviso externo é neutro. Documentos, nomes, valores e detalhes permanecem no registro
          autorizado.
        </p>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Canal da prévia">
        <Button
          variant={channel === "email" ? "default" : "outline"}
          aria-pressed={channel === "email"}
          onClick={() => setChannel("email")}
        >
          E-mail
        </Button>
        <Button
          variant={channel === "whatsapp" ? "default" : "outline"}
          aria-pressed={channel === "whatsapp"}
          onClick={() => setChannel("whatsapp")}
        >
          WhatsApp
        </Button>
      </div>
      {channel === "email" ? (
        <div className="space-y-4 rounded-lg bg-muted/30 p-5" aria-label="Prévia de e-mail">
          <p className="text-sm text-muted-foreground">
            Modelo fixo: notification-update · Prévia, sem destinatário real
          </p>
          <p className="text-sm">
            Assunto: <strong>{NOTIFICATION_UPDATE_SUBJECT}</strong>
          </p>
          <h3 className="text-lg font-semibold">{NOTIFICATION_UPDATE_SUBJECT}</h3>
          <p>{NOTIFICATION_UPDATE_TEXT}</p>
          <span className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Abrir central de notificações
          </span>
          <p className="break-all text-xs text-muted-foreground">
            Destino seguro: /notifications · exige sessão e permissão atual.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A lista consulta os modelos do remetente selecionado na política abaixo. Uma prévia não
            cria nem aprova modelo na Meta.
          </p>
          {error ? (
            <div role="alert">
              <p>Não foi possível consultar os modelos. {error}</p>
              <Button
                variant="outline"
                disabled={!canRetryWhatsApp}
                onClick={() => {
                  if (notificationDeliveryInteractionAllowed(canRetryWhatsApp, loading)) onRetry();
                }}
              >
                Tentar consultar modelos novamente
              </Button>
            </div>
          ) : loading ? (
            <p role="status">Consultando modelos do remetente…</p>
          ) : templates.length ? (
            <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div className="min-w-0 space-y-2" aria-label="Modelos do WhatsApp">
                {templates.map((entry) => (
                  <button
                    type="button"
                    className={`block w-full min-w-0 rounded-lg p-3 text-left ${selected === `${entry.name}:${entry.language}` ? "bg-primary/10" : "bg-muted/30 hover:bg-muted/50"}`}
                    key={`${entry.name}:${entry.language}`}
                    onClick={() => setSelected(`${entry.name}:${entry.language}`)}
                  >
                    <span className="block break-all font-medium">{entry.name}</span>
                    <span className="mr-2 text-xs text-muted-foreground">{entry.language}</span>
                    <Badge variant="secondary">
                      {entry.compatible && entry.preview ? "Compatível" : "Não elegível"}
                    </Badge>
                    <span className="mt-2 block text-xs text-muted-foreground">
                      Status Meta: {entry.status ?? "Não confirmado"} · Categoria:{" "}
                      {entry.category ?? "Não confirmada"}
                    </span>
                  </button>
                ))}
              </div>
              <div
                className="min-w-0 space-y-3 rounded-lg bg-muted/30 p-5"
                aria-label="Prévia de WhatsApp"
              >
                {template ? (
                  <>
                    <h3 className="break-all font-semibold">{template.name}</h3>
                    {template.compatible && template.preview ? (
                      <div className="space-y-3" aria-label="Conteúdo previsto do WhatsApp">
                        {template.preview.header && (
                          <p className="font-semibold">{template.preview.header}</p>
                        )}
                        <p className="whitespace-pre-wrap break-words text-sm">
                          {template.preview.body}
                        </p>
                        {template.preview.footer && (
                          <p className="text-xs text-muted-foreground">{template.preview.footer}</p>
                        )}
                        {template.preview.button && (
                          <div className="space-y-1">
                            <span className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                              {template.preview.button.text}
                            </span>
                            <p className="break-all text-xs text-muted-foreground">
                              {template.preview.button.url}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Este modelo não possui prévia de envio elegível.
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {template.compatible && template.preview
                        ? "Compatível com o formato neutro de notificações. A elegibilidade será conferida novamente no envio."
                        : (TEMPLATE_REASON[template.reason ?? ""] ??
                          "O modelo não atende ao formato de avisos desta central.")}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Selecione um modelo para conferir a prévia.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum modelo disponível. Selecione um remetente autorizado e consulte seus modelos.
            </p>
          )}
          <details className="rounded-lg bg-muted/20 p-4">
            <summary className="cursor-pointer text-sm font-medium">
              Formatos de conteúdo neutro aceitos
            </summary>
            <ul className="mt-3 space-y-3">
              {NEUTRAL_NOTIFICATION_TEMPLATE_BODIES.map((body) => (
                <li className="break-words text-sm" key={body}>
                  {body}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              A aprovação e a categoria UTILITY precisam estar confirmadas pelo provedor. Os valores
              das variáveis são fixados pela central; não são campos do registro.
            </p>
          </details>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Nenhuma mensagem é enviada por esta prévia. Alterar um modelo na Meta pode torná-lo
        incompatível e interromper futuras entregas.
      </p>
    </section>
  );
}
