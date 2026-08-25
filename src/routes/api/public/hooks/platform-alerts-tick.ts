// Avalia regras de platform_alert_rules e grava eventos em platform_alert_events.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { runCronWithLogging } from "@/lib/cron-observability.server";
import { dispatchAlert } from "@/lib/alert-dispatch.server";

export const Route = createFileRoute("/api/public/hooks/platform-alerts-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;

        const run = await runCronWithLogging("platform-alerts-tick", async () => {
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
          );

          const { data: rules } = await supabase
            .from("platform_alert_rules")
            .select(
              "id, name, rule_type, threshold_pct, threshold_mins, target_key, channels, enabled",
            )
            .eq("enabled", true);
          const rulesById = new Map<string, any>((rules ?? []).map((r: any) => [r.id, r]));

          const fired: Array<{
            rule_id: string;
            severity: string;
            message: string;
            context: unknown;
          }> = [];

          // Cron status one-shot
          const cronRes = await supabase.rpc("platform_cron_status" as never);
          const crons = (cronRes.data ?? []) as Array<{
            jobname: string;
            schedule: string;
            last_start: string | null;
            last_end: string | null;
            status: string | null;
            duration_ms: number | null;
          }>;
          const now = Date.now();

          const sinceIso = new Date(now - 60 * 60_000).toISOString();

          for (const r of rules ?? []) {
            try {
              if (r.rule_type === "cron_late") {
                const threshold = r.threshold_mins ?? 15;
                const jobs = r.target_key ? crons.filter((c) => c.jobname === r.target_key) : crons;
                for (const c of jobs) {
                  const lateMin = c.last_start
                    ? Math.round((now - new Date(c.last_start).getTime()) / 60000)
                    : 9999;
                  if (lateMin >= threshold) {
                    fired.push({
                      rule_id: r.id as string,
                      severity: lateMin > threshold * 4 ? "critical" : "warning",
                      message: `Cron "${c.jobname}" atrasado ${lateMin}min (limite ${threshold}min)`,
                      context: { job: c.jobname, late_minutes: lateMin, last_start: c.last_start },
                    });
                  }
                }
              } else if (r.rule_type === "broadcast_failure") {
                const pct = r.threshold_pct ?? 20;
                const { data: rec } = await supabase
                  .from("email_broadcast_recipients")
                  .select("status")
                  .gte("updated_at", sinceIso)
                  .limit(5000);
                const total = rec?.length ?? 0;
                const failed = (rec ?? []).filter(
                  (x: any) => x.status === "failed" || x.status === "bounced",
                ).length;
                const rate = total ? (failed / total) * 100 : 0;
                if (total >= 20 && rate >= pct) {
                  fired.push({
                    rule_id: r.id as string,
                    severity: rate >= pct * 2 ? "critical" : "warning",
                    message: `Falhas em broadcast: ${rate.toFixed(1)}% (limite ${pct}%) na última hora`,
                    context: { total, failed, rate },
                  });
                }
              } else if (r.rule_type === "twilio_errors") {
                const pct = r.threshold_pct ?? 10;
                const { data: calls } = await supabase
                  .from("prospecting_call_attempts")
                  .select("status")
                  .gte("created_at", sinceIso)
                  .limit(5000);
                const total = calls?.length ?? 0;
                const failed = (calls ?? []).filter(
                  (x: any) =>
                    x.status === "failed" || x.status === "no-answer" || x.status === "busy",
                ).length;
                const rate = total ? (failed / total) * 100 : 0;
                if (total >= 10 && rate >= pct) {
                  fired.push({
                    rule_id: r.id as string,
                    severity: rate >= pct * 2 ? "critical" : "warning",
                    message: `Erros Twilio: ${rate.toFixed(1)}% (limite ${pct}%) na última hora`,
                    context: { total, failed, rate },
                  });
                }
              }
            } catch (err) {
              console.error("[platform-alerts-tick] rule error", r.id, err);
            }
          }

          // Dedup: não dispara se já tem evento aberto na última hora para a mesma regra+mensagem
          let inserted = 0;
          let dispatchedSlack = 0;
          let dispatchedEmail = 0;
          const dispatchErrors: string[] = [];
          for (const ev of fired) {
            const { data: existing } = await supabase
              .from("platform_alert_events")
              .select("id")
              .eq("rule_id", ev.rule_id)
              .eq("message", ev.message)
              .gte("fired_at", sinceIso)
              .maybeSingle();
            if (existing) continue;
            await (supabase.from("platform_alert_events") as any).insert({
              rule_id: ev.rule_id,
              severity: ev.severity,
              message: ev.message,
              context: ev.context,
            });
            inserted++;

            const rule = rulesById.get(ev.rule_id);
            const channels = Array.isArray(rule?.channels) ? rule.channels : [];
            if (channels.length) {
              const dp = await dispatchAlert(supabase, {
                ruleId: ev.rule_id,
                ruleName: rule?.name ?? "Alerta",
                severity: ev.severity,
                message: ev.message,
                context: ev.context,
                channels,
              });
              dispatchedSlack += dp.slack;
              dispatchedEmail += dp.email;
              if (dp.errors.length) dispatchErrors.push(...dp.errors);
            }
          }

          return {
            evaluated: rules?.length ?? 0,
            fired: fired.length,
            inserted,
            dispatched_slack: dispatchedSlack,
            dispatched_email: dispatchedEmail,
            dispatch_errors: dispatchErrors.length,
          } as unknown as Record<string, unknown>;
        });
        if (run.status === "error")
          return Response.json({ ok: false, error: run.error }, { status: 500 });
        return Response.json({ ok: true, duration_ms: run.duration_ms, ...run.metrics });
      },
    },
  },
});
