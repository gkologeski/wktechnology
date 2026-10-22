import { pickWhatsAppNumber, toWhatsAppE164 } from "@/lib/phone/whatsapp-e164";
// Público e variáveis das campanhas de WhatsApp (regras puras, tela + servidor).
// Os campos vêm de uma lista branca: nada fora dela entra na mensagem ou nos filtros.

export type AudienceBase = "leads" | "contacts" | "companies" | "deals";
export type FieldGroup =
  | "lead"
  | "contact"
  | "company"
  | "deal"
  | "owner_record"
  | "owner_contact"
  | "owner_company"
  | "owner_deal"
  | "sender";

/** Chave especial: o texto digitado (em `fallback`) vai igual para todos. */
export const FREE_TEXT_FIELD = "__free__";
export const FREE_TEXT_MAX = 200;

export type AudienceField = { key: string; label: string; group: FieldGroup };

export const GROUP_LABEL: Record<FieldGroup, string> = {
  lead: "Lead",
  contact: "Contato",
  company: "Empresa",
  deal: "Negócio",
  owner_record: "Responsável pelo registro",
  owner_contact: "Responsável pelo contato",
  owner_company: "Responsável pela empresa",
  owner_deal: "Responsável pelo negócio",
  sender: "Remetente",
};

const OWNER_COLUMNS = { full_name: "Nome", first_name: "Primeiro nome" };

export const BASE_LABEL: Record<AudienceBase, string> = {
  leads: "Leads",
  contacts: "Contatos",
  companies: "Empresas",
  deals: "Negócios",
};

/** Colunas lidas de cada tabela para montar as variáveis. */
export const FIELD_COLUMNS: Record<FieldGroup, Record<string, string>> = {
  lead: {
    first_name: "Primeiro nome",
    last_name: "Sobrenome",
    full_name: "Nome completo",
    email: "E-mail",
    company_name: "Empresa (texto)",
    source: "Origem",
    status: "Status",
    job_title: "Cargo",
    cargo_resumido: "Cargo resumido",
    area_atuacao: "Área de atuação",
    nivel_hierarquico: "Nível hierárquico",
  },
  contact: {
    first_name: "Primeiro nome",
    last_name: "Sobrenome",
    full_name: "Nome completo",
    email: "E-mail",
    job_title: "Cargo",
    city: "Cidade",
    cargo_resumido: "Cargo resumido",
    area_atuacao: "Área de atuação",
    nivel_hierarquico: "Nível hierárquico",
    state: "Estado",
  },
  company: {
    name: "Nome",
    industry: "Setor",
    size_description: "Porte Descritivo",
    city: "Cidade",
    state: "Estado",
    website: "Site",
  },
  deal: {
    name: "Título",
    service_line: "Linha de serviço",
    source: "Origem",
    stage: "Etapa",
    value: "Valor",
  },
  owner_record: OWNER_COLUMNS,
  owner_contact: OWNER_COLUMNS,
  owner_company: OWNER_COLUMNS,
  owner_deal: OWNER_COLUMNS,
  sender: OWNER_COLUMNS,
};

/** Toda base enxerga todas as entidades (via registros relacionados). */
const ALL_GROUPS: FieldGroup[] = [
  "lead",
  "contact",
  "company",
  "deal",
  "owner_record",
  "owner_contact",
  "owner_company",
  "owner_deal",
  "sender",
];

export function fieldsForBase(_base: AudienceBase): AudienceField[] {
  return ALL_GROUPS.flatMap((g) =>
    Object.entries(FIELD_COLUMNS[g]).map(([col, label]) => ({
      key: `${g}.${col}`,
      label: `${GROUP_LABEL[g]} › ${label}`,
      group: g,
    })),
  );
}

export function isAllowedField(base: AudienceBase, key: string): boolean {
  if (key === FREE_TEXT_FIELD) return true;
  return fieldsForBase(base).some((f) => f.key === key);
}

/** Filtros permitidos no "Criar público" (coluna real da tabela-base). */
export type FilterFieldDef = {
  column: string;
  label: string;
  kind: "text" | "enum" | "date" | "member" | "number" | "boolean";
  options?: { value: string; label: string }[];
  /** Mostra lista com os valores já existentes no workspace (texto livre continua aceito). */
  suggest?: boolean;
};

