// Métricas agregadas do funil ATS para o dashboard.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { DEFAULT_ATS_STAGES } from "./stages";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

export const getAtsAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [jobsRes, appsRes, recentRes] = await Promise.all([
      supabase.from("ats_jobs").select("id, status").eq("workspace_id", workspaceId),
      supabase
        .from("ats_applications")
        .select("id, stage_value, status, source, applied_at, moved_at, job_id")
        .eq("workspace_id", workspaceId),
      supabase
        .from("ats_applications")
        .select("id")
        .eq("workspace_id", workspaceId)
        .gte("applied_at", since.toISOString()),
    ]);

    if (jobsRes.error) throw new Error(jobsRes.error.message);
    if (appsRes.error) throw new Error(appsRes.error.message);

    type App = {
      id: string;
      stage_value: string;
      status: string;
      source: string | null;
      applied_at: string | null;
      moved_at: string | null;
      job_id: string | null;
    };
    const apps = (appsRes.data ?? []) as unknown as App[];
    const jobs = (jobsRes.data ?? []) as unknown as Array<{ id: string; status: string }>;

    // Funil por stage
    const funnel = DEFAULT_ATS_STAGES.map((s) => ({
      value: s.value,
      label: s.label,
      count: apps.filter((a) => a.stage_value === s.value).length,
    }));

    const hired = apps.filter((a) => a.status === "hired").length;
    const rejected = apps.filter((a) => a.status === "rejected").length;
    const active = apps.filter((a) => a.status === "active").length;
    const conversionRate = apps.length > 0 ? +((hired / apps.length) * 100).toFixed(1) : 0;

    // Fontes
    const sources: Record<string, number> = {};
    for (const a of apps) {
      const k = a.source ?? "unknown";
      sources[k] = (sources[k] ?? 0) + 1;
    }

    // Tempo médio entre applied_at e moved_at (em dias) para hired/rejected
    const closed = apps.filter((a) => a.status !== "active" && a.applied_at && a.moved_at);
    const avgDaysToClose =
      closed.length > 0
        ? +(
            closed.reduce(
              (acc, a) =>
                acc +
                (new Date(a.moved_at!).getTime() - new Date(a.applied_at!).getTime()) /
                  (1000 * 60 * 60 * 24),
              0,
            ) / closed.length
          ).toFixed(1)
        : 0;

    return {
      totals: {
        jobs: jobs.length,
        jobsPublished: jobs.filter((j) => j.status === "published").length,
        applications: apps.length,
        applicationsRecent30d: recentRes.data?.length ?? 0,
        active,
        hired,
        rejected,
        conversionRate,
        avgDaysToClose,
      },
      funnel,
      sources: Object.entries(sources).map(([k, v]) => ({ source: k, count: v })),
    };
  });
