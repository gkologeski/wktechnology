// Prospecting agent — busca prospects reais via Apollo.io.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import {
  isTransientDatabaseError,
  toFriendlyDbError,
  withTransientRetry,
} from "@/lib/db/transient-retry";

const APOLLO_GATEWAY_URL = "https://connector-gateway.lovable.dev/apollo";

const strArr = z.array(z.string().min(1).max(200)).max(100).optional();
const FiltersSchema = z
  .object({
    person_titles: strArr,
    person_not_titles: strArr,
    person_seniorities: strArr,
    person_departments: strArr,
    person_locations: strArr,
    organization_locations: strArr,
    organization_industry_keywords: strArr,
    organization_num_employees_ranges: strArr,
    organization_estimated_annual_revenue_ranges: strArr,
    organization_technology_uids: strArr,
    q_keywords: strArr,
    q_organization_keyword_tags: strArr,
    contact_email_status: strArr,
    organization_domains: strArr,
    organization_not_domains: strArr,
  })
  .partial()
  .default({});

const SearchInput = z.object({
  id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(120),
  filters: FiltersSchema,
  instructions: z.string().max(1000).optional().default(""),
  max_results: z.number().int().min(1).max(50).default(10),
});

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | { [key: string]: JsonValue } | JsonValue[];

type ProspectSearch = {
  id: string;
  owner_id: string;
  name: string;
  status: string;
  error: string | null;
  industry: string | null;
  role_title: string | null;
  company_size: string | null;
  location: string | null;
  keywords: string | null;
  instructions: string | null;
  max_results: number;
  result_count: number;
  ran_at: string | null;
  created_at: string;
  updated_at: string;
  source: string;
  apollo_query: JsonValue;
  filters: JsonValue;
};

type ProspectResult = {
  id: string;
  owner_id: string;
  search_id: string;
  company_name: string | null;
  contact_name: string | null;
  role_title: string | null;
  email_hint: string | null;
  domain_hint: string | null;
  location: string | null;
  reason: string | null;
  imported_lead_id: string | null;
  imported_at: string | null;
  created_at: string;
  source: string;
  external_id: string | null;
  linkedin_url: string | null;
  phone: string | null;
  email: string | null;
  company_domain: string | null;
  company_size: string | null;
  industry: string | null;
  apollo_score: number | null;
  raw_payload: JsonValue;
};

export const listProspectSearches = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProspectSearch[]> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data, error } = await withTransientRetry<ProspectSearch[]>(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("prospecting_searches")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
    );
    if (error) throw toFriendlyDbError(error, "Erro ao listar buscas de prospecção");
    return (data ?? []) as ProspectSearch[];
  });

export const upsertProspectSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SearchInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const f = data.filters ?? {};
    const first = (arr?: string[]) => (arr && arr.length ? arr.join(", ") : null);
    const payload = {
      workspace_id: workspaceId,
      owner_id: userId,
      name: data.name,
      // Campos legados: derivados dos filtros estruturados para compatibilidade.
      industry: first(f.organization_industry_keywords),
      role_title: first(f.person_titles),
      company_size: first(f.organization_num_employees_ranges),
      location: first(f.person_locations),
      keywords: first(f.q_keywords),
      instructions: data.instructions || null,
      max_results: data.max_results,
      filters: f as Record<string, unknown>,
      source: "apollo",
    };
    if (data.id) {
      const { error } = await withTransientRetry(() =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any)
          .from("prospecting_searches")
          .update(payload)
          .eq("id", data.id)
          .eq("workspace_id", workspaceId),
      );
      if (error) throw toFriendlyDbError(error, "Erro ao salvar a busca");
      return { id: data.id };
    }
    const { data: row, error } = await withTransientRetry<{ id: string }>(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("prospecting_searches").insert(payload).select("id").single(),
    );
    if (error || !row) throw toFriendlyDbError(error, "Erro ao criar a busca");
    return { id: row.id };
  });

export const deleteProspectSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { error } = await withTransientRetry(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("prospecting_searches")
        .delete()
        .eq("id", data.id)
        .eq("workspace_id", workspaceId),
    );
    if (error) throw toFriendlyDbError(error, "Erro ao excluir a busca");
    return { ok: true };
  });

