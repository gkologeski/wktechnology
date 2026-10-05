import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const assignSchema = z.object({
  conversationId: z.string().uuid(),
  assignedTo: z.string().uuid().nullable(),
});

async function assertActiveMember(workspaceId: string, userId: string | null) {
  if (!userId) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: membership }, { data: workspace }] = await Promise.all([
    supabaseAdmin
      .from("workspace_members")
      .select("user_id, status")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabaseAdmin.from("workspaces").select("created_by").eq("id", workspaceId).maybeSingle(),
  ]);
  const activeMember = membership && membership.status !== "inactive";
  if (!activeMember && workspace?.created_by !== userId) {
    throw new Error("Selecione um membro ativo deste workspace.");
  }
}

export const assignEmailThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => assignSchema.parse(input))
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await assertActiveMember(workspaceId, data.assignedTo);
    const { error } = await context.supabase
      .from("email_threads")
      .update({ assigned_to: data.assignedTo })
      .eq("id", data.conversationId)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const assignChatSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => assignSchema.parse(input))
  .handler(async ({ data, context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    await assertActiveMember(workspaceId, data.assignedTo);
    const { error } = await context.supabase
      .from("live_chat_sessions")
      .update({ assignee_id: data.assignedTo })
      .eq("id", data.conversationId)
      .eq("workspace_id", workspaceId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
