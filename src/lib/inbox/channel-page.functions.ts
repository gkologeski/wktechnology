import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Lista paginada de um canal da Inbox (RPC sob a RLS do usuário). O chat continua
// restrito ao workspace ativo, como em listChatSessions.
export const listInboxChannelPage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        channel: z.enum(["email", "whatsapp", "chat"]),
        assignee: z.enum(["all", "mine", "unassigned"]),
        search: z.string().max(200).optional(),
        cursor: z.object({ at: z.string().max(40), id: z.string().uuid() }).nullable().optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const workspaceId = data.channel === "chat" ? await resolveActiveWorkspace(context.userId) : undefined;
    const { data: page, error } = await context.supabase.rpc("get_inbox_channel_page", {
      p_channel: data.channel,
      p_assignee: data.assignee,
      p_search: data.search?.trim() || undefined,
      p_workspace_id: workspaceId,
      p_cursor_at: data.cursor?.at,
      p_cursor_id: data.cursor?.id,
      p_page_size: data.pageSize ?? 50,
    });
    if (error) throw new Error(error.message);
    return page as unknown;
  });
