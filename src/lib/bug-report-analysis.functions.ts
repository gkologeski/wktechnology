// Server functions to trigger and list AI analyses of bug reports.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertPlatformAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso negado: apenas super-admins da plataforma.");
}

export const analyzeBugReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ bug_report_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertPlatformAdmin(context.userId);
    const { analyzeBugReportById } = await import("./bug-report-analysis.server");
    const row = await analyzeBugReportById(data.bug_report_id);
    return row;
  });

export const listBugReportAnalyses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ bug_report_ids: z.array(z.string().uuid()).max(500) }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertPlatformAdmin(context.userId);
    if (data.bug_report_ids.length === 0) return [];
    const { data: rows, error } = await supabaseAdmin
      .from("bug_report_analyses")
      .select("*")
      .in("bug_report_id", data.bug_report_ids)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
