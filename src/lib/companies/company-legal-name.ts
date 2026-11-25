export type CompanyLegalNameSource = {
  name?: string | null;
  legal_name?: string | null;
  trade_name?: string | null;
  custom_fields?: Record<string, unknown> | null;
};

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Resolve a razão social oficial de uma empresa do CRM.
 * Ordem: campo nativo `legal_name` -> campo personalizado legado `razao_social` -> `name`.
 */
export function resolveCompanyLegalName(
  company: CompanyLegalNameSource | null | undefined,
): string | null {
  if (!company) return null;
  const nativeLegal = cleanText(company.legal_name);
  if (nativeLegal) return nativeLegal;
  const customLegal = cleanText(company.custom_fields?.["razao_social"]);
  if (customLegal) return customLegal;
  return cleanText(company.name);
}

export type CompanyCnpjRecord = {
  legal_name?: string | null;
  trade_name?: string | null;
  industry?: string | null;
  size?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
  domain?: string | null;
};

export type CompanyCnpjFieldKey = keyof CompanyCnpjRecord;

export type CompanyCnpjConflict = {
  field: CompanyCnpjFieldKey;
  label: string;
  current: string;
  incoming: string;
};

const FIELD_LABELS: Record<CompanyCnpjFieldKey, string> = {
  legal_name: "Razão social",
  trade_name: "Nome fantasia",
  industry: "Indústria",
  size: "Tamanho",
  phone: "Telefone",
  address: "Endereço",
  city: "Cidade",
  state: "UF",
  cep: "CEP",
  domain: "Domínio",
};

const ENRICHABLE_FIELDS: readonly CompanyCnpjFieldKey[] = [
  "legal_name",
  "trade_name",
  "industry",
  "size",
  "phone",
  "address",
  "city",
  "state",
  "cep",
];

function sameNormalized(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase("pt-BR") === b.trim().toLocaleLowerCase("pt-BR");
}

/**
 * Planeja as alterações de enriquecimento via CNPJ para uma empresa do CRM.
 * Nunca altera o campo de exibição `name`.
 * Identifica campos já preenchidos com valor diferente para confirmação antes de substituir.
 */
export function planCompanyCnpjEnrichment(
  current: CompanyCnpjRecord,
  incoming: CompanyCnpjRecord,
  options?: { overwrite?: boolean },
): {
  emptyUpdates: Partial<Record<CompanyCnpjFieldKey, string>>;
  conflicts: CompanyCnpjConflict[];
  update: Partial<Record<CompanyCnpjFieldKey, string>>;
} {
  const emptyUpdates: Partial<Record<CompanyCnpjFieldKey, string>> = {};
  const conflicts: CompanyCnpjConflict[] = [];
  const update: Partial<Record<CompanyCnpjFieldKey, string>> = {};
  const overwrite = Boolean(options?.overwrite);

  for (const field of ENRICHABLE_FIELDS) {
    const nextVal = cleanText(incoming[field]);
    if (!nextVal) continue;
    const curVal = cleanText(current[field]);
    if (!curVal) {
      emptyUpdates[field] = nextVal;
      update[field] = nextVal;
    } else if (!sameNormalized(curVal, nextVal)) {
      conflicts.push({
        field,
        label: FIELD_LABELS[field],
        current: curVal,
        incoming: nextVal,
      });
      if (overwrite) {
        update[field] = nextVal;
      }
    }
  }

  const nextDomain = cleanText(incoming.domain);
  const curDomain = cleanText(current.domain);
  if (!curDomain && nextDomain) {
    emptyUpdates.domain = nextDomain;
    update.domain = nextDomain;
  }

  return { emptyUpdates, conflicts, update };
}

export type PersonCnpjFields = {
  legal_entity_name: string;
  trade_name: string;
};

export type PersonCnpjConflict = {
  field: keyof PersonCnpjFields;
  label: string;
  current: string;
  incoming: string;
};

/**
 * Aplica a sugestão da consulta CNPJ aos campos PJ de um prestador.
 * Campos não retornados pela consulta são preservados.
 */
export function applyPersonCnpjSuggestion(
  current: PersonCnpjFields,
  incoming: { legal_entity_name?: string | null; trade_name?: string | null },
): {
  next: PersonCnpjFields;
  changed: boolean;
  conflicts: PersonCnpjConflict[];
} {
  const nextLegal = cleanText(incoming.legal_entity_name);
  const nextTrade = cleanText(incoming.trade_name);
  const curLegal = current.legal_entity_name.trim();
  const curTrade = current.trade_name.trim();

  const conflicts: PersonCnpjConflict[] = [];
  if (nextLegal && curLegal && !sameNormalized(curLegal, nextLegal)) {
    conflicts.push({
      field: "legal_entity_name",
      label: "Razão social",
      current: curLegal,
      incoming: nextLegal,
    });
  }
  if (nextTrade && curTrade && !sameNormalized(curTrade, nextTrade)) {
    conflicts.push({
      field: "trade_name",
      label: "Nome fantasia",
      current: curTrade,
      incoming: nextTrade,
    });
  }

  const next: PersonCnpjFields = {
    legal_entity_name: nextLegal ?? current.legal_entity_name,
    trade_name: nextTrade ?? current.trade_name,
  };
  const changed =
    next.legal_entity_name !== current.legal_entity_name || next.trade_name !== current.trade_name;

  return { next, changed, conflicts };
}
