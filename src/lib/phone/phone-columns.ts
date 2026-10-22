/** Colunas que guardam telefone canônico E.164 (inventário em docs/architecture/phone-e164.md). */
export const PHONE_COLUMNS: ReadonlySet<string> = new Set([
  "phone",
  "mobile_phone",
  "emergency_phone",
  "candidate_phone",
  "invitee_phone",
  "company_phone",
  "contact_phone",
]);

/** Campo WhatsApp: E.164 + política do canal (`whatsapp-e164.ts`). */
export const WHATSAPP_COLUMN = "whatsapp_e164";

export function isPhoneColumn(name: string): boolean {
  return PHONE_COLUMNS.has(name);
}