export const listProspectResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ search_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<ProspectResult[]> => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: rows, error } = await withTransientRetry<ProspectResult[]>(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("prospecting_results")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("search_id", data.search_id)
        .order("created_at", { ascending: false }),
    );
    if (error) throw toFriendlyDbError(error, "Erro ao listar resultados");
    return (rows ?? []) as ProspectResult[];
  });

async function apolloRequest<T = unknown>({
  path,
  method = "POST",
  query,
  body,
}: {
  path: string;
  method?: "GET" | "POST";
  query?: Record<string, string | string[]>;
  body?: unknown;
}): Promise<T> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const apolloKey = process.env.APOLLO_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY ausente");
  if (!apolloKey) throw new Error("APOLLO_API_KEY ausente. Conecte o Apollo.io em Configurações → Conectores.");

  const url = new URL(`${APOLLO_GATEWAY_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (Array.isArray(value)) {
        for (const v of value) url.searchParams.append(`${key}[]`, v);
      } else if (value !== undefined && value !== null && value !== "") {
        url.searchParams.append(key, value);
      }
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": apolloKey,
  };
  const init: RequestInit = { method, headers };
  if (method === "POST" && body !== undefined) {
    init.body = JSON.stringify(body);
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, init);

  if (res.status === 401) {
    throw new Error("Credenciais do Apollo.io inválidas. Reconecte o conector em Configurações → Conectores.");
  }
  if (res.status === 403) {
    const text = await res.text();
    throw new Error(
      `A chave do Apollo.io não tem acesso a este endpoint (${text}). Use uma master key com permissão para people search.`
    );
  }
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After");
    throw new Error(
      `Limite de requisições do Apollo.io atingido. ${retryAfter ? `Tente novamente em ${retryAfter}s.` : "Aguarde alguns minutos."}`
    );
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apollo request failed (${res.status}): ${text}`);
  }

  return (await res.json()) as T;
}

type ApolloPersonSearchItem = {
  id: string;
  first_name?: string;
  last_name_obfuscated?: string;
  title?: string;
  organization?: {
    name?: string;
    has_industry?: boolean;
    has_phone?: boolean;
    has_city?: boolean;
    has_state?: boolean;
    has_country?: boolean;
    has_employee_count?: boolean;
  };
};

type ApolloPersonSearchResponse = {
  total_entries?: number;
  people?: ApolloPersonSearchItem[];
};

type ApolloPersonDetail = {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  linkedin_url?: string | null;
  email?: string | null;
  email_status?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  formatted_address?: string | null;
  phone?: string | null;
  phone_numbers?: { sanitized_number?: string; raw_number?: string; type?: string }[];

  organization?: {
    name?: string;
    primary_domain?: string | null;
    website_url?: string | null;
    industry?: string | null;
    estimated_num_employees?: number | null;
    primary_phone?: { number?: string | null } | null;
    phone?: string | null;
  } | null;
};

// Filtros enviados diretamente ao Apollo (arrays repetidos na query string).
// `organization_industry_keywords` NÃO é suportado pelo people search do Apollo
// (é aceito e silenciosamente ignorado); setores e palavras-chave são traduzidos
// para `q_organization_keyword_tags`, que aceita múltiplos termos com OR.
const STRUCTURED_FILTER_KEYS = [
  "person_titles",
  "person_not_titles",
  "person_seniorities",
  "person_departments",
  "person_locations",
  "organization_locations",
  "organization_num_employees_ranges",
  "organization_estimated_annual_revenue_ranges",
  "organization_technology_uids",
  "contact_email_status",
  "organization_domains",
  "organization_not_domains",
] as const;

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === "string" && value.trim())
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  return [];
}

