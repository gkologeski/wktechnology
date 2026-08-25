// POST /api/public/hunting/render-template — renderiza template com perfil do DOM.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope } from "@/lib/api-keys/auth.server";
import { corsPreflight, jsonResponse, renderTemplateString } from "@/lib/ats/hunting-public.server";

const Payload = z.object({
  templateId: z.string().uuid(),
  profile: z.object({
    linkedin_url: z.string().url().optional(),
    full_name: z.string().optional(),
    current_position: z.string().optional().nullable(),
    current_company: z.string().optional().nullable(),
    location: z.string().optional().nullable(),
  }),
});

export const Route = createFileRoute("/api/public/hunting/render-template")({
  server: {
    handlers: {
      OPTIONS: () => corsPreflight(),
      POST: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if (!auth) return jsonResponse({ error: "unauthorized" }, { status: 401 });
        const denied = requireScope(auth, "read");
        if (denied) return denied;

        const body = await request.json().catch(() => null);
        const parsed = Payload.safeParse(body);
        if (!parsed.success)
          return jsonResponse({ error: parsed.error.flatten() }, { status: 400 });

        const { data: tpl } = await supabaseAdmin
          .from("ats_hunting_templates")
          .select("subject, body, channel")
          .eq("id", parsed.data.templateId)
          .eq("owner_id", auth.ownerId)
          .maybeSingle();
        if (!tpl) return jsonResponse({ error: "template_not_found" }, { status: 404 });

        const profile = {
          linkedin_url: parsed.data.profile.linkedin_url ?? "",
          full_name: parsed.data.profile.full_name ?? "",
          current_position: parsed.data.profile.current_position ?? "",
          current_company: parsed.data.profile.current_company ?? "",
          location: parsed.data.profile.location ?? "",
        };
        return jsonResponse({
          channel: tpl.channel as string,
          subject: renderTemplateString(tpl.subject as string | null, profile),
          body: renderTemplateString(tpl.body as string, profile),
        });
      },
    },
  },
});
