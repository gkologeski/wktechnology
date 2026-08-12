// Fase 4 — Observabilidade de crons.
// Envolve a execução de um cron com log estruturado (cron_run_logs)
// e dispara um platform_alert_event em caso de falha.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CronRunResult<T> = {
  status: "success" | "error";
  duration_ms: number;
  metrics: Record<string, unknown>;
  result?: T;
  error?: string;
};

export async function runCronWithLogging<T extends Record<string, unknown>>(
  jobName: string,
  fn: () => Promise<T>,
): Promise<CronRunResult<T>> {
  const startedAt = new Date();
  const t0 = Date.now();

  const { data: logRow, error: logErr } = await (supabaseAdmin as any)
    .from("cron_run_logs")
    .insert({ job_name: jobName, started_at: startedAt.toISOString(), status: "running" })
    .select("id")
    .single();

  if (logErr) {
    console.warn(`[cron:${jobName}] failed to open run log`, logErr.message);
  }
  const logId: string | undefined = logRow?.id;

  try {
    const result = await fn();
    const durationMs = Date.now() - t0;

    if (logId) {
      await (supabaseAdmin as any)
        .from("cron_run_logs")
        .update({
          finished_at: new Date().toISOString(),
          duration_ms: durationMs,
          status: "success",
          metrics: result,
        })
        .eq("id", logId);
    }
    console.log(`[cron:${jobName}] success`, { duration_ms: durationMs, ...result });
    return { status: "success", duration_ms: durationMs, metrics: result, result };
  } catch (e) {
    const durationMs = Date.now() - t0;
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[cron:${jobName}] error`, { duration_ms: durationMs, error: message });

    if (logId) {
      await (supabaseAdmin as any)
        .from("cron_run_logs")
        .update({
          finished_at: new Date().toISOString(),
          duration_ms: durationMs,
          status: "error",
          error: message,
        })
        .eq("id", logId);
    }

    // Dispara alerta na plataforma (visível apenas para platform admins).
    try {
      await (supabaseAdmin as any).from("platform_alert_events").insert({
        severity: "error",
        message: `Cron "${jobName}" falhou: ${message}`,
        context: { job_name: jobName, duration_ms: durationMs, error: message },
      });
    } catch (alertErr) {
      console.warn(`[cron:${jobName}] failed to emit platform alert`, alertErr);
    }

    return { status: "error", duration_ms: durationMs, metrics: {}, error: message };
  }
}

/**
 * Registra em cron_run_logs uma tentativa de execução recusada por credencial
 * inválida (401). Sem isso, um job agendado com segredo errado falha
 * silenciosamente: o agendador marca "succeeded" e a aplicação nunca roda.
 */
export async function logCronRejection(jobName: string, reason = "Unauthorized (401)") {
  try {
    const now = new Date().toISOString();
    await (supabaseAdmin as any).from("cron_run_logs").insert({
      job_name: jobName,
      started_at: now,
      finished_at: now,
      duration_ms: 0,
      status: "error",
      error: reason,
    });
  } catch (e) {
    console.warn(`[cron:${jobName}] failed to log rejection`, e);
  }
}
