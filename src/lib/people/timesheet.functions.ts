// Sprint Timesheet — TechPeople.
// Integra apontamentos (`project_time_entries`) com a ficha da pessoa e com
// alocações (`people_allocations`), consolidando horas, receita, custo, margem
// e utilização. Também expõe ações operacionais (aprovar/rejeitar/lançar).
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
  effective_rate: number | null;
  effective_cost_rate: number | null;
  approved_at: string | null;
  description: string | null;
  project_id: string;
  project_name: string | null;
  task_id: string | null;
  task_title: string | null;
  allocation_id: string | null;
  person_id: string | null;
};

export type TimesheetTotals = {
  hours: number;
  billableHours: number;
  approvedHours: number;
  pendingHours: number;
  revenue: number;
  cost: number;
  margin: number;
  capacityHours: number;
  utilization: number; // 0..1
};

export type TimesheetSummary = {
  entries: TimesheetEntry[];
  totals: TimesheetTotals;
};

type MinimalClient = { from: (t: string) => unknown };

async function resolvePerson(
  supabase: MinimalClient,
  personId: string,
): Promise<{ profile_id: string | null; cost_hour: number | null; workspace_id: string | null }> {
  const q = supabase.from("people") as {
    select: (c: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        maybeSingle: () => Promise<{
          data: {
            profile_id: string | null;
            cost_hour: number | null;
            owner_id: string | null;
          } | null;
        }>;
      };
    };
  };
  const { data } = await q
    .select("profile_id, cost_hour, owner_id")
    .eq("id", personId)
    .maybeSingle();
  return {
    profile_id: data?.profile_id ?? null,
    cost_hour: data?.cost_hour ?? null,
    workspace_id: data?.owner_id ?? null,
  };
}

type AllocationSlim = {
  id: string;
  project_id: string | null;
  contract_id: string | null;
  billable_rate: number | null;
  cost_rate: number | null;
  allocation_pct: number;
  starts_at: string;
  ends_at: string | null;
  status: string;
  role_title: string | null;
  contract_title?: string | null;
  contract_number?: string | null;
  project_name?: string | null;
};

async function loadAllocationsFor(
  supabase: MinimalClient,
  personId: string,
  start: string,
  end: string,
): Promise<AllocationSlim[]> {
  const q = supabase.from("people_allocations") as {
    select: (c: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        lte: (
          k: string,
          v: string,
        ) => {
          or: (
            expr: string,
          ) => Promise<{ data: AllocationSlim[] | null; error: { message: string } | null }>;
        };
      };
    };
  };
  const { data, error } = await q
    .select(
      "id, project_id, contract_id, billable_rate, cost_rate, allocation_pct, starts_at, ends_at, status, role_title, contracts(title,number), projects(name)",
    )
    .eq("person_id", personId)
    .lte("starts_at", end)
    .or(`ends_at.is.null,ends_at.gte.${start}`);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => {
    const row = r as AllocationSlim & {
      contracts?: { title: string | null; number: string | null } | null;
      projects?: { name: string | null } | null;
    };
    return {
      ...row,
      contract_title: row.contracts?.title ?? null,
      contract_number: row.contracts?.number ?? null,
      project_name: row.projects?.name ?? null,
    };
  });
}

function pickAllocationRate(
  allocations: AllocationSlim[],
  entry: { allocation_id: string | null; project_id: string; entry_date: string | null },
): AllocationSlim | null {
  if (entry.allocation_id) {
    return allocations.find((a) => a.id === entry.allocation_id) ?? null;
  }
  // Match by project + date range
  const d = entry.entry_date ?? new Date().toISOString().slice(0, 10);
  return (
    allocations.find(
      (a) =>
        a.project_id === entry.project_id &&
        a.starts_at <= d &&
        (a.ends_at == null || a.ends_at >= d),
    ) ?? null
  );
}

