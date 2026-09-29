import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { loadPeopleDashboard } from "./dashboard.server";

export const getPeopleDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const workspaceId = await resolveActiveWorkspace(context.userId);
    return loadPeopleDashboard(context.supabase, context.userId, workspaceId);
  });
