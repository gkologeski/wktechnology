import { z } from "zod";
import { requestKind } from "./types";
export const formalizationInput = z.object({
  kind: requestKind,
  id: z.string().uuid(),
  revision: z.number().int().positive(),
});
export const formalizationAction = formalizationInput.extend({
  action: z.enum(["prepare", "submit", "legal", "finance", "link", "revoke", "reject"]),
  note: z.string().trim().max(2000).default(""),
});
export type FormalizationContext = {
  contract_id: string | null;
  draft_id: string | null;
  cycle: number;
  status: "none" | "editing" | "legal" | "accepted" | "sent" | "finance" | "signing" | "invalid";
  problem: string | null;
  can_prepare: boolean;
  can_submit: boolean;
  can_legal: boolean;
  can_finance: boolean;
  can_link: boolean;
  legal_name: string | null;
  finance_name: string | null;
  signature_name: string | null;
  due_at: string | null;
};
export const formalizationLabels: Record<FormalizationContext["status"], string> = {
  none: "Documento não preparado",
  editing: "Preparação do documento",
  legal: "Revisão jurídica",
  accepted: "Minuta aprovada pelo Jurídico",
  sent: "Aguardando aceite da contraparte",
  finance: "Conferência Financeiro",
  signing: "Pronto para envio humano à assinatura",
  invalid: "Versão invalidada — preparar nova revisão",
};
