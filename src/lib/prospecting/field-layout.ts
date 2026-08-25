/**
 * Layout de campos de entidades exibidos na tela de qualificação.
 *
 * Cada questionário guarda em `field_layout` uma lista de blocos que definem
 * quais campos de Lead/Empresa/Contato aparecem antes ou depois das perguntas.
 * Vive fora de `*.functions.ts` para que os tipos e o parser possam ser usados
 * tanto no cliente quanto no servidor.
 */

export const QUALIFICATION_FIELD_ENTITIES = [
  { value: "leads", label: "Lead" },
  { value: "companies", label: "Empresa" },
  { value: "contacts", label: "Contato" },
] as const;

export type QualificationFieldEntity = (typeof QUALIFICATION_FIELD_ENTITIES)[number]["value"];

export type QualificationFieldPosition = "before" | "after";

export type QualificationFieldType = "text" | "number" | "currency" | "date" | "select" | "boolean";

export type QualificationField = {
  key: string;
  label: string;
  type: QualificationFieldType;
  required?: boolean;
  options?: { value: string; label: string }[];
};

export type QualificationFieldBlock = {
  id: string;
  entity: QualificationFieldEntity;
  position: QualificationFieldPosition;
  title: string;
  fields: QualificationField[];
};

const ENTITY_VALUES = new Set<string>(QUALIFICATION_FIELD_ENTITIES.map((e) => e.value));
const TYPES = new Set<string>(["text", "number", "currency", "date", "select", "boolean"]);

export function entityLabel(entity: QualificationFieldEntity): string {
  return QUALIFICATION_FIELD_ENTITIES.find((e) => e.value === entity)?.label ?? entity;
}

/** Normaliza o JSON salvo no banco, descartando entradas inválidas. */
export function parseFieldLayout(raw: unknown): QualificationFieldBlock[] {
  if (!Array.isArray(raw)) return [];
  const blocks: QualificationFieldBlock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const b = item as Record<string, unknown>;
    const entity = typeof b.entity === "string" && ENTITY_VALUES.has(b.entity) ? b.entity : null;
    if (!entity) continue;
    const position: QualificationFieldPosition = b.position === "after" ? "after" : "before";
    const fields: QualificationField[] = [];
    if (Array.isArray(b.fields)) {
      for (const f of b.fields) {
        if (!f || typeof f !== "object") continue;
        const ff = f as Record<string, unknown>;
        if (typeof ff.key !== "string" || !ff.key) continue;
        const type =
          typeof ff.type === "string" && TYPES.has(ff.type)
            ? (ff.type as QualificationFieldType)
            : "text";
        const options = Array.isArray(ff.options)
          ? (ff.options as unknown[])
              .filter(
                (o): o is { value: string; label: string } =>
                  !!o &&
                  typeof o === "object" &&
                  typeof (o as { value?: unknown }).value === "string",
              )
              .map((o) => ({ value: o.value, label: String(o.label ?? o.value) }))
          : undefined;
        fields.push({
          key: ff.key,
          label: typeof ff.label === "string" && ff.label ? ff.label : ff.key,
          type,
          required: ff.required === true,
          ...(options && options.length ? { options } : {}),
        });
      }
    }
    blocks.push({
      id: typeof b.id === "string" && b.id ? b.id : `${entity}-${position}-${blocks.length}`,
      entity: entity as QualificationFieldEntity,
      position,
      title:
        typeof b.title === "string" && b.title
          ? b.title
          : entityLabel(entity as QualificationFieldEntity),
      fields,
    });
  }
  return blocks;
}
