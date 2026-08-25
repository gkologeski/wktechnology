// POST /api/public/hunting/capture — captura/upsert de candidato via extensão.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope } from "@/lib/api-keys/auth.server";
import { corsPreflight, jsonResponse, normalizeLinkedinUrl } from "@/lib/ats/hunting-public.server";
import { recordAtsEvent } from "@/lib/ats/audit.server";

const coerceObject = (v: unknown): unknown => {
  if (v == null || v === "") return null;
  if (typeof v === "object") return v;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const truncStr = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.slice(0, max) : v),
    z.string().max(max).nullable().optional(),
  );

const Payload = z.object({
  linkedin_url: z.string().url().max(500),
  full_name: z.preprocess(
    (v) => (typeof v === "string" ? v.slice(0, 200) : v),
    z.string().min(1).max(200).optional().default(""),
  ),
  current_position: truncStr(400),
  current_company: truncStr(200),
  location: truncStr(200),
  source: z.string().max(60).optional(),
  // Perfil profissional
  headline: truncStr(500),
  about: truncStr(8000),
  photo_url: truncStr(1000),
  experiences: z.array(z.any()).max(50).optional().nullable(),
  education: z.array(z.any()).max(50).optional().nullable(),
  certifications: z.array(z.any()).max(50).optional().nullable(),
  languages: z.array(z.any()).max(50).optional().nullable(),
  skills_detailed: z.array(z.any()).max(200).optional().nullable(),
  projects: z.array(z.any()).max(50).optional().nullable(),
  publications: z.array(z.any()).max(50).optional().nullable(),
  volunteering: z.array(z.any()).max(50).optional().nullable(),

  // Sinais de recrutamento — tolerantes a versões antigas da extensão que enviam strings
  open_to_work: z
    .preprocess((v) => {
      if (typeof v === "boolean") return v;
      if (v == null || v === "") return null;
      if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (["true", "1", "yes", "sim"].includes(s)) return true;
        if (["false", "0", "no", "nao", "não"].includes(s)) return false;
        return null;
      }
      return null;
    }, z.boolean().nullable())
    .optional(),
  connection_degree: z.string().max(10).optional().nullable(),
  available_actions: z.preprocess(coerceObject, z.record(z.any()).nullable()).optional(),
  // Links/empresa/atividade
  external_links: z.preprocess(coerceObject, z.record(z.any()).nullable()).optional(),
  current_company_data: z.preprocess(coerceObject, z.record(z.any()).nullable()).optional(),
  recent_activity: z.array(z.any()).max(20).optional().nullable(),
  recommendations: z.array(z.any()).max(20).optional().nullable(),
  parser_diagnostics: z.preprocess(coerceObject, z.record(z.any()).nullable()).optional(),
  // Metadados
  capture_version: z.string().max(20).optional(),
});

type PayloadData = z.infer<typeof Payload>;

const cleanText = (v: unknown) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sliceProfileSection(text: string, start: RegExp, end: RegExp) {
  const startMatch = text.match(start);
  if (!startMatch?.index && startMatch?.index !== 0) return "";
  const from = startMatch.index + startMatch[0].length;
  const rest = text.slice(from);
  const endMatch = rest.match(end);
  return cleanText(
    (endMatch?.index != null ? rest.slice(0, endMatch.index) : rest).replace(/…\s*mais/gi, ""),
  );
}

function sanitizeAbout(raw: string | null | undefined) {
  const text = cleanText(raw);
  if (!text) return null;
  const looksLikeWholePage =
    text.length > 1800 ||
    /\b(dados de contato|contact info|enviar mensagem|send message|mais de \d+ conex|connections|atividade|activity|publica[çc][õo]es|comments|coment[áa]rios|imagens)\b/i.test(
      text,
    );
  if (!looksLikeWholePage)
    return cleanText(
      text.replace(
        /\s+\b(key skills and technologies|principais compet[êe]ncias|atividade|activity|publica[çc][õo]es|posts|coment[áa]rios|comments|imagens|images)\b.*$/i,
        "",
      ),
    ).slice(0, 8000);
  const section = sliceProfileSection(
    text,
    /\b(sobre|about)\b\s*/i,
    /\b(destaques|highlights|atividade|activity|experi[êe]ncia|experience|forma[çc][ãa]o|education|licen[çc]as|certifica|licenses|certifications|key skills and technologies|principais compet[êe]ncias|compet[êe]ncias|skills|idiomas|languages|mais perfis|people also viewed)\b/i,
  );
  return (section || text).slice(0, 8000) || null;
}

function skillsFromText(text: string | null | undefined) {
  const raw = cleanText(text);
  if (!raw) return [];
  const chunks = [
    sliceProfileSection(
      raw,
      /\b(key skills and technologies|principais compet[êe]ncias|compet[êe]ncias|skills)\s*:?\s*/i,
      /\b(atividade|activity|experi[êe]ncia|experience|forma[çc][ãa]o|education|publica[çc][õo]es|comments|coment[áa]rios)\b/i,
    ),
  ].filter(Boolean);
  return uniqueStrings(
    chunks
      .join(" · ")
      .split(/[·•,;|]/)
      .map((s) => cleanText(s.replace(/…\s*mais/gi, "")))
      .filter(
        (s) =>
          s.length >= 2 &&
          s.length <= 80 &&
          !/^(key skills and technologies|principais compet[êe]ncias|skills)$/i.test(s),
      ),
  ).slice(0, 100);
}

