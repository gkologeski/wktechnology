// Public route: list/send chat messages for a visitor session
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

const sendSchema = z.object({
  session_id: z.string().uuid(),
  visitor_id: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[a-zA-Z0-9_-]+$/),
  body: z.string().min(1).max(2000),
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

async function loadSession(sessionId: string, visitorId: string) {
  const { data } = await supabaseAdmin
    .from("live_chat_sessions")
    .select("id, owner_id, visitor_id, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!data || data.visitor_id !== visitorId) return null;
  return data;
}

export const Route = createFileRoute("/api/public/widget/messages")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get("session_id") ?? "";
        const visitorId = url.searchParams.get("visitor_id") ?? "";
        const since = url.searchParams.get("since");
        if (!sessionId || !visitorId)
          return Response.json({ error: "missing" }, { status: 400, headers: CORS });
        const s = await loadSession(sessionId, visitorId);
        if (!s) return Response.json({ error: "invalid session" }, { status: 403, headers: CORS });
        let q = supabaseAdmin
          .from("live_chat_messages")
          .select("id, direction, body, created_at")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true })
          .limit(200);
        if (since) q = q.gt("created_at", since);
        const { data } = await q;
        return Response.json({ messages: data ?? [] }, { headers: CORS });
      },
      POST: async ({ request }) => {
        try {
          const data = sendSchema.parse(await request.json());
          const s = await loadSession(data.session_id, data.visitor_id);
          if (!s)
            return Response.json({ error: "invalid session" }, { status: 403, headers: CORS });
          if (s.status === "closed")
            return Response.json({ error: "closed" }, { status: 400, headers: CORS });
          const now = new Date().toISOString();
          const { error } = await supabaseAdmin.from("live_chat_messages").insert({
            session_id: data.session_id,
            owner_id: s.owner_id,
            workspace_id: s.owner_id,
            direction: "inbound",
            body: data.body,
          });
          if (error) throw error;
          await supabaseAdmin
            .from("live_chat_sessions")
            .update({ last_message_at: now })
            .eq("id", data.session_id);
          return Response.json({ ok: true }, { headers: CORS });
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
