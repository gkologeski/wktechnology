/** Traduz o motivo de não entrega do WhatsApp (Meta/Twilio) para PT-BR. */
const REASONS: Record<string, string> = {
  "131026": "número sem WhatsApp ou inativo",
  "131049": "bloqueada pela Meta para preservar o engajamento",
  "131042": "pendência de pagamento na conta Meta",
  "130472": "número em teste restrito da Meta",
  "131047": "fora da janela de 24h — use um modelo aprovado",
  "63015": "número não autorizado no ambiente de teste",
};

export function describeDeliveryError(
  code: string | number | null | undefined,
  message: string | null | undefined,
): { label: string; detail: string } {
  const c = code == null ? "" : String(code).trim();
  const msg = (message ?? "").trim();
  const reason = REASONS[c] ?? (msg || "motivo não informado");
  const detail = [c ? `Código ${c}` : null, msg || null].filter(Boolean).join(" — ");
  return { label: `Não entregue: ${reason}`, detail: detail || "Sem detalhes do provedor" };
}
