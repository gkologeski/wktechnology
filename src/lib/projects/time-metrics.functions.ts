// TechProjects — indicadores de horas (profissional e gestor).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  eachIsoDate,
  expectedMinutesForDate,
  expectedMinutesForRange,
  hoursToMinutes,
  type AllocationSlice,
} from "@/lib/projects/time-entry.shared";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

type Client = { from: (t: string) => ReturnType<never> };

async function loadAllocations(
  supabase: Parameters<typeof loadEntries>[0],
  userId: string,
): Promise<AllocationSlice[]> {
  const { data } = await supabase
    .from("people_allocations")
    .select("allocation_pct, starts_at, ends_at, status, assigned_to")
    .eq("assigned_to", userId);
  return (data ?? [])
    .filter((a: { status?: string | null }) => a.status !== "ended")
    .map((a: AllocationSlice) => ({
      allocation_pct: a.allocation_pct,
      starts_at: a.starts_at,
      ends_at: a.ends_at,
    }));
}

type EntryRow = {
  id: string;
  entry_date: string;
  duration_minutes: number | null;
  hours: number | null;
  status: string;
  user_id: string;
  project_id: string | null;
};

async function loadEntries(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  args: { from: string; to: string; userId?: string },
): Promise<EntryRow[]> {
  let q = supabase
    .from("project_time_entries")
    .select("id, entry_date, duration_minutes, hours, status, user_id, project_id")
    .gte("entry_date", args.from)
    .lte("entry_date", args.to);
  if (args.userId) q = q.eq("user_id", args.userId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as EntryRow[];
}

function minutesOf(e: EntryRow): number {
  return e.duration_minutes ?? hoursToMinutes(e.hours);
}

/** Resumo do profissional: dia, semana e mês corrente com meta derivada da alocação. */
export const getMyTimeSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ date: isoDate }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const ref = new Date(`${data.date}T12:00:00`);
    const weekStart = new Date(ref);
    weekStart.setDate(ref.getDate() - ((ref.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1, 12);
    const monthEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 12);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const [allocations, entries] = await Promise.all([
      loadAllocations(supabase, userId),
      loadEntries(supabase, { from: iso(monthStart), to: iso(monthEnd), userId }),
    ]);

    const sum = (from: string, to: string) =>
      entries
        .filter((e) => e.entry_date >= from && e.entry_date <= to)
        .reduce((acc, e) => acc + minutesOf(e), 0);

    const byDay = eachIsoDate(iso(weekStart), iso(weekEnd)).map((d) => ({
      date: d,
      tracked: sum(d, d),
      expected: expectedMinutesForDate(d, allocations),
    }));

    return {
      today: {
        date: data.date,
        tracked: sum(data.date, data.date),
        expected: expectedMinutesForDate(data.date, allocations),
      },
      week: {
        from: iso(weekStart),
        to: iso(weekEnd),
        tracked: sum(iso(weekStart), iso(weekEnd)),
        expected: expectedMinutesForRange(iso(weekStart), iso(weekEnd), allocations),
        byDay,
      },
      month: {
        from: iso(monthStart),
        to: iso(monthEnd),
        tracked: sum(iso(monthStart), iso(monthEnd)),
        expected: expectedMinutesForRange(iso(monthStart), iso(monthEnd), allocations),
      },
    };
  });

/** Calendário mensal: horas apontadas x esperadas por dia. */
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
    const first = new Date(data.year, data.month - 1, 1, 12);
    const last = new Date(data.year, data.month, 0, 12);
    const from = first.toISOString().slice(0, 10);
    const to = last.toISOString().slice(0, 10);

    const [allocations, entries] = await Promise.all([
      loadAllocations(supabase, userId),
      loadEntries(supabase, { from, to, userId }),
    ]);

    const days = eachIsoDate(from, to).map((date) => {
      const tracked = entries
        .filter((e) => e.entry_date === date)
        .reduce((acc, e) => acc + minutesOf(e), 0);
      const expected = expectedMinutesForDate(date, allocations);
      const status =
        expected === 0
          ? "off"
          : tracked === 0
            ? "missing"
            : tracked >= expected
              ? "complete"
              : "partial";
      return { date, tracked, expected, status };
    });

    return { from, to, days };
  });

/** Visão do gestor: totais por profissional, projeto e status no período. */
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
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("project_time_entries")
      .select(
        "id, entry_date, duration_minutes, hours, status, billable, user_id, project_id, task_id, description, start_time, end_time, projects(id, name, service_id), project_tasks(id, title)",
      )
      .gte("entry_date", data.from)
      .lte("entry_date", data.to)
      .order("entry_date", { ascending: false })
      .limit(5000);
    if (data.projectId) q = q.eq("project_id", data.projectId);
    if (data.userId) q = q.eq("user_id", data.userId);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const entries = (rows ?? []) as unknown as (EntryRow & {
      projects?: { id: string; name: string } | null;
      project_tasks?: { id: string; title: string } | null;
      billable?: boolean | null;
      description?: string | null;
      start_time?: string | null;
      end_time?: string | null;
      task_id?: string | null;
    })[];

    const byUser = new Map<string, number>();
    const byProject = new Map<string, { name: string; minutes: number }>();
    const byStatus = new Map<string, number>();
    let total = 0;
    for (const e of entries) {
      const m = minutesOf(e);
      total += m;
      byUser.set(e.user_id, (byUser.get(e.user_id) ?? 0) + m);
      const pid = e.project_id ?? "—";
      const cur = byProject.get(pid) ?? { name: e.projects?.name ?? "Sem projeto", minutes: 0 };
      cur.minutes += m;
      byProject.set(pid, cur);
      byStatus.set(e.status, (byStatus.get(e.status) ?? 0) + m);
    }

    const userIds = Array.from(byUser.keys());
    const names = new Map<string, string>();
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      for (const p of profiles ?? []) {
        names.set(p.id, (p.full_name as string | null) || "Sem nome");
      }
    }

    return {
      total,
      entries,
      byUser: userIds
        .map((id) => ({
          userId: id,
          name: names.get(id) ?? "Sem nome",
          minutes: byUser.get(id) ?? 0,
        }))
        .sort((a, b) => b.minutes - a.minutes),
      byProject: Array.from(byProject.entries())
        .map(([id, v]) => ({ projectId: id, name: v.name, minutes: v.minutes }))
        .sort((a, b) => b.minutes - a.minutes),
      byStatus: Array.from(byStatus.entries()).map(([status, minutes]) => ({ status, minutes })),
    };
  });

export type { Client };
