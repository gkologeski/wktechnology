// Painel por perfil (Ciclo 5): chamadas às funções do banco como o usuário (RLS/RBAC, workspace ativo).
// Nada aqui grava dados de origem; só alertas/regras passam pelas funções dedicadas.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  DASH_EXPORT_MAX_ROWS,
  metricDef,
  toSafeCsv,
  type DashDataset,
  type DashFilters,
  type DashView,
} from "./dashboard-views.shared";
import type {
  DashDrillPage,
  DashFilterOption,
  DashRiskRules,
  DashSummary,
  Json,
} from "./dashboard-views.types";

type Sb = SupabaseClient<Database>;
type Rpc = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>;

// As funções novas são chamadas por nome; o retorno é jsonb normalizado abaixo.
const rpc = (sb: Sb): Rpc => (sb.rpc as unknown as Rpc).bind(sb);

function fail(prefix: string, error: { message: string; code?: string }): never {
  // Mensagens do banco já vêm em PT-BR e sem dados sensíveis (permissão, filtro inválido etc.).
  throw new Error(`${prefix}: ${error.message}`);
}

export async function loadDashSummary(
  sb: Sb,
  view: DashView,
  filters: DashFilters,
): Promise<DashSummary> {
  const { data, error } = await rpc(sb)("project_dash_summary", {
    p_view: view,
    p_filters: filters,
  });
  if (error) fail("Não foi possível carregar o painel", error);
  return data as DashSummary;
}

export async function loadDashScope(sb: Sb): Promise<DashSummary["scope"]> {
  const { data, error } = await rpc(sb)("project_dash_scope", {});
  if (error) fail("Não foi possível carregar seu acesso ao painel", error);
  return data as DashSummary["scope"];
}

