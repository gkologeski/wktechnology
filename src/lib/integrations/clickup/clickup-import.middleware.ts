// Fronteira de servidor do importador ClickUp: sessão, workspace selecionado com membro ativo e
// chave `techprojects.clickup_import.<ação>.workspace` conferida no banco (deny prevalece).
import { createMiddleware } from "@tanstack/react-start";
import { requireWorkspaceContext } from "@/lib/access-control/active-workspace.middleware";

export function requireClickUpImport(action: "view" | "manage") {
  return createMiddleware({ type: "function" })
    .middleware([requireWorkspaceContext()])
    .server(async ({ context, next }) => {
      const { data, error } = await context.supabase.rpc(
        "clickup_import_access" as never,
        {
          p_ws: context.activeWorkspaceId,
          p_user: context.userId,
          p_action: action,
        } as never,
      );
      if (error || data !== true) throw new Error("Sem permissão para o importador do ClickUp.");
      return next({ context: { ...context, clickupWorkspaceId: context.activeWorkspaceId } });
    });
}
