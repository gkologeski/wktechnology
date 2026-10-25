// TechProjects — apontamento de horas (criação, edição, duplicação, exclusão).
// Regras de integridade (vínculo no projeto, fim > início, sobreposição, duração, fluxo de
// aprovação, competência fechada) são garantidas no banco por gatilho; aqui validamos antes
// para dar mensagem em PT-BR. Situação de aprovação nunca é enviada pelo cliente.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { cleanDbError, durationMinutes, findOverlap } from "@/lib/projects/time-entry.shared";
import type { TrackableProjects } from "@/lib/projects/time-workflow.types";

const clock = z
  .string()
  .regex(/^\d{1,2}:\d{2}(:\d{2})?$/, "Informe o horário no formato HH:MM")
  .transform((v) => (v.length === 5 ? `${v}:00` : v));

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

const ENTRY_SELECT =
  "id, project_id, task_id, user_id, entry_date, start_time, end_time, duration_minutes, duration_seconds, entry_kind, timezone, hours, description, billable, status, source, submitted_at, approved_at, rejected_at, reject_reason, locked_at, revision, review_flags, period_closing_id, submission_id, started_at, stopped_at, project_tasks(id, title), projects(id, name)";

/** Projetos em que o usuário pode apontar: membro liberado ou alocação vigente (política do workspace). */
export const listTrackableProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data, error } = await context.supabase.rpc("project_time_trackable_projects", {
      p_ws: ws,
    });
    if (error) throw new Error(cleanDbError(error.message));
    const r = data as unknown as TrackableProjects;
    return {
      projects: r.projects,
      linked: r.projects.length > 0,
      personLinked: r.person_linked,
      policy: r.policy,
    };
  });

/** Tarefas de um projeto para escolher no apontamento (com busca opcional). */
export const listTrackableTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ projectId: z.string().uuid(), search: z.string().max(120).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    const rows = await workRpc<Array<{ id: string; title: string; status: string }>>(
      supabase,
      "project_time_task_references",
      { p_project: data.projectId, p_search: data.search ?? null },
    );
    return { tasks: rows ?? [] };
  });

/** Apontamentos do usuário (ou de outro profissional, se permitido pela RLS). */
export const listTimeEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        from: isoDate,
        to: isoDate,
        userId: z.string().uuid().optional(),
        projectId: z.string().uuid().optional(),
        status: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("project_time_entries")
      .select(ENTRY_SELECT)
      .gte("entry_date", data.from)
      .lte("entry_date", data.to)
      .eq("user_id", data.userId ?? userId)
      .order("entry_date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: false })
      .limit(1000);
    if (data.projectId) q = q.eq("project_id", data.projectId);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const { workRpc } = await import("@/lib/access-control/work-core.server");
    const labels = rows?.length
      ? await workRpc<
          Array<{
            id: string;
            project_id: string;
            project_name: string;
            task_id: string | null;
            task_title: string | null;
          }>
        >(supabase, "project_time_entry_labels", { p_ids: rows.map((x) => x.id) })
      : [];
    const byId = new Map(labels.map((x) => [x.id, x]));
    return {
      entries: (rows ?? []).map((row) => {
        const label = byId.get(row.id);
        return {
          ...row,
          projects:
            row.projects ?? (label ? { id: label.project_id, name: label.project_name } : null),
          project_tasks:
            row.project_tasks ??
            (label?.task_id ? { id: label.task_id, title: label.task_title } : null),
        };
      }),
    };
  });

const saveInput = z
  .object({
    id: z.string().uuid().optional(),
    projectId: z.string().uuid({ message: "Selecione um projeto" }),
    taskId: z.string().uuid().nullable().optional(),
    /** Texto livre: cria a tarefa no projeto quando não há tarefa selecionada. */
    taskTitle: z.string().trim().min(2).max(200).optional(),
    entryDate: isoDate,
    /** `interval` = início e fim; `duration` = só duração, sem inventar horário. */
    mode: z.enum(["interval", "duration"]).default("interval"),
    startTime: clock.optional(),
    endTime: clock.optional(),
    durationSeconds: z
      .number()
      .int()
      .min(60, "Duração mínima de 1 minuto")
      .max(24 * 3600)
      .optional(),
    timezone: z.string().min(1).max(64).optional(),
    description: z.string().max(2000).nullable().optional(),
    billable: z.boolean().default(true),
  })
  .refine((v) => (v.mode === "interval" ? !!v.startTime && !!v.endTime : !!v.durationSeconds), {
    message: "Informe início e fim, ou a duração.",
  });

