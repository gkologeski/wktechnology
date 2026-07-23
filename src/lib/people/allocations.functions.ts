// Server functions para o módulo TechPeople — Sprint 4.
// Alocações de pessoas em contratos e projetos (VMS / Outsourcing).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ALLOCATION_STATUSES = ["active", "paused", "ended"] as const;
export type AllocationStatus = (typeof ALLOCATION_STATUSES)[number];

export const ALLOCATION_STATUS_LABELS: Record<AllocationStatus, string> = {
  active: "Ativa",
  paused: "Pausada",
  ended: "Encerrada",
};

export type AllocationRow = {
  id: string;
  workspace_id: string;
  owner_id: string;
  person_id: string;
  contract_id: string | null;
  project_id: string | null;
  manager_id: string | null;
  role_title: string | null;
  allocation_pct: number;
  billable_rate: number | null;
  cost_rate: number | null;
  currency: string;
  starts_at: string;
  ends_at: string | null;
  status: AllocationStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  person_name?: string | null;
  manager_name?: string | null;
  contract_title?: string | null;
  contract_number?: string | null;
  project_name?: string | null;
};

type MinimalClient = { from: (t: string) => unknown };
async function resolveWorkspaceId(supabase: MinimalClient, userId: string): Promise<string> {
  const q = supabase.from("profiles") as {
    select: (c: string) => {
      eq: (
        k: string,
        v: string,
      ) => {
        maybeSingle: () => Promise<{
          data: { active_workspace_id: string | null } | null;
        }>;
      };
    };
  };
  const { data } = await q.select("active_workspace_id").eq("id", userId).maybeSingle();
  const wsId = data?.active_workspace_id;
  if (!wsId) throw new Error("Workspace ativo não encontrado");
  return wsId;
}

const allocationSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  person_id: z.string().uuid(),
  contract_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  role_title: z.string().max(200).nullable().optional(),
  allocation_pct: z.number().min(0).max(100).default(100),
  billable_rate: z.number().nullable().optional(),
  cost_rate: z.number().nullable().optional(),
  currency: z.string().max(8).default("BRL"),
  starts_at: z.string(),
  ends_at: z.string().nullable().optional(),
  status: z.enum(ALLOCATION_STATUSES).default("active"),
  notes: z.string().max(4000).nullable().optional(),
});

export const listAllocationsByPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ person_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("people_allocations")
      .select(
        "*, contracts(id,title,number), projects(id,name)",
      )
      .eq("person_id", data.person_id)
      .order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const row = r as AllocationRow & {
        contracts?: { title: string | null; number: string | null } | null;
        projects?: { name: string | null } | null;
      };
      return {
        ...row,
        contract_title: row.contracts?.title ?? null,
        contract_number: row.contracts?.number ?? null,
        project_name: row.projects?.name ?? null,
      } as AllocationRow;
    });
  });

export const listAllocationsByContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ contract_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("people_allocations")
      .select("*, people(id,full_name)")
      .eq("contract_id", data.contract_id)
      .order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const row = r as AllocationRow & {
        people?: { full_name: string | null } | null;
      };
      return { ...row, person_name: row.people?.full_name ?? null } as AllocationRow;
    });
  });

export const upsertAllocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => allocationSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload: Record<string, unknown> = {
      person_id: data.person_id,
      contract_id: data.contract_id ?? null,
      project_id: data.project_id ?? null,
      role_title: data.role_title ?? null,
      allocation_pct: data.allocation_pct,
      billable_rate: data.billable_rate ?? null,
      cost_rate: data.cost_rate ?? null,
      currency: data.currency,
      starts_at: data.starts_at,
      ends_at: data.ends_at || null,
      status: data.status,
      notes: data.notes ?? null,
    };
    if (data.id) {
      const { error } = await supabase
        .from("people_allocations")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const workspaceId = await resolveWorkspaceId(supabase, userId);
    const { data: row, error } = await supabase
      .from("people_allocations")
      .insert({ ...payload, workspace_id: workspaceId, owner_id: userId } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id };
  });

export const deleteAllocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("people_allocations")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Cálculo de margem por alocação: (billable - cost) * allocation_pct / 100
export function computeMonthlyMargin(row: AllocationRow, hoursPerMonth = 160): {
  revenue: number;
  cost: number;
  margin: number;
  marginPct: number;
} {
  const pct = row.allocation_pct / 100;
  const revenue = (row.billable_rate ?? 0) * hoursPerMonth * pct;
  const cost = (row.cost_rate ?? 0) * hoursPerMonth * pct;
  const margin = revenue - cost;
  const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
  return { revenue, cost, margin, marginPct };
}
