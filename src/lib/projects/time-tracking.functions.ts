// TechProjects — apontamento de horas (criação, edição, duplicação, exclusão).
// Regras de integridade (fim > início, sobreposição, duração) são garantidas
// também no banco por trigger; aqui validamos antes para dar mensagem em PT-BR.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import { durationMinutes, findOverlap } from "@/lib/projects/time-entry.shared";

const clock = z
  .string()
  .regex(/^\d{1,2}:\d{2}(:\d{2})?$/, "Informe o horário no formato HH:MM")
  .transform((v) => (v.length === 5 ? `${v}:00` : v));

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

const ENTRY_SELECT =
  "id, project_id, task_id, user_id, entry_date, start_time, end_time, duration_minutes, hours, description, billable, status, source, submitted_at, approved_at, rejected_at, reject_reason, locked_at, project_tasks(id, title), projects(id, name)";

/** Projetos em que o usuário pode apontar horas: membro, alocado ou com tarefas. */
export const listTrackableProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [members, allocations, tasks] = await Promise.all([
      supabase.from("project_members").select("project_id, can_track_time").eq("user_id", userId),
      supabase.from("people_allocations").select("project_id").eq("assigned_to", userId),
      supabase.from("project_tasks").select("project_id").eq("assignee_id", userId).limit(500),
    ]);

    const ids = new Set<string>();
    for (const m of members.data ?? []) {
      if (m.can_track_time !== false && m.project_id) ids.add(m.project_id);
    }
    for (const a of allocations.data ?? []) if (a.project_id) ids.add(a.project_id);
    for (const t of tasks.data ?? []) if (t.project_id) ids.add(t.project_id);

    if (ids.size === 0) {
      // Sem vínculo explícito: mostra os projetos ativos visíveis ao usuário (RLS).
      const { data } = await supabase
        .from("projects")
        .select("id, name, status")
        .in("status", ["planning", "active"])
        .order("name")
        .limit(100);
      return { projects: data ?? [], linked: false };
    }

    const { data, error } = await supabase
      .from("projects")
      .select("id, name, status")
      .in("id", Array.from(ids))
      .order("name");
    if (error) throw new Error(error.message);
    return { projects: data ?? [], linked: true };
  });

/** Tarefas de um projeto para escolher no apontamento (com busca opcional). */
export const listTrackableTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ projectId: z.string().uuid(), search: z.string().max(120).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("project_tasks")
      .select("id, title, status")
      .eq("project_id", data.projectId)
      .order("updated_at", { ascending: false })
      .limit(50);
    if (data.search?.trim()) q = q.ilike("title", `%${data.search.trim()}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
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
      .order("start_time", { ascending: true, nullsFirst: false });
    if (data.projectId) q = q.eq("project_id", data.projectId);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { entries: rows ?? [] };
  });

const saveInput = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid({ message: "Selecione um projeto" }),
  taskId: z.string().uuid().nullable().optional(),
  /** Texto livre: cria a tarefa no projeto quando não há tarefa selecionada. */
  taskTitle: z.string().trim().min(2).max(200).optional(),
  entryDate: isoDate,
  startTime: clock,
  endTime: clock,
  description: z.string().max(2000).nullable().optional(),
  billable: z.boolean().default(true),
});

/** Cria ou atualiza um apontamento manual. */
export const saveTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => saveInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    const minutes = durationMinutes(data.startTime, data.endTime);
    if (minutes === null) throw new Error("O horário final deve ser maior que o horário inicial.");

    const { data: sameDay } = await supabase
      .from("project_time_entries")
      .select("id, start_time, end_time")
      .eq("user_id", userId)
      .eq("entry_date", data.entryDate);
    const overlap = findOverlap(sameDay ?? [], {
      id: data.id,
      start_time: data.startTime,
      end_time: data.endTime,
    });
    if (overlap) {
      throw new Error(
        `Já existe um apontamento entre ${overlap.start_time} e ${overlap.end_time} neste dia.`,
      );
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
      if (taskErr) throw new Error(taskErr.message);
      taskId = created.id;
    }
    if (!taskId) throw new Error("Informe a atividade realizada.");

    const payload = {
      workspace_id: workspaceId,
      project_id: data.projectId,
      task_id: taskId,
      user_id: userId,
      entry_date: data.entryDate,
      start_time: data.startTime,
      end_time: data.endTime,
      duration_minutes: minutes,
      description: data.description ?? null,
      billable: data.billable,
      source: "manual" as const,
    };

    if (data.id) {
      const { data: current } = await supabase
        .from("project_time_entries")
        .select("status")
        .eq("id", data.id)
        .maybeSingle();
      if (current?.status === "locked") {
        throw new Error("Este apontamento está travado e não pode ser alterado.");
      }
      const { data: row, error } = await supabase
        .from("project_time_entries")
        .update({ ...payload, status: "draft", rejected_at: null, reject_reason: null })
        .eq("id", data.id)
        .select(ENTRY_SELECT)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("Você não tem permissão para alterar este apontamento.");
      return { entry: row };
    }

    const { data: row, error } = await supabase
      .from("project_time_entries")
      .insert({ ...payload, status: "draft" })
      .select(ENTRY_SELECT)
      .single();
    if (error) throw new Error(error.message);
    return { entry: row };
  });

/** Duplica um apontamento no mesmo dia, encaixando após o horário final. */
export const duplicateTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: src, error } = await supabase
      .from("project_time_entries")
      .select(
        "project_id, task_id, entry_date, start_time, end_time, duration_minutes, description, billable, workspace_id",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!src) throw new Error("Apontamento não encontrado.");

    const minutes = src.duration_minutes ?? 60;
    const startMin =
      Number(String(src.end_time ?? "09:00:00").slice(0, 2)) * 60 +
      Number(String(src.end_time ?? "09:00:00").slice(3, 5));
    const endMin = Math.min(23 * 60 + 59, startMin + minutes);
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}:00`;

    const { data: row, error: insErr } = await supabase
      .from("project_time_entries")
      .insert({
        workspace_id: src.workspace_id,
        project_id: src.project_id,
        task_id: src.task_id,
        user_id: userId,
        entry_date: src.entry_date,
        start_time: fmt(startMin),
        end_time: fmt(endMin),
        duration_minutes: endMin - startMin,
        description: src.description,
        billable: src.billable,
        source: "manual",
        status: "draft",
      })
      .select(ENTRY_SELECT)
      .single();
    if (insErr) throw new Error(insErr.message);
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
      .neq("status", "locked")
      .select("id");
    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) {
      throw new Error("Nenhum apontamento excluído: ele está travado ou você não tem permissão.");
    }
    return { ok: true };
  });
