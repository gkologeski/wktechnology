import type { ExtractedContract } from "@/lib/contracts/import-schemas";

/** Campos que só o fluxo de assinatura pode gravar; o banco recusa o patch se vierem. */
export const PROTECTED_CONTRACT_KEYS = [
  "id",
  "workspace_id",
  "owner_id",
  "created_at",
  "updated_at",
  "public_token",
  "signature_document_id",
  "signature_operation_id",
  "signature_provider",
] as const;

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : v == null || v === "" ? null : Number(v);

/** Monta o patch do contrato importado sem nenhum campo protegido. */
export function buildImportPatch(f: ExtractedContract): Record<string, unknown> {
  return {
    title: f.title?.trim() || "Contrato importado",
    role: f.role ?? undefined,
    total_value: (f.total_value ?? f.monthly_value ?? 0) as number,
    currency: f.currency ?? "BRL",
    starts_at: f.starts_at ?? null,
    ends_at: f.ends_at ?? null,
    auto_renew: f.auto_renew ?? false,
    notice_days: num(f.notice_days) ?? 30,
    monthly_value: num(f.monthly_value),
    hours_per_month: num(f.hours_per_month),
    payment_day: num(f.payment_day),
    payment_method: f.payment_method ?? null,
    late_fee_percent: num(f.late_fee_percent),
    late_interest_monthly_percent: num(f.late_interest_monthly_percent),
    expense_reimbursement_days: num(f.expense_reimbursement_days),
    readjustment_index: f.readjustment_index ?? null,
    readjustment_period: f.readjustment_period ?? null,
    penalty_percent: num(f.penalty_percent),
    cure_period_days: num(f.cure_period_days),
    trial_period_days: num(f.trial_period_days),
    unilateral_termination_notice_days: num(f.unilateral_termination_notice_days),
    service_type: f.service_type ?? null,
    service_scope: f.service_scope ?? null,
    service_location: f.service_location ?? null,
    governing_law: f.governing_law ?? null,
    jurisdiction: f.jurisdiction ?? null,
    confidentiality_term_months: num(f.confidentiality_term_months),
  };
}
