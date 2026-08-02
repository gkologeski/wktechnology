// Colunas de referência (FK) compartilhadas entre o catálogo de campos
// (server) e o construtor de workflows (client).
// Vive fora de `*.functions.ts` porque módulos de server functions são
// divididos no build e perderiam constantes de runtime no bundle do cliente.

/** Tipos de referência suportados pelo seletor com busca por nome. */
export type RefKind = "user" | "company" | "contact" | "pipeline" | "legal_entity" | "contract";

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
  company_id: "company",
  parent_company_id: "company",
  counterparty_company_id: "company",
  primary_contact_id: "contact",
  contact_id: "contact",
  pipeline_id: "pipeline",
  contracting_legal_entity_id: "legal_entity",
  legal_entity_id: "legal_entity",
  parent_contract_id: "contract",
  contract_id: "contract",
};
