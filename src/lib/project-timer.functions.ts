// Sprint D — Fase 4.3: Timer global (Clockify-like) e timesheet semanal.
// Regras:
// - Uma única entrada em execução por usuário (unique index parcial).
// - Ao parar, calcula `hours` = (stopped_at - started_at) em horas com 2 casas.
// - Timesheet lista entradas concluídas do período; total agregado por dia/projeto.
// - Geração de financial_entries a partir de horas billable (aprovadas) — MVP.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

// ============= TIMER =============

export const getRunningTimer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("project_time_entries")
      .select("*, project_tasks(id, title), projects(id, name)")
      .eq("user_id", userId)
      .is("stopped_at", null)
      .not("started_at", "is", null)
      .order("started_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    return rows?.[0] ?? null;
  });

export const startTimer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        projectId: z.string().uuid(),
        taskId: z.string().uuid().nullable().optional(),
        description: z.string().max(1000).nullable().optional(),
        billable: z.boolean().default(true),
        hourlyRate: z.number().nonnegative().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    // Se já existe timer rodando, para-o antes de iniciar outro.
    const { data: running } = await supabase
      .from("project_time_entries")
      .select("id, started_at")
      .eq("user_id", userId)
      .is("stopped_at", null)
      .not("started_at", "is", null)
      .maybeSingle();
    if (running?.id) {
      const now = new Date();
      const startedAt = running.started_at ? new Date(running.started_at) : now;
      const hours = Math.max(0, (now.getTime() - startedAt.getTime()) / 3_600_000);
      await supabase
        .from("project_time_entries")
        .update({
          stopped_at: now.toISOString(),
          hours: Number(hours.toFixed(2)),
          entry_date: now.toISOString().slice(0, 10),
        })
        .eq("id", running.id);
    }

    const nowIso = new Date().toISOString();
    const { data: row, error } = await supabase
      .from("project_time_entries")
      .insert({
        workspace_id: workspaceId,
        project_id: data.projectId,
        task_id: data.taskId ?? null,
        user_id: userId,
        description: data.description ?? null,
        billable: data.billable,
        hourly_rate: data.hourlyRate ?? null,
        started_at: nowIso,
        stopped_at: null,
        entry_date: nowIso.slice(0, 10),
        hours: null,
      })
      .select("*, project_tasks(id, title), projects(id, name)")
      .single();
    if (error) throw error;
    return row;
  });

export const stopTimer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let entryId = data.id ?? null;
    if (!entryId) {
      const { data: running } = await supabase
        .from("project_time_entries")
        .select("id")
        .eq("user_id", userId)
        .is("stopped_at", null)
        .not("started_at", "is", null)
        .maybeSingle();
      entryId = running?.id ?? null;
    }
    if (!entryId) return null;

    const { data: entry, error: getErr } = await supabase
      .from("project_time_entries")
      .select("id, started_at")
      .eq("id", entryId)
      .single();
    if (getErr) throw getErr;

    const now = new Date();
    const startedAt = entry.started_at ? new Date(entry.started_at) : now;
    const hours = Math.max(0, (now.getTime() - startedAt.getTime()) / 3_600_000);

    const { data: row, error } = await supabase
      .from("project_time_entries")
      .update({
        stopped_at: now.toISOString(),
        hours: Number(hours.toFixed(2)),
        entry_date: now.toISOString().slice(0, 10),
      })
      .eq("id", entry.id)
      .select("*, project_tasks(id, title), projects(id, name)")
      .single();
    if (error) throw error;
    return row;
  });

// ============= TIMESHEET =============

export const listTimesheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        from: z.string(), // YYYY-MM-DD
        to: z.string(),
        userId: z.string().uuid().optional(),
        projectId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase
      .from("project_time_entries")
      .select("*, project_tasks(id, title), projects(id, name)")
      .gte("entry_date", data.from)
      .lte("entry_date", data.to)
      .not("stopped_at", "is", null)
      .order("entry_date", { ascending: true });

    q = q.eq("user_id", data.userId ?? userId);
    if (data.projectId) q = q.eq("project_id", data.projectId);

    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

// ============= BILLABLE → FINANCIAL ENTRIES (MVP) =============
// Consolida horas billable aprovadas (approved_at not null) e sem financial_entry_id em um único
// financial_entry por projeto (receita a receber).

export const generateFinancialFromBillable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ projectId: z.string().uuid(), from: z.string(), to: z.string() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);

    const { data: entries, error } = await supabase
      .from("project_time_entries")
      .select("id, hours, hourly_rate, billable, financial_entry_id, approved_at")
      .eq("project_id", data.projectId)
      .gte("entry_date", data.from)
      .lte("entry_date", data.to)
      .eq("billable", true)
      .is("financial_entry_id", null)
      .not("approved_at", "is", null);
    if (error) throw error;

    const eligible = (entries ?? []).filter((e) => (e.hours ?? 0) > 0 && (e.hourly_rate ?? 0) > 0);
    if (eligible.length === 0) return { created: 0, amount: 0 };

    const amount = eligible.reduce((acc, e) => acc + (e.hours ?? 0) * (e.hourly_rate ?? 0), 0);

    const { data: fin, error: finErr } = await supabase
      .from("financial_entries")
      .insert({
        workspace_id: workspaceId,
        owner_id: userId,
        direction: "receivable",
        status: "open",
        amount: Number(amount.toFixed(2)),
        competence_date: data.to,
        due_date: data.to,
        description: `Horas billable ${data.from} a ${data.to}`,
        origin_type: "service",
        origin_id: data.projectId,
        project_id: data.projectId,
      })
      .select("id")
      .single();
    if (finErr) throw finErr;

    await supabase
      .from("project_time_entries")
      .update({ financial_entry_id: fin.id })
      .in(
        "id",
        eligible.map((e) => e.id),
      );

    return { created: 1, amount: Number(amount.toFixed(2)), financialEntryId: fin.id };
  });

// ============= APROVAÇÃO DE HORAS =============

export const approveTimeEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("project_time_entries")
      .update({ approved_at: nowIso, approved_by: userId })
      .in("id", data.ids);
    if (error) throw error;
    return { ok: true };
  });
