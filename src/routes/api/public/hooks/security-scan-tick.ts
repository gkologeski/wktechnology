// Recurring security scan. Runs daily at 03:00 UTC via pg_cron.
// Combines four checks: RLS coverage, anon grants, SECURITY DEFINER search_path,
// and presence of required webhook/cron secrets. Persists results to
// security_scan_runs / security_scan_findings and notifies platform admins.
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { requireCronAuth } from "@/lib/cron-auth.server";
import { runCronWithLogging } from "@/lib/cron-observability.server";

type Severity = "info" | "warning" | "error" | "critical";

interface Finding {
  scanner: string;
  severity: Severity;
  category: string;
  code: string;
  title: string;
  detail?: string;
  ref?: Record<string, unknown>;
  fingerprint: string;
}

const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
};

// Secrets that MUST exist in production for webhooks to be properly verified.
const REQUIRED_SECRETS: Array<{ name: string; reason: string; severity: Severity }> = [
  {
    name: "CRON_SECRET",
    reason: "Autoriza chamadas /api/public/hooks/* a partir do pg_cron.",
    severity: "critical",
  },
  {
    name: "TWILIO_AUTH_TOKEN",
    reason: "Valida assinatura HMAC dos webhooks Twilio (voz/WhatsApp).",
    severity: "error",
  },
  {
    name: "META_WHATSAPP_APP_SECRET",
    reason: "Valida assinatura dos webhooks Meta/WhatsApp.",
    severity: "error",
  },
  {
    name: "STRIPE_WEBHOOK_SECRET",
    reason: "Valida eventos do Stripe (pagamentos).",
    severity: "warning",
  },
];

export const Route = createFileRoute("/api/public/hooks/security-scan-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauth = requireCronAuth(request);
        if (unauth) return unauth;

        const run = await runCronWithLogging("security-scan-tick", async () => {
          const supabase = createClient(
            process.env.SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            { auth: { persistSession: false, autoRefreshToken: false } },
          );

          const t0 = Date.now();
          const { data: runRow, error: runErr } = await supabase
            .from("security_scan_runs")
            .insert({ status: "running" })
            .select("id")
            .single();
          if (runErr || !runRow) {
            throw new Error(runErr?.message ?? "run insert failed");
          }
          const runId = runRow.id as string;

          try {
            const { data: dbFindings, error: collectErr } = await supabase.rpc(
              "security_scan_collect" as never,
            );
            if (collectErr) throw collectErr;

            const findings: Finding[] = Array.isArray(dbFindings) ? (dbFindings as Finding[]) : [];

            for (const s of REQUIRED_SECRETS) {
              const val = process.env[s.name];
              if (!val || val.length < 8) {
                findings.push({
                  scanner: "secrets",
                  severity: s.severity,
                  category: "Segredo ausente",
                  code: "secret_missing",
                  title: `${s.name} não configurado ou muito curto`,
                  detail: s.reason,
                  ref: { secret: s.name },
                  fingerprint: `secret_missing:${s.name}`,
                });
              }
            }

            if (findings.length > 0) {
              const rows = findings.map((f) => ({ ...f, run_id: runId }));
              const { error: insErr } = await (
                supabase.from("security_scan_findings") as any
              ).insert(rows);
              if (insErr) throw insErr;
            }

            const totals: Record<string, number> = {
              info: 0,
              warning: 0,
              error: 0,
              critical: 0,
              total: findings.length,
            };
            let worst: Severity = "info";
            for (const f of findings) {
              totals[f.severity] = (totals[f.severity] ?? 0) + 1;
              if (SEVERITY_RANK[f.severity] > SEVERITY_RANK[worst]) worst = f.severity;
            }

            const duration = Date.now() - t0;
            await supabase
              .from("security_scan_runs")
              .update({
                status: "success",
                finished_at: new Date().toISOString(),
                totals,
                duration_ms: duration,
              })
              .eq("id", runId);

            if (SEVERITY_RANK[worst] >= SEVERITY_RANK.warning) {
              const { data: admins } = await supabase.from("platform_admins").select("user_id");
              const adminIds = (admins ?? []).map((a: any) => a.user_id as string);
              if (adminIds.length > 0) {
                const title = `Varredura de segurança: ${totals.total} achado(s)`;
                const body = `Críticos: ${totals.critical} · Erros: ${totals.error} · Avisos: ${totals.warning}`;
                const notifs = adminIds.map((uid) => ({
                  owner_id: uid,
                  user_id: uid,
                  type: "security_scan",
                  title,
                  body,
                  link: "/admin/security-scans",
                  entity: "security_scan_run",
                  entity_id: runId,
                }));
                await (supabase.from("notifications") as any).insert(notifs);
              }
            }

            return { run_id: runId, totals, duration_ms: duration } as unknown as Record<
              string,
              unknown
            >;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await supabase
              .from("security_scan_runs")
              .update({
                status: "failed",
                finished_at: new Date().toISOString(),
                error: msg,
                duration_ms: Date.now() - t0,
              })
              .eq("id", runId);
            throw err;
          }
        });
        if (run.status === "error")
          return Response.json({ ok: false, error: run.error }, { status: 500 });
        return Response.json({ ok: true, duration_ms: run.duration_ms, ...run.metrics });
      },
    },
  },
});
