// Importação contínua: autorização por provedor (mesmas chaves dos importadores), leitura/gravação
// da agenda com o cliente do usuário (RLS: admin ativo) e execução automática pelo agendador.
import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";
import { AUTO_PROVIDERS, nextRunAt, type ImportFrequency, type ImportProvider } from "./schedule";

export type ScheduleCtx = { workspaceId: string; userId: string };

export async function authorizeImportSchedule(
  supabase: SupabaseClient,
  userId: string,
  provider: ImportProvider,
  write: boolean,
): Promise<ScheduleCtx> {
  // Mesma chave do importador (deny prevalece, membro ativo); cada provedor reconfere abaixo.
  await workRpc(supabase, "work_area_authorize", {
    r: `techprojects.${provider}_import`,
    a: write ? "manage" : "view",
    i: null,
  });
  if (provider === "clockify") {
    const s = await import("@/lib/integrations/clockify/clockify-service.server");
    return s.requireClockifyAdmin(supabase, userId, { write });
  }
  if (provider === "jibble") {
    const s = await import("@/lib/integrations/jibble/jibble-service.server");
    return s.requireJibbleAdmin(supabase, userId, { write });
  }
  const { resolveActiveWorkspace } = await import("@/lib/active-workspace.server");
  const workspaceId = await resolveActiveWorkspace(userId);
  const { assertClickUpImport } = await import("@/lib/integrations/clickup/clickup-import.server");
  await assertClickUpImport(supabase, workspaceId, userId, write ? "manage" : "view");
  return { workspaceId, userId };
}

const COLS =
  "provider, enabled, frequency, run_hour, run_weekday, time_zone, mode, next_run_at, last_run_at, last_status, last_error";

export async function getSchedule(
  supabase: SupabaseClient,
  ctx: ScheduleCtx,
  provider: ImportProvider,
) {
  const { data, error } = await supabase
    .from("import_connector_schedules")
    .select(COLS)
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", provider)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return { schedule: data, autoAvailable: AUTO_PROVIDERS.includes(provider) };
}

export async function saveSchedule(
  supabase: SupabaseClient,
  ctx: ScheduleCtx,
  input: {
    provider: ImportProvider;
    enabled: boolean;
    frequency: ImportFrequency;
    runHour: number;
    runWeekday: number;
    mode: "preview" | "auto_import";
  },
) {
  if (input.enabled && !AUTO_PROVIDERS.includes(input.provider))
    throw new Error("A importação contínua do ClickUp ainda não está disponível.");
  const timeZone = "America/Sao_Paulo";
  const next = input.enabled
    ? nextRunAt(
        {
          frequency: input.frequency,
          runHour: input.runHour,
          runWeekday: input.runWeekday,
          timeZone,
        },
        new Date(),
      )
    : null;
  const { error } = await supabase.from("import_connector_schedules").upsert(
    {
      workspace_id: ctx.workspaceId,
      provider: input.provider,
      enabled: input.enabled,
      frequency: input.frequency,
      run_hour: input.runHour,
      run_weekday: input.runWeekday,
      time_zone: timeZone,
      mode: input.mode,
      next_run_at: next?.toISOString() ?? null,
      owner_user_id: ctx.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,provider" },
  );
  if (error) throw new Error(error.message);
  return { ok: true, nextRunAt: next?.toISOString() ?? null };
}

type Row = {
  id: string;
  workspace_id: string;
  provider: ImportProvider;
  frequency: ImportFrequency;
  run_hour: number;
  run_weekday: number;
  time_zone: string;
  mode: "preview" | "auto_import";
  owner_user_id: string;
  last_run_id: string | null;
};

/** Chamado pelo agendador (CRON_SECRET). Nunca inicia nada para dono inativo ou sem permissão. */
export async function processDueSchedules(limit = 5) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const now = new Date();
  const { data } = await db
    .from("import_connector_schedules")
    .select(
      "id, workspace_id, provider, frequency, run_hour, run_weekday, time_zone, mode, owner_user_id, last_run_id",
    )
    .eq("enabled", true)
    .lte("next_run_at", now.toISOString())
    .limit(limit);
  let started = 0;
  for (const r of (data ?? []) as Row[]) {
    const next = nextRunAt(
      {
        frequency: r.frequency,
        runHour: r.run_hour,
        runWeekday: r.run_weekday,
        timeZone: r.time_zone,
      },
      now,
    ).toISOString();
    // Reserva a vez antes de executar: outra chamada concorrente não pega a mesma agenda.
    const { data: claimed } = await db
      .from("import_connector_schedules")
      .update({ next_run_at: next, last_run_at: now.toISOString() })
      .eq("id", r.id)
      .lte("next_run_at", now.toISOString())
      .select("id")
      .maybeSingle();
    if (!claimed) continue;
    try {
      const allowed = await workRpc<boolean>(db as never, "work_import_delegate_allowed", {
        p_ws: r.workspace_id,
        p_actor: r.owner_user_id,
        p_provider: r.provider,
      });
      if (!allowed)
        throw new Error("Quem ativou a agenda perdeu a permissão. A agenda foi pausada.");
      const ctx = { workspaceId: r.workspace_id, userId: r.owner_user_id };
      const runId =
        r.provider === "clockify"
          ? (
              await (
                await import("@/lib/integrations/clockify/clockify-service.server")
              ).startClockifyRun(ctx, { kind: "dry_run" })
            ).runId
          : (
              await (
                await import("@/lib/integrations/jibble/jibble-service.server")
              ).startJibbleRun(ctx, { kind: "dry_run" })
            ).runId;
      await db
        .from("import_connector_schedules")
        .update({ last_status: "preview_started", last_error: null, last_run_id: runId })
        .eq("id", r.id);
      started++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db
        .from("import_connector_schedules")
        .update({
          last_status: "failed",
          last_error: msg.slice(0, 500),
          ...(/permissão/i.test(msg) ? { enabled: false } : {}),
        })
        .eq("id", r.id);
    }
  }
  started += await promoteCompletedPreviews();
  return { due: data?.length ?? 0, started };
}

