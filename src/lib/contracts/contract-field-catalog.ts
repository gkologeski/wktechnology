// Catálogo dos campos de contrato usados na criação e na tela de padrões.
// Módulo puro (sem I/O): rótulos em português, tipo do campo, seção e para
// quais tipos de documento cada campo se aplica.
import { CONTRACT_FIELD_LABELS, CONTRACT_FIELD_OPTIONS } from "./workflow-field-meta";
import type { ContractKind } from "./contract-kinds";

export type ContractFieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "date"
  | "boolean"
  | "select"
  | "company"
  | "legal_entity"
  | "deal"
  | "user"
  | "contract";

export type ContractFieldDef = {
  name: string;
  label: string;
  type: ContractFieldType;
  options?: { value: string; label: string }[];
  /** Seção do formulário (também usada na tela de padrões). */
  section: string;
  /** Tipos de documento em que o campo aparece. Ausente = todos. */
  kinds?: ContractKind[];
  /** Pode ter valor padrão configurado em /settings/contract-defaults. */
  defaultable?: boolean;
  /** Texto de apoio abaixo do campo. */
  hint?: string;
  placeholder?: string;
};

const L = (name: string) => CONTRACT_FIELD_LABELS[name] ?? name;
const O = (name: string) => CONTRACT_FIELD_OPTIONS[name];

export const CONTRACT_SECTIONS = [
  "Identificação",
  "Vigência",
  "Valores",
  "Cobrança",
  "Reajuste",
  "Serviço",
  "Jurídico",
  "Assinatura",
] as const;

export const CONTRACT_FIELDS: ContractFieldDef[] = [
  // Identificação
  { name: "title", label: L("title"), type: "text", section: "Identificação" },
  {
    name: "counterparty_company_id",
    label: L("counterparty_company_id"),
    type: "company",
    section: "Identificação",
  },
  {
    name: "contracting_legal_entity_id",
    label: L("contracting_legal_entity_id"),
    type: "legal_entity",
    section: "Identificação",
    defaultable: true,
  },
  { name: "deal_id", label: L("deal_id"), type: "deal", section: "Identificação" },
  { name: "assigned_to", label: L("assigned_to"), type: "user", section: "Identificação" },
  {
    name: "parent_contract_id",
    label: L("parent_contract_id"),
    type: "contract",
    section: "Identificação",
    kinds: ["amendment"],
  },
  {
    name: "amendment_number",
    label: L("amendment_number"),
    type: "text",
    section: "Identificação",
    kinds: ["amendment"],
    placeholder: "1º",
  },
  {
    name: "amendment_effective_at",
    label: L("amendment_effective_at"),
    type: "date",
    section: "Identificação",
    kinds: ["amendment"],
  },

  // Vigência
  { name: "starts_at", label: L("starts_at"), type: "date", section: "Vigência" },
  { name: "ends_at", label: L("ends_at"), type: "date", section: "Vigência" },
  {
    name: "auto_renew",
    label: L("auto_renew"),
    type: "boolean",
    section: "Vigência",
    defaultable: true,
  },
  {
    name: "notice_days",
    label: L("notice_days"),
    type: "number",
    section: "Vigência",
    defaultable: true,
  },
  {
    name: "trial_period_days",
    label: L("trial_period_days"),
    type: "number",
    section: "Vigência",
    defaultable: true,
  },

  // Valores
  { name: "total_value", label: L("total_value"), type: "currency", section: "Valores" },
  { name: "monthly_value", label: L("monthly_value"), type: "currency", section: "Valores" },
  {
    name: "hours_per_month",
    label: L("hours_per_month"),
    type: "number",
    section: "Valores",
    defaultable: true,
  },
  {
    name: "currency",
    label: L("currency"),
    type: "select",
    options: O("currency"),
    section: "Valores",
    defaultable: true,
  },

  // Cobrança
  {
    name: "payment_day",
    label: L("payment_day"),
    type: "number",
    section: "Cobrança",
    defaultable: true,
  },
  {
    name: "payment_method",
    label: L("payment_method"),
    type: "select",
    options: O("payment_method"),
    section: "Cobrança",
    defaultable: true,
  },
  {
    name: "late_fee_percent",
    label: L("late_fee_percent"),
    type: "number",
    section: "Cobrança",
    defaultable: true,
  },
  {
    name: "late_interest_monthly_percent",
    label: L("late_interest_monthly_percent"),
    type: "number",
    section: "Cobrança",
    defaultable: true,
  },
  {
    name: "expense_reimbursement_days",
    label: L("expense_reimbursement_days"),
    type: "number",
    section: "Cobrança",
    defaultable: true,
  },

  // Reajuste
  {
    name: "readjustment_index",
    label: L("readjustment_index"),
    type: "select",
    options: O("readjustment_index"),
    section: "Reajuste",
    defaultable: true,
  },
  {
    name: "readjustment_period",
    label: L("readjustment_period"),
    type: "select",
    options: O("readjustment_period"),
    section: "Reajuste",
    defaultable: true,
  },

  // Serviço
  {
    name: "service_type",
    label: L("service_type"),
    type: "select",
    options: O("service_type"),
    section: "Serviço",
    defaultable: true,
  },
  {
    name: "service_location",
    label: L("service_location"),
    type: "select",
    options: O("service_location"),
    section: "Serviço",
    defaultable: true,
  },
  {
    name: "service_scope",
    label: L("service_scope"),
    type: "textarea",
    section: "Serviço",
    defaultable: true,
  },

  // Jurídico
  {
    name: "governing_law",
    label: L("governing_law"),
    type: "text",
    section: "Jurídico",
    defaultable: true,
    placeholder: "Lei brasileira",
  },
  {
    name: "jurisdiction",
    label: L("jurisdiction"),
    type: "text",
    section: "Jurídico",
    defaultable: true,
    placeholder: "Comarca de Florianópolis/SC",
  },
  {
    name: "penalty_percent",
    label: L("penalty_percent"),
    type: "number",
    section: "Jurídico",
    defaultable: true,
  },
  {
    name: "cure_period_days",
    label: L("cure_period_days"),
    type: "number",
    section: "Jurídico",
    defaultable: true,
  },
  {
    name: "unilateral_termination_notice_days",
    label: L("unilateral_termination_notice_days"),
    type: "number",
    section: "Jurídico",
    defaultable: true,
  },
  {
    name: "confidentiality_term_months",
    label: L("confidentiality_term_months"),
    type: "number",
    section: "Jurídico",
    defaultable: true,
  },

  // Assinatura
  {
    name: "signature_provider",
    label: L("signature_provider"),
    type: "select",
    options: O("signature_provider"),
    section: "Assinatura",
    defaultable: true,
  },
];

export const DEFAULTABLE_CONTRACT_FIELDS = CONTRACT_FIELDS.filter((f) => f.defaultable);

export function fieldsForKind(kind: ContractKind): ContractFieldDef[] {
  return CONTRACT_FIELDS.filter((f) => !f.kinds || f.kinds.includes(kind));
}

export function fieldsBySection(fields: ContractFieldDef[]): [string, ContractFieldDef[]][] {
  return CONTRACT_SECTIONS.map(
    (s) => [s, fields.filter((f) => f.section === s)] as [string, ContractFieldDef[]],
  ).filter(([, list]) => list.length > 0);
}

export const CONTRACT_FIELD_BY_NAME: Record<string, ContractFieldDef> = Object.fromEntries(
  CONTRACT_FIELDS.map((f) => [f.name, f]),
);
