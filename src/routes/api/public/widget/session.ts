import { emailSchema } from "@/lib/email-schema";
// Public route: create chat session
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import { identityColumns } from "@/lib/inbox/identity-resolution.server";
import { unverifiedVisitorIdentity } from "@/lib/security/public-capability-guards";

const schema = z.object({
  workspace_id: z.string().uuid(),
  visitor_id: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/),
  visitor_name: z.string().max(120).optional(),
  visitor_email: emailSchema(180).optional(),
  visitor_url: z.string().url().max(500).optional(),
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** Pré-voo CORS: sem dados nem efeitos. */
const widgetSessionPreflight = async () => new Response(null, { status: 204, headers: CORS });

export const Route = createFileRoute("/api/public/widget/session")({
  server: {
    handlers: {
      OPTIONS: widgetSessionPreflight,
      POST: async ({ request }) => {
        try {
          const raw = await request.json();
          const data = schema.parse(raw);
          // Verify workspace exists
          const { data: ws } = await supabaseAdmin
            .from("workspaces")
            .select("id")
            .eq("id", data.workspace_id)
            .maybeSingle();
          if (!ws)
            return Response.json({ error: "Workspace inválido" }, { status: 404, headers: CORS });
          // Reuse open session for this visitor
          const { data: existing } = await supabaseAdmin
            .from("live_chat_sessions")
            .select("id")
            .eq("owner_id", data.workspace_id)
            .eq("visitor_id", data.visitor_id)
            .eq("status", "open")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (existing) {
            return Response.json({ session_id: existing.id }, { headers: CORS });
          }
          // E-mail informado pelo visitante não é comprovado: nunca vincula a Contato/Lead
          // automaticamente; a equipe associa manualmente na Inbox.
          const identity = unverifiedVisitorIdentity();
          const { data: row, error } = await supabaseAdmin
            .from("live_chat_sessions")
            .insert({
              owner_id: data.workspace_id,
              workspace_id: data.workspace_id,
              visitor_id: data.visitor_id,
              visitor_name: data.visitor_name ?? null,
              visitor_email: data.visitor_email ?? null,
              visitor_url: data.visitor_url ?? null,
              ...identityColumns(identity),
              status: "open",
              last_message_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (error) throw error;
          const { autoAssignInboxConversation } =
            await import("@/lib/inbox-auto-assignment.server");
          await autoAssignInboxConversation(
            supabaseAdmin,
            data.workspace_id,
            "live_chat_sessions",
            row.id,
          );
          return Response.json({ session_id: row.id }, { headers: CORS });
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "erro" },
            { status: 400, headers: CORS },
          );
        }
      },
    },
  },
});
