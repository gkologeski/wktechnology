import { z } from "zod";

/** Package 4 batch C2: canonical payables presentation contract (values come only from the gated context RPC). */
export type PayLine = {
  key: string;
  type: "delivery" | "hourly" | "monthly";
  amount: number | null;
  blocking: string | null;
  source_clause: string;
  seconds?: number;
  due_on?: string;
  delivery_id?: string;
  project_id?: string | null;
};
export type PayEligible = {
  preview_hash: string;
  plan_version: number;
  currency: string;
  competence: string;
  lines: PayLine[];
};
export type PayLegacy = {
  id: string;
  kind: "entry" | "recurrence";
  description: string | null;
  amount: number | string | null;
  currency?: string;
  status?: string;
  due_date?: string;
  paid?: number;
  match?: "contract" | "payroll" | "counterparty";
  cadence?: string;
};
export type PayInstallment = {
  seq: number;
  amount: number;
  due_on: string;
  entry_id: string;
  status: string | null;
  paid: number;
};
export type PaySchedule = {
  id: string;
  competence: string;
  currency: string;
  total: number;
  plan_version: number;
  justification: string;
  at: string;
  by: string | null;
  document_id: string | null;
  installments: PayInstallment[];
  sources: Array<{ kind: string; seconds: number | null; amount: number | null }>;
};
export type PayReconciliation = {
  id: string;
  decision: "linked" | "unrelated";
  entry_id: string | null;
  recurrence_id: string | null;
  competence: string;
  reason: string;
  at: string;
  by: string | null;
};
export type PayDocument = {
  id: string;
  doc_type: string;
  number: string;
  amount: number;
  currency: string;
  delivery_id: string | null;
  used: number;
};
export type ClientAcceptance = {
  id: string;
  delivery_id: string;
  delivery_version: number;
  target_kind: "project" | "commercial_contract" | "deal";
  accepted_by_name: string;
  accepted_by_role: string;
  accepted_on: string;
  evidence_reference: string;
  status: "registered" | "confirmed" | "rejected";
  content_hash: string;
  registered_by_me: boolean;
  reason: string | null;
  at: string;
};
export type PayContext = {
  started: boolean;
  kind: "professional" | "supplier";
  regime: string | null;
  release_condition: string | null;
  client_targets: Partial<Record<"project" | "commercial_contract" | "deal", string>> | null;
  can_view: boolean;
  can_generate: boolean;
  can_reconcile: boolean;
  can_register_client: boolean;
  can_confirm_client: boolean;
  finance_configured: boolean;
  finance_name: string | null;
  contract_id: string | null;
  eligible: PayEligible | null;
  eligible_problem: string | null;
  legacy: PayLegacy[];
  schedules: PaySchedule[];
  reconciliations: PayReconciliation[];
  documents: PayDocument[];
  client_acceptances: ClientAcceptance[];
  acceptable_deliveries: Array<{ id: string; version: number; hash: string; title: string }>;
};

export const payBlockingLabel: Record<string, string> = {
  not_accepted: "Entrega ainda sem aceite",
  delivery_version_changed: "Versão da entrega mudou",
  period_open: "Período ainda não encerrado",
  no_closed_hours: "Sem horas aprovadas em fechamento vigente",
  client_acceptance_needs_delivery: "Condição do cliente final só libera entregas",
  client_acceptance_missing: "Falta aceite do cliente final conferido",
  already_claimed: "Fonte já possui obrigação ou conciliação",
};
export const payDocTypeLabel: Record<string, string> = {
  nfse: "NFS-e",
  nfe: "NF-e",
  payroll_evidence: "Evidência de folha",
  freelance_document: "Documento freelance",
};
export const payTargetLabel = {
  project: "Projeto",
  commercial_contract: "Contrato comercial",
  deal: "Negócio",
} as const;

export const payInstallment = z.object({
  amount: z.number().positive().multipleOf(0.01),
  due_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Sum check in cents so the UI blocks the same "must close exactly" rule enforced by the database. */
export function installmentsProblem(
  total: number,
  list: Array<{ amount: number; due_on: string }>,
  competence: string,
): string | null {
  if (list.length < 1 || list.length > 24) return "Informe de 1 a 24 parcelas.";
  if (list.some((x) => !(x.amount > 0))) return "Toda parcela precisa de valor explícito.";
  if (list.some((x) => !x.due_on || x.due_on < competence))
    return "Vencimento explícito e não anterior à competência.";
  const cents = list.reduce((s, x) => s + Math.round(x.amount * 100), 0);
  if (cents !== Math.round(total * 100))
    return "A soma das parcelas deve fechar exatamente a obrigação.";
  return null;
}
/** Total of the explicitly selected, non-blocked lines only (pending lines never count as zero). */
export function selectedTotal(lines: PayLine[], keys: string[]): number | null {
  const chosen = lines.filter((l) => keys.includes(l.key));
  if (chosen.length !== keys.length || chosen.some((l) => l.blocking || l.amount === null))
    return null;
  return Math.round(chosen.reduce((s, l) => s + Number(l.amount) * 100, 0)) / 100;
}
