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
  purchase_contract_id: string | null;

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
  contracting_preset_id?: string | null;
  competencies?: string[] | null;
  created_at: string;
  updated_at: string;
  // joined
  person_name?: string | null;
  manager_name?: string | null;
  contract_title?: string | null;
  contract_number?: string | null;
  purchase_contract_title?: string | null;
  purchase_contract_number?: string | null;
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
  purchase_contract_id: z.string().uuid().nullable().optional(),

  project_id: z.string().uuid().nullable().optional(),
  manager_id: z.string().uuid().nullable().optional(),
  role_title: z.string().max(200).nullable().optional(),
  allocation_pct: z.number().min(0).max(100).default(100),
  billable_rate: z.number().nullable().optional(),
  cost_rate: z.number().nullable().optional(),
  currency: z.string().max(8).default("BRL"),
  starts_at: z.string(),
  ends_at: z.string().nullable().optional(),
  status: z.enum(ALLOCATION_STATUSES).default("active"),
  notes: z.string().max(4000).nullable().optional(),
  // Senioridade não é coluna da alocação: serve para sugerir/preencher
  // people.seniority quando o cadastro da pessoa estiver vazio.
  seniority: z.string().max(60).nullable().optional(),
  // Preset de contratação usado como base e competências acordadas.
  contracting_preset_id: z.string().uuid().nullable().optional(),
  competencies: z.array(z.string().max(120)).max(50).optional(),
});

export type ContractRoleSuggestion = {
  service_id: string;
  service_name: string;
  job_profile_id: string | null;
  job_profile_name: string | null;
  seniority: string | null;
  competencies: string[];
  /** Preset de contratação coerente com o cargo do serviço, quando existir. */
  contracting_preset_id: string | null;
  preset_name: string | null;
  suggested_billable_rate: number | null;
  suggested_cost_rate: number | null;
  unit: string | null;
};

// Sugestões de cargo/senioridade a partir dos serviços associados ao contrato,
// enriquecidas com os presets de contratação do mesmo cargo (competências e
// valores sugeridos).
export const listContractRoleSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ contract_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("services")
      .select("id, name, seniority, competencies, job_profile_id, job_profiles(id, name)")
      .eq("contract_id", data.contract_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const services = (rows ?? []) as unknown as Array<{
      id: string;
      name: string | null;
      seniority: string | null;
      competencies: string[] | null;
      job_profile_id: string | null;
      job_profiles?: { name: string | null } | null;
    }>;

    const profileIds = [
      ...new Set(services.map((r) => r.job_profile_id).filter(Boolean)),
    ] as string[];
    type PresetRow = {
      id: string;
      name: string;
      job_profile_id: string | null;
      seniority: string | null;
      competencies: string[] | null;
      unit: string | null;
      default_unit_price: number | null;
      default_unit_cost: number | null;
    };
    let presets: PresetRow[] = [];
    if (profileIds.length) {
      const { data: presetRows } = await context.supabase
        .from("contracting_presets")
        .select(
          "id, name, job_profile_id, seniority, competencies, unit, default_unit_price, default_unit_cost",
        )
        .eq("active", true)
        .in("job_profile_id", profileIds)
        .limit(200);
      presets = (presetRows ?? []) as unknown as PresetRow[];
    }

    return services.map((row) => {
      const candidates = presets.filter((pr) => pr.job_profile_id === row.job_profile_id);
      const preset =
        candidates.find((pr) => pr.seniority && pr.seniority === row.seniority) ??
        candidates[0] ??
        null;
      const competencies = [
        ...new Set([...(row.competencies ?? []), ...((preset?.competencies ?? []) as string[])]),
      ];
      return {
        service_id: row.id,
        service_name: row.name ?? "Serviço",
        job_profile_id: row.job_profile_id ?? null,
        job_profile_name: row.job_profiles?.name ?? null,
        seniority: row.seniority ?? preset?.seniority ?? null,
        competencies,
        contracting_preset_id: preset?.id ?? null,
        preset_name: preset?.name ?? null,
        suggested_billable_rate:
          preset?.default_unit_price != null ? Number(preset.default_unit_price) : null,
        suggested_cost_rate:
          preset?.default_unit_cost != null ? Number(preset.default_unit_cost) : null,
        unit: preset?.unit ?? null,
      } satisfies ContractRoleSuggestion;
    });
  });

