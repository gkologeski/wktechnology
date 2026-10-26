import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { workRpc } from "./work-core.server";
export function requireAdminSetting(resource: string, action = "view") {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ context, next }) => {
      const c = await workRpc<{ workspace: string; can_manage: boolean }>(
        context.supabase,
        "admin_setting_authorize",
        { r: resource, a: action },
      );
      return next({
        context: { ...context, settingWorkspaceId: c.workspace, settingCanManage: c.can_manage },
      });
    });
}
