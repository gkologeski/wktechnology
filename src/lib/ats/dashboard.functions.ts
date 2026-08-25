// Métricas complementares para o Dashboard do TechHire (ATS).
// KPIs principais e funil vêm de `getAtsAnalytics` — aqui expomos
// entrevistas próximas, ofertas abertas e vagas mais ativas.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

type UpcomingInterview = {
  id: string;
  scheduled_at: string;
  status: string;
  candidate_id: string | null;
  candidate_name: string | null;
  job_id: string | null;
  job_title: string | null;
};

type ActiveJob = {
  id: string;
  title: string;
  status: string;
  applications: number;
};

export const getAtsDashboardExtras = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [ivRes, offRes, jobsRes, appsRes] = await Promise.all([
      supabase
        .from("ats_interviews")
        .select("id, scheduled_at, status, candidate_id, job_id")
        .eq("workspace_id", workspaceId)
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", in7.toISOString())
        .neq("status", "cancelled")
        .order("scheduled_at", { ascending: true })
        .limit(8),
      supabase
        .from("ats_offers")
        .select("id, status")
        .eq("workspace_id", workspaceId)
        .in("status", ["draft", "sent", "viewed"]),
      supabase
        .from("ats_jobs")
        .select("id, title, status")
        .eq("workspace_id", workspaceId)
        .eq("status", "published")
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase
        .from("ats_applications")
        .select("job_id")
        .eq("workspace_id", workspaceId)
        .eq("status", "active"),
    ]);

    if (ivRes.error) throw new Error(ivRes.error.message);
    if (jobsRes.error) throw new Error(jobsRes.error.message);

    const interviewsRaw = (ivRes.data ?? []) as Array<{
      id: string;
      scheduled_at: string;
      status: string;
      candidate_id: string | null;
      job_id: string | null;
    }>;

    const candIds = Array.from(
      new Set(interviewsRaw.map((i) => i.candidate_id).filter(Boolean) as string[]),
    );
    const jobIds = Array.from(
      new Set(interviewsRaw.map((i) => i.job_id).filter(Boolean) as string[]),
    );

    const [candNames, jobNames] = await Promise.all([
      candIds.length
        ? supabase.from("ats_candidates").select("id, full_name").in("id", candIds)
        : Promise.resolve({ data: [] as Array<{ id: string; full_name: string | null }> }),
      jobIds.length
        ? supabase.from("ats_jobs").select("id, title").in("id", jobIds)
        : Promise.resolve({ data: [] as Array<{ id: string; title: string | null }> }),
    ]);

    const candMap = new Map<string, string | null>(
      ((candNames.data ?? []) as Array<{ id: string; full_name: string | null }>).map((c) => [
        c.id,
        c.full_name,
      ]),
    );
    const jobMap = new Map<string, string | null>(
      ((jobNames.data ?? []) as Array<{ id: string; title: string | null }>).map((j) => [
        j.id,
        j.title,
      ]),
    );

    const upcomingInterviews: UpcomingInterview[] = interviewsRaw.map((i) => ({
      id: i.id,
      scheduled_at: i.scheduled_at,
      status: i.status,
      candidate_id: i.candidate_id,
      candidate_name: i.candidate_id ? (candMap.get(i.candidate_id) ?? null) : null,
      job_id: i.job_id,
      job_title: i.job_id ? (jobMap.get(i.job_id) ?? null) : null,
    }));

    // Contagem de candidatos ativos por vaga (para "vagas em destaque").
    const appsByJob = new Map<string, number>();
    for (const a of (appsRes.data ?? []) as Array<{ job_id: string | null }>) {
      if (!a.job_id) continue;
      appsByJob.set(a.job_id, (appsByJob.get(a.job_id) ?? 0) + 1);
    }
    const activeJobs: ActiveJob[] = (
      (jobsRes.data ?? []) as Array<{
        id: string;
        title: string;
        status: string;
      }>
    )
      .map((j) => ({
        id: j.id,
        title: j.title,
        status: j.status,
        applications: appsByJob.get(j.id) ?? 0,
      }))
      .sort((a, b) => b.applications - a.applications)
      .slice(0, 5);

    const offers = (offRes.data ?? []) as Array<{ id: string; status: string }>;
    const offersOpen = offers.length;
    const offersSent = offers.filter((o) => o.status === "sent" || o.status === "viewed").length;

    return {
      upcomingInterviews,
      activeJobs,
      offers: {
        open: offersOpen,
        sent: offersSent,
      },
    };
  });
