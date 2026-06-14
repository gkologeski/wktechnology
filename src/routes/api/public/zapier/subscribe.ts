// Release 16 — Zapier REST hook subscribe / unsubscribe / triggers.
// Zapier autentica com a mesma API key do CRM (Authorization: Bearer lvb_...).
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope, unauthorized } from "@/lib/api-keys/auth.server";
import { ZAPIER_TRIGGERS } from "@/lib/zapier.functions";

const SubscribeZ = z.object({
  target_url: z.string().url().max(2000),
  event: z.string().min(1).max(60),
});

export const Route = createFileRoute("/api/public/zapier/subscribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await authenticateApiKey(request);
        if (!auth) return unauthorized();
        const denied = requireScope(auth, "write");
        if (denied) return denied;
        const body = await request.json().catch(() => null);
        const parsed = SubscribeZ.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "invalid_input", details: parsed.error.flatten() },
            { status: 400 },
          );
        }
        if (!(ZAPIER_TRIGGERS as readonly string[]).includes(parsed.data.event)) {
          return Response.json(
            { error: "unknown_event", supported: ZAPIER_TRIGGERS },
            { status: 400 },
          );
        }
        const { data, error } = await supabaseAdmin
          .from("zapier_subscriptions")
          .insert({
            workspace_id: auth.ownerId,
            owner_id: auth.ownerId,
            api_key_id: auth.keyId,
            event: parsed.data.event,
            target_url: parsed.data.target_url,
            active: true,
          })
          .select("id,event,target_url,created_at")
          .single();
        if (error) return Response.json({ error: error.message }, { status: 400 });
        return Response.json({ data });
      },
    },
  },
});
