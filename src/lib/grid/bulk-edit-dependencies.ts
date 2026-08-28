// Dependências e agrupamento de campos da edição em massa (somente UI).
// Espelha o comportamento do HubSpot: ao editar um campo dependente, o
// diálogo pede primeiro o campo "pai" e filtra as opções a partir dele.
// Não fala com o banco nem altera o contrato de `bulkUpdateEntity`.
import type { EntityFieldDef } from "@/lib/entity-fields.functions";
import type { BulkEditEntity } from "./bulk-edit-fields";

/** Entidade de pipeline correspondente à tabela editada (quando houver). */
export function pipelineEntityFor(entity: BulkEditEntity): "deal" | "lead" | "ticket" | null {
  if (entity === "deals") return "deal";
  if (entity === "leads") return "lead";
  if (entity === "tickets") return "ticket";
  return null;
}

/** Campos que representam a etapa do pipeline. */
export const STAGE_FIELDS = new Set(["stage", "stage_id"]);
/** Campo de substatus da etapa. */
export const SUBSTATUS_FIELD = "stage_substatus_id";
/** Campo de pipeline. */
export const PIPELINE_FIELD = "pipeline_id";

export type DependencyKind = "stage" | "substatus" | "lost_reason";

/**
 * Classifica o campo escolhido. `null` = campo simples, sem dependência.
 */
export function dependencyKindFor(
  entity: BulkEditEntity,
  fieldName: string,
): DependencyKind | null {
  if (!pipelineEntityFor(entity)) return null;
  if (STAGE_FIELDS.has(fieldName)) return "stage";
  if (fieldName === SUBSTATUS_FIELD) return "substatus";
  if (fieldName === "closed_lost_reason" || fieldName === "loss_reason_id") return "lost_reason";
  return null;
}

/** Texto-guia exibido acima dos campos em cascata. */
export function dependencyHint(kind: DependencyKind): string {
  if (kind === "stage") {
    return "Ao editar um pipeline ou uma etapa de pipeline, você deve selecionar tanto um pipeline quanto uma etapa.";
  }
  if (kind === "substatus") {
    return "O substatus pertence a uma etapa: selecione o pipeline e a etapa para ver os substatus disponíveis.";
  }
  return "O motivo de perda só se aplica a registros em uma etapa de perda.";
}

// ---------------------------------------------------------------------------
// Agrupamento das propriedades no combo de escolha
// ---------------------------------------------------------------------------

export const FIELD_GROUP_ORDER = [
  "Pipeline e etapas",
  "Identificação",
  "Associações",
  "Atribuição",
  "Valores",
  "Datas",
  "Outras propriedades",
  "Campos de sistema e integração",
] as const;

export type FieldGroup = (typeof FIELD_GROUP_ORDER)[number];

const PIPELINE_GROUP = new Set([
  PIPELINE_FIELD,
  "stage",
  "stage_id",
  SUBSTATUS_FIELD,
  "status",
  "probability",
  "closed_lost_reason",
  "closed_won_reason",
  "loss_reason_id",
  "lost_reason",
  "close_date",
  "closed_at",
]);

const IDENTITY_GROUP = new Set([
  "name",
  "title",
  "subject",
  "full_name",
  "first_name",
  "last_name",
  "email",
  "phone",
  "mobile_phone",
  "document",
  "cnpj",
  "cpf",
  "website",
  "domain",
  "linkedin_url",
  "code",
  "reference",
]);

const ASSIGNMENT_GROUP = new Set([
  "assigned_to",
  "assigned_user_id",
  "assignee_id",
  "manager_id",
  "approver_user_id",
  "hiring_manager_id",
  "requested_by",
  "team_id",
]);

/** Grupo (categoria) de uma propriedade no combo de escolha. */
export function fieldGroupFor(field: EntityFieldDef): FieldGroup {
  if (field.system) return "Campos de sistema e integração";
  if (PIPELINE_GROUP.has(field.name)) return "Pipeline e etapas";
  if (ASSIGNMENT_GROUP.has(field.name)) return "Atribuição";
  if (IDENTITY_GROUP.has(field.name)) return "Identificação";
  if (field.ref) return "Associações";
  if (field.type === "currency") return "Valores";
  if (field.type === "date") return "Datas";
  return "Outras propriedades";
}

/** Agrupa e ordena as propriedades para exibição no combo. */
export function groupFields(
  fields: EntityFieldDef[],
): Array<{ group: FieldGroup; fields: EntityFieldDef[] }> {
  const buckets = new Map<FieldGroup, EntityFieldDef[]>();
  for (const f of fields) {
    const g = fieldGroupFor(f);
    const list = buckets.get(g);
    if (list) list.push(f);
    else buckets.set(g, [f]);
  }
  return FIELD_GROUP_ORDER.filter((g) => (buckets.get(g)?.length ?? 0) > 0).map((g) => ({
    group: g,
    fields: (buckets.get(g) as EntityFieldDef[])
      .slice()
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
  }));
}
