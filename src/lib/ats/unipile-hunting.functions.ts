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
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

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
  cursor: z.string().max(4000).optional(),
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
        data.location
          ? resolveSearchParameter(ctx, "LOCATION", data.location)
          : Promise.resolve([]),
        data.industry
          ? resolveSearchParameter(ctx, "INDUSTRY", data.industry)
          : Promise.resolve([]),
        data.current_company
          ? resolveSearchParameter(ctx, "COMPANY", data.current_company)
          : Promise.resolve([]),
        data.school ? resolveSearchParameter(ctx, "SCHOOL", data.school) : Promise.resolve([]),
      ]);

      // IDs resolvidos vão como `{ id }` (a v2 usa IDs opacos, não numéricos);
      // texto livre continua como string e é mesclado em keywords pelo cliente.
      const asIds = (ids: string[], fallback?: string) =>
        ids.length ? ids.map((id) => ({ id })) : fallback ? [fallback] : undefined;

      const result = (await searchPeopleClassic(ctx, {
        keywords: data.keywords,
        location: asIds(locationIds, data.location),
        industry: asIds(industryIds, data.industry),
        current_company: asIds(companyIds, data.current_company),
        school: asIds(schoolIds, data.school),

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
    const workspaceId = await resolveActiveWorkspace(userId);
    const { loadAccountCtx, fetchProfile, UnipileError } =
      await import("@/lib/unipile/client.server");

    let enrichCtx: Awaited<ReturnType<typeof loadAccountCtx>> | null = null;
    try {
      enrichCtx = await loadAccountCtx(userId);
    } catch {
      enrichCtx = null; // segue sem enriquecer — import básico ainda funciona
    }

    let created = 0;
    let deduped = 0;
    let enriched = 0;
    const errors: Array<{ url: string; message: string }> = [];

    for (const it of data.items) {
      try {
        const url = normalizeLinkedinUrl(it.linkedin_url);

        // ── Enriquecimento via Unipile (skills, education, experiences) ─────
        type EnrichPayload = {
          headline?: string | null;
          location?: string | null;
          current_company?: string | null;
          current_position?: string | null;
          photo_url?: string | null;
          email?: string | null;
          phone?: string | null;
          skills?: string[];
          skills_detailed?: unknown;
          education?: unknown;
          experiences?: unknown;
          languages?: unknown;
          certifications?: unknown;
          raw?: unknown;
        };
        const enrich: EnrichPayload = {};
        if (enrichCtx && it.public_identifier) {
          try {
            const profile = (await fetchProfile(enrichCtx, it.public_identifier)) as Record<
              string,
              unknown
            > | null;
            if (profile) {
              const p = profile as Record<string, any>;
              enrich.raw = profile;
              enrich.headline = (p.headline as string) ?? null;
              enrich.location = (p.location as string) ?? (p.location_name as string) ?? null;
              enrich.photo_url =
                (p.profile_picture_url as string) ?? (p.picture_url as string) ?? null;

              // ── Contact info (só vem quando é conexão 1º grau / perfil expôs) ─
              const ci = (p.contact_info ?? p.contactInfo ?? {}) as Record<string, any>;
              const emailCandidates: unknown[] = [
                p.email,
                p.primary_email,
                ci.email,
                ...(Array.isArray(ci.emails) ? ci.emails : []),
                ...(Array.isArray(p.emails) ? p.emails : []),
              ];
              const pickString = (v: unknown): string | null => {
                if (typeof v === "string" && v.trim()) return v.trim();
                if (v && typeof v === "object") {
                  const o = v as Record<string, unknown>;
                  const s =
                    (o.address as string) ??
                    (o.email as string) ??
                    (o.value as string) ??
                    (o.number as string) ??
                    (o.phone as string) ??
                    null;
                  if (typeof s === "string" && s.trim()) return s.trim();
                }
                return null;
              };
              const email = emailCandidates.map(pickString).find((v) => !!v) ?? null;
              const phoneCandidates: unknown[] = [
                p.phone,
                p.primary_phone,
                ci.phone,
                ...(Array.isArray(ci.phones) ? ci.phones : []),
                ...(Array.isArray(ci.phone_numbers) ? ci.phone_numbers : []),
                ...(Array.isArray(p.phone_numbers) ? p.phone_numbers : []),
              ];
              const phone = phoneCandidates.map(pickString).find((v) => !!v) ?? null;
              enrich.email = email && /.+@.+\..+/.test(email) ? email.toLowerCase() : null;
              enrich.phone = phone;

              const exps = Array.isArray(p.work_experience)
                ? p.work_experience
                : Array.isArray(p.experiences)
                  ? p.experiences
                  : Array.isArray(p.experience)
                    ? p.experience
                    : [];
              enrich.experiences = exps;
              if (exps[0]) {
                enrich.current_company =
                  (exps[0].company as string) ?? (exps[0].company_name as string) ?? null;
                enrich.current_position =
                  (exps[0].position as string) ??
                  (exps[0].role as string) ??
                  (exps[0].title as string) ??
                  null;
              }

              const edu = Array.isArray(p.education) ? p.education : [];
              enrich.education = edu;

              const skillsRaw = Array.isArray(p.skills) ? p.skills : [];
              enrich.skills_detailed = skillsRaw;
              enrich.skills = skillsRaw
                .map((s: any) => (typeof s === "string" ? s : (s?.name as string)))
                .filter((v: string | undefined): v is string => !!v && v.trim().length > 0)
                .slice(0, 50);

              enrich.languages = Array.isArray(p.languages) ? p.languages : [];
              enrich.certifications = Array.isArray(p.certifications) ? p.certifications : [];
              enriched += 1;
            }
          } catch (e) {
            // Não derruba o import se o enrich falhar (rate limit, perfil privado, etc.)
            if (e instanceof UnipileError && e.code === "daily_budget_reached") {
              enrichCtx = null; // para de tentar enriquecer no resto do loop
            }
          }
        }

        const { data: existing } = await supabase
          .from("ats_candidates")
          .select("id, email, phone")
          .eq("workspace_id", workspaceId)
          .ilike("linkedin_url", url)
          .maybeSingle();

        // ── Fallback garantido: nome, headline, link, localização, empresa ─
        // mesmo se o enrich falhar/estiver vazio, mantemos o mínimo do hit.
        const baseFallback: Record<string, unknown> = {
          last_touch_at: new Date().toISOString(),
        };
        const fallbackHeadline = enrich.headline ?? it.headline ?? null;
        const fallbackLocation = enrich.location ?? it.location ?? null;
        const fallbackCompany = enrich.current_company ?? it.current_company ?? null;
        const fallbackPosition =
          enrich.current_position ?? it.current_position ?? it.headline ?? null;
        const fallbackPhoto = enrich.photo_url ?? it.photo_url ?? null;

        if (fallbackHeadline) baseFallback.headline = fallbackHeadline;
        if (fallbackLocation) baseFallback.location = fallbackLocation;
        if (fallbackCompany) baseFallback.current_company = fallbackCompany;
        if (fallbackPosition) baseFallback.current_position = fallbackPosition;
        if (fallbackPhoto) baseFallback.photo_url = fallbackPhoto;

        // Campos enriquecidos só entram quando o enrich realmente trouxe dado.
        const enrichExtras: Record<string, unknown> = {};
        if (enrich.skills?.length) enrichExtras.skills = enrich.skills;
        if (enrich.skills_detailed) enrichExtras.skills_detailed = enrich.skills_detailed;
        if (enrich.education) enrichExtras.education = enrich.education;
        if (enrich.experiences) enrichExtras.experiences = enrich.experiences;
        if (enrich.languages) enrichExtras.languages = enrich.languages;
        if (enrich.certifications) enrichExtras.certifications = enrich.certifications;

        const updatePayload: Record<string, unknown> = { ...baseFallback, ...enrichExtras };

        // Email/telefone: não sobrescreve se já existir; grava quando enrich trouxe.
        const existingEmail = (existing?.email as string | null) ?? null;
        const existingPhone = (existing?.phone as string | null) ?? null;
        if (enrich.email && !existingEmail) updatePayload.email = enrich.email;
        if (enrich.phone && !existingPhone) updatePayload.phone = enrich.phone;

        let candidateId: string;
        if (existing) {
          candidateId = existing.id as string;
          deduped += 1;
          await supabase
            .from("ats_candidates")
            .update(updatePayload as never)
            .eq("id", candidateId);
        } else {
          const insertRow: Record<string, unknown> = {
            owner_id: userId,
            workspace_id: workspaceId,
            created_by: userId,
            full_name: it.full_name || "Sem nome",
            linkedin_url: url,
            source: "linkedin_unipile_search",
            ...updatePayload,
          };
          if (enrich.email) insertRow.email = enrich.email;
          if (enrich.phone) insertRow.phone = enrich.phone;
          const { data: ins, error } = await supabase
            .from("ats_candidates")
            .insert(insertRow as never)
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
          workspace_id: workspaceId,
          candidate_id: candidateId,
          source_url: it.linkedin_url,
          raw_payload: (enrich.raw ?? it) as never,
          parser_version: enrich.raw ? "unipile-search-v2-enriched" : "unipile-search-v2-fallback",
          captured_by: userId,
        } as never);
      } catch (e) {
        errors.push({ url: it.linkedin_url, message: (e as Error).message });
      }
    }

    return { created, deduped, enriched, errors };
  });