export async function loadDashDrill(
  sb: Sb,
  view: DashView,
  dataset: DashDataset,
  metric: string,
  filters: DashFilters,
  limit: number,
  offset: number,
): Promise<DashDrillPage> {
  const { data, error } = await rpc(sb)("project_dash_drill", {
    p_view: view,
    p_dataset: dataset,
    p_metric: metric,
    p_filters: filters,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) fail("Não foi possível carregar a lista", error);
  return data as DashDrillPage;
}

export async function loadDashFilterOptions(
  sb: Sb,
  kind: string,
  q: string,
): Promise<DashFilterOption[]> {
  const { data, error } = await rpc(sb)("project_dash_filter_options", { p_kind: kind, p_q: q });
  if (error) fail("Não foi possível buscar opções", error);
  return (data as DashFilterOption[]) ?? [];
}

/** Colunas por conjunto; custo nunca aparece (só a situação da tarifa). */
const EXPORT_COLUMNS: Record<DashDataset, Array<[string, string]>> = {
  entries: [
    ["date", "Data"],
    ["project", "Projeto"],
    ["person", "Pessoa"],
    ["seconds", "Segundos"],
    ["status", "Situação"],
    ["origin", "Origem"],
    ["billable", "Faturável"],
    ["in_review", "Pendência de conciliação"],
  ],
  projects: [
    ["name", "Projeto"],
    ["status", "Situação"],
    ["due_at", "Prazo"],
    ["planned_hours", "Horas previstas"],
    ["owner", "Responsável"],
    ["kind", "Modelo de entrega"],
  ],
  tasks: [
    ["title", "Tarefa"],
    ["project", "Projeto"],
    ["status", "Situação"],
    ["due_at", "Prazo"],
    ["assignee", "Responsável"],
    ["estimated_hours", "Horas estimadas"],
  ],
  milestones: [
    ["name", "Marco"],
    ["project", "Projeto"],
    ["status", "Situação"],
    ["due_at", "Data"],
    ["assignee", "Responsável"],
  ],
  people: [
    ["name", "Pessoa"],
    ["person_status", "Situação"],
    ["schedule_known", "Jornada conhecida"],
    ["contracted", "Capacidade contratada (s)"],
    ["allocated_total", "Alocado total (s)"],
    ["allocated_scope", "Alocado no escopo (s)"],
    ["available", "Disponível (s)"],
    ["registered", "Registrado (s)"],
    ["submitted", "Enviado (s)"],
    ["gap", "Lacuna (s)"],
    ["overbooked_days", "Dias sobrealocados"],
  ],
  forecast: [
    ["name", "Projeto"],
    ["method", "Método"],
    ["remaining_secs", "Restante estimado (s)"],
    ["open_tasks", "Tarefas abertas"],
    ["est_tasks", "Tarefas com estimativa"],
    ["eta_low", "Data otimista"],
    ["eta_mid", "Data provável"],
    ["eta_high", "Data conservadora"],
    ["due_at", "Prazo"],
    ["reason", "Observação"],
  ],
  deals: [
    ["name", "Negócio"],
    ["closed_at", "Fechado em"],
    ["owner", "Responsável"],
    ["project", "Projeto"],
    ["project_status", "Situação do projeto"],
    ["contract_status", "Contrato"],
    ["transition_seconds", "Tempo até o projeto (s)"],
  ],
  measurements: [
    ["period_from", "Competência"],
    ["contract", "Contrato"],
    ["service", "Serviço"],
    ["company", "Empresa"],
    ["status", "Situação"],
    ["currency", "Moeda"],
    ["amount", "Valor"],
    ["received", "Recebido"],
  ],
  cost: [
    ["date", "Data"],
    ["project", "Projeto"],
    ["person", "Pessoa"],
    ["entries", "Apontamentos"],
    ["seconds", "Segundos"],
    ["cost_status", "Situação da tarifa"],
  ],
  alerts: [
    ["rule_key", "Regra"],
    ["severity", "Severidade"],
    ["status", "Situação"],
    ["project", "Projeto"],
    ["subject", "Pessoa"],
    ["owner", "Responsável"],
    ["period_from", "De"],
    ["period_to", "Até"],
    ["last_detected_at", "Última detecção"],
  ],
};

/**
 * Exporta a MESMA lista do cartão (mesmos filtros e escopo), página a página, até o limite real.
 * O arquivo começa com a definição, o total real e o aviso quando o total excede o limite.
 */
export async function exportDashDrill(
  sb: Sb,
  view: DashView,
  dataset: DashDataset,
  metric: string,
  filters: DashFilters,
): Promise<{ filename: string; csv: string; total: number; exported: number; truncated: boolean }> {
  const scope = await loadDashScope(sb);
  if (!scope?.can_export) {
    throw new Error("Sem permissão para exportar listas do painel.");
  }
  const cols = EXPORT_COLUMNS[dataset];
  const rows: unknown[][] = [];
  let total = 0;
  for (let offset = 0; offset < DASH_EXPORT_MAX_ROWS; offset += 1000) {
    const page = await loadDashDrill(sb, view, dataset, metric, filters, 1000, offset);
    total = Number(page.total);
    for (const r of page.rows) rows.push(cols.map(([k]) => r[k]));
    if (page.rows.length < 1000 || rows.length >= total) break;
  }
  const exported = Math.min(rows.length, DASH_EXPORT_MAX_ROWS);
  const def = metricDef(dataset, metric);
  const meta = [
    [`Indicador: ${def.title}`],
    [`Definição: ${def.definition}`],
    [`Período: ${filters.from} a ${filters.to} (${filters.tz})`],
    [`Total real: ${total}; exportados: ${exported}`],
    ...(total > exported
      ? [[`Atenção: limite de ${DASH_EXPORT_MAX_ROWS} linhas por arquivo.`]]
      : []),
    [],
  ];
  const csv =
    toSafeCsv([], meta).replace(/^\r\n/, "") +
    "\r\n" +
    toSafeCsv(
      cols.map(([, label]) => label),
      rows.slice(0, exported),
    );
  return {
    filename: `painel-${dataset}-${metric}-${filters.from}-${filters.to}.csv`,
    csv,
    total,
    exported,
    truncated: total > exported,
  };
}

export async function refreshDashAlerts(sb: Sb, tz: string) {
  const { data, error } = await rpc(sb)("project_alert_refresh", { p_tz: tz });
  if (error) fail("Não foi possível reavaliar os alertas", error);
  return data as Record<string, Json>;
}

export async function actOnDashAlert(
  sb: Sb,
  alertId: string,
  action: "ack" | "snooze" | "resolve" | "reopen",
  note: string,
  until: string | null,
) {
  const { data, error } = await rpc(sb)("project_alert_act", {
    p_alert: alertId,
    p_action: action,
    p_note: note,
    p_until: until,
  });
  if (error) fail("Não foi possível atualizar o alerta", error);
  return data as { id: string; status: string };
}

export async function loadDashRiskRules(sb: Sb, projectId: string | null): Promise<DashRiskRules> {
  const { data, error } = await rpc(sb)("project_risk_rules_get", { p_project: projectId });
  if (error) fail("Não foi possível carregar as regras", error);
  return data as DashRiskRules;
}

export async function saveDashRiskRules(
  sb: Sb,
  projectId: string | null,
  rules: Record<string, unknown>,
  note: string,
) {
  const { data, error } = await rpc(sb)("project_risk_rules_save", {
    p_project: projectId,
    p_rules: rules,
    p_note: note,
  });
  if (error) fail("Não foi possível salvar as regras", error);
  return data as { id: string; version: number };
}
