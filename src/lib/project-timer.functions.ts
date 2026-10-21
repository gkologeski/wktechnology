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

// ============= BILLABLE → FINANCIAL ENTRIES (desativado no Ciclo 4) =============
// O antigo consolidador de horas billable gravava título sem tarifa vigente, sem trava e com
// `origin_type='service'` apontando para o projeto, podendo cobrar em dobro junto das Medições.
// Mantido o nome para não quebrar importações; a cobrança por hora agora é feita pelas Medições
// (contrato → Medições), com tarifa por data do apontamento, aprovação e geração idempotente.

export const generateFinancialFromBillable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ projectId: z.string().uuid(), from: z.string(), to: z.string() }).parse(input),
  )
  .handler(async (): Promise<{ created: number; amount: number; financialEntryId?: string }> => {
    throw new Error(
      "A cobrança de horas agora é feita pelas Medições do contrato (TechProjects › Medições e rentabilidade).",
    );
  });

// Aprovação de horas: ver src/lib/projects/time-approval.functions.ts (fluxo versionado no banco).