/** Modo "importar automaticamente": prévia concluída vira importação em nome de quem ativou. */
async function promoteCompletedPreviews() {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data } = await db
    .from("import_connector_schedules")
    .select("id, workspace_id, provider, owner_user_id, last_run_id")
    .eq("enabled", true)
    .eq("mode", "auto_import")
    .eq("last_status", "preview_started")
    .not("last_run_id", "is", null)
    .limit(5);
  let n = 0;
  for (const r of (data ?? []) as Row[]) {
    const table = r.provider === "clockify" ? "clockify_import_runs" : "time_import_runs";
    const { data: run } = await db
      .from(table)
      .select("status")
      .eq("id", r.last_run_id as string)
      .maybeSingle();
    const st = (run as { status?: string } | null)?.status;
    if (!st || ["queued", "running", "cancel_requested", "paused"].includes(st)) continue;
    if (st !== "completed") {
      await db
        .from("import_connector_schedules")
        .update({ last_status: "failed", last_error: `Prévia terminou como ${st}.` })
        .eq("id", r.id);
      continue;
    }
    const ctx = { workspaceId: r.workspace_id, userId: r.owner_user_id };
    try {
      let importId: string;
      if (r.provider === "clockify") {
        const s = await import("@/lib/integrations/clockify/clockify-service.server");
        await s.confirmClockifyPreview(ctx, r.last_run_id as string);
        importId = (
          await s.startClockifyRun(ctx, { kind: "import", previewRunId: r.last_run_id as string })
        ).runId;
      } else {
        const s = await import("@/lib/integrations/jibble/jibble-service.server");
        await s.confirmJibblePreview(ctx, r.last_run_id as string);
        importId = (
          await s.startJibbleRun(ctx, { kind: "import", previewRunId: r.last_run_id as string })
        ).runId;
      }
      await db
        .from("import_connector_schedules")
        .update({ last_status: "import_started", last_run_id: importId })
        .eq("id", r.id);
      n++;
    } catch (e) {
      await db
        .from("import_connector_schedules")
        .update({
          last_status: "failed",
          last_error: (e instanceof Error ? e.message : String(e)).slice(0, 500),
        })
        .eq("id", r.id);
    }
  }
  return n;
}
