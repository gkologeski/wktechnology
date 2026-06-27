// POST /api/public/hunting/capture — captura/upsert de candidato via extensão.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  authenticateApiKey,
  requireScope,
  unauthorized,
} from "@/lib/api-keys/auth.server";
import {
  CORS_HEADERS,
  corsPreflight,
  jsonResponse,
  normalizeLinkedinUrl,
} from "@/lib/ats/hunting-public.server";
import { recordAtsEvent } from "@/lib/ats/audit.server";

const Payload = z.object({
  linkedin_url: z.string().url().max(500),
  full_name: z.string().min(1).max(200).optional().default(""),
  current_position: z.string().max(400).optional().nullable(),
  current_company: z.string().max(200).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  source: z.string().max(60).optional(),
});

export const Route = createFileRoute("/api/public/hunting/capture")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      POST: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if (!auth)
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...CORS_HEADERS },
          }) || unauthorized();
        const denied = requireScope(auth, "write");
        if (denied) return denied;

        const body = await request.json().catch(() => null);
        const parsed = Payload.safeParse(body);
        if (!parsed.success)
          return jsonResponse({ error: parsed.error.flatten() }, { status: 400 });

        const linkedinUrl = normalizeLinkedinUrl(parsed.data.linkedin_url);
        const ownerId = auth.ownerId;

        const { data: existing } = await supabaseAdmin
          .from("ats_candidates")
          .select("id")
          .eq("owner_id", ownerId)
          .ilike("linkedin_url", linkedinUrl)
          .maybeSingle();

        let candidateId: string;
        let created = false;
        if (existing) {
          candidateId = existing.id as string;
          const patch: Record<string, unknown> = {
            last_touch_at: new Date().toISOString(),
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
          parser_version: "ext-v1",
          captured_by: null,
        } as never);

        return jsonResponse({ capture_id: candidateId, candidate_id: candidateId, created });
      },
    },
  },
});
