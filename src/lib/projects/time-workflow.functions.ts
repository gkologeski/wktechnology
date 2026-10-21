// TechProjects Ciclo 3 — cronômetro persistente, envio do período, fila e decisão do aprovador.
// Toda regra (autorização, versão, idempotência, fuso) é revalidada no banco pelas funções
// `project_timer_*`, `project_timesheet_*` e `project_time_*`; aqui só validamos a entrada.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { cleanDbError } from "@/lib/projects/time-entry.shared";
import type {
  PendingApprovals,
  SubmissionPreview,
  TimerState,
  TimesheetOverview,
  TrackableProjects,
} from "@/lib/projects/time-workflow.types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const tz = z.string().min(1).max(64);

/** Projetos liberados para o profissional apontar (membro liberado ou alocação vigente). */
export const getTrackableProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data, error } = await context.supabase.rpc("project_time_trackable_projects", {
      p_ws: ws,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return data as unknown as TrackableProjects;
  });

export const toggleFavoriteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ projectId: z.string().uuid(), favorite: z.boolean() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const q = data.favorite
      ? context.supabase
          .from("project_time_favorites")
          .upsert(
            { workspace_id: ws, user_id: context.userId, project_id: data.projectId },
            { onConflict: "user_id,project_id", ignoreDuplicates: true },
          )
      : context.supabase
          .from("project_time_favorites")
          .delete()
          .eq("user_id", context.userId)
          .eq("project_id", data.projectId);
    const { error } = await q;
    if (error) throw new Error(cleanDbError(error.message));
    return { ok: true };
  });

// ============= cronômetro =============

export const getTimer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data, error } = await context.supabase.rpc("project_timer_get", { p_ws: ws });
    if (error) throw new Error(cleanDbError(error.message));
    return (data ?? null) as unknown as TimerState | null;
  });

export const startTimerSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        taskId: z.string().uuid().nullable().optional(),
        description: z.string().max(1000).nullable().optional(),
        billable: z.boolean().default(true),
        timezone: tz,
        requestId: z.string().min(8).max(80),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: row, error } = await context.supabase.rpc("project_timer_start", {
      p_ws: ws,
      p_project: data.projectId,
      p_task: (data.taskId ?? null) as never,
      p_description: (data.description ?? null) as never,
      p_billable: data.billable,
      p_tz: data.timezone,
      p_request_id: data.requestId,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return row as unknown as TimerState;
  });

const timerAction = z.object({
  sessionId: z.string().uuid(),
  version: z.number().int().positive().nullable(),
  action: z.enum(["pause_paid", "pause_unpaid", "resume", "switch", "stop", "discard"]),
  taskId: z.string().uuid().nullable().optional(),
});

/** Pausa (paga/não paga), retoma, troca atividade, finaliza ou descarta — idempotente por versão. */
export const timerAct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => timerAction.parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const v = (data.version ?? null) as never;
    const res =
      data.action === "pause_paid" || data.action === "pause_unpaid"
        ? await sb.rpc("project_timer_pause", {
            p_session: data.sessionId,
            p_paid: data.action === "pause_paid",
            p_version: v,
          })
        : data.action === "resume"
          ? await sb.rpc("project_timer_resume", { p_session: data.sessionId, p_version: v })
          : data.action === "switch"
            ? await sb.rpc("project_timer_switch", {
                p_session: data.sessionId,
                p_task: (data.taskId ?? null) as never,
                p_version: v,
              })
            : await sb.rpc("project_timer_stop", {
                p_session: data.sessionId,
                p_version: v,
                p_discard: data.action === "discard",
              });
    if (res.error) throw new Error(cleanDbError(res.error.message));
    return res.data as unknown as TimerState;
  });

// ============= envio do período =============

const period = z.object({ from: isoDate, to: isoDate });

export const previewSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => period.parse(i))
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: row, error } = await context.supabase.rpc("project_timesheet_preview", {
      p_ws: ws,
      p_from: data.from,
      p_to: data.to,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return row as unknown as SubmissionPreview;
  });

export const submitPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    period.extend({ expectedHash: z.string().min(8).max(64), timezone: tz }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: row, error } = await context.supabase.rpc("project_timesheet_submit", {
      p_ws: ws,
      p_from: data.from,
      p_to: data.to,
      p_expected_hash: data.expectedHash,
      p_tz: data.timezone,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return row as unknown as {
      submission_id: string;
      version: number;
      entries: number;
      total_seconds: number;
    };
  });

export const withdrawSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ submissionId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc("project_timesheet_withdraw", {
      p_submission: data.submissionId,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return row as unknown as { withdrawn: number };
  });

// ============= fila e decisão do aprovador =============

export const listPendingApprovals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid().nullable().optional(),
        userId: z.string().uuid().nullable().optional(),
        page: z.number().int().min(0).default(0),
        pageSize: z.number().int().min(10).max(200).default(50),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: row, error } = await context.supabase.rpc("project_time_pending_for_me", {
      p_ws: ws,
      p_project: (data.projectId ?? null) as never,
      p_user: (data.userId ?? null) as never,
      p_limit: data.pageSize,
      p_offset: data.page * data.pageSize,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return row as unknown as PendingApprovals;
  });

export const decidePendingItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        items: z
          .array(z.object({ itemId: z.string().uuid(), revision: z.number().int().min(0) }))
          .min(1)
          .max(500),
        action: z.enum(["approve", "reject"]),
        reason: z.string().trim().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: row, error } = await context.supabase.rpc("project_timesheet_decide", {
      p_ws: ws,
      p_items: data.items.map((x) => ({ item_id: x.itemId, revision: x.revision })),
      p_action: data.action,
      p_reason: (data.reason ?? null) as never,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return row as unknown as { decided: number; action: string };
  });

export const reopenApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        ids: z.array(z.string().uuid()).min(1).max(200),
        reason: z.string().trim().min(5).max(500),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data: row, error } = await context.supabase.rpc("project_time_reopen_approval", {
      p_ws: ws,
      p_ids: data.ids,
      p_reason: data.reason,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return row as unknown as { reopened: number };
  });

/** Timesheet agregado no banco (RLS do usuário), sem limite de linhas. */
export const getTimesheetOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    period
      .extend({
        userId: z.string().uuid().nullable().optional(),
        projectId: z.string().uuid().nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.rpc("project_timesheet_overview", {
      p_from: data.from,
      p_to: data.to,
      p_user: (data.userId ?? null) as never,
      p_project: (data.projectId ?? null) as never,
    });
    if (error) throw new Error(cleanDbError(error.message));
    return row as unknown as TimesheetOverview;
  });
