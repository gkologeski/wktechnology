// Server functions para Hunting via Unipile (LinkedIn API).
// Fase 2.1 — Search & Import.
//
// - searchLinkedinPeople: busca pessoas no LinkedIn Classic via Unipile,
//   respeitando throttling/budget/janela horária definidos em client.server.
// - importLinkedinSearchResults: persiste candidatos selecionados em
//   ats_candidates + ats_hunting_captures (dedupe por linkedin_url).
//
// Observação: importamos client.server SOMENTE dentro do handler para não
// vazar service role para o bundle do cliente.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ────────────────────────────────────────────────────────────────────────────
// Schemas
// ────────────────────────────────────────────────────────────────────────────

const SearchInput = z.object({
  keywords: z.string().max(200).optional(),
  location: z.string().max(200).optional(), // texto livre — convertemos pra array
  industry: z.string().max(200).optional(),
  current_company: z.string().max(200).optional(),
  school: z.string().max(200).optional(),
  network: z
    .array(z.enum(["F", "S", "O"]))
    .max(3)
    .optional(),
  language: z.string().max(40).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(50).optional().default(10),
});

const ImportItem = z.object({
  linkedin_url: z.string().url().max(500),
  full_name: z.string().min(1).max(200),
  headline: z.string().max(400).nullish(),
  location: z.string().max(200).nullish(),
  current_company: z.string().max(200).nullish(),
  current_position: z.string().max(200).nullish(),
  public_identifier: z.string().max(200).nullish(),
  photo_url: z.string().url().max(800).nullish(),
});

const ImportInput = z.object({
  items: z.array(ImportItem).min(1).max(50),
});

// ────────────────────────────────────────────────────────────────────────────
// Normalização do payload Unipile (defensiva — Unipile varia campos por tenant)
// ────────────────────────────────────────────────────────────────────────────

function pickStr(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

interface UnipileSearchItem {
  // valores possíveis vindos da Unipile
  id?: string;
  member_urn?: string;
  public_identifier?: string;
  public_profile_url?: string;
  profile_url?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  location?: string;
  network_distance?: string;
  profile_picture_url?: string;
  picture_url?: string;
  current_positions?: Array<{ company?: string; role?: string; title?: string }>;
  current_position?: { company?: string; role?: string; title?: string } | string;
  industry?: string;
}

export interface NormalizedSearchHit {
  public_identifier: string | null;
  linkedin_url: string | null;
  full_name: string;
  headline: string | null;
  location: string | null;
  current_company: string | null;
  current_position: string | null;
  photo_url: string | null;
  network_distance: string | null;
}

function normalizeHit(it: UnipileSearchItem): NormalizedSearchHit {
  const publicId = pickStr(it.public_identifier);
  const url =
    pickStr(it.public_profile_url, it.profile_url) ??
    (publicId ? `https://www.linkedin.com/in/${publicId}` : null);
  const composed =
    pickStr(it.name) ??
    ([pickStr(it.first_name), pickStr(it.last_name)].filter(Boolean).join(" ").trim() || null);
  const name = composed ?? "Sem nome";

  const currentArr = Array.isArray(it.current_positions) ? it.current_positions[0] : undefined;
  const currentObj =
    currentArr ??
    (typeof it.current_position === "object" && it.current_position !== null
      ? (it.current_position as { company?: string; role?: string; title?: string })
      : undefined);

  return {
    public_identifier: publicId,
    linkedin_url: url,
    full_name: name,
    headline: pickStr(it.headline),
    location: pickStr(it.location),
    current_company: pickStr(currentObj?.company),
    current_position: pickStr(currentObj?.role, currentObj?.title) ?? pickStr(it.headline),
    photo_url: pickStr(it.profile_picture_url, it.picture_url),
    network_distance: pickStr(it.network_distance),
  };
}



function normalizeLinkedinUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Search
// ────────────────────────────────────────────────────────────────────────────

export const searchLinkedinPeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { loadAccountCtx, searchPeopleClassic, resolveSearchParameter, UnipileError } =
      await import("@/lib/unipile/client.server");

    try {
      const ctx = await loadAccountCtx(userId);

      // Resolve textos livres → IDs (URNs) que a Unipile aceita em filtros estruturados.
      // Se a resolução falhar/voltar vazia, o próprio searchPeopleClassic mescla o texto em keywords.
      const [locationIds, industryIds, companyIds, schoolIds] = await Promise.all([
        data.location ? resolveSearchParameter(ctx, "LOCATION", data.location) : Promise.resolve([]),
        data.industry ? resolveSearchParameter(ctx, "INDUSTRY", data.industry) : Promise.resolve([]),
        data.current_company
          ? resolveSearchParameter(ctx, "COMPANY", data.current_company)
          : Promise.resolve([]),
        data.school ? resolveSearchParameter(ctx, "SCHOOL", data.school) : Promise.resolve([]),
      ]);

      const result = (await searchPeopleClassic(ctx, {
        keywords: data.keywords,
        location: locationIds.length ? locationIds : data.location ? [data.location] : undefined,
        industry: industryIds.length ? industryIds : data.industry ? [data.industry] : undefined,
        current_company: companyIds.length
          ? companyIds
          : data.current_company
            ? [data.current_company]
            : undefined,
        school: schoolIds.length ? schoolIds : data.school ? [data.school] : undefined,
        network: data.network,
        language: data.language ? [data.language] : undefined,
        cursor: data.cursor,
        limit: data.limit,
      })) as { items?: UnipileSearchItem[]; cursor?: string; paging?: { cursor?: string } } | null;

      const rawItems = (result?.items ?? []) as UnipileSearchItem[];
      const hits = rawItems.map(normalizeHit);
      const cursor = result?.cursor ?? result?.paging?.cursor ?? null;

      return { ok: true as const, hits, cursor };
    } catch (err) {
      if (err instanceof UnipileError) {
        return {
          ok: false as const,
          code: err.code,
          message: err.message,
          status: err.status ?? null,
        };
      }
      throw err;
    }
  });