function buildApolloQuery(search: ProspectSearch): Record<string, string | string[]> {
  const query: Record<string, string | string[]> = {
    per_page: String(Math.min(search.max_results, 50)),
    page: "1",
  };

  const structured =
    search.filters && typeof search.filters === "object" && !Array.isArray(search.filters)
      ? (search.filters as Record<string, unknown>)
      : {};

  let hasStructured = false;
  for (const key of STRUCTURED_FILTER_KEYS) {
    const values = asStringArray(structured[key]);
    if (values.length > 0) {
      query[key] = values;
      hasStructured = true;
    }
  }

  // Setores, palavras-chave e tags viram um único conjunto OR de keyword tags.
  const keywordTags = new Set<string>();
  for (const key of [
    "organization_industry_keywords",
    "q_keywords",
    "q_organization_keyword_tags",
  ]) {
    for (const term of asStringArray(structured[key])) keywordTags.add(term);
  }
  if (keywordTags.size === 0 && !hasStructured) {
    // Fallback para buscas legadas salvas antes dos filtros estruturados.
    for (const term of asStringArray(search.industry)) keywordTags.add(term);
    for (const term of asStringArray(search.keywords)) keywordTags.add(term);
    const titles = asStringArray(search.role_title);
    if (titles.length) query.person_titles = titles;
    const sizes = asStringArray(search.company_size);
    if (sizes.length) query.organization_num_employees_ranges = sizes;
    const locations = asStringArray(search.location);
    if (locations.length) query.person_locations = locations;
  } else if (keywordTags.size > 0) {
    hasStructured = true;
  }

  if (keywordTags.size > 0) {
    query.q_organization_keyword_tags = Array.from(keywordTags);
  }

  return query;
}


function cleanEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  if (email.toLowerCase().includes("not_unlocked")) return null;
  if (email.toLowerCase().includes("unknown")) return null;
  return email.slice(0, 200);
}

function buildLocation(person: ApolloPersonDetail): string | null {
  const parts = [person.city, person.state, person.country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export const runProspectSearch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: s, error: sErr } = await withTransientRetry<ProspectSearch>(() =>
      sb
        .from("prospecting_searches")
        .select("*")
        .eq("id", data.id)
        .eq("workspace_id", workspaceId)
        .single(),
    );
    if (sErr && isTransientDatabaseError(sErr)) throw toFriendlyDbError(sErr, "");
    if (sErr || !s) throw new Error("Busca não encontrada");

    const search = s as ProspectSearch;

    await sb
      .from("prospecting_searches")
      .update({ status: "running", error: null, source: "apollo" })
      .eq("id", data.id);

    try {
      const apolloQuery = buildApolloQuery(search);

      await sb
        .from("prospecting_searches")
        .update({ apollo_query: apolloQuery })
        .eq("id", data.id);

      const searchRes = await apolloRequest<ApolloPersonSearchResponse>({
        path: "/api/v1/mixed_people/api_search",
        query: apolloQuery,
      });

      const people = (searchRes.people ?? []).slice(0, search.max_results);

      const enriched: ProspectResult[] = [];
      for (const personSummary of people) {
        try {
          const detail = await apolloRequest<{ person: ApolloPersonDetail }>({
            path: `/api/v1/people/${encodeURIComponent(personSummary.id)}`,
            method: "GET",
          });
          const p = detail.person;
          const org = p.organization;
          const email = cleanEmail(p.email);
          // Telefone é sempre da pessoa: celular tem prioridade e o fixo da
          // empresa nunca substitui o número do prospect.
          const numbers = p.phone_numbers ?? [];
          const isMobile = (n: { type?: string }) =>
            (n.type ?? "").toLowerCase().includes("mobile");
          const numOf = (n?: { sanitized_number?: string; raw_number?: string }) =>
            n?.sanitized_number ?? n?.raw_number ?? null;
          const personPhone =
            numOf(numbers.find(isMobile)) ??
            numOf(numbers.find((n) => !isMobile(n))) ??
            p.phone ??
            null;

          enriched.push({
            owner_id: userId,
            search_id: data.id,
            source: "apollo",
            external_id: p.id,
            contact_name: p.name || `${p.first_name || ""} ${p.last_name || ""}`.trim() || null,
            role_title: p.title || search.role_title,
            company_name: org?.name || null,
            company_domain: org?.primary_domain || null,
            domain_hint: org?.primary_domain || null,
            email: email,
            email_hint: email,
            phone: personPhone,
            linkedin_url: p.linkedin_url || null,
            location: buildLocation(p),

            industry: org?.industry || null,
            company_size: org?.estimated_num_employees ? String(org.estimated_num_employees) : null,
            apollo_score: null,
            reason: `Prospect real encontrado via Apollo.io${p.email_status ? ` · email status: ${p.email_status}` : ""}`,
            raw_payload: p,
            imported_lead_id: null,
            imported_at: null,
            created_at: new Date().toISOString(),
            id: "",
          });
        } catch (e) {
          // Falha no enrichment individual não quebra a busca toda.
          const msg = e instanceof Error ? e.message : "erro";
          console.error(`Apollo enrichment failed for ${personSummary.id}:`, msg);
        }
      }

      if (enriched.length) {
        await sb.from("prospecting_results").insert(
          enriched.map((r) => ({
            workspace_id: workspaceId,
            owner_id: r.owner_id,
            search_id: r.search_id,
            source: r.source,
            external_id: r.external_id,
            company_name: r.company_name,
            contact_name: r.contact_name,
            role_title: r.role_title,
            email: r.email,
            email_hint: r.email_hint,
            phone: r.phone,
            linkedin_url: r.linkedin_url,
            domain_hint: r.domain_hint,
            company_domain: r.company_domain,
            location: r.location,
            industry: r.industry,
            company_size: r.company_size,
            apollo_score: r.apollo_score,
            reason: r.reason,
            raw_payload: r.raw_payload,
          })),
        );
      }

      const totalEntries = searchRes.total_entries ?? 0;
      let notice: string | null = null;
      if (enriched.length === 0) {
        notice =
          totalEntries === 0
            ? "O Apollo.io não encontrou nenhuma pessoa com estes filtros. Tente remover palavras-chave/setores, reduzir as faixas de porte ou usar cargos em inglês (ex.: CTO, Head of IT)."
            : `O Apollo.io encontrou ${totalEntries} pessoa(s), mas nenhuma pôde ser enriquecida. Verifique os créditos e as permissões da chave do Apollo.`;
      }

      await sb
        .from("prospecting_searches")
        .update({
          status: "completed",
          ran_at: new Date().toISOString(),
          result_count: enriched.length,
          error: notice,
        })
        .eq("id", data.id);

      return { count: enriched.length, total_entries: totalEntries, notice };

    } catch (e) {
      const msg = e instanceof Error ? e.message : "erro";
      await sb.from("prospecting_searches").update({ status: "failed", error: msg }).eq("id", data.id);
      throw new Error(msg);
    }
  });

