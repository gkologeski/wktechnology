// Sprint 10 — Benefícios, Folha e Custos
// Server functions para gerenciar benefícios (people_benefits) e consulta de custo total.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const BENEFIT_TYPES = [
  "health",
  "dental",
  "meal",
  "food",
  "transport",
  "life_insurance",
  "gym",
  "education",
  "childcare",
  "other",
] as const;

export type BenefitType = (typeof BENEFIT_TYPES)[number];

export const BENEFIT_TYPE_LABELS: Record<BenefitType, string> = {
  health: "Plano de saúde",
  dental: "Plano odontológico",
  meal: "Vale-refeição",
  food: "Vale-alimentação",
  transport: "Vale-transporte",
  life_insurance: "Seguro de vida",
  gym: "Gympass / academia",
  education: "Educação",
  childcare: "Auxílio-creche",
  other: "Outro",
};

export type PeopleBenefitRow = {
  id: string;
  owner_id: string;
  person_id: string;
  benefit_type: BenefitType;
  provider: string | null;
  plan_name: string | null;
  monthly_value: number;
  employee_share: number;
  currency: string;
  starts_on: string | null;
  ends_on: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PeopleTotalCostRow = {
  person_id: string;
  owner_id: string;
  full_name: string;
  employment_type: string;
  status: string;
  monthly_cost: number | null;
  benefits_total: number;
  total_cost_monthly: number;
};

const BENEFIT_COLS =
  "id, owner_id, person_id, benefit_type, provider, plan_name, monthly_value, employee_share, currency, starts_on, ends_on, active, notes, created_at, updated_at";

// ============================================================
// list
// ============================================================
export const listPeopleBenefits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { personId: string }) =>
    z.object({ personId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("people_benefits")
      .select(BENEFIT_COLS)
      .eq("person_id", data.personId)
      .order("active", { ascending: false })
      .order("benefit_type", { ascending: true });
    if (error) throw error;
    return (rows ?? []) as PeopleBenefitRow[];
  });

// ============================================================
// upsert
// ============================================================
const upsertSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  person_id: z.string().uuid(),
  benefit_type: z.enum(BENEFIT_TYPES),
  provider: z.string().max(200).nullable().optional(),
  plan_name: z.string().max(200).nullable().optional(),
  monthly_value: z.number().nonnegative(),
  employee_share: z.number().nonnegative().optional(),
  currency: z.string().max(8).optional(),
  starts_on: z.string().nullable().optional(),
  ends_on: z.string().nullable().optional(),
  active: z.boolean().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const upsertPeopleBenefit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: z.infer<typeof upsertSchema>) => upsertSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Descobre owner_id via people.owner_id (garante RLS admin_v2 mesmo se o cliente enviar person_id alheio)
    const { data: person, error: personErr } = await supabase
      .from("people")
      .select("owner_id")
      .eq("id", data.person_id)
      .maybeSingle();
    if (personErr) throw personErr;
    if (!person) throw new Error("Pessoa não encontrada");

    const payload = {
      person_id: data.person_id,
      benefit_type: data.benefit_type,
      provider: data.provider ?? null,
      plan_name: data.plan_name ?? null,
      monthly_value: data.monthly_value,
      employee_share: data.employee_share ?? 0,
      currency: data.currency ?? "BRL",
      starts_on: data.starts_on ?? null,
      ends_on: data.ends_on ?? null,
      active: data.active ?? true,
      notes: data.notes ?? null,
    };

    if (data.id) {
      const { data: updated, error } = await supabase
        .from("people_benefits")
        .update(payload)
        .eq("id", data.id)
        .select(BENEFIT_COLS)
        .maybeSingle();
      if (error) throw error;
      return updated as PeopleBenefitRow | null;
    }

    const { data: inserted, error } = await supabase
      .from("people_benefits")
      .insert({
        ...payload,
        owner_id: (person as { owner_id: string }).owner_id,
        created_by: userId,
      })
      .select(BENEFIT_COLS)
      .maybeSingle();
    if (error) throw error;
    return inserted as PeopleBenefitRow | null;
  });

// ============================================================
// delete
// ============================================================
export const deletePeopleBenefit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("people_benefits").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============================================================
// getPersonTotalCost — consulta a view
// ============================================================
export const getPersonTotalCost = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { personId: string }) =>
    z.object({ personId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("people_total_cost")
      .select("*")
      .eq("person_id", data.personId)
      .maybeSingle();
    if (error) throw error;
    return (row ?? null) as PeopleTotalCostRow | null;
  });

// ============================================================
// listWorkspaceTotalCost — para dashboards de folha
// ============================================================
export const listWorkspaceTotalCost = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("people_total_cost")
      .select("*")
      .order("total_cost_monthly", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PeopleTotalCostRow[];
  });