// ────────────────────────────────────────────────────────────────────────────
// Import (cria/atualiza ats_candidates + registra ats_hunting_captures)
// ────────────────────────────────────────────────────────────────────────────

export const importLinkedinSearchResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ImportInput.parse(input))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    let created = 0;
    let deduped = 0;
    const errors: Array<{ url: string; message: string }> = [];

    for (const it of data.items) {
      try {
        const url = normalizeLinkedinUrl(it.linkedin_url);
        const { data: existing } = await supabase
          .from("ats_candidates")
          .select("id")
          .eq("owner_id", userId)
          .ilike("linkedin_url", url)
          .maybeSingle();

        let candidateId: string;
        if (existing) {
          candidateId = existing.id as string;
          deduped += 1;
          await supabase
            .from("ats_candidates")
            .update({ last_touch_at: new Date().toISOString() } as never)
            .eq("id", candidateId);
        } else {
          const { data: ins, error } = await supabase
            .from("ats_candidates")
            .insert({
              owner_id: userId,
              created_by: userId,
              full_name: it.full_name,
              linkedin_url: url,
              location: it.location ?? null,
              current_company: it.current_company ?? null,
              current_position: it.current_position ?? it.headline ?? null,
              headline: it.headline ?? null,
              photo_url: it.photo_url ?? null,
              source: "linkedin_unipile_search",
              last_touch_at: new Date().toISOString(),
            } as never)
            .select("id")
            .single();
          if (error) {
            errors.push({ url: it.linkedin_url, message: error.message });
            continue;
          }
          candidateId = ins.id as string;
          created += 1;
        }

        await supabase.from("ats_hunting_captures").insert({
          owner_id: userId,
          candidate_id: candidateId,
          source_url: it.linkedin_url,
          raw_payload: it as never,
          parser_version: "unipile-search-v1",
          captured_by: userId,
        } as never);
      } catch (e) {
        errors.push({ url: it.linkedin_url, message: (e as Error).message });
      }
    }

    return { created, deduped, errors };
  });
