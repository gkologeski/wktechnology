// Política única do compositor de WhatsApp (puro): o que a interface pode
// oferecer em cada estado de janela de 24 h / catálogo de modelos.
// Todos os pontos de envio usam esta função — o servidor revalida no envio.

export type WindowState =
  | "checking" // consultando a janela
  | "open" // mensagem recebida nas últimas 24 h
  | "closed" // fora da janela
  | "error" // falha ao consultar
  | "no_channel" // WhatsApp não conectado
  | "unknown"; // sem destinatário/conversa resolvida

export type CatalogState = "idle" | "loading" | "error" | "empty" | "ready" | "no_channel";

export type ComposerPolicy = {
  windowState: WindowState;
  catalogState: CatalogState;
  /** Texto livre, anexo e atalho de teclado liberados. */
  freeTextAllowed: boolean;
  /** Envio só é possível por modelo aprovado. */
  templateRequired: boolean;
  /** Ações de IA que escrevem no campo livre. */
  aiComposeAllowed: boolean;
  /** Mensagem exibida ao usuário (vazia quando o texto livre está liberado). */
  notice: string;
};

export function composerPolicy(input: {
  channelReady: boolean | null;
  windowChecking: boolean;
  windowError: boolean;
  withinWindow: boolean | null;
  templateRequiredByServer: boolean;
  templates: { approved: boolean }[] | null;
  templatesLoading: boolean;
  templatesError: boolean;
}): ComposerPolicy {
  const windowState: WindowState = !input.channelReady
    ? input.channelReady === null
      ? "checking"
      : "no_channel"
    : input.windowChecking
      ? "checking"
      : input.windowError
        ? "error"
        : input.templateRequiredByServer
          ? "closed"
          : input.withinWindow === true
            ? "open"
            : input.withinWindow === false
              ? "closed"
              : "unknown";

  const approved = (input.templates ?? []).filter((t) => t.approved);
  const catalogState: CatalogState = !input.channelReady
    ? input.channelReady === null
      ? "idle"
      : "no_channel"
    : input.templatesLoading
      ? "loading"
      : input.templatesError
        ? "error"
        : input.templates === null
          ? "idle"
          : approved.length === 0
            ? "empty"
            : "ready";

  const freeTextAllowed = windowState === "open";
  const notice =
    windowState === "open"
      ? ""
      : windowState === "checking"
        ? "Verificando a janela de 24 horas…"
        : windowState === "error"
          ? "Não foi possível verificar a janela de 24 horas. Tente novamente."
          : windowState === "no_channel"
            ? "WhatsApp não conectado neste workspace."
            : windowState === "closed"
              ? "Janela de 24 horas encerrada: só é possível continuar com um modelo aprovado pela Meta."
              : "Sem conversa recebida: só é possível iniciar com um modelo aprovado pela Meta.";

  return {
    windowState,
    catalogState,
    freeTextAllowed,
    templateRequired: windowState === "closed" || windowState === "unknown",
    aiComposeAllowed: freeTextAllowed,
    notice,
  };
}

export function catalogMessage(state: CatalogState): string {
  switch (state) {
    case "loading":
      return "Carregando modelos aprovados…";
    case "error":
      return "Não foi possível carregar os modelos aprovados.";
    case "empty":
      return "Nenhum modelo aprovado está disponível nesta conta do WhatsApp.";
    case "no_channel":
      return "Conecte o WhatsApp para carregar os modelos aprovados.";
    default:
      return "";
  }
}