export const FILTER_FIELDS: Record<AudienceBase, FilterFieldDef[]> = {
  leads: [
    {
      column: "status",
      label: "Status",
      kind: "enum",
      options: [
        { value: "new", label: "Novo" },
        { value: "contacted", label: "Contatado" },
        { value: "qualified", label: "Qualificado" },
        { value: "disqualified", label: "Desqualificado" },
        { value: "nurturing", label: "Em nutrição" },
      ],
    },
    { column: "source", suggest: true, label: "Origem", kind: "text" },
    { column: "company_name", suggest: true, label: "Empresa", kind: "text" },
    { column: "whatsapp_e164", label: "WhatsApp", kind: "text" },
    { column: "assigned_to", label: "Responsável", kind: "member" },
    { column: "created_at", label: "Criado em", kind: "date" },
  ],
  contacts: [
    { column: "job_title", suggest: true, label: "Cargo", kind: "text" },
    { column: "whatsapp_e164", label: "WhatsApp", kind: "text" },
    { column: "city", suggest: true, label: "Cidade", kind: "text" },
    { column: "state", suggest: true, label: "Estado", kind: "text" },
    { column: "lifecyclestage", suggest: true, label: "Estágio do ciclo", kind: "text" },
    { column: "assigned_to", label: "Responsável", kind: "member" },
    { column: "created_at", label: "Criado em", kind: "date" },
  ],
  companies: [
    { column: "industry", suggest: true, label: "Setor", kind: "text" },
    { column: "city", suggest: true, label: "Cidade", kind: "text" },
    { column: "state", suggest: true, label: "Estado", kind: "text" },
    { column: "assigned_to", label: "Responsável", kind: "member" },
    { column: "created_at", label: "Criado em", kind: "date" },
  ],
  deals: [
    {
      column: "stage",
      label: "Etapa",
      kind: "enum",
      options: [
        { value: "new", label: "Novo" },
        { value: "qualified", label: "Qualificado" },
        { value: "proposal", label: "Proposta" },
        { value: "negotiation", label: "Negociação" },
        { value: "won", label: "Ganho" },
        { value: "lost", label: "Perdido" },
      ],
    },
    { column: "source", suggest: true, label: "Origem", kind: "text" },
    { column: "service_line", suggest: true, label: "Linha de serviço", kind: "text" },
    { column: "assigned_to", label: "Responsável", kind: "member" },
    { column: "created_at", label: "Criado em", kind: "date" },
  ],
};

export type AudienceFilterOp =
  | "eq"
  | "neq"
  | "ilike"
  | "not_ilike"
  | "gte"
  | "lte"
  | "is_null"
  | "is_not_null";
export const AUDIENCE_FILTER_OPS: AudienceFilterOp[] = [
  "eq",
  "neq",
  "ilike",
  "not_ilike",
  "gte",
  "lte",
  "is_null",
  "is_not_null",
];
/** `entity` ausente = a própria base (formato antigo). */
export type AudienceFilter = {
  entity?: AudienceBase;
  column: string;
  op: AudienceFilterOp;
  value: string;
  /** Vários termos (só "contém"/"não contém"); ausente = só `value`. */
  values?: string[];
};

export const MAX_FILTER_TERMS = 20;
export const isMultiTermOp = (op: AudienceFilterOp) => op === "ilike" || op === "not_ilike";

/** Termos efetivos do filtro: `values` (multi) ou `[value]`, sem vazios nem repetidos. */
export function filterTerms(f: Pick<AudienceFilter, "op" | "value" | "values">): string[] {
  const raw = isMultiTermOp(f.op) && f.values?.length ? f.values : [f.value];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const v = (t ?? "").trim();
    const k = v.toLocaleLowerCase("pt-BR");
    if (!v || seen.has(k)) continue;
    seen.add(k);
    out.push(v);
  }
  return out.slice(0, MAX_FILTER_TERMS);
}
export const ENTITY_LABEL: Record<AudienceBase, string> = {
  leads: "Lead",
  contacts: "Contato",
  companies: "Empresa",
  deals: "Negócio",
};
export type AudienceGroup = { logic: "and" | "or"; filters: AudienceFilter[] };
export const MAX_AUDIENCE_GROUPS = 10;
export const MAX_FILTERS_PER_GROUP = 20;

