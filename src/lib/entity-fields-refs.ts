// Colunas de referência (FK) compartilhadas entre o catálogo de campos
// (server) e o construtor de workflows (client).
// Vive fora de `*.functions.ts` porque módulos de server functions são
// divididos no build e perderiam constantes de runtime no bundle do cliente.

/** Tipos de referência suportados pelo seletor com busca por nome. */
export type RefKind =
  | "user"
  | "company"
  | "contact"
  | "pipeline"
  | "legal_entity"
  | "contract"
  | "deal"
  | "substatus"
  | "job"
  | "candidate"
  | "application"
  | "project"
  | "milestone"
  | "service"
  | "service_catalog"
  | "financial_category"
  | "kb_category";

/** Tipos resolvidos pela busca genérica `searchSimpleRefs`. */
export const SIMPLE_REF_KINDS = [
  "substatus",
  "job",
  "candidate",
  "application",
  "project",
  "milestone",
  "service",
  "service_catalog",
  "financial_category",
  "kb_category",
] as const;

export type SimpleRefKind = (typeof SIMPLE_REF_KINDS)[number];

export function isSimpleRefKind(kind: RefKind): kind is SimpleRefKind {
  return (SIMPLE_REF_KINDS as readonly string[]).includes(kind);
}

/** Colunas cujo valor é um ID: a interface mostra o nome e grava o ID. */
export const REF_COLUMNS: Record<string, RefKind> = {
  assigned_user_id: "user",
  assigned_to: "user",
  assignee_id: "user",
  approver_user_id: "user",
  hiring_manager_id: "user",
  notify_user_id: "user",
  manager_id: "user",
  requested_by: "user",
  recruiter_id: "user",
  relationship_owner_id: "user",
  interviewer_id: "user",
  delivery_owner_id: "user",
  company_id: "company",
  parent_company_id: "company",
  counterparty_company_id: "company",
  primary_contact_id: "contact",
  contact_id: "contact",
  pipeline_id: "pipeline",
  contracting_legal_entity_id: "legal_entity",
  legal_entity_id: "legal_entity",
  counterparty_legal_entity_id: "legal_entity",
  parent_contract_id: "contract",
  contract_id: "contract",
  deal_id: "deal",
  // Cadastros auxiliares e entidades de outros módulos: mesma regra —
  // a interface mostra o nome e grava o ID.
  stage_substatus_id: "substatus",
  job_id: "job",
  candidate_id: "candidate",
  application_id: "application",
  project_id: "project",
  milestone_id: "milestone",
  service_id: "service",
  service_catalog_id: "service_catalog",
};

/**
 * Colunas homônimas que apontam para tabelas diferentes conforme a entidade.
 * Ex.: `category_id` é categoria financeira em Financeiro e categoria da base
 * de conhecimento em Artigos. Tem precedência sobre `REF_COLUMNS`.
 */
export const REF_COLUMNS_BY_ENTITY: Record<string, Record<string, RefKind>> = {
  financial_entries: { category_id: "financial_category" },
  kb_articles: { category_id: "kb_category" },
};

/**
 * Colunas puramente técnicas (IDs de integração/sincronização): continuam
 * editáveis, mas ficam no bloco recolhido "Outros campos" em vez de aparecer
 * como propriedade normal do registro.
 */
export const TECHNICAL_ID_COLUMNS: ReadonlySet<string> = new Set([
  "provider_applicant_id",
  "linkedin_company_id",
  "linkedin_location_id",
  "connection_id",
  "external_id",
  "origin_id",
  "parent_entry_id",
  "signature_operation_id",
]);
