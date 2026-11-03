/**
 * Números recusados pela Meta e bloqueados temporariamente nas campanhas.
 * As regras de prazo (131026 = 90 dias; 131049 = 7 dias, 2ª seguida = 30 dias)
 * são aplicadas no banco (`wa_record_suppression`); aqui só a leitura.
 */
import { pickWhatsAppNumber, toWhatsAppE164, type WhatsAppPick } from "@/lib/phone/whatsapp-e164";

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

/**
 * Escolhe o WhatsApp do cadastro (WhatsApp → Celular → Telefone, nunca fixo)
 * pulando números bloqueados. `blockedBy` indica o bloqueio que tirou o
 * primeiro candidato válido — usado para explicar a etapa pulada.
 */
export function pickUnsuppressedWhatsApp(
  phones: Array<string | null | undefined>,
  suppressed: Map<string, SuppressionReason>,
): { pick: WhatsAppPick; blockedBy: SuppressionReason | null } {
  let candidates = phones.slice();
  let pick = pickWhatsAppNumber(candidates);
  let blockedBy: SuppressionReason | null = null;
  while (pick.status === "ok" && suppressed.has(suppressionKey(pick.e164))) {
    blockedBy = blockedBy ?? suppressed.get(suppressionKey(pick.e164)) ?? null;
    const used = suppressionKey(pick.e164);
    candidates = candidates.filter((p) => {
      const e = toWhatsAppE164(p);
      return !(e && suppressionKey(e) === used);
    });
    pick = pickWhatsAppNumber(candidates);
  }
  return { pick, blockedBy };
}

/** Motivo gravado na execução da sequência quando a etapa de WhatsApp é pulada. */
export function sequenceSuppressionReason(reason: SuppressionReason): string {
  return reason === "no_whatsapp"
    ? "whatsapp_suppressed_no_whatsapp"
    : "whatsapp_suppressed_engagement";
}
