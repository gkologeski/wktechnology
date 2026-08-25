import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { runCronWithLogging } from "@/lib/cron-observability.server";

export const Route = createFileRoute("/api/public/hooks/linkedin-applicants-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        const run = await runCronWithLogging("linkedin-applicants-sync", async () => {
          const { listSyncablePostings, syncPostingApplicants } =
            await import("@/lib/ats/linkedin-applicants-sync.server");
          const postings = await listSyncablePostings(100);
          const results = [];
          for (const p of postings) {
            const r = await syncPostingApplicants(p.id);
            results.push(r);
          }
          return {
            postings: results.length,
            fetched: results.reduce((s, r) => s + r.fetched, 0),
            createdCandidates: results.reduce((s, r) => s + r.createdCandidates, 0),
            createdApplications: results.reduce((s, r) => s + r.createdApplications, 0),
            skipped: results.reduce((s, r) => s + r.skipped, 0),
            errors: results.filter((r) => r.error).length,
          } as unknown as Record<string, unknown>;
        });
        if (run.status === "error")
          return Response.json({ ok: false, error: run.error }, { status: 500 });
        return Response.json({ ok: true, duration_ms: run.duration_ms, ...run.metrics });
      },
    },
  },
});
