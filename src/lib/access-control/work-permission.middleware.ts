import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
/** Coarse action gate. Record scope and process invariants remain mandatory in RLS/RPC. */
export function requireWorkPermission(resource: string, action: string) {
  return createMiddleware({ type: "function" })
    .middleware([requireSupabaseAuth])
    .server(async ({ context, next }) => {
      const { workRpc } = await import("./work-core.server");
      await workRpc(context.supabase, "work_area_authorize", { r: resource, a: action, i: null });
      return next();
    });
}
