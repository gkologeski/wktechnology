import { checkedMutationClient } from "./checked-mutation-client";
import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SalesAction } from "./sales-resources";
/** Coarse action gate; RLS and record guards enforce the actual row scope. */
export function requireSalesPermission(
  resource: string | readonly string[],
  action: SalesAction | readonly SalesAction[],
) {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ context, next }) => {
      const { assertSalesAnyArea } = await import("./sales-core.server");
      await assertSalesAnyArea(context.supabase, resource, action);
      return next({
        context: {
          ...context,
          supabase: checkedMutationClient(context.supabase, { server: true }),
        },
      });
    });
}
