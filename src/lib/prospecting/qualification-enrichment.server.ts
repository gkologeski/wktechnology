/**
 * Helpers server-only do enriquecimento de qualificação (Apollo.io).
 *
 * Mantém as listas de colunas permitidas por entidade, a normalização das
 * sugestões e a aplicação no banco (sem sobrescrever valores existentes).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Colunas reais de `leads` que podem ser preenchidas pelo enriquecimento. */
export const LEAD_KEYS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "mobile_phone",
  "company_name",
  "linkedin_url",
] as const;

/** Colunas reais de `companies`. */
export const COMPANY_KEYS = [
  "name",
  "domain",
  "website",
  "industry",
  "size",
  "phone",
  "address",
  "city",
  "state",
  "country",
  "cep",
  "linkedin_company_page",
  "facebook_company_page",
  "twitterhandle",
  "annualrevenue",
  "description",
  "timezone",
] as const;

/** Colunas reais de `contacts`. */
export const CONTACT_KEYS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "mobile_phone",
  "job_title",
  "linkedin_url",
  "twitter_handle",
  "address",
  "city",
  "state",
  "country",
  "cep",
  "website",
  "company_name",
] as const;

export type SuggestionValue = string | number | boolean | null;
export type SuggestionMap = Record<string, SuggestionValue>;

/** Sinal usado para localizar a pessoa no provedor. */
export type PersonSignal = "linkedin" | "email" | "name_domain" | "none";

export type EnrichmentSuggestions = {
  domain: string | null;
  domainSource: string | null;
  /** Como a pessoa foi localizada (procedência exibida na UI). */
  personSignal?: PersonSignal;
  /** LinkedIn efetivamente usado na consulta, já normalizado. */
  linkedinUrl?: string | null;
  fetchedAt: string;
  cached: boolean;
  found: boolean;
  /** Falhas parciais do provedor (ex.: créditos esgotados). */
  warnings: string[];
  lead: SuggestionMap;
  companies: SuggestionMap;
  contacts: SuggestionMap;
  /** Colunas efetivamente gravadas no banco por entidade. */
  applied?: Record<string, string[]>;
};

/** Copia apenas as chaves permitidas com valores primitivos preenchidos. */
export function pick(
  source: Record<string, unknown> | null,
  keys: readonly string[],
): SuggestionMap {
  const out: SuggestionMap = {};
  if (!source) return out;
  for (const k of keys) {
    const v = source[k];
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
}

/** Remove sugestões que apenas repetem o valor atual do registro. */
export function onlyNew(map: SuggestionMap, row: Record<string, unknown> | null): SuggestionMap {
  if (!row) return map;
  const out: SuggestionMap = {};
  for (const [k, v] of Object.entries(map)) {
    const current = row[k];
    const same =
      current !== null &&
      current !== undefined &&
      String(current).trim().toLowerCase() === String(v).trim().toLowerCase();
    if (!same) out[k] = v;
  }
  return out;
}

function isEmptyValue(v: unknown) {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

type AnyClient = SupabaseClient<never, never, never>;

/**
 * Aplica as sugestões no lead e nos registros de empresa/contato vinculados.
 * Por padrão só grava em campos vazios; `overwrite` força a substituição.
 */
export async function applyEnrichmentToRecords(
  supabase: AnyClient,
  args: {
    leadId: string;
    lead?: Record<string, unknown>;
    companies?: Record<string, unknown>;
    contacts?: Record<string, unknown>;
    overwrite?: boolean;
  },
): Promise<Record<string, string[]>> {
  const client = supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          c: string,
          v: string,
        ) => { maybeSingle: () => Promise<{ data: Record<string, unknown> | null }> };
      };
      update: (p: Record<string, unknown>) => {
        eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    };
  };

  const { data: lead } = await client.from("leads").select("*").eq("id", args.leadId).maybeSingle();
  if (!lead) throw new Error("Lead não encontrado.");

  const applied: Record<string, string[]> = { leads: [], companies: [], contacts: [] };

  async function updateRow(
    table: "leads" | "companies" | "contacts",
    id: string,
    row: Record<string, unknown>,
    values: Record<string, unknown> | undefined,
    allowedKeys: readonly string[],
  ) {
    if (!values) return;
    const patch: Record<string, unknown> = {};
    for (const key of allowedKeys) {
      if (!(key in values)) continue;
      const next = values[key];
      if (isEmptyValue(next)) continue;
      const current = row[key];
      if (!isEmptyValue(current) && !args.overwrite) continue;
      if (JSON.stringify(current ?? null) === JSON.stringify(next)) continue;
      patch[key] = next;
    }
    if (Object.keys(patch).length === 0) return;
    const { error } = await client.from(table).update(patch).eq("id", id);
    // Enriquecimento é complementar: bloqueio de RLS não deve derrubar o fluxo.
    if (error) {
      console.warn(`[apollo] falha ao gravar ${table}: ${error.message}`);
      return;
    }
    applied[table] = Object.keys(patch);
  }

  await updateRow("leads", args.leadId, lead, args.lead, LEAD_KEYS);

  const companyId = lead.company_id as string | null;
  if (companyId) {
    const { data: company } = await client
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .maybeSingle();
    if (company) await updateRow("companies", companyId, company, args.companies, COMPANY_KEYS);
  }

  const contactId = lead.converted_contact_id as string | null;
  if (contactId) {
    const { data: contact } = await client
      .from("contacts")
      .select("*")
      .eq("id", contactId)
      .maybeSingle();
    if (contact) await updateRow("contacts", contactId, contact, args.contacts, CONTACT_KEYS);
  }

  return applied;
}