function overlapDays(start: string, end: string, aStart: string, aEnd: string | null): number {
  const s = new Date(Math.max(new Date(start).getTime(), new Date(aStart).getTime()));
  const e = new Date(Math.min(new Date(end).getTime(), new Date(aEnd ?? "2999-12-31").getTime()));
  if (e < s) return 0;
  return Math.floor((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

export const listPersonTimesheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        person_id: z.string().uuid(),
        start: z.string(),
        end: z.string(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<TimesheetSummary> => {
    const { supabase } = context;
    const { profile_id, cost_hour } = await resolvePerson(supabase, data.person_id);
    const allocations = await loadAllocationsFor(supabase, data.person_id, data.start, data.end);

    const results: TimesheetEntry[] = [];

    const mapRow = (r: Record<string, unknown>): TimesheetEntry => {
      const proj = r.projects as { id: string; name: string | null } | null | undefined;
      const task = r.project_tasks as { id: string; title: string | null } | null | undefined;
      const entry_hourly = (r.hourly_rate as number) ?? null;
      const project_id = r.project_id as string;
      const allocation_id = (r.allocation_id as string) ?? null;
      const alloc = pickAllocationRate(allocations, {
        allocation_id,
        project_id,
        entry_date: (r.entry_date as string) ?? null,
      });
      const effective_rate = entry_hourly ?? alloc?.billable_rate ?? null;
      const effective_cost_rate = alloc?.cost_rate ?? cost_hour ?? null;
      return {
        id: r.id as string,
        entry_date: (r.entry_date as string) ?? null,
        started_at: (r.started_at as string) ?? null,
        stopped_at: (r.stopped_at as string) ?? null,
        hours: (r.hours as number) ?? null,
        billable: (r.billable as boolean) ?? false,
        hourly_rate: entry_hourly,
        effective_rate,
        effective_cost_rate,
        approved_at: (r.approved_at as string) ?? null,
        description: (r.description as string) ?? null,
        project_id,
        project_name: proj?.name ?? null,
        task_id: (r.task_id as string) ?? null,
        task_title: task?.title ?? null,
        allocation_id,
        person_id: (r.person_id as string) ?? null,
      };
    };

    const cols =
      "id, entry_date, started_at, stopped_at, hours, billable, hourly_rate, approved_at, description, project_id, task_id, allocation_id, person_id, projects(id,name), project_tasks(id,title)";

    {
      const { data: rows, error } = await supabase
        .from("project_time_entries")
        .select(cols)
        .eq("person_id", data.person_id)
        .gte("entry_date", data.start)
        .lte("entry_date", data.end)
        .order("entry_date", { ascending: false });
      if (error) throw new Error(error.message);
      for (const r of rows ?? []) results.push(mapRow(r as Record<string, unknown>));
    }

    if (profile_id) {
      const { data: rows, error } = await supabase
        .from("project_time_entries")
        .select(cols)
        .eq("user_id", profile_id)
        .is("person_id", null)
        .gte("entry_date", data.start)
        .lte("entry_date", data.end)
        .order("entry_date", { ascending: false });
      if (error) throw new Error(error.message);
      for (const r of rows ?? []) results.push(mapRow(r as Record<string, unknown>));
    }

    let hours = 0;
    let billableHours = 0;
    let approvedHours = 0;
    let revenue = 0;
    let cost = 0;
    for (const e of results) {
      const h = e.hours ?? 0;
      hours += h;
      if (e.billable) {
        billableHours += h;
        revenue += h * (e.effective_rate ?? 0);
      }
      if (e.approved_at) approvedHours += h;
      cost += h * (e.effective_cost_rate ?? 0);
    }
    const pendingHours = hours - approvedHours;
    const margin = revenue - cost;

    // capacityHours = soma((horas_por_semana ≈ allocation_pct% * 40) × dias_no_periodo / 7) por alocação
    let capacityHours = 0;
    for (const a of allocations) {
      const days = overlapDays(data.start, data.end, a.starts_at, a.ends_at);
      if (days <= 0) continue;
      const weeklyHours = (Number(a.allocation_pct) / 100) * 40;
      capacityHours += (weeklyHours * days) / 7;
    }
    const utilization = capacityHours > 0 ? billableHours / capacityHours : 0;

    return {
      entries: results,
      totals: {
        hours: Number(hours.toFixed(2)),
        billableHours: Number(billableHours.toFixed(2)),
        approvedHours: Number(approvedHours.toFixed(2)),
        pendingHours: Number(pendingHours.toFixed(2)),
        revenue: Number(revenue.toFixed(2)),
        cost: Number(cost.toFixed(2)),
        margin: Number(margin.toFixed(2)),
        capacityHours: Number(capacityHours.toFixed(2)),
        utilization: Number(utilization.toFixed(4)),
      },
    };
  });

// ============ Alocações no período (com utilização/margem) ============

export type AllocationInPeriod = {
  id: string;
  contract_id: string | null;
  contract_title: string | null;
  contract_number: string | null;
  project_id: string | null;
  project_name: string | null;
  role_title: string | null;
  allocation_pct: number;
  billable_rate: number | null;
  cost_rate: number | null;
  starts_at: string;
  ends_at: string | null;
  status: string;
  capacityHours: number;
  billableHours: number;
  revenue: number;
  cost: number;
  margin: number;
  utilization: number;
};

export const listPersonAllocationsInPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        person_id: z.string().uuid(),
        start: z.string(),
        end: z.string(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }): Promise<AllocationInPeriod[]> => {
    const { supabase } = context;
    const { cost_hour } = await resolvePerson(supabase, data.person_id);
    const allocations = await loadAllocationsFor(supabase, data.person_id, data.start, data.end);

    // Horas apontadas por alocação
    const { data: rows, error } = await supabase
      .from("project_time_entries")
      .select("hours, billable, hourly_rate, allocation_id, project_id, entry_date")
      .eq("person_id", data.person_id)
      .gte("entry_date", data.start)
      .lte("entry_date", data.end);
    if (error) throw new Error(error.message);

    const byAlloc = new Map<string, { billable: number; revenue: number; cost: number }>();
    for (const r of rows ?? []) {
      const row = r as {
        hours: number | null;
        billable: boolean;
        hourly_rate: number | null;
        allocation_id: string | null;
        project_id: string;
        entry_date: string | null;
      };
      const alloc = pickAllocationRate(allocations, {
        allocation_id: row.allocation_id,
        project_id: row.project_id,
        entry_date: row.entry_date,
      });
      if (!alloc) continue;
      const acc = byAlloc.get(alloc.id) ?? { billable: 0, revenue: 0, cost: 0 };
      const h = row.hours ?? 0;
      const rate = row.hourly_rate ?? alloc.billable_rate ?? 0;
      const cRate = alloc.cost_rate ?? cost_hour ?? 0;
      if (row.billable) {
        acc.billable += h;
        acc.revenue += h * rate;
      }
      acc.cost += h * cRate;
      byAlloc.set(alloc.id, acc);
    }

    return allocations.map((a) => {
      const stats = byAlloc.get(a.id) ?? { billable: 0, revenue: 0, cost: 0 };
      const days = overlapDays(data.start, data.end, a.starts_at, a.ends_at);
      const weeklyHours = (Number(a.allocation_pct) / 100) * 40;
      const capacityHours = Math.max(0, (weeklyHours * days) / 7);
      return {
        id: a.id,
        contract_id: a.contract_id,
        contract_title: a.contract_title ?? null,
        contract_number: a.contract_number ?? null,
        project_id: a.project_id,
        project_name: a.project_name ?? null,
        role_title: a.role_title,
        allocation_pct: Number(a.allocation_pct),
        billable_rate: a.billable_rate,
        cost_rate: a.cost_rate,
        starts_at: a.starts_at,
        ends_at: a.ends_at,
        status: a.status,
        capacityHours: Number(capacityHours.toFixed(2)),
        billableHours: Number(stats.billable.toFixed(2)),
        revenue: Number(stats.revenue.toFixed(2)),
        cost: Number(stats.cost.toFixed(2)),
        margin: Number((stats.revenue - stats.cost).toFixed(2)),
        utilization: capacityHours > 0 ? Number((stats.billable / capacityHours).toFixed(4)) : 0,
      };
    });
  });

// ============ Ações operacionais ============

export const approveTimesheetEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error, count } = await supabase
      .from("project_time_entries")
      .update({ approved_at: new Date().toISOString(), approved_by: userId }, { count: "exact" })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { approved: count ?? 0 };
  });