export const importProspectAsLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ result_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = context.supabase as any;
    const { data: r, error: rErr } = await sb
      .from("prospecting_results")
      .select("*")
      .eq("id", data.result_id)
      .eq("workspace_id", workspaceId)
      .single();
    if (rErr || !r) throw new Error("Prospect não encontrado");
    if (r.imported_lead_id) return { id: r.imported_lead_id, already: true };

    const fullName: string = r.contact_name || r.company_name || "Prospect";
    const parts = fullName.split(" ");
    const first = parts[0] || fullName;
    const last = parts.slice(1).join(" ") || null;

    const { data: lead, error: lErr } = await sb
      .from("leads")
      .insert({
        workspace_id: workspaceId,
        owner_id: userId,
        first_name: first,
        last_name: last,
        company_name: r.company_name,
        email: r.email || r.email_hint,
        phone: r.phone,
        source: "prospecting",
        status: "new",
        external_ids: r.external_id ? { apollo_person: r.external_id } : {},
        custom_fields: {
          prospecting: {
            result_id: r.id,
            search_id: r.search_id,
            source: r.source,
            imported_at: new Date().toISOString(),
            role_title: r.role_title,
            location: r.location,
            industry: r.industry,
            company_domain: r.company_domain,
            domain_hint: r.domain_hint,
            linkedin_url: r.linkedin_url,
            apollo_score: r.apollo_score,
          },
        },
      })
      .select("id")
      .single();
    if (lErr) {
      const message = String(lErr.message ?? "Erro ao importar prospect como lead");
      if (message.includes("schema cache") || message.includes("column")) {
        throw new Error(`Erro no mapeamento dos campos do lead: ${message}`);
      }
      throw new Error(message);
    }

    await sb
      .from("prospecting_results")
      .update({ imported_lead_id: lead.id, imported_at: new Date().toISOString() })
      .eq("id", r.id);
    // Garante empresa e contato vinculados ao lead
    const { ensureLeadRelationsSafe } = await import("@/lib/leads/lead-relations");
    await ensureLeadRelationsSafe(context.supabase, lead.id as string);
    return { id: lead.id, already: false };
  });
