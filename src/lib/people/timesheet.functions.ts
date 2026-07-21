// Sprint 5 — Timesheet do TechPeople.
// Integra apontamentos existentes de `project_time_entries` com a ficha da pessoa
// e com alocações (`people_allocations`), consolidando horas realizadas e margem.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TimesheetEntry = {
  id: string;
  entry_date: string | null;
  started_at: string | null;
  stopped_at: string | null;
  hours: number | null;
  billable: boolean;
  hourly_rate: number | null;
  approved_at: string | null;
  description: string | null;
  project_id: string;
  project_name: string | null;
  task_id: string | null;
  task_title: string | null;
  allocation_id: string | null;
  person_id: string | null;
};

export type TimesheetSummary = {
  entries: TimesheetEntry[];
  totals: {
    hours: number;
    billableHours: number;
    approvedHours: number;
    revenue: number; // horas billable × hourly_rate
    cost: number;    // horas × people.cost_hour (quando disponível)
    margin: number;
  };
};

async function resolveProfileId(
  supabase: { from: (t: string) => unknown },
  personId: string,
): Promise<{ profile_id: string | null; cost_hour: number | null }> {
  const q = supabase.from("people") as {
    select: (c: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        maybeSingle: () => Promise<{
          data: { profile_id: string | null; cost_hour: number | null } | null;
        }>;
      };
    };
  };
  const { data } = await q.select("profile_id, cost_hour").eq("id", personId).maybeSingle();
  return { profile_id: data?.profile_id ?? null, cost_hour: data?.cost_hour ?? null };
}

export const listPersonTimesheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        person_id: z.string().uuid(),
        start: z.string(), // yyyy-mm-dd
        end: z.string(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<TimesheetSummary> => {
    const { supabase } = context;
    const { profile_id, cost_hour } = await resolveProfileId(supabase, data.person_id);

    // Estratégia: buscar por person_id (link direto) OU por user_id = profile_id.
    // Como o supabase-js não suporta OR complexo com join, fazemos duas queries.
    const results: TimesheetEntry[] = [];

    const mapRow = (r: Record<string, unknown>): TimesheetEntry => {
      const proj = r.projects as { id: string; name: string | null } | null | undefined;
      const task = r.project_tasks as { id: string; title: string | null } | null | undefined;
      return {
        id: r.id as string,
        entry_date: (r.entry_date as string) ?? null,
        started_at: (r.started_at as string) ?? null,
        stopped_at: (r.stopped_at as string) ?? null,
        hours: (r.hours as number) ?? null,
        billable: (r.billable as boolean) ?? false,
        hourly_rate: (r.hourly_rate as number) ?? null,
        approved_at: (r.approved_at as string) ?? null,
        description: (r.description as string) ?? null,
        project_id: r.project_id as string,
        project_name: proj?.name ?? null,
        task_id: (r.task_id as string) ?? null,
        task_title: task?.title ?? null,
        allocation_id: (r.allocation_id as string) ?? null,
        person_id: (r.person_id as string) ?? null,
      };
    };

    // 1) Por person_id explícito
    {
      const { data: rows, error } = await supabase
        .from("project_time_entries")
        .select(
          "id, entry_date, started_at, stopped_at, hours, billable, hourly_rate, approved_at, description, project_id, task_id, allocation_id, person_id, projects(id,name), project_tasks(id,title)",
        )
        .eq("person_id", data.person_id)
        .gte("entry_date", data.start)
        .lte("entry_date", data.end)
        .order("entry_date", { ascending: false });
      if (error) throw new Error(error.message);
      for (const r of rows ?? []) results.push(mapRow(r as Record<string, unknown>));
    }

    // 2) Fallback por user_id do profile (entradas legadas sem person_id)
    if (profile_id) {
      const { data: rows, error } = await supabase
        .from("project_time_entries")
        .select(
          "id, entry_date, started_at, stopped_at, hours, billable, hourly_rate, approved_at, description, project_id, task_id, allocation_id, person_id, projects(id,name), project_tasks(id,title)",
        )
        .eq("user_id", profile_id)
        .is("person_id", null)
        .gte("entry_date", data.start)
        .lte("entry_date", data.end)
        .order("entry_date", { ascending: false });
      if (error) throw new Error(error.message);
      for (const r of rows ?? []) results.push(mapRow(r as Record<string, unknown>));
    }

    // Totais
    let hours = 0;
    let billableHours = 0;
    let approvedHours = 0;
    let revenue = 0;
    for (const e of results) {
      const h = e.hours ?? 0;
      hours += h;
      if (e.billable) {
        billableHours += h;
        revenue += h * (e.hourly_rate ?? 0);
      }
      if (e.approved_at) approvedHours += h;
    }
    const cost = hours * (cost_hour ?? 0);
    const margin = revenue - cost;

    return {
      entries: results,
      totals: {
        hours: Number(hours.toFixed(2)),
        billableHours: Number(billableHours.toFixed(2)),
        approvedHours: Number(approvedHours.toFixed(2)),
        revenue: Number(revenue.toFixed(2)),
        cost: Number(cost.toFixed(2)),
        margin: Number(margin.toFixed(2)),
      },
    };
  });

// Consolida horas realizadas por alocação e retorna margem real vs planejada.
export const getAllocationRealized = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        allocation_id: z.string().uuid(),
        start: z.string().optional(),
        end: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    let q = supabase
      .from("project_time_entries")
      .select("hours, billable, hourly_rate, approved_at, entry_date")
      .eq("allocation_id", data.allocation_id) as unknown as {
      gte: (k: string, v: string) => typeof q;
      lte: (k: string, v: string) => typeof q;
      then: Promise<{ data: unknown[] | null; error: { message: string } | null }>["then"];
    };
    if (data.start) q = q.gte("entry_date", data.start);
    if (data.end) q = q.lte("entry_date", data.end);
    const { data: rows, error } = (await (q as unknown as Promise<{
      data: Array<{
        hours: number | null;
        billable: boolean;
        hourly_rate: number | null;
        approved_at: string | null;
      }> | null;
      error: { message: string } | null;
    }>));
    if (error) throw new Error(error.message);

    let hours = 0;
    let approvedHours = 0;
    let revenue = 0;
    for (const r of rows ?? []) {
      const h = r.hours ?? 0;
      hours += h;
      if (r.billable) revenue += h * (r.hourly_rate ?? 0);
      if (r.approved_at) approvedHours += h;
    }
    return {
      hours: Number(hours.toFixed(2)),
      approvedHours: Number(approvedHours.toFixed(2)),
      revenue: Number(revenue.toFixed(2)),
    };
  });
