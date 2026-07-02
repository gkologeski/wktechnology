// Cron horário: sincroniza aplicantes das vagas publicadas no LinkedIn (via Unipile).
import { createFileRoute } from "@tanstack/react-router";
import { requireCronAuth } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/linkedin-applicants-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;

        try {
          const { listSyncablePostings, syncPostingApplicants } = await import(
            "@/lib/ats/linkedin-applicants-sync.server"
          );
          const postings = await listSyncablePostings(100);
          const results = [];
          for (const p of postings) {
            const r = await syncPostingApplicants(p.id);
            results.push(r);
          }
          const summary = {
            postings: results.length,
            fetched: results.reduce((s, r) => s + r.fetched, 0),
            createdCandidates: results.reduce((s, r) => s + r.createdCandidates, 0),
            createdApplications: results.reduce((s, r) => s + r.createdApplications, 0),
            skipped: results.reduce((s, r) => s + r.skipped, 0),
            errors: results.filter((r) => r.error).length,
          };
          return Response.json({ ok: true, summary, results });
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: (e as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
