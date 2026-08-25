// TechPeople · Sprint 11 — Analytics
// Server functions para dashboard de headcount, turnover, custo e margem.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PeopleAnalyticsRow = {
  headcount_total: number;
  headcount_by_status: Record<string, number>;
  headcount_by_employment: Record<string, number>;
  hires_last_12m: { month: string; count: number }[];
  terminations_last_12m: { month: string; count: number }[];
  turnover_rate_12m: number; // % anualizado sobre headcount médio
  monthly_cost_total: number;
  benefits_total: number;
  total_cost_monthly: number;
  allocations_active: number;
  allocations_billable_revenue: number;
  allocations_cost: number;
  allocations_margin: number;
  allocations_margin_pct: number;
};

type PersonMini = {
  id: string;
  status: string;
  employment_type: string;
  hire_date: string | null;
  termination_date: string | null;
  monthly_cost: number | null;
  archived: boolean;
};

type BenefitMini = {
  monthly_value: number;
  active: boolean;
  starts_on: string | null;
  ends_on: string | null;
};

type AllocMini = {
  status: string;
  allocation_pct: number;
  billable_rate: number | null;
  cost_rate: number | null;
};

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function last12Months(): string[] {
  const out: string[] = [];
  const now = new Date();
  now.setDate(1);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(monthKey(d));
  }
  return out;
}

export const getPeopleAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PeopleAnalyticsRow> => {
    const { supabase } = context;

    const peopleRes = await (
      supabase.from("people") as unknown as {
        select: (c: string) => {
          eq: (k: string, v: boolean) => Promise<{ data: PersonMini[] | null; error: unknown }>;
        };
      }
    )
      .select("id, status, employment_type, hire_date, termination_date, monthly_cost, archived")
      .eq("archived", false);
    const people: PersonMini[] = peopleRes.data ?? [];

    const benRes = await (
      supabase.from("people_benefits") as unknown as {
        select: (c: string) => Promise<{ data: BenefitMini[] | null; error: unknown }>;
      }
    ).select("monthly_value, active, starts_on, ends_on");
    const benefits: BenefitMini[] = benRes.data ?? [];

    const allocRes = await (
      supabase.from("people_allocations") as unknown as {
        select: (c: string) => Promise<{ data: AllocMini[] | null; error: unknown }>;
      }
    ).select("status, allocation_pct, billable_rate, cost_rate");
    const allocations: AllocMini[] = allocRes.data ?? [];

    // Headcount ativo = status != terminated
    const activePeople = people.filter((p) => p.status !== "terminated");
    const headcount_total = activePeople.length;

    const headcount_by_status: Record<string, number> = {};
    const headcount_by_employment: Record<string, number> = {};
    for (const p of activePeople) {
      headcount_by_status[p.status] = (headcount_by_status[p.status] ?? 0) + 1;
      headcount_by_employment[p.employment_type] =
        (headcount_by_employment[p.employment_type] ?? 0) + 1;
    }

    // Hires/terminations por mês (últimos 12)
    const months = last12Months();
    const hiresMap = new Map<string, number>(months.map((m) => [m, 0]));
    const termsMap = new Map<string, number>(months.map((m) => [m, 0]));
    for (const p of people) {
      if (p.hire_date) {
        const k = p.hire_date.slice(0, 7);
        if (hiresMap.has(k)) hiresMap.set(k, (hiresMap.get(k) ?? 0) + 1);
      }
      if (p.termination_date) {
        const k = p.termination_date.slice(0, 7);
        if (termsMap.has(k)) termsMap.set(k, (termsMap.get(k) ?? 0) + 1);
      }
    }
    const hires_last_12m = months.map((m) => ({ month: m, count: hiresMap.get(m) ?? 0 }));
    const terminations_last_12m = months.map((m) => ({
      month: m,
      count: termsMap.get(m) ?? 0,
    }));

    const totalTerms = terminations_last_12m.reduce((s, r) => s + r.count, 0);
    const avgHeadcount = Math.max(1, headcount_total);
    const turnover_rate_12m = (totalTerms / avgHeadcount) * 100;

    // Custos: apenas pessoas ativas
    const monthly_cost_total = activePeople.reduce((s, p) => s + Number(p.monthly_cost ?? 0), 0);
    const today = new Date().toISOString().slice(0, 10);
    const benefits_total = benefits
      .filter(
        (b) =>
          b.active && (!b.starts_on || b.starts_on <= today) && (!b.ends_on || b.ends_on >= today),
      )
      .reduce((s, b) => s + Number(b.monthly_value ?? 0), 0);
    const total_cost_monthly = monthly_cost_total + benefits_total;

    // Alocações ativas — projeção mensal (160h/mês)
    const hoursPerMonth = 160;
    const activeAllocs = allocations.filter((a) => a.status === "active");
    let revenue = 0;
    let cost = 0;
    for (const a of activeAllocs) {
      const pct = (a.allocation_pct ?? 100) / 100;
      revenue += Number(a.billable_rate ?? 0) * hoursPerMonth * pct;
      cost += Number(a.cost_rate ?? 0) * hoursPerMonth * pct;
    }
    const margin = revenue - cost;
    const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;

    return {
      headcount_total,
      headcount_by_status,
      headcount_by_employment,
      hires_last_12m,
      terminations_last_12m,
      turnover_rate_12m,
      monthly_cost_total,
      benefits_total,
      total_cost_monthly,
      allocations_active: activeAllocs.length,
      allocations_billable_revenue: revenue,
      allocations_cost: cost,
      allocations_margin: margin,
      allocations_margin_pct: marginPct,
    };
  });
