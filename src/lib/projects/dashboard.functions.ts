import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadProjectDashboard } from "./dashboard.server";

export const getProjectDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ from: z.string().date(), to: z.string().date() }).parse(input),
  )
  .handler(async ({ context, data }) => loadProjectDashboard(context.supabase, data.from, data.to));
