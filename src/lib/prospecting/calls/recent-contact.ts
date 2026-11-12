// Regra "contato recente" das Campanhas de Ligação (pura, sem banco).
export type RecentContactScope = "calls" | "calls_whatsapp";

export type RecentContactConfig = { days: number; scope: RecentContactScope };

export const DEFAULT_RECENT_CONTACT: RecentContactConfig = { days: 7, scope: "calls" };

export function normalizeRecentContact(raw: {
  recent_contact_days?: number | null;
  recent_contact_scope?: string | null;
}): RecentContactConfig {
  const d = Number(raw.recent_contact_days ?? DEFAULT_RECENT_CONTACT.days);
  const days = Number.isFinite(d) ? Math.max(0, Math.min(365, Math.trunc(d))) : 7;
  const scope: RecentContactScope =
    raw.recent_contact_scope === "calls_whatsapp" ? "calls_whatsapp" : "calls";
  return { days, scope };
}

/** Início da janela; null quando a regra está desligada (0 dias). */
export function recentSince(cfg: RecentContactConfig, now = Date.now()): string | null {
  if (cfg.days <= 0) return null;
  return new Date(now - cfg.days * 86_400_000).toISOString();
}

export function recentReason(kind: "call" | "whatsapp", days: number): string {
  return kind === "call"
    ? `Recebeu ligação de outra campanha nos últimos ${days} dia(s)`
    : `Recebeu WhatsApp de campanha nos últimos ${days} dia(s)`;
}
