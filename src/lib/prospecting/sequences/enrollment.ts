import { z } from "zod";
import { validateEmailAddress } from "@/lib/email-address";
import { isValidE164 } from "@/lib/phone/e164";
import { pickWhatsAppNumber } from "@/lib/phone/whatsapp-e164";
import type { AudienceRow } from "@/lib/whatsapp/campaign-audience";
import type { SequenceDefinition } from "./draft";
export const enrollmentInput = z
  .object({
    workspaceId: z.string().uuid(),
    versionId: z.string().uuid(),
    requestId: z.string().uuid(),
    consentEvidence: z.string().trim().min(10).max(2000),
  })
  .strict();
export type EnrollmentInput = z.infer<typeof enrollmentInput>;
export const COHORT_REASONS = {
  delivery_uncertain: "Envio anterior aguarda conciliação",
  opt_out: "Descadastro ou pedido para não receber contato",
  customer: "Já é cliente",
  open_deal: "Negociação em aberto",
  duplicate: "Já reservado nesta versão ou duplicado no público",
  other_sequence: "Em outra sequência ou atendimento ativo",
  missing_channel: "Sem canal válido para as etapas configuradas",
  recent_whatsapp: "Recebeu WhatsApp recentemente",
} as const;
export type CohortSummary = {
  id: string;
  version_id: string;
  created_at: string;
  requested: number;
  held: number;
  blocked: number;
  reasons: Record<string, number>;
};
/** Only caller-RLS source rows reach the service-only snapshot writer. No country guessing. */
export function cohortCandidates(rows: AudienceRow[], definition: SequenceDefinition) {
  const needed = new Set(definition.steps.map((s) => s.type));
  return [...rows]
    .sort((a, b) => `${a.sourceType}:${a.sourceId}`.localeCompare(`${b.sourceType}:${b.sourceId}`))
    .map((row) => {
      if (row.sourceType !== "lead" && row.sourceType !== "contact")
        throw new Error("Base de destinatários inválida.");
      const raw_email = row.values[`${row.sourceType}.email`] ?? "";
      const checked = validateEmailAddress(raw_email);
      const raw_phones = [
        row.phones?.[0] ?? null,
        row.phones?.[1] ?? null,
        row.phones?.[2] ?? null,
      ];
      const phones = [...new Set(raw_phones.filter((p): p is string => !!p && isValidE164(p)))];
      const whatsapp = pickWhatsAppNumber(phones).status === "ok";
      return {
        entity: row.sourceType,
        id: row.sourceId,
        raw_email,
        raw_phones,
        email: checked.ok ? checked.value : null,
        email_aliases: checked.ok
          ? [...new Set([checked.value.toLowerCase(), raw_email.trim().toLowerCase()])]
          : [],
        phones,
        channels: {
          email: needed.has("email") && checked.ok,
          whatsapp: needed.has("whatsapp") && whatsapp,
          call: needed.has("call") && phones.length > 0,
        },
      };
    });
}
