// POST /api/public/hunting/bulk-capture — captura em lote (extensão / scripts).
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope } from "@/lib/api-keys/auth.server";
import { corsPreflight, jsonResponse, normalizeLinkedinUrl } from "@/lib/ats/hunting-public.server";
import { recordAtsEvent } from "@/lib/ats/audit.server";

const Item = z.object({
  linkedin_url: z.string().url().max(500),
  full_name: z.string().min(1).max(200).optional().default(""),
  current_position: z.string().max(400).optional().nullable(),
  current_company: z.string().max(200).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  source: z.string().max(60).optional(),
});
const Payload = z.object({ items: z.array(Item).min(1).max(50) });

export const Route = createFileRoute("/api/public/hunting/bulk-capture")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      POST: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if (!auth) return jsonResponse({ error: "unauthorized" }, { status: 401 });
        const denied = requireScope(auth, "write");
        if (denied) return denied;

        const body = await request.json().catch(() => null);
        const parsed = Payload.safeParse(body);
        if (!parsed.success)
          return jsonResponse({ error: parsed.error.flatten() }, { status: 400 });

        const ownerId = auth.ownerId;
        let created = 0;
        let deduped = 0;
        const errors: Array<{ url: string; message: string }> = [];

        for (const it of parsed.data.items) {
          try {
            const url = normalizeLinkedinUrl(it.linkedin_url);
            const { data: existing } = await supabaseAdmin
              .from("ats_candidates")
              .select("id")
              .eq("owner_id", ownerId)
              .ilike("linkedin_url", url)
              .maybeSingle();

            let candidateId: string;
            if (existing) {
              candidateId = existing.id as string;
              deduped += 1;
              await supabaseAdmin
                .from("ats_candidates")
                .update({ last_touch_at: new Date().toISOString() } as never)
                .eq("id", candidateId);
            } else {
              const { data: ins, error } = await supabaseAdmin
                .from("ats_candidates")
                .insert({
                  owner_id: ownerId,
                  full_name: it.full_name || "Sem nome",
                  linkedin_url: url,
                  current_position: it.current_position ?? null,
                  current_company: it.current_company ?? null,
                  location: it.location ?? null,
                  source: it.source ?? "linkedin_bulk",
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
              await recordAtsEvent(supabaseAdmin, {
                ownerId,
                name: "ats.candidate.sourced",
                entityType: "candidate",
                entityId: candidateId,
                payload: { source: "linkedin_bulk", key_id: auth.keyId },
              });
            }

            await supabaseAdmin.from("ats_hunting_captures").insert({
              owner_id: ownerId,
              candidate_id: candidateId,
              source_url: it.linkedin_url,
              raw_payload: it as never,
              parser_version: "bulk-v1",
              captured_by: null,
            } as never);
          } catch (e) {
            errors.push({ url: it.linkedin_url, message: (e as Error).message });
          }
        }

        return jsonResponse({ created, deduped, errors });
      },
    },
  },
});
