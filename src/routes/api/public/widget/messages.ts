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

function widgetPreflight() {
  return new Response(null, { status: 204, headers: CORS });
}

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
      OPTIONS: async () => widgetPreflight(),
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
          .select("id, direction, body, created_at, author_name, agent_attachments")
          .eq("session_id", sessionId)
          .order("created_at", { ascending: true })
          .limit(200);
        if (since) q = q.gt("created_at", since);
        const { data, error } = await q;
        if (error)
          return Response.json({ error: "messages unavailable" }, { status: 503, headers: CORS });
        const rows = (data ?? []) as any[];
        const validId = (id: unknown): id is string =>
          typeof id === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id);
        const ids = [
          ...new Set(
            rows.flatMap((message) =>
              (Array.isArray(message.agent_attachments) ? message.agent_attachments : [])
                .slice(0, 10)
                .map((item: any) => item?.material_id)
                .filter(validId),
            ),
          ),
        ];
        const links = new Map<string, { title: string; url: string }>();
        if (ids.length) {
          const { data: found } = await supabaseAdmin
            .from("sdr_materials")
            .select("id,storage_path,title")
            .in("id", ids)
            .eq("workspace_id", s.owner_id)
            .eq("active", true)
            .eq("approved", true)
            .eq("kind", "file");
          const files = (found ?? []).filter((file) =>
            file.storage_path?.startsWith(`${s.owner_id}/`),
          );
          if (files.length) {
            const signed = await supabaseAdmin.storage.from("sdr-materials").createSignedUrls(
              files.map((file) => file.storage_path!),
              300,
            );
            for (const file of files) {
              const url = signed.data?.find((item) => item.path === file.storage_path)?.signedUrl;
              if (url) links.set(file.id, { title: file.title, url });
            }
          }
        }
        const messages = rows.map((message) => {
          const attachments = (
            Array.isArray(message.agent_attachments) ? message.agent_attachments : []
          )
            .slice(0, 10)
            .map((item: any) => links.get(item?.material_id))
            .filter(Boolean);
          return {
            id: message.id,
            direction: message.direction,
            body: message.body,
            created_at: message.created_at,
            author_name: message.author_name,
            attachments,
          };
        });
        return Response.json({ messages }, { headers: { ...CORS, "Cache-Control": "no-store" } });
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
