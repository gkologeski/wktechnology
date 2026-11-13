import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { linkedinInboxAccess } from "./inbox-access";
export function requireLinkedinInbox(action: "view" | "create" | "manage") {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ context, next }) => {
      const { workRpc } = await import("@/lib/access-control/work-core.server");
      const access = await workRpc<Parameters<typeof linkedinInboxAccess>[0]>(
        context.supabase,
        "work_access_context",
        {},
      );
      const linkedinWorkspace = linkedinInboxAccess(access, context.userId, action);
      return next({ context: { ...context, linkedinWorkspace } });
    });
}