export const OPS_BY_KIND: Record<
  FilterFieldDef["kind"],
  { op: AudienceFilterOp; label: string }[]
> = {
  text: [
    { op: "ilike", label: "contém" },
    { op: "not_ilike", label: "não contém" },
    { op: "eq", label: "é igual a" },
    { op: "neq", label: "é diferente de" },
    { op: "is_null", label: "está vazio" },
    { op: "is_not_null", label: "não está vazio" },
  ],
  enum: [
    { op: "eq", label: "é" },
    { op: "neq", label: "não é" },
    { op: "is_null", label: "está vazio" },
    { op: "is_not_null", label: "não está vazio" },
  ],
  member: [
    { op: "eq", label: "é" },
    { op: "neq", label: "não é" },
    { op: "is_null", label: "sem responsável" },
    { op: "is_not_null", label: "tem responsável" },
  ],
  number: [
    { op: "eq", label: "é igual a" },
    { op: "neq", label: "é diferente de" },
    { op: "gte", label: "maior ou igual a" },
    { op: "lte", label: "menor ou igual a" },
    { op: "is_null", label: "está vazio" },
    { op: "is_not_null", label: "não está vazio" },
  ],
  boolean: [
    { op: "eq", label: "é" },
    { op: "is_null", label: "está vazio" },
    { op: "is_not_null", label: "não está vazio" },
  ],
  date: [
    { op: "gte", label: "a partir de" },
    { op: "lte", label: "até" },
    { op: "is_null", label: "está vazio" },
    { op: "is_not_null", label: "não está vazio" },
  ],
};

export const opNeedsValue = (op: AudienceFilterOp) => op !== "is_null" && op !== "is_not_null";

export type FilterFieldCatalog = Record<AudienceBase, FilterFieldDef[]>;

/** Prefixo de campo personalizado (`custom_fields->>chave`). */
export const CUSTOM_FIELD_PREFIX = "cf:";
const CUSTOM_KEY_RE = /^[a-z0-9_]{1,60}$/i;

/** Colunas nunca oferecidas nem aceitas em filtros (internas, sensíveis ou técnicas). */
export function isBlockedFilterColumn(col: string): boolean {
  return (
    /^(id|owner_id|workspace_id|deleted_at|portal_token|hs_raw|external_ids|custom_fields|import_batch_id|sync_state_id)$/.test(
      col,
    ) ||
    /_digits$/.test(col) ||
    /(token|secret|password|hash)/i.test(col) ||
    /^(hs_|hubspot_)/.test(col)
  );
}

/** Campo do catálogo de entidades (cliente: getEntityFieldCatalog; servidor: tipo da coluna). */
export type CatalogFieldLike = {
  name: string;
  label: string;
  type: "text" | "number" | "currency" | "date" | "select" | "boolean";
  options?: { value: string; label: string }[];
  ref?: string;
};

/** Lista completa de filtros da entidade: fixos primeiro, depois o catálogo e os personalizados. */
export function buildFilterFields(
  entity: AudienceBase,
  catalog: CatalogFieldLike[],
  custom: { key: string; label: string }[] = [],
): FilterFieldDef[] {
  const out: FilterFieldDef[] = [...FILTER_FIELDS[entity]];
  const seen = new Set(out.map((d) => d.column));
  for (const c of catalog) {
    if (seen.has(c.name) || isBlockedFilterColumn(c.name)) continue;
    let def: FilterFieldDef | null = null;
    if (c.ref) def = c.ref === "user" ? { column: c.name, label: c.label, kind: "member" } : null;
    else if (c.type === "select" && c.options?.length)
      def = { column: c.name, label: c.label, kind: "enum", options: c.options };
    else if (c.type === "number" || c.type === "currency")
      def = { column: c.name, label: c.label, kind: "number" };
    else if (c.type === "date") def = { column: c.name, label: c.label, kind: "date" };
    else if (c.type === "boolean") def = { column: c.name, label: c.label, kind: "boolean" };
    else def = { column: c.name, label: c.label, kind: "text", suggest: true };
    if (!def) continue;
    seen.add(c.name);
    out.push(def);
  }
  for (const cf of custom) {
    if (!CUSTOM_KEY_RE.test(cf.key)) continue;
    const column = `${CUSTOM_FIELD_PREFIX}${cf.key}`;
    if (seen.has(column)) continue;
    seen.add(column);
    out.push({ column, label: `${cf.label} (personalizado)`, kind: "text", suggest: true });
  }
  return out;
}

