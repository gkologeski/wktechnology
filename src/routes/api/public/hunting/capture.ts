// POST /api/public/hunting/capture — captura/upsert de candidato via extensão.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope } from "@/lib/api-keys/auth.server";
import {
  corsPreflight,
  jsonResponse,
  normalizeLinkedinUrl,
} from "@/lib/ats/hunting-public.server";
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
  available_actions: z
    .preprocess(coerceObject, z.record(z.any()).nullable())
    .optional(),
  // Links/empresa/atividade
  external_links: z
    .preprocess(coerceObject, z.record(z.any()).nullable())
    .optional(),
  current_company_data: z
    .preprocess(coerceObject, z.record(z.any()).nullable())
    .optional(),
  recent_activity: z.array(z.any()).max(20).optional().nullable(),
  recommendations: z.array(z.any()).max(20).optional().nullable(),
  parser_diagnostics: z
    .preprocess(coerceObject, z.record(z.any()).nullable())
    .optional(),
  // Metadados
  capture_version: z.string().max(20).optional(),
});

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
            ["about", 8000], ["headline", 500], ["current_position", 400],
            ["current_company", 200], ["location", 200], ["photo_url", 1000],
          ];
          for (const [k, max] of checks) {
            const v = (body as Record<string, unknown>)[k];
            if (typeof v === "string" && v.length > max) warnings.push(`${k}_truncated_${v.length}_to_${max}`);
          }
        }
        const parsed = Payload.safeParse(body);
        if (!parsed.success)
          return jsonResponse({ error: parsed.error.flatten(), warnings }, { status: 400 });


        const linkedinUrl = normalizeLinkedinUrl(parsed.data.linkedin_url);
        const ownerId = auth.ownerId;

        const { data: existing } = await supabaseAdmin
          .from("ats_candidates")
          .select("id")
          .eq("owner_id", ownerId)
          .ilike("linkedin_url", linkedinUrl)
          .maybeSingle();

        const richFields = {
          headline: parsed.data.headline ?? undefined,
          about: parsed.data.about ?? undefined,
          photo_url: parsed.data.photo_url ?? undefined,
          experiences: parsed.data.experiences ?? undefined,
          education: parsed.data.education ?? undefined,
          certifications: parsed.data.certifications ?? undefined,
          languages: parsed.data.languages ?? undefined,
          skills_detailed: parsed.data.skills_detailed ?? undefined,
          projects: parsed.data.projects ?? undefined,
          publications: parsed.data.publications ?? undefined,
          volunteering: parsed.data.volunteering ?? undefined,
          open_to_work: parsed.data.open_to_work ?? undefined,
          connection_degree: parsed.data.connection_degree ?? undefined,
          available_actions: parsed.data.available_actions ?? undefined,
          external_links: parsed.data.external_links ?? undefined,
          current_company_data: parsed.data.current_company_data ?? undefined,
          recent_activity: parsed.data.recent_activity ?? undefined,
          recommendations: parsed.data.recommendations ?? undefined,
        };
        const definedRich = Object.fromEntries(
          Object.entries(richFields).filter(([, v]) => v !== undefined),
        );

        let candidateId: string;
        let created = false;
        if (existing) {
          candidateId = existing.id as string;
          const patch: Record<string, unknown> = {
            ...definedRich,
            last_touch_at: new Date().toISOString(),
            captured_at: new Date().toISOString(),
            capture_version: parsed.data.capture_version ?? "2.0",
          };
          if (parsed.data.current_position)
            patch.current_position = parsed.data.current_position;
          if (parsed.data.current_company)
            patch.current_company = parsed.data.current_company;
          if (parsed.data.location) patch.location = parsed.data.location;
          await supabaseAdmin
            .from("ats_candidates")
            .update(patch as never)
            .eq("id", candidateId);
        } else {
          const { data: ins, error } = await supabaseAdmin
            .from("ats_candidates")
            .insert({
              owner_id: ownerId,
              full_name: parsed.data.full_name || "Sem nome",
              linkedin_url: linkedinUrl,
              current_position: parsed.data.current_position ?? null,
              current_company: parsed.data.current_company ?? null,
              location: parsed.data.location ?? null,
              source: parsed.data.source ?? "linkedin_extension",
              last_touch_at: new Date().toISOString(),
              captured_at: new Date().toISOString(),
              capture_version: parsed.data.capture_version ?? "2.0",
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
          source_url: parsed.data.linkedin_url,
          raw_payload: parsed.data as never,
          parser_version: parsed.data.capture_version ?? "ext-v2",
          captured_by: null,
        } as never);

        return jsonResponse({ capture_id: candidateId, candidate_id: candidateId, created, warnings });
      },
    },
  },
});
