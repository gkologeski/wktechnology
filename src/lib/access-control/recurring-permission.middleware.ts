import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkedMutationClient } from "./checked-mutation-client";
import { workRpc } from "./work-core.server";
/** Area authorization is followed by per-row RLS and parent/tenant checks. */
export function requireRecurringPermission(resource: "recurrences" | "invoices", action = "view") {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ context, next }) => {
      const access = await workRpc<{ workspace: string }>(
        context.supabase,
        "recurring_area_authorize",
        {
          r: resource,
          a: action,
        },
      );
      return next({
        context: {
          ...context,
          recurringWorkspaceId: access.workspace,
          supabase: checkedMutationClient(context.supabase, { server: true }),
        },
      });
    });
}
