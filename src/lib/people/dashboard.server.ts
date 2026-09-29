import type { SupabaseClient } from "@supabase/supabase-js";
import { hasPermission } from "@/lib/access-control/enforce.server";
import type { PeopleDashboardData } from "./dashboard.types";

export async function loadPeopleDashboard(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
): Promise<PeopleDashboardData> {
  const canViewFinancials = await hasPermission(
    supabase,
    userId,
    workspaceId,
    "techpeople.allocations.view.workspace",
  );
  const [peopleResult, documentsResult, plansResult, allocationsResult] = await Promise.all([
    supabase.from("people").select("status, employment_type, archived").eq("archived", false),
    supabase.from("people_documents").select("status, expires_at").limit(2000),
    supabase
      .from("people_onboarding_plans")
      .select("kind, status, target_completion_date")
      .limit(2000),
    canViewFinancials
      ? supabase
          .from("people_allocations")
          .select("status, allocation_pct, billable_rate, cost_rate")
          .limit(2000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const firstError =
    peopleResult.error ?? documentsResult.error ?? plansResult.error ?? allocationsResult.error;
  if (firstError)
    throw new Error(`Não foi possível carregar os dados de Pessoas: ${firstError.message}`);

  const people = (peopleResult.data ?? []).filter((row) => row.status !== "terminated");
  const documents = documentsResult.data ?? [];
  const plans = plansResult.data ?? [];
  const allocations = (allocationsResult.data ?? []).filter((row) => row.status === "active");
  const employmentMap = new Map<string, number>();
  for (const row of people) {
    employmentMap.set(row.employment_type, (employmentMap.get(row.employment_type) ?? 0) + 1);
  }
  const allocationTotal = allocations.reduce(
    (sum, row) => sum + Number(row.allocation_pct ?? 0),
    0,
  );
  const revenue = allocations.reduce(
    (sum, row) =>
      sum + Number(row.billable_rate ?? 0) * 160 * (Number(row.allocation_pct ?? 0) / 100),
    0,
  );
  const cost = allocations.reduce(
    (sum, row) => sum + Number(row.cost_rate ?? 0) * 160 * (Number(row.allocation_pct ?? 0) / 100),
    0,
  );
  const today = new Date().toISOString().slice(0, 10);
  const inThirtyDays = new Date();
  inThirtyDays.setDate(inThirtyDays.getDate() + 30);
  const cutoff = inThirtyDays.toISOString().slice(0, 10);
  const isOpen = (status: string) => !["completed", "cancelled", "done"].includes(status);

  return {
    headcount: people.length,
    activeAllocations: allocations.length,
    allocationRate: people.length > 0 ? allocationTotal / people.length : 0,
    marginPct: canViewFinancials && revenue > 0 ? ((revenue - cost) / revenue) * 100 : null,
    canViewFinancials,
    employment: Array.from(employmentMap, ([type, count]) => ({ type, count })).sort(
      (a, b) => b.count - a.count,
    ),
    expiringDocuments: documents.filter(
      (row) =>
        row.status === "expired" ||
        row.status === "expiring" ||
        (Boolean(row.expires_at) && String(row.expires_at).slice(0, 10) <= cutoff),
    ).length,
    activeOnboarding: plans.filter((row) => row.kind !== "offboarding" && isOpen(row.status))
      .length,
    activeOffboarding: plans.filter((row) => row.kind === "offboarding" && isOpen(row.status))
      .length,
    overduePlans: plans.filter(
      (row) =>
        isOpen(row.status) &&
        Boolean(row.target_completion_date) &&
        String(row.target_completion_date).slice(0, 10) < today,
    ).length,
  };
}
