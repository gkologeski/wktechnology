// Release 16 — Triggers para Zapier (sample data + listagem real).
// Zapier chama este endpoint para popular o "Test trigger" durante o setup do Zap.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { authenticateApiKey, requireScope, unauthorized } from "@/lib/api-keys/auth.server";
import { ZAPIER_TRIGGERS } from "@/lib/zapier.functions";

const EVENT_TO_TABLE: Record<string, { table: string; cols: string }> = {
  "lead.created": { table: "leads", cols: "id,first_name,last_name,email,phone,company,source,status,created_at" },
  "lead.assigned": { table: "leads", cols: "id,first_name,last_name,email,assigned_user_id,status,updated_at" },
  "deal.created": { table: "deals", cols: "id,title,value,currency,stage,created_at" },
  "deal.won": { table: "deals", cols: "id,title,value,currency,stage,won_at,updated_at" },
  "deal.lost": { table: "deals", cols: "id,title,value,currency,stage,lost_at,updated_at" },
  "ticket.created": { table: "tickets", cols: "id,subject,status,priority,created_at" },
  "contact.created": { table: "contacts", cols: "id,first_name,last_name,email,phone,created_at" },
  "company.created": { table: "companies", cols: "id,name,domain,industry,created_at" },
};

export const Route = createFileRoute("/api/public/zapier/triggers/$event")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const auth = await authenticateApiKey(request);
        if (!auth) return unauthorized();
        const denied = requireScope(auth, "read");
        if (denied) return denied;
        const event = String(params.event ?? "");
        if (!(ZAPIER_TRIGGERS as readonly string[]).includes(event)) {
          return Response.json({ error: "unknown_event", supported: ZAPIER_TRIGGERS }, { status: 400 });
        }
        const cfg = EVENT_TO_TABLE[event];
        if (!cfg) return Response.json({ data: [] });

        let q = supabaseAdmin
          .from(cfg.table)
          .select(cfg.cols)
          .eq("owner_id", auth.ownerId)
          .order("created_at", { ascending: false })
          .limit(3);

        if (event === "deal.won") q = q.eq("stage", "won");
        if (event === "deal.lost") q = q.eq("stage", "lost");

        const { data, error } = await q;
        if (error) return Response.json({ error: error.message }, { status: 400 });
        return Response.json({ data: data ?? [] });
      },
    },
  },
});