export const listAllocationsByPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ person_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("people_allocations")
      .select(
        "*, contract:contracts!people_allocations_contract_id_fkey(id,title,number), purchase_contract:contracts!people_allocations_purchase_contract_id_fkey(id,title,number), projects(id,name), manager:people!people_allocations_manager_id_fkey(id,full_name)",
      )
      .eq("person_id", data.person_id)
      .order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const row = r as unknown as AllocationRow & {
        contract?: { title: string | null; number: string | null } | null;
        purchase_contract?: { title: string | null; number: string | null } | null;
        projects?: { name: string | null } | null;
        manager?: { full_name: string | null } | null;
      };
      return {
        ...row,
        contract_title: row.contract?.title ?? null,
        contract_number: row.contract?.number ?? null,
        purchase_contract_title: row.purchase_contract?.title ?? null,
        purchase_contract_number: row.purchase_contract?.number ?? null,
        project_name: row.projects?.name ?? null,
        manager_name: row.manager?.full_name ?? null,
      } as AllocationRow;
    });
  });

export const listAllocationsByContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ contract_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("people_allocations")
      .select(
        "*, person:people!people_allocations_person_id_fkey(id,full_name), manager:people!people_allocations_manager_id_fkey(id,full_name)",
      )
      .eq("contract_id", data.contract_id)
      .order("starts_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const row = r as unknown as AllocationRow & {
        person?: { full_name: string | null } | null;
        manager?: { full_name: string | null } | null;
      };
      return {
        ...row,
        person_name: row.person?.full_name ?? null,
        manager_name: row.manager?.full_name ?? null,
      } as AllocationRow;
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
      purchase_contract_id: data.purchase_contract_id ?? null,

      project_id: data.project_id ?? null,
      manager_id: data.manager_id ?? null,
      role_title: data.role_title ?? null,
      allocation_pct: data.allocation_pct,
      billable_rate: data.billable_rate ?? null,
      cost_rate: data.cost_rate ?? null,
      currency: data.currency,
      starts_at: data.starts_at,
      ends_at: data.ends_at || null,
      status: data.status,
      notes: data.notes ?? null,
      contracting_preset_id: data.contracting_preset_id ?? null,
      competencies: data.competencies ?? [],
    };
    // Preenche o cadastro da pessoa só quando os campos estão vazios —
    // nunca sobrescreve informação já cadastrada pelo RH.
    async function syncPerson() {
      const roleTitle = (data.role_title ?? "").trim();
      const seniority = (data.seniority ?? "").trim();
      if (!roleTitle && !seniority) return;
      const { data: person } = await supabase
        .from("people")
        .select("id, role_title, seniority")
        .eq("id", data.person_id)
        .maybeSingle();
      const p = person as { role_title: string | null; seniority: string | null } | null;
      if (!p) return;
      const patch: { role_title?: string; seniority?: string } = {};
      if (roleTitle && !(p.role_title ?? "").trim()) patch.role_title = roleTitle;
      if (seniority && !(p.seniority ?? "").trim()) patch.seniority = seniority;
      if (Object.keys(patch).length === 0) return;
      await supabase
        .from("people")
        .update(patch as never)
        .eq("id", data.person_id);
    }
    if (data.id) {
      const { error } = await supabase
        .from("people_allocations")
        .update(payload as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await syncPerson();
      return { id: data.id };
    }
    const workspaceId = await resolveWorkspaceId(supabase, userId);
    const { data: row, error } = await supabase
      .from("people_allocations")
      .insert({ ...payload, workspace_id: workspaceId, owner_id: userId } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await syncPerson();
    return { id: (row as { id: string }).id };
  });

export const deleteAllocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("people_allocations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Cálculo de margem por alocação: (billable - cost) * allocation_pct / 100
export function computeMonthlyMargin(
  row: AllocationRow,
  hoursPerMonth = 160,
): {
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
