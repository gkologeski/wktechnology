import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { workRpc } from "./work-core.server";
export function requireWorkspaceContext() {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ context, next }) => {
      const c = await workRpc<{ workspace?: string; actor?: string }>(
        context.supabase,
        "work_access_context",
        {},
      );
      if (!c.workspace || !c.actor || c.actor !== context.userId)
        throw Error("Membro ativo e workspace selecionado são obrigatórios.");
      return next({ context: { ...context, activeWorkspaceId: c.workspace } });
    });
}
