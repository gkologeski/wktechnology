// Mapa de associações entre entidades e sua chave estrangeira / tabela alvo.
// Usado por copy_field_from_association e associate_records/disassociate_records.
import type { WorkflowEntity } from "./types";

export type AssociationDef = {
  key: string; // rótulo lógico (ex: "company", "primary_contact")
  label: string;
  fk_column: string; // coluna FK na entidade origem
  target_table: string; // tabela alvo
};

export const ENTITY_ASSOCIATIONS: Record<WorkflowEntity, AssociationDef[]> = {
  leads: [
    { key: "converted_contact", label: "Contato convertido", fk_column: "converted_contact_id", target_table: "contacts" },
    { key: "converted_deal", label: "Negócio convertido", fk_column: "converted_deal_id", target_table: "deals" },
  ],
  contacts: [
    { key: "company", label: "Empresa", fk_column: "company_id", target_table: "companies" },
  ],
  companies: [
    { key: "parent_company", label: "Empresa-mãe", fk_column: "parent_company_id", target_table: "companies" },
  ],
  deals: [
    { key: "company", label: "Empresa", fk_column: "company_id", target_table: "companies" },
    { key: "primary_contact", label: "Contato principal", fk_column: "primary_contact_id", target_table: "contacts" },
  ],
  tickets: [
    { key: "company", label: "Empresa", fk_column: "company_id", target_table: "companies" },
    { key: "contact", label: "Contato", fk_column: "contact_id", target_table: "contacts" },
    { key: "deal", label: "Negócio", fk_column: "deal_id", target_table: "deals" },
  ],
  ats_jobs: [
    { key: "company", label: "Empresa", fk_column: "company_id", target_table: "companies" },
    { key: "deal", label: "Negócio", fk_column: "deal_id", target_table: "deals" },
  ],
  ats_candidates: [],
  ats_applications: [
    { key: "job", label: "Vaga", fk_column: "job_id", target_table: "ats_jobs" },
    { key: "candidate", label: "Candidato", fk_column: "candidate_id", target_table: "ats_candidates" },
  ],
  ats_interviews: [
    { key: "job", label: "Vaga", fk_column: "job_id", target_table: "ats_jobs" },
    { key: "candidate", label: "Candidato", fk_column: "candidate_id", target_table: "ats_candidates" },
    { key: "application", label: "Aplicação", fk_column: "application_id", target_table: "ats_applications" },
  ],
  projects: [
    { key: "company", label: "Empresa", fk_column: "company_id", target_table: "companies" },
    { key: "deal", label: "Negócio", fk_column: "deal_id", target_table: "deals" },
    { key: "contact", label: "Contato principal", fk_column: "primary_contact_id", target_table: "contacts" },
  ],
  project_tasks: [
    { key: "project", label: "Projeto", fk_column: "project_id", target_table: "projects" },
    { key: "assignee", label: "Responsável", fk_column: "assignee_id", target_table: "profiles" },
  ],
  project_milestones: [
    { key: "project", label: "Projeto", fk_column: "project_id", target_table: "projects" },
  ],
  contracts: [
    { key: "company", label: "Empresa", fk_column: "company_id", target_table: "companies" },
    { key: "deal", label: "Negócio", fk_column: "deal_id", target_table: "deals" },
    { key: "contact", label: "Contato", fk_column: "contact_id", target_table: "contacts" },
  ],
  financial_entries: [
    { key: "legal_entity", label: "Empresa (CNPJ)", fk_column: "legal_entity_id", target_table: "legal_entities" },
    { key: "cost_center", label: "Centro de custo", fk_column: "cost_center_id", target_table: "financial_cost_centers" },
    { key: "category", label: "Categoria", fk_column: "category_id", target_table: "financial_categories" },
    { key: "bank_account", label: "Conta bancária", fk_column: "bank_account_id", target_table: "financial_bank_accounts" },
    { key: "company", label: "Empresa (contato)", fk_column: "company_id", target_table: "companies" },
    { key: "deal", label: "Negócio", fk_column: "deal_id", target_table: "deals" },
  ],
  bank_payments: [
    { key: "bank_account", label: "Conta bancária", fk_column: "bank_account_id", target_table: "financial_bank_accounts" },
  ],
  quotes: [
    { key: "deal", label: "Negócio", fk_column: "deal_id", target_table: "deals" },
    { key: "company", label: "Empresa", fk_column: "company_id", target_table: "companies" },
  ],
  proposals: [
    { key: "deal", label: "Negócio", fk_column: "deal_id", target_table: "deals" },
    { key: "company", label: "Empresa", fk_column: "company_id", target_table: "companies" },
  ],
  services: [],
  recurring_plans: [
    { key: "company", label: "Empresa", fk_column: "company_id", target_table: "companies" },
  ],
  subscription_invoices: [
    { key: "subscription", label: "Assinatura", fk_column: "subscription_id", target_table: "subscriptions" },
  ],
  customer_invoices: [
    { key: "company", label: "Empresa", fk_column: "company_id", target_table: "companies" },
    { key: "deal", label: "Negócio", fk_column: "deal_id", target_table: "deals" },
  ],
};

export function findAssociation(entity: WorkflowEntity, key: string): AssociationDef | null {
  return ENTITY_ASSOCIATIONS[entity]?.find((a) => a.key === key) ?? null;
}
