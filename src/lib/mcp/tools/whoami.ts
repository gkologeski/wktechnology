import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, unauthenticated, resolveWorkspaceId } from "../supabase";

export default defineTool({
  name: "whoami",
  title: "Identificar usuário conectado",
  description: "Retorna o usuário autenticado e o workspace ativo usado pelas demais ferramentas.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthenticated();
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId()!;
    const workspaceId = await resolveWorkspaceId(supabase, userId);
    const { data } = await supabase
      .from("workspaces")
      .select("id,name")
      .eq("id", workspaceId)
      .maybeSingle();
    const payload = {
      user_id: userId,
      email: ctx.getUserEmail() ?? null,
      workspace: data ?? { id: workspaceId },
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