/** Cria ou atualiza um apontamento manual (rascunho; editar enviado/devolvido volta a rascunho). */
export const saveTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => saveInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    if (data.mode === "interval") {
      const minutes = durationMinutes(data.startTime, data.endTime);
      if (minutes === null)
        throw new Error("O horário final deve ser maior que o horário inicial.");
      const { data: sameDay } = await supabase
        .from("project_time_entries")
        .select("id, start_time, end_time")
        .eq("user_id", userId)
        .eq("entry_date", data.entryDate);
      const overlap = findOverlap(sameDay ?? [], {
        id: data.id,
        start_time: data.startTime!,
        end_time: data.endTime!,
      });
      if (overlap) {
        throw new Error(
          `Já existe um apontamento entre ${overlap.start_time} e ${overlap.end_time} neste dia.`,
        );
      }
    }

    let taskId = data.taskId ?? null;
    if (!taskId && data.taskTitle) {
      const { data: created, error: taskErr } = await supabase
        .from("project_tasks")
        .insert({
          workspace_id: workspaceId,
          project_id: data.projectId,
          title: data.taskTitle,
          status: "doing",
          assignee_id: userId,
        })
        .select("id")
        .single();
      if (taskErr) throw new Error(cleanDbError(taskErr.message));
      taskId = created.id;
    }
    if (!taskId) throw new Error("Informe a atividade realizada.");

    const payload = {
      workspace_id: workspaceId,
      project_id: data.projectId,
      task_id: taskId,
      user_id: userId,
      entry_date: data.entryDate,
      entry_kind: data.mode,
      start_time: data.mode === "interval" ? data.startTime! : null,
      end_time: data.mode === "interval" ? data.endTime! : null,
      duration_seconds: data.mode === "duration" ? data.durationSeconds! : null,
      timezone: data.timezone ?? null,
      description: data.description ?? null,
      billable: data.billable,
      source: "manual" as const,
    };

    if (data.id) {
      const { data: row, error } = await supabase
        .from("project_time_entries")
        .update(payload)
        .eq("id", data.id)
        .select(ENTRY_SELECT)
        .maybeSingle();
      if (error) throw new Error(cleanDbError(error.message));
      if (!row) throw new Error("Você não tem permissão para alterar este apontamento.");
      return { entry: row };
    }

    const { data: row, error } = await supabase
      .from("project_time_entries")
      .insert(payload)
      .select(ENTRY_SELECT)
      .single();
    if (error) throw new Error(cleanDbError(error.message));
    return { entry: row };
  });

/** Duplica um apontamento: intervalo encaixa após o fim; duração repete a duração. */
export const duplicateTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: src, error } = await supabase
      .from("project_time_entries")
      .select(
        "project_id, task_id, entry_date, start_time, end_time, duration_minutes, duration_seconds, entry_kind, timezone, description, billable, workspace_id",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!src) throw new Error("Apontamento não encontrado.");

    const base = {
      workspace_id: src.workspace_id,
      project_id: src.project_id,
      task_id: src.task_id,
      user_id: userId,
      entry_date: src.entry_date,
      description: src.description,
      billable: src.billable,
      timezone: src.timezone,
      source: "manual",
    };
    const seconds = src.duration_seconds ?? (src.duration_minutes ?? 60) * 60;
    let insert;
    if (!src.start_time || !src.end_time) {
      insert = { ...base, entry_kind: "duration", duration_seconds: seconds };
    } else {
      const startMin =
        Number(String(src.end_time).slice(0, 2)) * 60 + Number(String(src.end_time).slice(3, 5));
      const endMin = Math.min(23 * 60 + 59, startMin + Math.round(seconds / 60));
      if (endMin <= startMin)
        throw new Error("Não há espaço no dia para duplicar após este horário.");
      const pad = (n: number) => String(n).padStart(2, "0");
      const fmt = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}:00`;
      insert = {
        ...base,
        entry_kind: "interval",
        start_time: fmt(startMin),
        end_time: fmt(endMin),
      };
    }
    const { data: row, error: insErr } = await supabase
      .from("project_time_entries")
      .insert(insert)
      .select(ENTRY_SELECT)
      .single();
    if (insErr) throw new Error(cleanDbError(insErr.message));
    return { entry: row };
  });

/** Exclui um apontamento e falha quando a permissão bloqueia (0 linhas). */
export const removeTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("project_time_entries")
      .delete()
      .eq("id", data.id)
      .in("status", ["draft", "rejected"])
      .select("id");
    if (error) throw new Error(cleanDbError(error.message));
    if (!rows || rows.length === 0) {
      throw new Error(
        "Nenhum apontamento excluído: só rascunhos e devolvidos podem ser excluídos, e conforme sua permissão.",
      );
    }
    return { ok: true };
  });
