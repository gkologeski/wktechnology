/**
 * Enriquecimento Apollo.io para a tela de qualificação.
 *
 * - `enrichLeadForQualification`: roda a cascata (domínio → empresa → pessoa),
 *   grava os campos vazios no lead/empresa/contato (quando `persist`) e
 *   devolve as sugestões normalizadas por coluna. O resultado é cacheado em
 *   `leads.custom_fields.apollo_enrichment`.
 * - `applyQualificationEnrichment`: grava as sugestões aceitas, sem
 *   sobrescrever valores já preenchidos.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EnrichmentSuggestions } from "./qualification-enrichment.server";

export type {
  EnrichmentSuggestions,
  SuggestionMap,
  SuggestionValue,
} from "./qualification-enrichment.server";

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 dias

export const enrichLeadForQualification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        leadId: z.string().uuid(),
        force: z.boolean().optional(),
        /** Grava imediatamente os campos vazios no banco (padrão: true). */
        persist: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<EnrichmentSuggestions> => {
    const { supabase } = context;
    const { LEAD_KEYS, COMPANY_KEYS, CONTACT_KEYS, pick, onlyNew, applyEnrichmentToRecords } =
      await import("./qualification-enrichment.server");

    const { data: lead, error } = await supabase
      .from("leads")
      .select(
        "id, first_name, last_name, email, phone, mobile_phone, company_name, company_id, converted_contact_id, custom_fields",
      )
      .eq("id", data.leadId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!lead) throw new Error("Lead não encontrado.");

    const persist = data.persist !== false;
    const custom = (lead.custom_fields ?? {}) as Record<string, unknown>;
    const cached = custom.apollo_enrichment as
      | { fetched_at?: string; payload?: EnrichmentSuggestions }
      | undefined;
    if (!data.force && cached?.payload && cached.fetched_at) {
      const age = Date.now() - new Date(cached.fetched_at).getTime();
      if (Number.isFinite(age) && age < CACHE_TTL_MS) {
        const payload = { ...cached.payload, cached: true };
        // Mesmo vindo do cache, garante que os registros estejam gravados
        // (ex.: empresa/contato vinculados depois da primeira consulta).
        if (persist && payload.found) {
          payload.applied = await applyEnrichmentToRecords(supabase as never, {
            leadId: data.leadId,
            lead: payload.lead,
            companies: payload.companies,
            contacts: payload.contacts,
          });
        }
        return payload;
      }
    }

    // Dados da empresa vinculada ajudam a resolver o domínio.
    let companyName = lead.company_name ?? null;
    let website: string | null = null;
    let domain: string | null = null;
    let companyRow: Record<string, unknown> | null = null;
    if (lead.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("*")
        .eq("id", lead.company_id)
        .maybeSingle();
      if (company) {
        companyRow = company as unknown as Record<string, unknown>;
        companyName = companyName ?? (companyRow.name as string | null) ?? null;
        website = (companyRow.website as string | null) ?? null;
        domain = (companyRow.domain as string | null) ?? null;
      }
    }

    let linkedin: string | null = null;
    let contactRow: Record<string, unknown> | null = null;
    if (lead.converted_contact_id) {
      const { data: contact } = await supabase
        .from("contacts")
        .select("*")
        .eq("id", lead.converted_contact_id)
        .maybeSingle();
      if (contact) {
        contactRow = contact as unknown as Record<string, unknown>;
        linkedin = (contactRow.linkedin_url as string | null) ?? null;
      }
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

    const companySuggestions = pick(result.company as Record<string, unknown> | null, COMPANY_KEYS);
    const personSuggestions = result.person as Record<string, unknown> | null;

    const leadSuggestions = onlyNew(
      {
        ...pick(personSuggestions, LEAD_KEYS),
        ...(result.company?.name ? { company_name: result.company.name } : {}),
      },
      lead as unknown as Record<string, unknown>,
    );
    const contactSuggestions = onlyNew(
      {
        ...pick(personSuggestions, CONTACT_KEYS),
        ...(result.company?.name ? { company_name: result.company.name } : {}),
        ...(result.company?.website ? { website: result.company.website } : {}),
      },
      contactRow,
    );
    const companyNew = onlyNew(companySuggestions, companyRow);

    const payload: EnrichmentSuggestions = {
      domain: result.domain,
      domainSource: result.domainSource,
      fetchedAt: new Date().toISOString(),
      cached: false,
      found:
        Object.keys(leadSuggestions).length > 0 ||
        Object.keys(contactSuggestions).length > 0 ||
        Object.keys(companyNew).length > 0,
      warnings: result.warnings,
      lead: leadSuggestions,
      companies: companyNew,
      contacts: contactSuggestions,
    };

    // Só cacheia quando houve ganho real — sem isso, uma nova tentativa
    // (após preencher o site da empresa, por ex.) ficaria bloqueada 30 dias.
    if (payload.found) {
      if (persist) {
        payload.applied = await applyEnrichmentToRecords(supabase as never, {
          leadId: data.leadId,
          lead: payload.lead,
          companies: payload.companies,
          contacts: payload.contacts,
        });
      }
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
    const { applyEnrichmentToRecords } = await import("./qualification-enrichment.server");
    const applied = await applyEnrichmentToRecords(context.supabase as never, {
      leadId: data.leadId,
      lead: data.lead,
      companies: data.companies,
      contacts: data.contacts,
      overwrite: data.overwrite,
    });
    return { applied };
  });
