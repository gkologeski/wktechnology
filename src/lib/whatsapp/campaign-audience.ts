// Público e variáveis das campanhas de WhatsApp (regras puras, tela + servidor).
// Os campos vêm de uma lista branca: nada fora dela entra na mensagem ou nos filtros.

export type AudienceBase = "leads" | "contacts" | "companies" | "deals";
export type FieldGroup = "lead" | "contact" | "company" | "deal";

export type AudienceField = { key: string; label: string; group: FieldGroup };

export const GROUP_LABEL: Record<FieldGroup, string> = {
  lead: "Lead",
  contact: "Contato",
  company: "Empresa",
  deal: "Negócio",
};

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
  },
  contact: {
    first_name: "Primeiro nome",
    last_name: "Sobrenome",
    full_name: "Nome completo",
    email: "E-mail",
    job_title: "Cargo",
    city: "Cidade",
    state: "Estado",
  },
  company: {
    name: "Nome",
    industry: "Setor",
    city: "Cidade",
    state: "Estado",
    website: "Site",
  },
  deal: {
    name: "Título",
    service_line: "Linha de serviço",
    source: "Origem",
  },
};

const GROUPS_BY_BASE: Record<AudienceBase, FieldGroup[]> = {
  leads: ["lead", "company"],
  contacts: ["contact", "company"],
  companies: ["company"],
  deals: ["deal", "contact", "company"],
};

export function fieldsForBase(base: AudienceBase): AudienceField[] {
  return GROUPS_BY_BASE[base].flatMap((g) =>
    Object.entries(FIELD_COLUMNS[g]).map(([col, label]) => ({
      key: `${g}.${col}`,
      label: `${GROUP_LABEL[g]} › ${label}`,
      group: g,
    })),
  );
}

export function isAllowedField(base: AudienceBase, key: string): boolean {
  return fieldsForBase(base).some((f) => f.key === key);
}

/** Filtros permitidos no "Criar público" (coluna real da tabela-base). */
export type FilterFieldDef = {
  column: string;
  label: string;
  kind: "text" | "enum" | "date" | "member";
  options?: { value: string; label: string }[];
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
    { column: "source", label: "Origem", kind: "text" },
    { column: "company_name", label: "Empresa", kind: "text" },
    { column: "assigned_to", label: "Responsável", kind: "member" },
    { column: "created_at", label: "Criado em", kind: "date" },
  ],
  contacts: [
    { column: "job_title", label: "Cargo", kind: "text" },
    { column: "city", label: "Cidade", kind: "text" },
    { column: "state", label: "Estado", kind: "text" },
    { column: "lifecyclestage", label: "Estágio do ciclo", kind: "text" },
    { column: "assigned_to", label: "Responsável", kind: "member" },
    { column: "created_at", label: "Criado em", kind: "date" },
  ],
  companies: [
    { column: "industry", label: "Setor", kind: "text" },
    { column: "city", label: "Cidade", kind: "text" },
    { column: "state", label: "Estado", kind: "text" },
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
    { column: "source", label: "Origem", kind: "text" },
    { column: "service_line", label: "Linha de serviço", kind: "text" },
    { column: "assigned_to", label: "Responsável", kind: "member" },
    { column: "created_at", label: "Criado em", kind: "date" },
  ],
};

export type AudienceFilterOp = "eq" | "ilike" | "gte" | "lte";
export type AudienceFilter = { column: string; op: AudienceFilterOp; value: string };

export function isAllowedFilter(base: AudienceBase, f: AudienceFilter): boolean {
  const def = FILTER_FIELDS[base].find((d) => d.column === f.column);
  if (!def || !f.value.trim()) return false;
  if (def.kind === "date") return f.op === "gte" || f.op === "lte";
  if (def.kind === "text") return f.op === "eq" || f.op === "ilike";
  return f.op === "eq";
}

/** Normaliza para E.164; números BR sem DDI recebem +55. Retorna null se inválido. */
export function normalizeCampaignPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const hasPlus = raw.trim().startsWith("+");
  let d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (!hasPlus && (d.length === 10 || d.length === 11)) d = `55${d}`;
  if (d.startsWith("55") && d.length !== 12 && d.length !== 13) return null;
  if (d.length < 10 || d.length > 15) return null;
  return `+${d}`;
}

/** Linha bruta do público: valores já achatados por chave "grupo.coluna". */
export type AudienceRow = {
  sourceType: FieldGroup;
  sourceId: string;
  contactId: string | null;
  phone: string | null;
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
  excluded: { no_phone: number; invalid_phone: number; duplicate: number; opted_out: number };
  withMissing: number;
};

export function resolveVariables(
  values: AudienceRow["values"],
  map: VariableMap,
): { variables: Record<string, string>; missing: string[] } {
  const variables: Record<string, string> = {};
  const missing: string[] = [];
  for (const [k, b] of Object.entries(map)) {
    const v = (values[b.field] ?? "").toString().trim() || (b.fallback ?? "").trim();
    if (v) variables[k] = v;
    else missing.push(k);
  }
  return { variables, missing };
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
  const excluded = { no_phone: 0, invalid_phone: 0, duplicate: 0, opted_out: 0 };
  const seen = new Set<string>();
  const optKeys = new Set([...optedOut].map(phoneKey));
  const recipients: BuiltRecipient[] = [];
  for (const r of rows) {
    if (!r.phone || !r.phone.trim()) {
      excluded.no_phone++;
      continue;
    }
    const phone = normalizeCampaignPhone(r.phone);
    if (!phone) {
      excluded.invalid_phone++;
      continue;
    }
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
