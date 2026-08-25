// Sprint 7 — Alertas operacionais consolidados.
// Retorna listas de contratos expirando, lançamentos vencidos e projetos em risco.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
};

export const getOperationalAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const today = new Date();
    const todayIso = iso(today);
    const in30 = iso(addDays(today, 30));

    // Contratos ativos expirando em <= 30d ou com renovação por vencer
    const { data: contractsRaw } = await supabase
      .from("contracts")
      .select("id, number, title, role, status, ends_at, auto_renew, notice_days")
      .in("status", ["active", "renewing", "awaiting_signature"])
      .not("ends_at", "is", null)
      .lte("ends_at", in30)
      .gte("ends_at", todayIso)
      .order("ends_at", { ascending: true })
      .limit(20);

    // Lançamentos vencidos
    const { data: overdueEntries } = await supabase
      .from("financial_entries")
      .select(
        "id, direction, description, amount, paid_amount, due_date, currency, companies:counterparty_company_id(name)",
      )
      .in("status", ["open", "partial", "overdue"])
      .lt("due_date", todayIso)
      .order("due_date", { ascending: true })
      .limit(20);

    // Projetos em risco: due_at passou e não concluído, OU status planning/on_hold parado
    const { data: projectsRaw } = await supabase
      .from("projects")
      .select("id, name, status, due_at, progress")
      .in("status", ["planning", "active", "on_hold"])
      .not("due_at", "is", null)
      .lte("due_at", in30)
      .order("due_at", { ascending: true })
      .limit(20);

    // Marcos billáveis atrasados
    const { data: milestonesRaw } = await supabase
      .from("project_milestones")
      .select("id, name, due_at, status, billable, bill_amount, project_id, projects(name)")
      .eq("billable", true)
      .neq("status", "done")
      .not("due_at", "is", null)
      .lt("due_at", todayIso)
      .order("due_at", { ascending: true })
      .limit(20);

    return {
      contractsExpiring: contractsRaw ?? [],
      overdueEntries: overdueEntries ?? [],
      projectsAtRisk: projectsRaw ?? [],
      overdueMilestones: milestonesRaw ?? [],
    };
  });
