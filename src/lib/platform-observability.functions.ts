// Release 21 — Observabilidade & Admin (super-admin only)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getSupabaseAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertPlatformAdmin(userId: string) {
  const supabaseAdmin = await getSupabaseAdmin();
  const { data } = await supabaseAdmin
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("Acesso negado: apenas super-admins.");
}

// ============== STATUS DASHBOARD ==============
export const getPlatformStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();

    // Cron status via RPC
    const cronRes = await supabaseAdmin.rpc("platform_cron_status" as never);
    if (cronRes.error) {
      throw new Error(`Falha ao carregar status dos crons: ${cronRes.error.message}`);
    }
    const crons = (cronRes.data ?? []) as Array<{
      jobname: string;
      schedule: string;
      last_start: string | null;
      last_end: string | null;
      status: string | null;
      duration_ms: number | null;
    }>;
    const now = Date.now();

    // Saúde real do endpoint da aplicação: o agendador pode marcar "succeeded"
    // mesmo quando a chamada HTTP é recusada (401). Cruzamos com cron_run_logs.
    const since = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const { data: appRuns } = await (supabaseAdmin as any)
      .from("cron_run_logs")
      .select("job_name, started_at, status, error")
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(500);

    const norm = (n: string) => n.replace(/-tick$/, "");
    const appByJob = new Map<
      string,
      { started_at: string; status: string; error: string | null }
    >();
    for (const r of (appRuns ?? []) as Array<{
      job_name: string;
      started_at: string;
      status: string;
      error: string | null;
    }>) {
      const key = norm(r.job_name);
      if (!appByJob.has(key)) appByJob.set(key, r);
    }

    const cronJobs = crons.map((c) => {
      const lastStartMs = c.last_start ? new Date(c.last_start).getTime() : 0;
      const lateMin = lastStartMs ? Math.round((now - lastStartMs) / 60000) : null;
      const app = appByJob.get(norm(c.jobname));
      // Agendador rodou nas últimas 2h, mas a aplicação não registrou execução:
      // sinal de chamada recusada (credencial) ou endpoint indisponível.
      const schedulerRecent = lastStartMs > 0 && now - lastStartMs < 2 * 60 * 60 * 1000;
      const appRecent = app ? now - new Date(app.started_at).getTime() < 2 * 60 * 60 * 1000 : false;
      return {
        ...c,
        late_minutes: lateMin,
        app_last_run: app?.started_at ?? null,
        app_last_status: app?.status ?? null,
        app_last_error: app?.error ?? null,
        endpoint_unhealthy: Boolean(
          (schedulerRecent && app && !appRecent) || (app && app.status === "error" && appRecent),
        ),
      };
    });

    // Integrações: contagens simples
    const [emailAcc, waba, twilio, twoFa] = await Promise.all([
      supabaseAdmin.from("email_accounts").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("wa_business_accounts").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("integrations")
        .select("id", { count: "exact", head: true })
        .eq("provider", "twilio"),
      supabaseAdmin.from("workspaces").select("id", { count: "exact", head: true }),
    ]);

    // Eventos recentes de alerta
    const { data: recentEvents } = await supabaseAdmin
      .from("platform_alert_events")
      .select("id, fired_at, severity, message")
      .order("fired_at", { ascending: false })
      .limit(10);

    // Últimas execuções dos crons observáveis (cron_run_logs)
    const { data: recentCronRuns } = await (supabaseAdmin as any)
      .from("cron_run_logs")
      .select("id, job_name, started_at, finished_at, duration_ms, status, metrics, error")
      .order("started_at", { ascending: false })
      .limit(20);

    return {
      cronJobs,
      integrations: {
        gmail_accounts: emailAcc.count ?? 0,
        whatsapp_accounts: waba.count ?? 0,
        twilio_integrations: twilio.count ?? 0,
        workspaces: twoFa.count ?? 0,
      },
      recentEvents: recentEvents ?? [],
      recentCronRuns: (recentCronRuns ?? []).map((r: any) => ({
        id: String(r.id),
        job_name: String(r.job_name),
        started_at: String(r.started_at),
        finished_at: r.finished_at ? String(r.finished_at) : null,
        duration_ms: r.duration_ms == null ? null : Number(r.duration_ms),
        status: String(r.status) as "running" | "success" | "error",
        metrics: JSON.stringify(r.metrics ?? {}),
        error: r.error ? String(r.error) : null,
      })),
      checkedAt: new Date().toISOString(),
    };
  });

