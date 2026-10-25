import type { SupabaseClient } from "@supabase/supabase-js";
import { workRpc } from "@/lib/access-control/work-core.server";
import { requireSharedPermission } from "@/lib/access-control/shared-permission.middleware";
// Home dashboard: KPIs agregados por módulo, filtrados por intervalo de datas.
// Consulta é feita pelo cliente supabase autenticado (RLS aplicada como o usuário).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RangeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});

export type ModuleKpi = { label: string; value: string; hint?: string };
export type ModuleSection = { moduleId: string; kpis: ModuleKpi[] };
export type HomeDashboardResponse = {
  from: string;
  to: string;
  enabledModules: string[];
  sections: ModuleSection[];
};

async function safeCount(
  sb: any,
  workspaceId: string,
  table: string,
  build: (q: any) => any,
): Promise<number> {
  try {
    const q = sb
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);
    const { count, error } = await build(q);
    if (error) throw new Error(error.message);
    return count ?? 0;
  } catch {
    throw new Error("Não foi possível consultar os indicadores autorizados.");
  }
}

async function safeSum(
  sb: any,
  workspaceId: string,
  table: string,
  column: string,
  build: (q: any) => any,
): Promise<number> {
  try {
    const q = sb.from(table).select(column).eq("workspace_id", workspaceId);
    const { data, error } = await build(q);
    if (error) throw new Error(error.message);
    if (!data) return 0;
    return (data as Array<Record<string, number | null>>).reduce(
      (acc, r) => acc + (Number(r[column]) || 0),
      0,
    );
  } catch {
    throw new Error("Não foi possível consultar os indicadores autorizados.");
  }
}

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

