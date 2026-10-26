import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkedMutationClient } from "./checked-mutation-client";
import { workRpc } from "./work-core.server";
export function requireApiKeyPermission(action: "view" | "create" | "manage" | "delete") {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ context, next }) => {
      const access = await workRpc<{ workspace: string }>(
        context.supabase,
        "shared_api_key_authorize",
        { a: action },
      );
      return next({
        context: {
          ...context,
          apiKeyWorkspaceId: access.workspace,
          supabase: checkedMutationClient(context.supabase, { server: true }),
        },
      });
    });
}
