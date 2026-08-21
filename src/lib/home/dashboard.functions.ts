// Home dashboard: KPIs agregados por módulo, filtrados por intervalo de datas.
// Consulta é feita pelo cliente supabase autenticado (RLS aplicada como o usuário).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeCount(sb: any, table: string, build: (q: any) => any): Promise<number> {
  try {
    const q = sb.from(table).select("id", { count: "exact", head: true });
    const { count, error } = await build(q);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function safeSum(
  sb: any,
  table: string,
  column: string,
  build: (q: any) => any,
): Promise<number> {
  try {
    const q = sb.from(table).select(column);
    const { data, error } = await build(q);
    if (error || !data) return 0;
    return (data as Array<Record<string, number | null>>).reduce(
      (acc, r) => acc + (Number(r[column]) || 0),
      0,
    );
  } catch {
    return 0;
  }
}

function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

export const getHomeDashboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RangeSchema.parse(d))
  .handler(async ({ context, data }): Promise<HomeDashboardResponse> => {
    const { supabase, userId } = context;
    const { from, to } = data;

    // Resolve workspace ativo
    const wm = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    const workspaceId = wm.data?.workspace_id as string | undefined;

    let enabledModules: string[] = [];
    if (workspaceId) {
      const { data: rows } = await supabase
        .from("workspace_modules")
        .select("module_id, enabled")
        .eq("workspace_id", workspaceId)
        .eq("enabled", true);
      enabledModules = (rows ?? []).map((r) => r.module_id as string);
    }

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
        safeCount(supabase, "leads", (q) => q.gte("created_at", from).lte("created_at", to)),
        safeCount(supabase, "deals", (q) => q.gte("created_at", from).lte("created_at", to)),
        // Janela pela data real de fechamento (preenchida por trigger em stage = 'won').
        safeCount(supabase, "deals", (q) =>
          q.eq("stage", "won").gte("closed_at", from).lte("closed_at", to),
        ),
        safeSum(supabase, "deals", "value", (q) =>
          q.eq("stage", "won").gte("closed_at", from).lte("closed_at", to),
        ),
        // Perdidos pela data real de perda (trigger em stage = 'lost').
        safeCount(supabase, "deals", (q) =>
          q.eq("stage", "lost").gte("lost_at", from).lte("lost_at", to),
        ),
        safeSum(supabase, "deals", "value", (q) =>
          q.eq("stage", "lost").gte("lost_at", from).lte("lost_at", to),
        ),
        safeSum(supabase, "deals", "value", (q) => q.not("stage", "in", "(won,lost)")),
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
            value:
              closedTotal > 0 ? `${((dealsWonCount / closedTotal) * 100).toFixed(1)}%` : "—",
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
        safeCount(supabase, "ats_candidates", (q) =>
          q.gte("created_at", from).lte("created_at", to),
        ),
        safeCount(supabase, "ats_applications", (q) =>
          q.gte("created_at", from).lte("created_at", to),
        ),
        safeCount(supabase, "ats_interviews", (q) =>
          q.gte("created_at", from).lte("created_at", to),
        ),
        safeCount(supabase, "ats_offers", (q) => q.gte("created_at", from).lte("created_at", to)),
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
        safeCount(supabase, "contracts", (q) => q.gte("created_at", from).lte("created_at", to)),
        safeCount(supabase, "contracts", (q) => q.eq("status", "active")),
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
      const [tasksDone, activeProjects] = await Promise.all([
        safeCount(supabase, "project_tasks", (q) =>
          q.eq("status", "done").gte("updated_at", from).lte("updated_at", to),
        ),
        safeCount(supabase, "projects", (q) => q.eq("status", "active")),
      ]);
      sections.push({
        moduleId: "projects",
        kpis: [
          { label: "Tarefas concluídas", value: String(tasksDone) },
          { label: "Projetos ativos", value: String(activeProjects) },
        ],
      });
    }

    if (enabledModules.includes("finance")) {
      const [recvOpen, payOpen, paymentsIn] = await Promise.all([
        safeSum(supabase, "financial_entries", "amount", (q) =>
          q.eq("direction", "receivable").in("status", ["open", "partial", "overdue"]),
        ),
        safeSum(supabase, "financial_entries", "amount", (q) =>
          q.eq("direction", "payable").in("status", ["open", "partial", "overdue"]),
        ),
        safeSum(supabase, "financial_payments", "amount", (q) =>
          q.gte("paid_at", from).lte("paid_at", to),
        ),
      ]);
      sections.push({
        moduleId: "finance",
        kpis: [
          { label: "A receber (aberto)", value: fmtBRL(recvOpen) },
          { label: "A pagar (aberto)", value: fmtBRL(payOpen) },
          { label: "Pagamentos no período", value: fmtBRL(paymentsIn) },
        ],
      });
    }

    if (enabledModules.includes("people")) {
      const [active, expiring] = await Promise.all([
        safeCount(supabase, "people", (q) => q.eq("status", "active")),
        safeCount(supabase, "people_documents", (q) => q.eq("status", "expiring")),
      ]);
      sections.push({
        moduleId: "people",
        kpis: [
          { label: "Pessoas ativas", value: String(active) },
          { label: "Documentos vencendo", value: String(expiring) },
        ],
      });
    }

    return { from, to, enabledModules, sections };
  });
