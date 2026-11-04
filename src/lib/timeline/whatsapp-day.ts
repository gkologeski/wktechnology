// Leitura do bloco diário de WhatsApp gravado em `activities.external_ids.messages`.
export type WaDayMessage = {
  id: string;
  direction: "inbound" | "outbound";
  at: string;
  body: string;
  status: string | null;
  error: string | null;
  origin: "client" | "agent" | "campaign" | "inbox";
  author: string | null;
};

const FAILED = new Set(["failed", "undelivered", "error"]);

export function isWaMessageFailed(m: Pick<WaDayMessage, "status">): boolean {
  return !!m.status && FAILED.has(m.status);
}

export function readWaDayMessages(externalIds: unknown): WaDayMessage[] | null {
  const ext = (externalIds ?? {}) as Record<string, unknown>;
  if (typeof ext.wa_day !== "string" || !Array.isArray(ext.messages)) return null;
  return (ext.messages as Record<string, unknown>[])
    .filter((m) => m && typeof m.at === "string")
    .map(
      (m): WaDayMessage => ({
        id: String(m.id ?? m.at),
        direction: m.direction === "inbound" ? "inbound" : "outbound",
        at: m.at as string,
        body: typeof m.body === "string" ? m.body : "",
        status: typeof m.status === "string" ? m.status : null,
        error: typeof m.error === "string" ? m.error : null,
        origin: (["client", "agent", "campaign", "inbox"].includes(m.origin as string)
          ? m.origin
          : m.direction === "inbound"
            ? "client"
            : "inbox") as WaDayMessage["origin"],
        author: typeof m.author === "string" ? m.author : null,
      }),
    )
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function waSenderLabel(m: WaDayMessage, contactLabel = "Cliente"): string {
  if (m.origin === "client") return contactLabel;
  if (m.origin === "agent") return "Agente IA";
  if (m.origin === "campaign") return "Campanha";
  return m.author ?? "WK";
}

/** Hora local de Brasília (HH:mm). */
export function waTime(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}
