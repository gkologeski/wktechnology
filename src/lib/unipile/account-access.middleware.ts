import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { linkedinAccountAccess } from "./account-access";

export function requireLinkedinPermission(action: "view" | "manage") {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ context, next }) => {
      const { workRpc } = await import("@/lib/access-control/work-core.server");
      const access = await workRpc<Parameters<typeof linkedinAccountAccess>[0]>(
        context.supabase,
        "work_access_context",
        {},
      );
      linkedinAccountAccess(access, context.userId, action);
      const { checkedMutationClient } =
        await import("@/lib/access-control/checked-mutation-client");
      return next({
        context: {
          ...context,
          supabase: checkedMutationClient(context.supabase, { server: true }),
        },
      });
    });
}