/** Tipo da coluna (information_schema) → tipo do catálogo, usado na validação do servidor. */
export function catalogTypeFromDataType(dt: string): CatalogFieldLike["type"] {
  if (dt === "boolean") return "boolean";
  if (/^(integer|numeric|bigint|double precision|real|smallint)$/.test(dt)) return "number";
  if (dt.startsWith("timestamp") || dt === "date") return "date";
  return "text";
}

/** Coluna física usada na consulta (campo personalizado vira caminho JSON). */
export function filterColumnPath(column: string): string {
  if (column.startsWith(CUSTOM_FIELD_PREFIX)) {
    const key = column.slice(CUSTOM_FIELD_PREFIX.length);
    if (!CUSTOM_KEY_RE.test(key)) throw new Error("Campo personalizado inválido.");
    return `custom_fields->>${key}`;
  }
  return column;
}

/**
 * Valida contra a lista do servidor. Tipos compatíveis: "enum" do cliente é
 * texto no banco, então o servidor aceita os operadores de texto.
 */
export function isAllowedFilter(
  base: AudienceBase,
  f: AudienceFilter,
  fields: FilterFieldCatalog = FILTER_FIELDS,
): boolean {
  const entity = f.entity ?? base;
  if (!fields[entity]) return false;
  if (isBlockedFilterColumn(f.column)) return false;
  const def = fields[entity].find((d) => d.column === f.column);
  if (!def) return false;
  if (!OPS_BY_KIND[def.kind].some((o) => o.op === f.op)) return false;
  if (opNeedsValue(f.op) && filterTerms(f).length === 0) return false;
  if (def.kind === "boolean" && opNeedsValue(f.op) && !/^(true|false)$/.test(f.value.trim()))
    return false;
  if (def.kind === "number" && opNeedsValue(f.op) && !Number.isFinite(Number(f.value.trim())))
    return false;
  return true;
}

/** Filtro sem valor (exceto vazio/não vazio) ainda está sendo montado: ignora. */
export const isCompleteFilter = (f: AudienceFilter) =>
  !opNeedsValue(f.op) || filterTerms(f).length > 0;

/** Converte o formato antigo (lista simples = E) e remove grupos vazios. */
export function normalizeAudienceGroups(input: {
  filters?: AudienceFilter[];
  groups?: AudienceGroup[];
}): AudienceGroup[] {
  const groups =
    input.groups ?? (input.filters ? [{ logic: "and" as const, filters: input.filters }] : []);
  return groups
    .map((g) => ({
      logic: g.logic === "or" ? ("or" as const) : ("and" as const),
      filters: g.filters.filter(isCompleteFilter),
    }))
    .filter((g) => g.filters.length > 0);
}

/**
 * Combina conjuntos de IDs: E/OU dentro do grupo e entre grupos (padrão OU entre grupos).
 * `idsFor` devolve os IDs da base que atendem a um filtro.
 */
export async function combineAudienceGroups(
  groups: AudienceGroup[],
  idsFor: (f: AudienceFilter) => Promise<Set<string>>,
  groupsLogic: "and" | "or" = "or",
): Promise<Set<string>> {
  let out = null as Set<string> | null;
  for (const g of groups) {
    let acc = null as Set<string> | null;
    for (const f of g.filters) {
      const s = await idsFor(f);
      if (acc === null) acc = new Set(s);
      else if (g.logic === "and") acc = new Set([...acc].filter((id) => s.has(id)));
      else for (const id of s) acc.add(id);
      if (g.logic === "and" && acc.size === 0) break;
    }
    const gs = acc ?? new Set<string>();
    if (out === null) out = gs;
    else if (groupsLogic === "and") out = new Set([...out].filter((id) => gs.has(id)));
    else for (const id of gs) out.add(id);
    if (groupsLogic === "and" && out.size === 0) break;
  }
  return out ?? new Set<string>();
}

/** E.164 apto a WhatsApp (celular BR ou estrangeiro). Fixo e inválido → null. */
export function normalizeCampaignPhone(raw: string | null | undefined): string | null {
  return toWhatsAppE164(raw);
}

