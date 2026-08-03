// Variáveis de dados associados ao registro do gatilho.
//
// O motor hidrata o registro do gatilho com os registros associados
// (`src/lib/workflows/hydrate-associations.server.ts`), expondo cada um sob a
// chave lógica da associação. Assim `{{company.name}}` resolve o nome da
// empresa vinculada ao negócio que disparou o fluxo.
//
// Este módulo é client-safe: alimenta as pills do construtor e as opções
// pré-carregadas dos campos de referência.

import type { RefKind } from "@/lib/entity-fields-refs";
import type { MessageToken } from "@/lib/message-tokens-catalog";
import { ENTITY_ASSOCIATIONS, type AssociationDef } from "./associations";
import type { WorkflowEntity } from "./types";

/** Tabela alvo da associação → tipo de referência do seletor. */
export const TARGET_REF_KIND: Record<string, RefKind> = {
  companies: "company",
  contacts: "contact",
  deals: "deal",
  contracts: "contract",
  legal_entities: "legal_entity",
  profiles: "user",
};

/** Entidade do gatilho → tipo de referência equivalente (para "Este registro"). */
export const ENTITY_REF_KIND: Partial<Record<WorkflowEntity, RefKind>> = {
  companies: "company",
  contacts: "contact",
  deals: "deal",
  contracts: "contract",
};

type AssocField = { name: string; label: string };

/**
 * Campos úteis por tabela associada (curados em PT-BR). Evita gerar centenas
 * de pills e nunca expõe colunas técnicas ou IDs internos.
 */
export const ASSOCIATION_FIELDS: Record<string, AssocField[]> = {
  companies: [
    { name: "name", label: "Nome" },
    { name: "domain", label: "Site/domínio" },
    { name: "industry", label: "Setor" },
    { name: "phone", label: "Telefone" },
    { name: "city", label: "Cidade" },
    { name: "state", label: "Estado" },
    { name: "country", label: "País" },
  ],
  contacts: [
    { name: "first_name", label: "Nome" },
    { name: "last_name", label: "Sobrenome" },
    { name: "email", label: "E-mail" },
    { name: "phone", label: "Telefone" },
    { name: "job_title", label: "Cargo" },
  ],
  deals: [
    { name: "name", label: "Nome" },
    { name: "value", label: "Valor" },
    { name: "currency", label: "Moeda" },
    { name: "stage", label: "Etapa" },
    { name: "expected_close_date", label: "Fechamento esperado" },
  ],
  contracts: [
    { name: "title", label: "Título" },
    { name: "status", label: "Status" },
    { name: "start_date", label: "Início" },
    { name: "end_date", label: "Fim" },
    { name: "total_value", label: "Valor total" },
  ],
  projects: [
    { name: "name", label: "Nome" },
    { name: "status", label: "Status" },
    { name: "start_date", label: "Início" },
    { name: "end_date", label: "Fim" },
  ],
  ats_jobs: [
    { name: "name", label: "Nome da vaga" },
    { name: "status", label: "Status" },
  ],
  ats_candidates: [
    { name: "full_name", label: "Nome completo" },
    { name: "email", label: "E-mail" },
    { name: "phone", label: "Telefone" },
  ],
  ats_applications: [
    { name: "stage", label: "Etapa" },
    { name: "status", label: "Status" },
  ],
  legal_entities: [
    { name: "name", label: "Razão social" },
    { name: "cnpj", label: "CNPJ" },
  ],
  profiles: [
    { name: "name", label: "Nome" },
    { name: "email", label: "E-mail" },
  ],
  financial_cost_centers: [{ name: "name", label: "Nome" }],
  financial_categories: [{ name: "name", label: "Nome" }],
  financial_bank_accounts: [{ name: "name", label: "Nome" }],
  subscriptions: [{ name: "status", label: "Status" }],
  leads: [
    { name: "first_name", label: "Nome" },
    { name: "last_name", label: "Sobrenome" },
    { name: "email", label: "E-mail" },
    { name: "company_name", label: "Empresa" },
  ],
};

/** Associações da entidade do gatilho que têm campos mapeados. */
export function associationsWithFields(entity: WorkflowEntity): AssociationDef[] {
  return (ENTITY_ASSOCIATIONS[entity] ?? []).filter(
    (a) => (ASSOCIATION_FIELDS[a.target_table] ?? []).length > 0,
  );
}

/**
 * Pills de texto para dados associados: `{{company.name}}`,
 * `{{primary_contact.email}}`, agrupadas por associação.
 */
export function buildAssociationTextTokens(entity: WorkflowEntity): MessageToken[] {
  const out: MessageToken[] = [];
  for (const assoc of associationsWithFields(entity)) {
    const group = `${assoc.label} (do gatilho)`;
    for (const f of ASSOCIATION_FIELDS[assoc.target_table] ?? []) {
      out.push({ token: `{{${assoc.key}.${f.name}}}`, label: f.label, group });
    }
  }
  return out;
}

export type RefTokenOption = { token: string; label: string; group: string };

const GROUP_TRIGGER = "Do gatilho";
const GROUP_STEPS = "Passos anteriores";

/**
 * Opções pré-carregadas para um campo de referência: IDs vindos do registro do
 * gatilho (o próprio registro e suas associações) compatíveis com o `kind`.
 */
export function triggerRefOptions(
  entity: WorkflowEntity | null | undefined,
  kind: RefKind,
): RefTokenOption[] {
  if (!entity) return [];
  const out: RefTokenOption[] = [];
  if (ENTITY_REF_KIND[entity] === kind) {
    out.push({ token: "{{id}}", label: "Este registro (do gatilho)", group: GROUP_TRIGGER });
  }
  for (const assoc of ENTITY_ASSOCIATIONS[entity] ?? []) {
    if (TARGET_REF_KIND[assoc.target_table] !== kind) continue;
    out.push({
      token: `{{${assoc.fk_column}}}`,
      label: `${assoc.label} do gatilho`,
      group: GROUP_TRIGGER,
    });
  }
  if (kind === "user") {
    out.push(
      { token: "{{assigned_to}}", label: "Responsável do gatilho", group: GROUP_TRIGGER },
      { token: "{{owner_id}}", label: "Criador do registro", group: GROUP_TRIGGER },
    );
  }
  // dedupe por token
  const seen = new Set<string>();
  return out.filter((o) => (seen.has(o.token) ? false : (seen.add(o.token), true)));
}

/** Opções de passos anteriores que produzem um registro do tipo `kind`. */
export function priorStepRefOptions(
  priorSteps: Array<{ index: number; type: string; label: string }>,
  kind: RefKind,
): RefTokenOption[] {
  const byType: Record<string, RefKind> = {
    create_company: "company",
    create_contact: "contact",
    create_deal: "deal",
  };
  return priorSteps
    .filter((s) => byType[s.type] === kind)
    .map((s) => ({
      token: `{{steps.${s.index}.id}}`,
      label: `Passo ${s.index + 1} · ${s.label}`,
      group: GROUP_STEPS,
    }));
}