async function loadHomeDashboard(
  supabase: SupabaseClient,
  workspaceId: string,
  data: z.infer<typeof RangeSchema>,
): Promise<HomeDashboardResponse> {
  const { from, to } = data;

  let enabledModules: string[] = [];
  if (workspaceId) {
    const { data: rows, error } = await supabase
      .from("workspace_modules")
      .select("module_id, enabled")
      .eq("workspace_id", workspaceId)
      .eq("enabled", true);
    if (error) throw new Error("Não foi possível consultar os módulos autorizados.");
    enabledModules = (rows ?? []).map((r) => r.module_id as string);
  }

  const fieldContext = await workRpc<{ rules?: Record<string, Record<string, string>> }>(
    supabase,
    "shared_field_context",
    {},
  );
  const sections: ModuleSection[] = [];

  if (enabledModules.includes("crm")) {
    const [
      leadsCount,
      dealsCreated,
      dealsWonCount,
      dealsWonValue,
      dealsLostCount,
      dealsLostValue,
      pipelineOpen,
    ] = await Promise.all([
      safeCount(supabase, workspaceId, "leads", (q) =>
        q.gte("created_at", from).lte("created_at", to),
      ),
      safeCount(supabase, workspaceId, "deals", (q) =>
        q.gte("created_at", from).lte("created_at", to),
      ),
      // Janela pela data real de fechamento (preenchida por trigger em stage = 'won').
      safeCount(supabase, workspaceId, "deals", (q) =>
        q.eq("stage", "won").gte("closed_at", from).lte("closed_at", to),
      ),
      safeSum(supabase, workspaceId, "deals", "value", (q) =>
        q.eq("stage", "won").gte("closed_at", from).lte("closed_at", to),
      ),
      // Perdidos pela data real de perda (trigger em stage = 'lost').
      safeCount(supabase, workspaceId, "deals", (q) =>
        q.eq("stage", "lost").gte("lost_at", from).lte("lost_at", to),
      ),
      safeSum(supabase, workspaceId, "deals", "value", (q) =>
        q.eq("stage", "lost").gte("lost_at", from).lte("lost_at", to),
      ),
      safeSum(supabase, workspaceId, "deals", "value", (q) => q.not("stage", "in", "(won,lost)")),
    ]);
    const closedTotal = dealsWonCount + dealsLostCount;
    sections.push({
      moduleId: "crm",
      kpis: [
        { label: "Leads criados", value: String(leadsCount) },
        { label: "Negócios criados", value: String(dealsCreated) },
        { label: "Negócios ganhos", value: String(dealsWonCount), hint: fmtBRL(dealsWonValue) },
        {
          label: "Negócios perdidos",
          value: String(dealsLostCount),
          hint: fmtBRL(dealsLostValue),
        },
        {
          label: "Taxa de conversão",
          value: closedTotal > 0 ? `${((dealsWonCount / closedTotal) * 100).toFixed(1)}%` : "—",
          hint:
            closedTotal > 0
              ? `${dealsWonCount} de ${closedTotal} fechados`
              : "Sem fechamentos no período",
        },
        { label: "Pipeline aberto", value: fmtBRL(pipelineOpen) },
      ],
    });
  }

  if (enabledModules.includes("ats")) {
    const [candidates, applications, interviews, offers] = await Promise.all([
      safeCount(supabase, workspaceId, "ats_candidates", (q) =>
        q.gte("created_at", from).lte("created_at", to),
      ),
      safeCount(supabase, workspaceId, "ats_applications", (q) =>
        q.gte("created_at", from).lte("created_at", to),
      ),
      safeCount(supabase, workspaceId, "ats_interviews", (q) =>
        q.gte("created_at", from).lte("created_at", to),
      ),
      safeCount(supabase, workspaceId, "ats_offers", (q) =>
        q.gte("created_at", from).lte("created_at", to),
      ),
    ]);
    sections.push({
      moduleId: "ats",
      kpis: [
        { label: "Candidatos", value: String(candidates) },
        { label: "Aplicações", value: String(applications) },
        { label: "Entrevistas", value: String(interviews) },
        { label: "Ofertas", value: String(offers) },
      ],
    });
  }

  if (enabledModules.includes("contracts")) {
    const [created, active] = await Promise.all([
      safeCount(supabase, workspaceId, "contracts", (q) =>
        q.gte("created_at", from).lte("created_at", to),
      ),
      safeCount(supabase, workspaceId, "contracts", (q) => q.eq("status", "active")),
    ]);
    sections.push({
      moduleId: "contracts",
      kpis: [
        { label: "Contratos criados", value: String(created) },
        { label: "Contratos ativos", value: String(active) },
      ],
    });
  }

  if (enabledModules.includes("projects")) {
    const totals = await workRpc<{ tasks_done: number; active_projects: number }>(
      supabase,
      "shared_home_project_totals",
      { p_from: from, p_to: to },
    );
    sections.push({
      moduleId: "projects",
      kpis: [
        { label: "Tarefas concluídas", value: String(totals.tasks_done) },
        { label: "Projetos ativos", value: String(totals.active_projects) },
      ],
    });
  }

  if (enabledModules.includes("finance")) {
    const totals = await workRpc<{
      receivable_open: number | null;
      payable_open: number | null;
      payments_in_period: number | null;
    }>(supabase, "shared_home_financial_totals", { p_from: from, p_to: to });
    const financeValue = (value: number | null) => (value === null ? "Restrito" : fmtBRL(value));
    sections.push({
      moduleId: "finance",
      kpis: [
        { label: "A receber (aberto)", value: financeValue(totals.receivable_open) },
        { label: "A pagar (aberto)", value: financeValue(totals.payable_open) },
        { label: "Pagamentos no período", value: financeValue(totals.payments_in_period) },
      ],
    });
  }

  if (enabledModules.includes("people")) {
    const [active, expiring] = await Promise.all([
      safeCount(supabase, workspaceId, "people", (q) => q.eq("status", "active")),
      workRpc<number | null>(supabase, "shared_home_expiring_documents", {}),
    ]);
    sections.push({
      moduleId: "people",
      kpis: [
        { label: "Pessoas ativas", value: String(active) },
        {
          label: "Documentos vencendo",
          value: expiring === null ? "Restrito" : String(expiring),
        },
      ],
    });
  }

  const valueMode = fieldContext.rules?.["techsales.deals"]?.value;
  if (valueMode === "hidden" || valueMode === "masked")
    for (const section of sections)
      if (section.moduleId === "crm")
        for (const kpi of section.kpis) {
          if (kpi.label === "Pipeline aberto") kpi.value = "Restrito";
          if (kpi.label === "Negócios ganhos" || kpi.label === "Negócios perdidos")
            kpi.hint = "Valor restrito";
        }
  return { from, to, enabledModules, sections };
}

export const getHomeDashboard = createServerFn({ method: "POST" })
  .middleware([requireSharedPermission("system.home")])
  .inputValidator((d: unknown) => RangeSchema.parse(d))
  .handler(({ context, data }) =>
    loadHomeDashboard(context.supabase, context.sharedWorkspaceId, data),
  );

export const exportHomeDashboard = createServerFn({ method: "POST" })
  .middleware([requireSharedPermission("system.home", "export")])
  .inputValidator((d: unknown) => RangeSchema.parse(d))
  .handler(({ context, data }) =>
    loadHomeDashboard(context.supabase, context.sharedWorkspaceId, data),
  );
