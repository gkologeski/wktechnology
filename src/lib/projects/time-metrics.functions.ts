// TechProjects — indicadores de horas (profissional e gestor).
// Meta do dia vem da jornada do People (`people.work_schedule`) e das alocações vigentes da
// pessoa ligada ao login. Sem jornada configurada a meta é desconhecida (null), nunca 8 h presumidas.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";
import {
  loadCapacity,
  sumEntrySeconds,
  monthBounds,
  weekBounds,
} from "@/lib/projects/time-metrics.server";
import {
  cleanDbError,
  eachIsoDate,
  expectedMinutesForDate,
  expectedMinutesForRange,
} from "@/lib/projects/time-entry.shared";
import type { TimesheetOverview } from "@/lib/projects/time-workflow.types";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

/** Resumo do profissional: dia, semana e mês com meta da jornada (ou "não configurada"). */
export const getMyTimeSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ date: isoDate }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await resolveActiveWorkspace(userId);
    const week = weekBounds(data.date);
    const month = monthBounds(data.date);
    const from = week.from < month.from ? week.from : month.from;
    const to = week.to > month.to ? week.to : month.to;
    const [cap, byDate] = await Promise.all([
      loadCapacity(supabase, userId, ws),
      sumEntrySeconds(supabase, userId, from, to),
    ]);
    const tracked = (a: string, b: string) =>
      Math.round(eachIsoDate(a, b).reduce((acc, d) => acc + (byDate.get(d) ?? 0), 0) / 60);
    return {
      scheduleConfigured: !!cap.schedule,
      personLinked: cap.personLinked,
      today: {
        date: data.date,
        tracked: tracked(data.date, data.date),
        expected: expectedMinutesForDate(data.date, cap.allocations, cap.schedule),
      },
      week: {
        ...week,
        tracked: tracked(week.from, week.to),
        expected: expectedMinutesForRange(week.from, week.to, cap.allocations, cap.schedule),
        byDay: eachIsoDate(week.from, week.to).map((d) => ({
          date: d,
          tracked: Math.round((byDate.get(d) ?? 0) / 60),
          expected: expectedMinutesForDate(d, cap.allocations, cap.schedule),
        })),
      },
      month: {
        ...month,
        tracked: tracked(month.from, month.to),
        expected: expectedMinutesForRange(month.from, month.to, cap.allocations, cap.schedule),
      },
    };
  });

/** Calendário mensal: horas apontadas x esperadas por dia (esperado nulo = jornada não configurada). */
export const getMyMonthCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        year: z.number().int().min(2000).max(2100),
        month: z.number().int().min(1).max(12),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ws = await resolveActiveWorkspace(userId);
    const iso = `${data.year}-${String(data.month).padStart(2, "0")}-01`;
    const { from, to } = monthBounds(iso);
    const [cap, byDate] = await Promise.all([
      loadCapacity(supabase, userId, ws),
      sumEntrySeconds(supabase, userId, from, to),
    ]);
    const days = eachIsoDate(from, to).map((date) => {
      const tracked = Math.round((byDate.get(date) ?? 0) / 60);
      const expected = expectedMinutesForDate(date, cap.allocations, cap.schedule);
      const status =
        expected === null
          ? tracked > 0
            ? "tracked"
            : "unknown"
          : expected === 0
            ? "off"
            : tracked === 0
              ? "missing"
              : tracked >= expected
                ? "complete"
                : "partial";
      return { date, tracked, expected, status };
    });
    return { from, to, days, scheduleConfigured: !!cap.schedule };
  });

/** Visão do gestor: totais agregados no banco (sem limite de linhas) + lista paginada. */
export const getTeamTimeOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        from: isoDate,
        to: isoDate,
        projectId: z.string().uuid().optional(),
        userId: z.string().uuid().optional(),
        status: z.string().optional(),
        page: z.number().int().min(0).default(0),
        pageSize: z.number().int().min(10).max(200).default(50),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const [agg, list] = await Promise.all([
      supabase.rpc("project_timesheet_overview", {
        p_from: data.from,
        p_to: data.to,
        p_user: (data.userId ?? null) as never,
        p_project: (data.projectId ?? null) as never,
      }),
      (() => {
        let q = supabase
          .from("project_time_entries")
          .select(
            "id, entry_date, duration_minutes, duration_seconds, entry_kind, hours, status, source, billable, user_id, project_id, task_id, description, start_time, end_time, review_flags, period_closing_id, projects(id, name), project_tasks(id, title)",
            { count: "exact" },
          )
          .gte("entry_date", data.from)
          .lte("entry_date", data.to)
          .order("entry_date", { ascending: false })
          .range(data.page * data.pageSize, data.page * data.pageSize + data.pageSize - 1);
        if (data.projectId) q = q.eq("project_id", data.projectId);
        if (data.userId) q = q.eq("user_id", data.userId);
        if (data.status) q = q.eq("status", data.status);
        return q;
      })(),
    ]);
    if (agg.error) throw new Error(cleanDbError(agg.error.message));
    if (list.error) throw new Error(cleanDbError(list.error.message));
    return {
      overview: agg.data as unknown as TimesheetOverview,
      entries: list.data ?? [],
      total: list.count ?? 0,
    };
  });
