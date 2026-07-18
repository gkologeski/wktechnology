import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { runCronWithLogging } from "@/lib/cron-observability.server";

export const Route = createFileRoute("/api/public/hooks/sla-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;
        const baseUrl = new URL(request.url).origin;

        const run = await runCronWithLogging("sla-tick", async () => {
          const now = new Date().toISOString();

          const { data: fr, error: e1 } = await supabaseAdmin
            .from("tickets")
            .update({ sla_first_response_breached: true })
            .lt("sla_first_response_due_at", now)
            .is("sla_first_response_at", null)
            .eq("sla_first_response_breached", false)
            .is("deleted_at", null)
            .select("id, subject, owner_id, assignee_id");
          if (e1) throw e1;

          const { data: rs, error: e2 } = await supabaseAdmin
            .from("tickets")
            .update({ sla_resolution_breached: true })
            .lt("sla_resolution_due_at", now)
            .is("resolved_at", null)
            .eq("sla_resolution_breached", false)
            .is("deleted_at", null)
            .select("id, subject, owner_id, assignee_id");
          if (e2) throw e2;

          const notifs: Array<{
            owner_id: string;
            user_id: string;
            type: string;
            title: string;
            body: string;
            link: string;
            entity: string;
            entity_id: string;
          }> = [];
          for (const t of fr ?? []) {
            if (!t.assignee_id) continue;
            notifs.push({
              owner_id: t.owner_id,
              user_id: t.assignee_id,
              type: "sla.first_response_breach",
              title: "SLA de 1ª resposta violado",
              body: t.subject,
              link: `/tickets/${t.id}`,
              entity: "ticket",
              entity_id: t.id,
            });
          }
          for (const t of rs ?? []) {
            if (!t.assignee_id) continue;
            notifs.push({
              owner_id: t.owner_id,
              user_id: t.assignee_id,
              type: "sla.resolution_breach",
              title: "SLA de resolução violado",
              body: t.subject,
              link: `/tickets/${t.id}`,
              entity: "ticket",
              entity_id: t.id,
            });
          }
          if (notifs.length) {
            await supabaseAdmin.from("notifications").insert(notifs);
          }

          const soon = new Date(Date.now() + 30 * 60_000).toISOString();
          const { data: risk } = await supabaseAdmin
            .from("tickets")
            .select("id, subject, owner_id, assignee_id, sla_first_response_due_at")
            .lt("sla_first_response_due_at", soon)
            .gt("sla_first_response_due_at", now)
            .is("sla_first_response_at", null)
            .eq("sla_first_response_breached", false)
            .is("deleted_at", null)
            .not("assignee_id", "is", null);
          let riskNotifsCount = 0;
          if (risk && risk.length) {
            const ids = risk.map((t) => t.id);
            const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
            const { data: existing } = await supabaseAdmin
              .from("notifications")
              .select("entity_id")
              .in("entity_id", ids)
              .eq("type", "sla.at_risk")
              .gt("created_at", cutoff);
            const sentSet = new Set((existing ?? []).map((n) => n.entity_id));
            const riskNotifs = risk
              .filter((t) => !sentSet.has(t.id))
              .map((t) => ({
                owner_id: t.owner_id,
                user_id: t.assignee_id!,
                type: "sla.at_risk",
                title: "SLA prestes a violar",
                body: t.subject,
                link: `/tickets/${t.id}`,
                entity: "ticket",
                entity_id: t.id,
              }));
            if (riskNotifs.length) {
              await supabaseAdmin.from("notifications").insert(riskNotifs);
              riskNotifsCount = riskNotifs.length;
            }
          }

          return {
            first_response_breaches: fr?.length ?? 0,
            resolution_breaches: rs?.length ?? 0,
            notifications: notifs.length,
            at_risk_checked: risk?.length ?? 0,
            at_risk_notifications: riskNotifsCount,
          };
        });

        if (run.status === "error") {
          return Response.json({ ok: false, error: run.error }, { status: 500 });
        }
        return Response.json({
          ok: true,
          duration_ms: run.duration_ms,
          base_url: baseUrl,
          ...run.metrics,
        });
      },
      GET: async () => Response.json({ ok: true, info: "POST with Bearer CRON_SECRET" }),
    },
  },
});
