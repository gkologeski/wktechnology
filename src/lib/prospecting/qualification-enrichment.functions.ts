/**
 * Enriquecimento Apollo.io para a tela de qualificação.
 *
 * - `enrichLeadForQualification`: roda a cascata (domínio → empresa → pessoa)
 *   e devolve sugestões normalizadas por coluna de Lead/Empresa/Contato.
 *   O resultado é cacheado em `leads.custom_fields.apollo_enrichment`.
 * - `applyQualificationEnrichment`: grava as sugestões aceitas no lead e nos
 *   registros de empresa/contato vinculados, sem sobrescrever valores
 *   já preenchidos.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const LEAD_KEYS = ["first_name", "last_name", "email", "phone", "company_name"] as const;
const COMPANY_KEYS = [
  "name",
  "domain",
  "website",
  "industry",
  "size",
  "phone",
  "city",
  "state",
  "country",
  "linkedin_company_page",
  "annualrevenue",
  "description",
] as const;
const CONTACT_KEYS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "mobile_phone",
  "job_title",
  "linkedin_url",
  "city",
  "state",
  "country",
  "website",
  "company_name",
] as const;

export type SuggestionValue = string | number | boolean | null;
export type SuggestionMap = Record<string, SuggestionValue>;

export type EnrichmentSuggestions = {
  domain: string | null;
  domainSource: string | null;
  fetchedAt: string;
  cached: boolean;
  found: boolean;
  /** Falhas parciais do provedor (ex.: créditos esgotados). */
  warnings: string[];
  lead: SuggestionMap;
  companies: SuggestionMap;
  contacts: SuggestionMap;
};

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

function pick(source: Record<string, unknown> | null, keys: readonly string[]): SuggestionMap {
  const out: SuggestionMap = {};
  if (!source) return out;
  for (const k of keys) {
    const v = source[k];
    if (v === null || v === undefined || v === "") continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") out[k] = v;
  }
  return out;
}

export const enrichLeadForQualification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ leadId: z.string().uuid(), force: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<EnrichmentSuggestions> => {
    const { supabase } = context;
    const { data: lead, error } = await supabase
      .from("leads")
      .select(
        "id, first_name, last_name, email, phone, company_name, company_id, converted_contact_id, custom_fields",
      )
      .eq("id", data.leadId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead) throw new Error("Lead não encontrado.");

    const custom = (lead.custom_fields ?? {}) as Record<string, unknown>;
    const cached = custom.apollo_enrichment as
      | { fetched_at?: string; payload?: EnrichmentSuggestions }
      | undefined;
    if (!data.force && cached?.payload && cached.fetched_at) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (Number.isFinite(age) && age < CACHE_TTL_MS) {
        return { ...cached.payload, cached: true };
      }
    }

    // Dados da empresa vinculada ajudam a resolver o domínio.
    let companyName = lead.company_name ?? null;
    let website: string | null = null;
    let domain: string | null = null;
    if (lead.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("name, website, domain")
        .eq("id", lead.company_id)
        .maybeSingle();
      if (company) {
        companyName = companyName ?? company.name ?? null;
        website = company.website ?? null;
        domain = company.domain ?? null;
      }
    }

    let linkedin: string | null = null;
    if (lead.converted_contact_id) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("linkedin_url")
        .eq("id", lead.converted_contact_id)
        .maybeSingle();
      linkedin = contact?.linkedin_url ?? null;
    }

    const { runApolloCascade } = await import("@/lib/integrations/apollo-enrich.server");
    const result = await runApolloCascade({
      first_name: lead.first_name,
      last_name: lead.last_name,
      email: lead.email,
      linkedin_url: linkedin,
      company_name: companyName,
      website,
      domain,
    });

    const companySuggestions = pick(
      result.company as Record<string, unknown> | null,
      COMPANY_KEYS,
    );
    const personSuggestions = result.person as Record<string, unknown> | null;

    const payload: EnrichmentSuggestions = {
      domain: result.domain,
      domainSource: result.domainSource,
      fetchedAt: new Date().toISOString(),
      cached: false,
      found: !!result.person || Object.keys(companySuggestions).length > 0,
      warnings: result.warnings,
      lead: {
        ...pick(personSuggestions, LEAD_KEYS),
        ...(result.company?.name ? { company_name: result.company.name } : {}),
      },
      companies: companySuggestions,
      contacts: {
        ...pick(personSuggestions, CONTACT_KEYS),
        ...(result.company?.name ? { company_name: result.company.name } : {}),
        ...(result.company?.website ? { website: result.company.website } : {}),
      },
    };

    // Só cacheia resultados úteis — falhas de provedor devem poder ser reprocessadas.
    if (payload.found) {
      await supabase
      .from("leads")
      .update({
        custom_fields: {
          ...custom,
          apollo_enrichment: { fetched_at: payload.fetchedAt, payload },
        } as never,
      })
      .eq("id", data.leadId);
    }

    return payload;
  });

const ValuesSchema = z.record(z.string(), z.unknown()).optional();

export const applyQualificationEnrichment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        leadId: z.string().uuid(),
        lead: ValuesSchema,
        companies: ValuesSchema,
        contacts: ValuesSchema,
        overwrite: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: lead, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", data.leadId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead) throw new Error("Lead não encontrado.");

    const leadRow = lead as unknown as Record<string, unknown>;
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
        if (next === null || next === undefined || next === "") continue;
        const current = row[key];
        const isEmpty =
          current === null ||
          current === undefined ||
          (typeof current === "string" && current.trim() === "");
        if (!isEmpty && !data.overwrite) continue;
        if (JSON.stringify(current ?? null) === JSON.stringify(next)) continue;
        patch[key] = next;
      }
      if (Object.keys(patch).length === 0) return;
      const { error: upErr } = await supabase
        .from(table)
        .update(patch as never)
        .eq("id", id);
      if (upErr) throw new Error(upErr.message);
      applied[table] = Object.keys(patch);
    }

    await updateRow("leads", data.leadId, leadRow, data.lead, LEAD_KEYS);

    const companyId = leadRow.company_id as string | null;
    if (companyId) {
      const { data: company } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .maybeSingle();
      if (company)
        await updateRow(
          "companies",
          companyId,
          company as unknown as Record<string, unknown>,
          data.companies,
          COMPANY_KEYS,
        );
    }

    const contactId = leadRow.converted_contact_id as string | null;
    if (contactId) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", contactId)
        .maybeSingle();
      if (contact)
        await updateRow(
          "contacts",
          contactId,
          contact as unknown as Record<string, unknown>,
          data.contacts,
          CONTACT_KEYS,
        );
    }

    return { applied };
  });
