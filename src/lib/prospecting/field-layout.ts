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

/** Tipos usados só pelo bloco fixo de dados básicos (não são gravados no layout). */
export type QualificationBasicFieldType = "email" | "phone";

export type QualificationField = {
  key: string;
  label: string;
  type: QualificationFieldType | QualificationBasicFieldType;
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

/** Título padrão de um bloco, com o artigo correto ("Dados da Empresa"). */
export function defaultBlockTitle(entity: QualificationFieldEntity): string {
  return `${entity === "companies" ? "Dados da" : "Dados do"} ${entityLabel(entity)}`;
}

export const BASIC_LEAD_BLOCK_ID = "basic-lead";

const BASIC_LEAD_FIELDS: QualificationField[] = [
  { key: "first_name", label: "Nome", type: "text" },
  { key: "last_name", label: "Sobrenome", type: "text" },
  { key: "email", label: "E-mail", type: "email" },
  { key: "phone", label: "Telefone", type: "phone" },
  { key: "whatsapp_e164", label: "WhatsApp", type: "phone" },
];

/**
 * Acrescenta no topo o bloco fixo "Dados básicos" do Lead (nome, sobrenome,
 * e-mail, telefone e WhatsApp), presente em todo questionário. Campos que o
 * layout já mostra para o Lead não são repetidos.
 */
export function withBasicLeadBlock(blocks: QualificationFieldBlock[]): QualificationFieldBlock[] {
  const leadKeys = new Set(
    blocks.filter((b) => b.entity === "leads").flatMap((b) => b.fields.map((f) => f.key)),
  );
  const fields = BASIC_LEAD_FIELDS.filter((f) => !leadKeys.has(f.key));
  const fixed = blocks.map((b) =>
    b.entity === "companies" && b.title.trim() === "Dados do Empresa"
      ? { ...b, title: "Dados da Empresa" }
      : b,
  );
  if (fields.length === 0) return fixed;
  return [
    { id: BASIC_LEAD_BLOCK_ID, entity: "leads", position: "before", title: "Dados básicos", fields },
    ...fixed,
  ];
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
          : defaultBlockTitle(entity as QualificationFieldEntity),
      fields,
    });
  }
  return blocks;
}
