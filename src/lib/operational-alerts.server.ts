import type { SupabaseClient } from "@supabase/supabase-js";
import { workCanRead } from "./access-control/work-read-gate.server";

/** User/RLS reads only. Independent lists start together; failures never mean zero alerts. */
export async function loadOperationalAlerts(client: SupabaseClient, userId: string, now = new Date()) {
  const profile = await client.from("profiles").select("active_workspace_id").eq("id", userId).maybeSingle();
  const workspace = profile.data?.active_workspace_id;
  if (profile.error || !workspace) throw new Error("Workspace ativo indisponível.");
  const member = await client.rpc("is_workspace_member", { _workspace: workspace, _user: userId });
  if (member.error || member.data !== true) throw new Error("Membro ativo obrigatório.");
  const canRead = async (resource: string) => {
    const results = await Promise.all(["own", "team", "workspace"].map((scope) => client.rpc("user_has_permission", {
      _workspace_id: workspace, _user_id: userId, _permission_key: `${resource}.view.${scope}`,
    })));
    if (results.some((r) => r.error)) throw new Error("Não foi possível conferir o acesso aos alertas.");
    return results.some((r) => r.data === true);
  };
  const [contractsAllowed, entriesAllowed, projectsAllowed, milestonesAllowed] = await Promise.all([
    canRead("techcontracts.contracts"), canRead("techfinance.entries"),
    workCanRead(client, "techprojects.projects"), workCanRead(client, "techprojects.milestones"),
  ]);
  const today = now.toISOString().slice(0, 10);
  const end = new Date(now);
  end.setDate(end.getDate() + 30);
  const in30 = end.toISOString().slice(0, 10);
  const empty = { data: [], error: null };
  const results = await Promise.all([
    contractsAllowed ? client.from("contracts").select("id, number, title, role, status, ends_at, auto_renew, notice_days")
      .eq("workspace_id", workspace).in("status", ["active", "renewing", "awaiting_signature"])
      .not("ends_at", "is", null).lte("ends_at", in30).gte("ends_at", today).order("ends_at", { ascending: true }).limit(20) : empty,
    entriesAllowed ? client.from("financial_entries").select("id, direction, description, amount, paid_amount, due_date, currency, companies:counterparty_company_id(name)")
      .eq("workspace_id", workspace).in("status", ["open", "partial", "overdue"]).lt("due_date", today).order("due_date", { ascending: true }).limit(20) : empty,
    projectsAllowed ? client.from("projects").select("id, name, status, due_at, progress")
      .eq("workspace_id", workspace).in("status", ["planning", "active", "on_hold"]).not("due_at", "is", null).lte("due_at", in30).order("due_at", { ascending: true }).limit(20) : empty,
    milestonesAllowed ? client.from("project_milestones").select("id, name, due_at, status, billable, bill_amount, project_id, projects(name)")
      .eq("workspace_id", workspace).eq("billable", true).neq("status", "done").not("due_at", "is", null).lt("due_at", today).order("due_at", { ascending: true }).limit(20) : empty,
  ]);
  if (results.some((r) => r.error)) throw new Error("Não foi possível carregar todos os alertas operacionais. Tente novamente.");
  return { contractsExpiring: results[0].data ?? [], overdueEntries: results[1].data ?? [], projectsAtRisk: results[2].data ?? [], overdueMilestones: results[3].data ?? [] };
}