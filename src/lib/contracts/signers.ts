import { z } from "zod";
export const signerRole = z
  .string()
  .trim()
  .toUpperCase()
  .min(2)
  .max(80)
  .regex(/^[A-Z0-9_ -]+$/, "Use letras sem acentos, números, espaços ou hífen no papel.");
export const contractSignersSchema = z
  .array(
    z.object({
      role: signerRole,
      contactId: z.string().uuid(),
      cpf: z.string().trim().max(20).nullable().optional(),
    }),
  )
  .min(2)
  .max(20)
  .superRefine((items, ctx) => {
    if (!["CONTRATANTE", "CONTRATADO"].every((role) => items.some((s) => s.role === role)))
      ctx.addIssue({ code: "custom", message: "Selecione contratante e contratado." });
    if (
      new Set(items.map((s) => s.role)).size !== items.length ||
      new Set(items.map((s) => s.contactId)).size !== items.length
    )
      ctx.addIssue({ code: "custom", message: "Papéis e contatos devem ser distintos." });
  });
export type SignerContact = { id: string; name: string; email: string };
export type SignerPartyHint = {
  partyName: string | null;
  partyKind: "company" | "person";
};
export type SignerSuggestion = SignerPartyHint & {
  contact: SignerContact | null;
  cpf: string | null;
};
export type ContractSignerSuggestions = {
  isPurchase: boolean;
  contratante: SignerSuggestion;
  contratado: SignerSuggestion;
};

export type SignerSlot = { role: string; contact: SignerContact | null; cpf?: string };

/** Preenche papéis vazios (CONTRATANTE/CONTRATADO) com sugestões sem sobrescrever escolhas manuais. */
export function applySignerSuggestions<T extends SignerSlot>(
  current: T[],
  suggestions: ContractSignerSuggestions,
  includeCpf = false,
): T[] {
  const byRole: Record<string, SignerSuggestion> = {
    CONTRATANTE: suggestions.contratante,
    CONTRATADO: suggestions.contratado,
  };
  return current.map((slot) => {
    const sug = byRole[slot.role];
    if (!sug || slot.contact) return slot;
    if (!sug.contact) return slot;
    return {
      ...slot,
      contact: sug.contact,
      ...(includeCpf && !slot.cpf && sug.cpf ? { cpf: sug.cpf } : {}),
    };
  });
}
