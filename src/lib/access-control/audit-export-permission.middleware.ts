import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { workRpc } from "./work-core.server";
export function requireAuditExportPermission(action = "view") {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ context, next }) => {
      const access = await workRpc<{ workspace: string }>(
        context.supabase,
        "shared_audit_export_authorize",
        { a: action },
      );
      return next({ context: { ...context, auditExportWorkspaceId: access.workspace } });
    });
}
