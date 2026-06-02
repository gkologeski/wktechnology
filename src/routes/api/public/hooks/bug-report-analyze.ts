// Webhook called by the Postgres AFTER INSERT trigger on bug_reports.
// Runs the AI analysis with service-role privileges. Auth: Bearer CRON_SECRET.
import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { analyzeBugReportById } from "@/lib/bug-report-analysis.server";

const Body = z.object({ bug_report_id: z.string().uuid() });

export const Route = createFileRoute("/api/public/hooks/bug-report-analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
        }
        const parsed = Body.safeParse(payload);
        if (!parsed.success) {
          return Response.json({ ok: false, error: "Invalid body" }, { status: 400 });
        }
        try {
          const row = await analyzeBugReportById(parsed.data.bug_report_id);
          return Response.json({ ok: true, analysis_id: (row as { id?: string })?.id });
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "erro" },
            { status: 500 },
          );
        }
      },
      GET: async () =>
        Response.json({ ok: true, info: "POST { bug_report_id } with Bearer CRON_SECRET" }),
    },
  },
});
