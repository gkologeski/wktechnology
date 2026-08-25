// POST /api/public/hunting/log-outreach — registra mensagem enviada via LinkedIn.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope } from "@/lib/api-keys/auth.server";
import {
  corsPreflight,
  findCandidateByLinkedinUrl,
  jsonResponse,
} from "@/lib/ats/hunting-public.server";

const Payload = z.object({
  linkedin_url: z.string().url(),
  channel: z.string().max(60).default("linkedin_message"),
  body: z.string().min(1).max(8000),
  template_id: z.string().uuid().optional(),
  detected: z.boolean().optional(),
  final_length: z.number().int().nonnegative().optional(),
  truncated: z.boolean().optional(),
});

export const Route = createFileRoute("/api/public/hunting/log-outreach")({
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

        const candidate = await findCandidateByLinkedinUrl(auth.ownerId, parsed.data.linkedin_url);
        if (!candidate) return jsonResponse({ error: "candidate_not_found" }, { status: 404 });

        const meta: string[] = [];
        if (parsed.data.detected !== undefined)
          meta.push(`detecção: ${parsed.data.detected ? "automática" : "manual"}`);
        if (parsed.data.final_length !== undefined) meta.push(`${parsed.data.final_length} chars`);
        if (parsed.data.truncated) meta.push("truncado");
        if (parsed.data.template_id) meta.push(`template: ${parsed.data.template_id}`);
        const description = meta.length
          ? `${parsed.data.body}\n\n— ${meta.join(" · ")}`
          : parsed.data.body;

        const { data: ins } = await supabaseAdmin
          .from("activities")
          .insert({
            owner_id: auth.ownerId,
            type: "outreach",
            subject: `Mensagem ${parsed.data.channel} enviada`,
            body: parsed.data.body,
            description,
          } as never)
          .select("id")
          .single();
        await supabaseAdmin
          .from("ats_candidates")
          .update({ last_touch_at: new Date().toISOString() } as never)
          .eq("id", candidate.id);

        return jsonResponse({
          ok: true,
          candidate_id: candidate.id,
          activity_id: (ins as { id?: string } | null)?.id ?? null,
        });
      },
    },
  },
});
