import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkedMutationClient } from "./checked-mutation-client";
import { workRpc } from "./work-core.server";
export function requireSharedPermission(resource: string, action = "view") {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ context, next }) => {
      const access = await workRpc(context.supabase, "shared_area_authorize", {
        r: resource,
        a: action,
      });
      return next({
        context: {
          ...context,
          sharedWorkspaceId: String((access as { workspace: string }).workspace),
          supabase: checkedMutationClient(context.supabase, { server: true }),
        },
      });
    });
}