function mapSkills(values: string[]) {
  return values.map((name) => ({ name, endorsements: null }));
}

function normalizePayload(data: PayloadData): PayloadData & { legacySkills?: string[] } {
  const safeAbout = sanitizeAbout(data.about);
  const derivedSkillNames = skillsFromText(data.about || safeAbout || "");
  const hasDetailedSkills = Array.isArray(data.skills_detailed) && data.skills_detailed.length > 0;
  return {
    ...data,
    about: safeAbout,
    current_position: data.current_position || data.headline || null,
    headline: data.headline || data.current_position || null,
    skills_detailed: hasDetailedSkills ? data.skills_detailed : mapSkills(derivedSkillNames),
    legacySkills: derivedSkillNames,
  };
}

export const Route = createFileRoute("/api/public/hunting/capture")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      POST: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if (!auth) return jsonResponse({ error: "unauthorized" }, { status: 401 });
        const denied = requireScope(auth, "write");
        if (denied) return denied;

        const body = await request.json().catch(() => null);
        const warnings: string[] = [];
        if (body && typeof body === "object") {
          const checks: Array<[string, number]> = [
            ["about", 8000],
            ["headline", 500],
            ["current_position", 400],
            ["current_company", 200],
            ["location", 200],
            ["photo_url", 1000],
          ];
          for (const [k, max] of checks) {
            const v = (body as Record<string, unknown>)[k];
            if (typeof v === "string" && v.length > max)
              warnings.push(`${k}_truncated_${v.length}_to_${max}`);
          }
        }
        const parsed = Payload.safeParse(body);
        if (!parsed.success)
          return jsonResponse({ error: parsed.error.flatten(), warnings }, { status: 400 });

        const payload = normalizePayload(parsed.data);
        const linkedinUrl = normalizeLinkedinUrl(payload.linkedin_url);
        const ownerId = auth.ownerId;

        const { data: existing } = await supabaseAdmin
          .from("ats_candidates")
          .select("id")
          .eq("owner_id", ownerId)
          .ilike("linkedin_url", linkedinUrl)
          .maybeSingle();

        const richFields = {
          headline: payload.headline ?? undefined,
          about: payload.about ?? undefined,
          photo_url: payload.photo_url ?? undefined,
          experiences: payload.experiences ?? undefined,
          education: payload.education ?? undefined,
          certifications: payload.certifications ?? undefined,
          languages: payload.languages ?? undefined,
          skills_detailed: payload.skills_detailed ?? undefined,
          projects: payload.projects ?? undefined,
          publications: payload.publications ?? undefined,
          volunteering: payload.volunteering ?? undefined,
          open_to_work: payload.open_to_work ?? undefined,
          connection_degree: payload.connection_degree ?? undefined,
          available_actions: payload.available_actions ?? undefined,
          external_links: payload.external_links ?? undefined,
          current_company_data: payload.current_company_data ?? undefined,
          recent_activity: payload.recent_activity ?? undefined,
          recommendations: payload.recommendations ?? undefined,
        };
        const definedRich = Object.fromEntries(
          Object.entries(richFields).filter(([, v]) => {
            if (v === undefined) return false;
            if (Array.isArray(v)) return v.length > 0;
            return true;
          }),
        );

        let candidateId: string;
        let created = false;
        if (existing) {
          candidateId = existing.id as string;
          const patch: Record<string, unknown> = {
            ...definedRich,
            last_touch_at: new Date().toISOString(),
            captured_at: new Date().toISOString(),
            capture_version: payload.capture_version ?? "2.0",
          };
          if (payload.current_position) patch.current_position = payload.current_position;
          if (payload.current_company) patch.current_company = payload.current_company;
          if (payload.location) patch.location = payload.location;
          if (payload.legacySkills?.length) patch.skills = payload.legacySkills;
          await supabaseAdmin
            .from("ats_candidates")
            .update(patch as never)
            .eq("id", candidateId);
        } else {
          const { data: ins, error } = await supabaseAdmin
            .from("ats_candidates")
            .insert({
              owner_id: ownerId,
              full_name: payload.full_name || "Sem nome",
              linkedin_url: linkedinUrl,
              current_position: payload.current_position ?? null,
              current_company: payload.current_company ?? null,
              location: payload.location ?? null,
              source: payload.source ?? "linkedin_extension",
              skills: payload.legacySkills ?? [],
              last_touch_at: new Date().toISOString(),
              captured_at: new Date().toISOString(),
              capture_version: payload.capture_version ?? "2.0",
              ...definedRich,
            } as never)
            .select("id")
            .single();
          if (error) return jsonResponse({ error: error.message }, { status: 400 });
          candidateId = ins.id as string;
          created = true;
          await recordAtsEvent(supabaseAdmin, {
            ownerId,
            name: "ats.candidate.sourced",
            entityType: "candidate",
            entityId: candidateId,
            payload: { source: "linkedin_extension", key_id: auth.keyId },
          });
        }

        await supabaseAdmin.from("ats_hunting_captures").insert({
          owner_id: ownerId,
          candidate_id: candidateId,
          source_url: payload.linkedin_url,
          raw_payload: payload as never,
          parser_version: payload.capture_version ?? "ext-v2",
          captured_by: null,
        } as never);

        return jsonResponse({
          capture_id: candidateId,
          candidate_id: candidateId,
          created,
          warnings,
        });
      },
    },
  },
});
