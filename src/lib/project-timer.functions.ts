// Sprint D — Fase 4.3: Timer global (Clockify-like) e timesheet semanal.
// Regras:
// - Timesheet lista entradas concluídas do período; total agregado por dia/projeto.
// - Geração de financial_entries a partir de horas billable (aprovadas) — MVP.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import type { TimerState } from "@/lib/projects/time-workflow.types";

// O cronômetro vive em `project_timer_sessions` (servidor): um ativo por profissional e
// workspace, pausas pagas/não pagas e troca de atividade. Ao finalizar, o banco grava
// apontamentos com UTC exato, divididos na meia-noite do fuso da sessão.
// As ações ficam em `src/lib/projects/time-workflow.functions.ts`; aqui só a leitura.

// ============= TIMER =============

export const getRunningTimer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await resolveActiveWorkspace(context.userId);
    const { data, error } = await context.supabase.rpc("project_timer_get", { p_ws: ws });
    if (error) throw new Error(error.message);
    return (data ?? null) as unknown as TimerState | null;
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
        /** `visible` = todos os profissionais que a RLS permite ver (gestor/líder). */
        scope: z.enum(["me", "visible"]).default("me"),
        page: z.number().int().min(0).default(0),
        pageSize: z.number().int().min(10).max(500).default(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Lista paginada (totais vêm de `project_timesheet_overview`, agregado no banco).
    // Sem custo/tarifa: o timesheet não expõe valores.
    let q = supabase
      .from("project_time_entries")
      .select(
        "id, project_id, task_id, user_id, entry_date, start_time, end_time, duration_minutes, duration_seconds, entry_kind, hours, description, billable, status, source, approved_at, reject_reason, review_flags, period_closing_id, project_tasks(id, title), projects(id, name)",
      )
      .gte("entry_date", data.from)
      .lte("entry_date", data.to)
      .order("entry_date", { ascending: true })
      .order("start_time", { ascending: true, nullsFirst: false })
      .range(data.page * data.pageSize, data.page * data.pageSize + data.pageSize - 1);

    if (data.userId) q = q.eq("user_id", data.userId);
    else if (data.scope === "me") q = q.eq("user_id", userId);
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

// Aprovação de horas: ver src/lib/projects/time-approval.functions.ts (fluxo versionado no banco).
