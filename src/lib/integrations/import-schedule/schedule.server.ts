// Importação contínua: autorização por provedor (mesmas chaves dos importadores), leitura/gravação
// da agenda com o cliente do usuário (RLS: admin ativo) e execução automática pelo agendador.
import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";
import { advanceClickUpSchedule, type ClickUpJobState } from "./clickup-schedule.server";
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
  "provider, enabled, frequency, run_hour, run_weekday, time_zone, mode, next_run_at, last_run_at, last_status, last_error, job_state";

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
  job_state?: ClickUpJobState | null;
};

async function ownerAllowed(db: SupabaseClient, r: Row): Promise<boolean> {
  if (r.provider !== "clickup")
    return workRpc<boolean>(db, "work_import_delegate_allowed", {
      p_ws: r.workspace_id,
      p_actor: r.owner_user_id,
      p_provider: r.provider,
    });
  const [adm, acc] = await Promise.all([
    db.rpc("is_active_workspace_admin", { _workspace: r.workspace_id, _user: r.owner_user_id }),
    db.rpc(
      "clickup_import_access" as never,
      {
        p_ws: r.workspace_id,
        p_user: r.owner_user_id,
        p_action: "manage",
      } as never,
    ),
  ]);
  return adm.data === true && acc.data === true;
}

/** Inicia uma execução (agenda vencida ou "Executar agora") em nome do dono da agenda. */
async function startScheduledRun(db: SupabaseClient, r: Row) {
  if (!(await ownerAllowed(db, r)))
    throw new Error("Quem ativou a agenda perdeu a permissão. A agenda foi pausada.");
  if (r.provider === "clickup") {
    if (r.job_state?.runId) return; // ainda processando a execução anterior
    await stepClickUp(db, r, null);
    return;
  }
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
}

async function stepClickUp(db: SupabaseClient, r: Row, state: ClickUpJobState | null) {
  const res = await advanceClickUpSchedule(
    { admin: db, workspaceId: r.workspace_id, actor: r.owner_user_id, mode: r.mode },
    state,
  );
  if (res.status === "running")
    await db
      .from("import_connector_schedules")
      .update({
        last_status: "running",
        last_error: null,
        last_run_id: res.state.runId,
        job_state: res.state as never,
      })
      .eq("id", r.id);
  else
    await db
      .from("import_connector_schedules")
      .update({
        last_status: res.status,
        last_error: null,
        job_state: { heldLists: res.heldLists } as never,
      })
      .eq("id", r.id);
}

/** Continua as execuções do ClickUp em andamento (uma etapa curta por chamada). */
async function continueClickUpJobs(db: SupabaseClient) {
  const { data } = await db
    .from("import_connector_schedules")
    .select(
      "id, workspace_id, provider, mode, owner_user_id, job_state, frequency, run_hour, run_weekday, time_zone, last_run_id",
    )
    .eq("enabled", true)
    .eq("provider", "clickup")
    .eq("last_status", "running")
    .limit(2);
  let n = 0;
  for (const r of (data ?? []) as Row[]) {
    try {
      if (!(await ownerAllowed(db, r)))
        throw new Error("Quem ativou a agenda perdeu a permissão. A agenda foi pausada.");
      await stepClickUp(db, r, r.job_state ?? null);
      n++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await db
        .from("import_connector_schedules")
        .update({
          last_status: "failed",
          last_error: msg.slice(0, 500),
          job_state: null,
          ...(/permissão/i.test(msg) ? { enabled: false } : {}),
        })
        .eq("id", r.id);
    }
  }
  return n;
}

/** "Executar agora": quem tem acesso de gestão dispara a execução da agenda ligada. */
export async function runScheduleNow(ctx: ScheduleCtx, provider: ImportProvider) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as unknown as SupabaseClient;
  const { data } = await db
    .from("import_connector_schedules")
    .select(
      "id, workspace_id, provider, mode, owner_user_id, job_state, frequency, run_hour, run_weekday, time_zone, last_run_id, last_status",
    )
    .eq("workspace_id", ctx.workspaceId)
    .eq("provider", provider)
    .maybeSingle();
  const r = data as (Row & { last_status: string | null; enabled?: boolean }) | null;
  if (!r) throw new Error("Salve a agenda antes de executar.");
  if (r.last_status === "running" || r.job_state?.runId)
    throw new Error("Já existe uma execução em andamento.");
  try {
    await startScheduledRun(db, { ...r, job_state: null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db
      .from("import_connector_schedules")
      .update({
        last_status: "failed",
        last_error: msg.slice(0, 500),
        last_run_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    throw e;
  }
  await db
    .from("import_connector_schedules")
    .update({ last_run_at: new Date().toISOString() })
    .eq("id", r.id);
  return { ok: true };
}

/** Chamado pelo agendador (CRON_SECRET). Nunca inicia nada para dono inativo ou sem permissão. */
export async function processDueSchedules(limit = 5) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const now = new Date();
  const { data } = await db
    .from("import_connector_schedules")
    .select(
      "id, workspace_id, provider, frequency, run_hour, run_weekday, time_zone, mode, owner_user_id, last_run_id, job_state",
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
      await startScheduledRun(db as unknown as SupabaseClient, r);
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
  started += await continueClickUpJobs(db as unknown as SupabaseClient);
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
