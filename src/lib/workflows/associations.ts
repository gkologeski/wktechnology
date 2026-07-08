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
};

export function findAssociation(entity: WorkflowEntity, key: string): AssociationDef | null {
  return ENTITY_ASSOCIATIONS[entity]?.find((a) => a.key === key) ?? null;
}
