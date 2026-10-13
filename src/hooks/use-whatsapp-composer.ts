// Hook único do compositor de WhatsApp: janela de 24 h + catálogo de modelos
// aprovados + política de envio. Usado por Inbox, Inbox unificada, diálogo de
// ficha/timeline e campanhas. O servidor revalida tudo no envio.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getWhatsAppServiceWindow,
  getWhatsAppTemplateCatalog,
  type WhatsAppTemplateOption,
} from "@/lib/whatsapp.functions";
import { useChannelAvailability } from "@/hooks/use-channel-availability";
import { composerPolicy, type ComposerPolicy } from "@/lib/whatsapp/composer-policy";

export type { WhatsAppTemplateOption };

export function waTemplatesKey(
  workspaceId: string | null,
  channel: string | null,
  lang: string | null,
) {
  return ["wa", "templates", workspaceId ?? "active", channel ?? "default", lang ?? "all"] as const;
}

export function useWhatsAppComposer(opts: {
  /** Telefone do destinatário (E.164 ou dígitos). */
  to: string | null | undefined;
  enabled?: boolean;
  /** Recusa do servidor ("TEMPLATE_REQUIRED") força o modo modelo. */
  templateRequiredByServer?: boolean;
  /** Carrega o catálogo mesmo dentro da janela (seleção opcional de modelo). */
  alwaysLoadTemplates?: boolean;
  language?: string | null;
  /** Conversa aberta: a janela é lida dela, não só do telefone. */
  conversationId?: string | null;
  /** Data do último recebimento visto em tempo real; mudança refaz a checagem. */
  lastInboundHint?: string | null;
}) {
  const enabled = opts.enabled ?? true;
  const to = (opts.to ?? "").trim();
  const hasRecipient = to.replace(/\D/g, "").length >= 8;
  const availabilityQ = useChannelAvailability();
  const channelReady = availabilityQ.isSuccess
    ? availabilityQ.data.whatsapp.ready
    : availabilityQ.isError
      ? false
      : null;

  const windowFn = useServerFn(getWhatsAppServiceWindow);
  const windowQ = useQuery({
    queryKey: [
      "wa",
      "service-window",
      to,
      opts.conversationId ?? null,
      opts.lastInboundHint ?? null,
    ],
    queryFn: () => windowFn({ data: { to, conversationId: opts.conversationId ?? null } }),
    enabled: enabled && hasRecipient && channelReady === true,
    staleTime: 30_000,
  });

  const workspaceId = windowQ.data?.workspaceId ?? null;
  const channel = windowQ.data?.phoneNumberId ?? null;
  const language = opts.language ?? null;

  const preliminary = composerPolicy({
    channelReady,
    windowChecking: windowQ.isLoading,
    windowError: windowQ.isError,
    withinWindow: hasRecipient ? (windowQ.data?.withinWindow ?? null) : null,
    templateRequiredByServer: !!opts.templateRequiredByServer,
    templates: null,
    templatesLoading: false,
    templatesError: false,
  });

  const catalogFn = useServerFn(getWhatsAppTemplateCatalog);
  const templatesQ = useQuery({
    queryKey: waTemplatesKey(workspaceId, channel, language),
    queryFn: () => catalogFn({ data: { language } }),
    enabled:
      enabled &&
      channelReady === true &&
      (opts.alwaysLoadTemplates || preliminary.templateRequired),
    staleTime: 60_000,
  });

  const policy: ComposerPolicy = composerPolicy({
    channelReady,
    windowChecking: windowQ.isLoading,
    windowError: windowQ.isError,
    withinWindow: hasRecipient ? (windowQ.data?.withinWindow ?? null) : null,
    templateRequiredByServer: !!opts.templateRequiredByServer,
    templates: templatesQ.data?.items ?? null,
    templatesLoading: templatesQ.isLoading && templatesQ.fetchStatus !== "idle",
    templatesError: templatesQ.isError,
  });

  const qc = useQueryClient();
  return {
    policy,
    windowQ,
    templatesQ,
    templates: (templatesQ.data?.items ?? []).filter((t) => t.approved),
    catalogSource: templatesQ.data?.source ?? null,
    /** Revalida o catálogo no provedor (ação "Atualizar modelos"). */
    refreshTemplates: async () => {
      await qc.invalidateQueries({ queryKey: ["wa", "templates"] });
      return templatesQ.refetch();
    },
  };
}
