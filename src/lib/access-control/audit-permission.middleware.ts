import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { workRpc } from "./work-core.server";
export function requireAuditPermission() {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ context, next }) => {
      const access = await workRpc<{ workspace: string }>(
        context.supabase,
        "shared_audit_authorize",
        {},
      );
      return next({ context: { ...context, auditWorkspaceId: access.workspace } });
    });
}
