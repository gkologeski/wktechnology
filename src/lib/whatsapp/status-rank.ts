// Regra de progressão de status de mensagens do WhatsApp: nunca regride.
const RANK: Record<string, number> = { accepted: 0, sent: 1, delivered: 2, read: 3 };

export function shouldApplyStatus(current: string | null | undefined, next: string): boolean {
  if (next === "failed") return current !== "read" && current !== "delivered";
  if (!(next in RANK)) return false;
  if (!current || !(current in RANK)) return current !== "failed";
  return RANK[next] > RANK[current];
}
