/**
 * Números recusados pela Meta e bloqueados temporariamente nas campanhas.
 * As regras de prazo (131026 = 90 dias; 131049 = 7 dias, 2ª seguida = 30 dias)
 * são aplicadas no banco (`wa_record_suppression`); aqui só a leitura.
 */
export type SuppressionReason = "no_whatsapp" | "engagement_limit";

export const SUPPRESSION_LABEL: Record<SuppressionReason, string> = {
  no_whatsapp: "Número sem WhatsApp (recusado pela Meta)",
  engagement_limit: "Aguardando nova tentativa (limite de engajamento da Meta)",
};

/** Chave do telefone: celular BR com ou sem o 9º dígito conta como o mesmo. */
export function suppressionKey(phone: string): string {
  const d = String(phone ?? "").replace(/\D/g, "");
  const m = /^55(\d{2})9?(\d{8})$/.exec(d);
  return m ? `+55${m[1]}${m[2]}` : `+${d}`;
}

export type SuppressionRow = {
  phone_key: string;
  reason: SuppressionReason;
  expires_at: string;
  released_at: string | null;
};

/** Índice dos bloqueios vigentes em `now`. */
export function activeSuppressions(
  rows: SuppressionRow[],
  now: Date = new Date(),
): Map<string, SuppressionReason> {
  const out = new Map<string, SuppressionReason>();
  for (const r of rows) {
    if (r.released_at) continue;
    if (new Date(r.expires_at).getTime() <= now.getTime()) continue;
    // "Sem WhatsApp" prevalece sobre adiamento por engajamento.
    if (out.get(r.phone_key) !== "no_whatsapp") out.set(r.phone_key, r.reason);
  }
  return out;
}