// ============== ALERT RULES ==============
const AlertRuleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  rule_type: z.enum(["cron_late", "broadcast_failure", "twilio_errors", "custom"]),
  threshold_pct: z.number().min(0).max(100).optional().nullable(),
  threshold_mins: z.number().int().min(0).max(1440).optional().nullable(),
  target_key: z.string().max(120).optional().nullable(),
  channels: z
    .array(
      z.object({
        type: z.enum(["email", "slack"]),
        value: z.string().min(1).max(255),
      }),
    )
    .default([]),
  enabled: z.boolean().default(true),
});

export const listAlertRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    const { data } = await supabaseAdmin
      .from("platform_alert_rules")
      .select("*")
      .order("created_at", { ascending: false });
    return { items: data ?? [] };
  });

export const upsertAlertRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => AlertRuleSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    const payload = {
      name: data.name,
      description: data.description ?? null,
      rule_type: data.rule_type,
      threshold_pct: data.threshold_pct ?? null,
      threshold_mins: data.threshold_mins ?? null,
      target_key: data.target_key ?? null,
      channels: data.channels,
      enabled: data.enabled,
    };
    if (data.id) {
      const { error } = await (supabaseAdmin.from("platform_alert_rules") as any)
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    }
    const { data: ins, error } = await (supabaseAdmin.from("platform_alert_rules") as any)
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, id: ins?.id };
  });

export const deleteAlertRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    await supabaseAdmin.from("platform_alert_rules").delete().eq("id", data.id);
    return { ok: true };
  });

export const listAlertEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    const { data } = await supabaseAdmin
      .from("platform_alert_events")
      .select("id, rule_id, fired_at, severity, message, context, resolved_at")
      .order("fired_at", { ascending: false })
      .limit(100);
    return { items: data ?? [] };
  });

// ============== QUOTAS ==============
export const listWorkspaceQuotas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    const { data: workspaces } = await supabaseAdmin
      .from("workspaces")
      .select("id, name, slug")
      .order("name");
    const ids = (workspaces ?? []).map((w) => w.id as string);
    if (!ids.length) return { items: [] };

    const [subs, counters] = await Promise.all([
      supabaseAdmin
        .from("workspace_subscriptions")
        .select("workspace_owner_id, plan_code")
        .in("workspace_owner_id", ids),
      supabaseAdmin
        .from("usage_counters")
        .select("workspace_owner_id, key, used")
        .in("workspace_owner_id", ids),
    ]);

    const planMap = new Map<string, string>();
    for (const s of subs.data ?? [])
      planMap.set(s.workspace_owner_id as string, s.plan_code as string);

    const counterMap = new Map<string, Record<string, number>>();
    for (const c of (counters.data ?? []) as Array<{
      workspace_owner_id: string;
      key: string;
      used: number;
    }>) {
      const k = c.workspace_owner_id;
      const m = counterMap.get(k) ?? {};
      m[c.key] = (m[c.key] ?? 0) + Number(c.used ?? 0);
      counterMap.set(k, m);
    }

    return {
      items: (workspaces ?? []).map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        plan: planMap.get(w.id as string) ?? "free",
        usage: counterMap.get(w.id as string) ?? {},
      })),
    };
  });

// ============== SANDBOX ==============
const SandboxCreateSchema = z.object({
  source_workspace_id: z.string().uuid(),
  name: z.string().min(2).max(120),
});

export const listSandboxes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    const { data } = await supabaseAdmin
      .from("platform_sandboxes")
      .select(
        "id, source_workspace_id, sandbox_workspace_id, name, status, last_synced_at, promoted_at, created_at",
      )
      .order("created_at", { ascending: false });
    return { items: data ?? [] };
  });

export const createSandbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => SandboxCreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();

    // Cria um workspace sandbox espelho (somente metadados; clonar dados é tarefa futura).
    const slug = `sandbox-${data.source_workspace_id.slice(0, 6)}-${Date.now().toString(36)}`;
    const { data: ws, error } = await (supabaseAdmin.from("workspaces") as any)
      .insert({
        name: `${data.name} (Sandbox)`,
        slug,
        status: "active",
        created_by: context.userId,
      })
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);

    const { error: sbErr } = await (supabaseAdmin.from("platform_sandboxes") as any).insert({
      source_workspace_id: data.source_workspace_id,
      sandbox_workspace_id: ws!.id,
      name: data.name,
      status: "active",
      created_by: context.userId,
      last_synced_at: new Date().toISOString(),
    });
    if (sbErr) throw new Error(sbErr.message);

    return { ok: true, sandbox_workspace_id: ws!.id };
  });

export const promoteSandbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    const { error } = await (supabaseAdmin.from("platform_sandboxes") as any)
      .update({ status: "promoted", promoted_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const archiveSandbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context.userId);
    const supabaseAdmin = await getSupabaseAdmin();
    await (supabaseAdmin.from("platform_sandboxes") as any)
      .update({ status: "archived" })
      .eq("id", data.id);
    return { ok: true };
  });