export const unapproveTimesheetEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error, count } = await supabase
      .from("project_time_entries")
      .update({ approved_at: null, approved_by: null }, { count: "exact" })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { unapproved: count ?? 0 };
  });

export const deleteTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("project_time_entries")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  person_id: z.string().uuid(),
  project_id: z.string().uuid(),
  task_id: z.string().uuid().nullable().optional(),
  allocation_id: z.string().uuid().nullable().optional(),
  entry_date: z.string(),
  hours: z.number().min(0).max(24),
  billable: z.boolean(),
  hourly_rate: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
});

export const upsertTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => upsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Resolve workspace do person para inserir workspace_id (NOT NULL)
    const { data: person, error: pErr } = await supabase
      .from("people")
      .select("owner_id, profile_id")
      .eq("id", data.person_id)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!person) throw new Error("Pessoa não encontrada");
    const workspace_id = (person as { owner_id: string }).owner_id;
    const profile_id = (person as { profile_id: string | null }).profile_id ?? userId;

    const payload = {
      workspace_id,
      user_id: profile_id,
      person_id: data.person_id,
      project_id: data.project_id,
      task_id: data.task_id ?? null,
      allocation_id: data.allocation_id ?? null,
      entry_date: data.entry_date,
      hours: data.hours,
      billable: data.billable,
      hourly_rate: data.hourly_rate ?? null,
      description: data.description ?? null,
    };

    if (data.id) {
      const { error } = await supabase
        .from("project_time_entries")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: inserted, error } = await supabase
      .from("project_time_entries")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (inserted as { id: string }).id };
  });

// ============ Retro-compatibilidade ============

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
    const { data: rows, error } = await (q as unknown as Promise<{
      data: Array<{
        hours: number | null;
        billable: boolean;
        hourly_rate: number | null;
        approved_at: string | null;
      }> | null;
      error: { message: string } | null;
    }>);
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
