// Operator-side server functions for live chat sessions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

export const listChatSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data, error } = await supabaseAdmin.from("live_chat_sessions")
      .select("id, visitor_id, visitor_name, visitor_email, visitor_url, status, assignee_id, last_message_at, created_at")
      .eq("owner_id", ws)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listChatMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ session_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: rows, error } = await supabaseAdmin.from("live_chat_messages")
      .select("id, direction, author_user_id, body, created_at")
      .eq("session_id", data.session_id)
      .eq("owner_id", ws)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({
    session_id: z.string().uuid(),
    body: z.string().min(1).max(2000),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { error } = await supabaseAdmin.from("live_chat_messages").insert({
      session_id: data.session_id,
      owner_id: ws,
      direction: "outbound",
      author_user_id: context.userId,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("live_chat_sessions")
      .update({ last_message_at: new Date().toISOString(), assignee_id: context.userId })
      .eq("id", data.session_id).eq("owner_id", ws);
    return { ok: true };
  });

export const closeChatSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ session_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    await supabaseAdmin.from("live_chat_sessions").update({ status: "closed" })
      .eq("id", data.session_id).eq("owner_id", ws);
    return { ok: true };
  });
