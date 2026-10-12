// Permissão efetiva e origens (somente admin do workspace).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { EffectiveOriginsResult } from "./effective-origins.server";

export const getEffectivePermissionOrigins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }): Promise<EffectiveOriginsResult> => {
    const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: isAdmin } = await context.supabase.rpc("is_workspace_admin_v2", {
      _workspace: ws,
      _user: context.userId,
    });
    if (!isAdmin)
      throw new Error("Apenas owner e administradores podem ver permissões de outras pessoas.");
    const { loadEffectiveOrigins } = await import("./effective-origins.server");
    return loadEffectiveOrigins(context.supabase, ws, data.user_id);
  });