/** Linha bruta do público: valores já achatados por chave "grupo.coluna". */
export type AudienceRow = {
  sourceType: FieldGroup;
  sourceId: string;
  contactId: string | null;
  phone: string | null;
  /** Candidatos em ordem de preferência (WhatsApp → Celular → Telefone). */
  phones?: Array<string | null | undefined>;
  label: string;
  values: Record<string, string | null | undefined>;
};

export type VariableBinding = { field: string; fallback?: string };
export type VariableMap = Record<string, VariableBinding>;

export type BuiltRecipient = {
  phone: string;
  contactId: string | null;
  label: string;
  source: string;
  variables: Record<string, string>;
  missing: string[];
};

export type AudienceSummary = {
  recipients: BuiltRecipient[];
  excluded: {
    no_phone: number;
    invalid_phone: number;
    landline: number;
    duplicate: number;
    opted_out: number;
  };
  withMissing: number;
};

export function resolveVariables(
  values: AudienceRow["values"],
  map: VariableMap,
): { variables: Record<string, string>; missing: string[] } {
  const variables: Record<string, string> = {};
  const missing: string[] = [];
  for (const [k, b] of Object.entries(map)) {
    const v =
      b.field === FREE_TEXT_FIELD
        ? cleanFreeText(b.fallback)
        : (values[b.field] ?? "").toString().trim() || (b.fallback ?? "").trim();
    if (v) variables[k] = v;
    else missing.push(k);
  }
  return { variables, missing };
}

/** Variáveis da Meta não aceitam quebra de linha nem espaços longos. */
export function cleanFreeText(v: string | null | undefined): string {
  return (v ?? "").replace(/\s+/g, " ").trim().slice(0, FREE_TEXT_MAX);
}

/** Telefones equivalentes (celular BR com/sem 9º dígito) contam como o mesmo. */
function phoneKey(e164: string): string {
  const m = /^\+55(\d{2})9?(\d{8})$/.exec(e164);
  return m ? `+55${m[1]}${m[2]}` : e164;
}

export function buildAudience(
  rows: AudienceRow[],
  map: VariableMap,
  optedOut: Set<string>,
): AudienceSummary {
  const excluded = { no_phone: 0, invalid_phone: 0, landline: 0, duplicate: 0, opted_out: 0 };
  const seen = new Set<string>();
  const optKeys = new Set([...optedOut].map(phoneKey));
  const recipients: BuiltRecipient[] = [];
  for (const r of rows) {
    const pick = pickWhatsAppNumber(r.phones ?? [r.phone]);
    if (pick.status === "empty") {
      excluded.no_phone++;
      continue;
    }
    if (pick.status === "landline") {
      excluded.landline++;
      continue;
    }
    if (pick.status !== "ok") {
      excluded.invalid_phone++;
      continue;
    }
    const phone = pick.e164;
    const key = phoneKey(phone);
    if (optKeys.has(key)) {
      excluded.opted_out++;
      continue;
    }
    if (seen.has(key)) {
      excluded.duplicate++;
      continue;
    }
    seen.add(key);
    const { variables, missing } = resolveVariables(r.values, map);
    recipients.push({
      phone,
      contactId: r.contactId,
      label: r.label,
      source: `${r.sourceType}:${r.sourceId}`,
      variables,
      missing,
    });
  }
  return { recipients, excluded, withMissing: recipients.filter((r) => r.missing.length).length };
}

export function fullName(first?: string | null, last?: string | null): string {
  return [first, last].filter((s) => s && s.trim()).join(" ");
}

/** Campo com lista de valores conhecidos permitido para a entidade. */
export function isSuggestField(
  base: AudienceBase,
  column: string,
  fields: FilterFieldCatalog = FILTER_FIELDS,
): boolean {
  return fields[base].some((f) => f.column === column && f.suggest);
}

/** Valores únicos, sem vazios, ordenados em PT-BR. */
export function distinctValues(raw: unknown[], max = 200): string[] {
  const seen = new Map<string, string>();
  for (const v of raw) {
    const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
    if (!s) continue;
    const k = s.toLocaleLowerCase("pt-BR");
    if (!seen.has(k)) seen.set(k, s);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "pt-BR")).slice(0, max);
}
