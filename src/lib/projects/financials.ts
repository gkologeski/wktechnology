// Pure aggregation of project financials.
// Extraído do server fn `getProjectFinancials` para permitir testes unitários
// determinísticos sem depender de Supabase.

export type TimeEntryInput = {
  user_id: string;
  hours: number | string;
  billable: boolean | null;
};

export type MemberRatesInput = {
  user_id: string;
  cost_rate_hour: number | string | null;
  bill_rate_hour: number | string | null;
};

export type MilestoneInput = {
  bill_amount: number | string | null;
  billable: boolean | null;
  status: string | null;
};

export type ProjectFinancials = {
  loggedHours: number;
  realizedCost: number;
  billableRevenue: number;
  milestoneRevenue: number;
  totalRevenue: number;
  margin: number;
  hasRates: boolean;
};

export function computeProjectFinancials(
  entries: TimeEntryInput[] | null | undefined,
  members: MemberRatesInput[] | null | undefined,
  milestones: MilestoneInput[] | null | undefined,
): ProjectFinancials {
  const memberMap = new Map<string, { cost: number; bill: number }>();
  for (const m of members ?? []) {
    memberMap.set(m.user_id, {
      cost: Number(m.cost_rate_hour ?? 0),
      bill: Number(m.bill_rate_hour ?? 0),
    });
  }

  let realizedCost = 0;
  let billableRevenue = 0;
  let loggedHours = 0;
  for (const e of entries ?? []) {
    const rates = memberMap.get(e.user_id) ?? { cost: 0, bill: 0 };
    const h = Number(e.hours);
    loggedHours += h;
    realizedCost += h * rates.cost;
    if (e.billable) billableRevenue += h * rates.bill;
  }

  let milestoneRevenue = 0;
  for (const m of milestones ?? []) {
    if (m.billable && m.status === "done") {
      milestoneRevenue += Number(m.bill_amount ?? 0);
    }
  }

  const totalRevenue = billableRevenue + milestoneRevenue;
  const margin = totalRevenue - realizedCost;
  const hasRates = Array.from(memberMap.values()).some((r) => r.cost > 0 || r.bill > 0);

  return {
    loggedHours,
    realizedCost,
    billableRevenue,
    milestoneRevenue,
    totalRevenue,
    margin,
    hasRates,
  };
}
