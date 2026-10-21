// Colunas das listas do painel (apresentação). Valores de custo nunca chegam aqui: só a situação da tarifa.
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { DashDataset } from "@/lib/projects/dashboard-views.shared";
import {
  ALERT_RULE_LABEL,
  ALERT_SEVERITY_LABEL,
  ALERT_STATUS_LABEL,
  DASH_ORIGIN_LABEL,
} from "@/lib/projects/dashboard-views.shared";
import {
  DASHBOARD_HOURS_STATUS_LABEL,
  PROJECT_STATUS_LABEL,
  formatSeconds,
} from "@/lib/projects/reconciliation-labels";

type Row = Record<string, unknown>;
export type DrillColumn = {
  key: string;
  label: string;
  render: (r: Row) => ReactNode;
  numeric?: boolean;
};

const str = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
const day = (v: unknown) =>
  typeof v === "string" && v
    ? new Date(`${v.slice(0, 10)}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" })
    : "—";
const dt = (v: unknown) =>
  typeof v === "string" && v
    ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "—";
const secs = (v: unknown) =>
  v === null || v === undefined ? "Desconhecido" : formatSeconds(Number(v));
const money = (v: unknown, cur: unknown) =>
  v === null || v === undefined
    ? "—"
    : Number(v).toLocaleString("pt-BR", { style: "currency", currency: String(cur || "BRL") });

const projectLink = (r: Row, idKey = "project_id", nameKey = "project") =>
  typeof r[idKey] === "string" && r[nameKey] ? (
    <Link
      to="/projects/$id"
      params={{ id: r[idKey] as string }}
      className="text-text-primary hover:underline"
    >
      {String(r[nameKey])}
    </Link>
  ) : r[idKey] ? (
    <span className="text-text-tertiary">Projeto sem acesso</span>
  ) : (
    "—"
  );

const COST_STATUS_LABEL: Record<string, string> = {
  found: "Tarifa vigente",
  monthly: "Custo mensal vigente",
  ambiguous: "Ambígua",
  missing: "Sem tarifa",
  none: "Sem tarifa",
};
const METHOD_LABEL: Record<string, string> = {
  estimate: "Estimativa ÷ ritmo",
  none: "Sem base",
  techhire: "TechHire",
  competence: "Competência",
};
const MEASUREMENT_STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  approved: "Aprovada",
  ready: "Pronta",
  generated: "Lançada",
  failed: "Falha na geração",
  reversed: "Estornada",
  cancelled: "Cancelada",
};
const CONTRACT_LABEL: Record<string, string> = {
  active: "Ativo",
  in_progress: "Em andamento",
  ended: "Encerrado",
  none: "Sem contrato",
};

export const DRILL_COLUMNS: Record<DashDataset, DrillColumn[]> = {
  entries: [
    { key: "date", label: "Data", render: (r) => day(r.date) },
    { key: "project", label: "Projeto", render: (r) => projectLink(r) },
    { key: "person", label: "Pessoa", render: (r) => str(r.person) },
    { key: "seconds", label: "Duração", render: (r) => secs(r.seconds), numeric: true },
    {
      key: "status",
      label: "Situação",
      render: (r) => DASHBOARD_HOURS_STATUS_LABEL[String(r.status)] ?? str(r.status),
    },
    {
      key: "origin",
      label: "Origem",
      render: (r) => DASH_ORIGIN_LABEL[String(r.origin)] ?? str(r.origin),
    },
    {
      key: "in_review",
      label: "Conciliação",
      render: (r) => (r.in_review ? "Pendência aberta" : "—"),
    },
  ],
  projects: [
    { key: "name", label: "Projeto", render: (r) => projectLink(r, "id", "name") },
    {
      key: "status",
      label: "Situação",
      render: (r) => PROJECT_STATUS_LABEL[String(r.status)] ?? str(r.status),
    },
    { key: "due_at", label: "Prazo", render: (r) => day(r.due_at) },
    { key: "owner", label: "Responsável", render: (r) => str(r.owner) },
    {
      key: "planned_hours",
      label: "Horas previstas",
      render: (r) =>
        r.planned_hours ? `${Number(r.planned_hours).toLocaleString("pt-BR")} h` : "—",
      numeric: true,
    },
  ],
  tasks: [
    { key: "title", label: "Tarefa", render: (r) => str(r.title) },
    { key: "project", label: "Projeto", render: (r) => projectLink(r) },
    { key: "due_at", label: "Prazo", render: (r) => day(r.due_at) },
    { key: "assignee", label: "Responsável", render: (r) => str(r.assignee) },
    {
      key: "estimated_hours",
      label: "Estimativa",
      render: (r) =>
        r.estimated_hours === null || r.estimated_hours === undefined
          ? "Sem estimativa"
          : `${Number(r.estimated_hours).toLocaleString("pt-BR")} h`,
      numeric: true,
    },
  ],
  milestones: [
    { key: "name", label: "Marco", render: (r) => str(r.name) },
    { key: "project", label: "Projeto", render: (r) => projectLink(r) },
    { key: "due_at", label: "Data", render: (r) => day(r.due_at) },
    { key: "assignee", label: "Responsável", render: (r) => str(r.assignee) },
  ],
  people: [
    { key: "name", label: "Pessoa", render: (r) => str(r.name) },
    {
      key: "contracted",
      label: "Capacidade",
      render: (r) => (r.schedule_known ? secs(r.contracted) : "Sem jornada"),
      numeric: true,
    },
    {
      key: "allocated_total",
      label: "Alocado (total)",
      render: (r) => (r.schedule_known ? secs(r.allocated_total) : "—"),
      numeric: true,
    },
    {
      key: "other_allocated",
      label: "Outras alocações",
      render: (r) => (r.schedule_known ? secs(r.other_allocated) : "—"),
      numeric: true,
    },
    { key: "registered", label: "Registrado", render: (r) => secs(r.registered), numeric: true },
    { key: "submitted", label: "Enviado", render: (r) => secs(r.submitted), numeric: true },
    {
      key: "gap",
      label: "Lacuna",
      render: (r) => (r.gap === null || r.gap === undefined ? "—" : secs(r.gap)),
      numeric: true,
    },
    {
      key: "overbooked_days",
      label: "Dias sobrealocados",
      render: (r) => str(r.overbooked_days),
      numeric: true,
    },
  ],
  forecast: [
    { key: "name", label: "Projeto", render: (r) => projectLink(r, "id", "name") },
    {
      key: "method",
      label: "Método",
      render: (r) => METHOD_LABEL[String(r.method)] ?? str(r.method),
    },
    {
      key: "eta",
      label: "Previsão (faixa)",
      render: (r) =>
        r.eta_mid
          ? `${day(r.eta_low)} · ${day(r.eta_mid)} · ${day(r.eta_high)}`
          : "Sem base para prever",
    },
    { key: "due_at", label: "Prazo", render: (r) => day(r.due_at) },
    {
      key: "remaining_secs",
      label: "Restante estimado",
      render: (r) => secs(r.remaining_secs),
      numeric: true,
    },
    { key: "reason", label: "Observação", render: (r) => str(r.reason) },
  ],
  deals: [
    {
      key: "name",
      label: "Negócio",
      render: (r) => (
        <Link
          to="/deals/$id"
          params={{ id: String(r.id) }}
          className="text-text-primary hover:underline"
        >
          {str(r.name)}
        </Link>
      ),
    },
    { key: "closed_at", label: "Ganho em", render: (r) => dt(r.closed_at) },
    { key: "owner", label: "Responsável", render: (r) => str(r.owner) },
    { key: "project", label: "Projeto", render: (r) => projectLink(r) },
    {
      key: "contract_status",
      label: "Contrato",
      render: (r) => CONTRACT_LABEL[String(r.contract_status)] ?? str(r.contract_status),
    },
    {
      key: "transition_seconds",
      label: "Venda → projeto",
      render: (r) =>
        r.transition_seconds === null || r.transition_seconds === undefined
          ? "—"
          : `${(Number(r.transition_seconds) / 86400).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias`,
      numeric: true,
    },
  ],
  measurements: [
    { key: "period_from", label: "Competência", render: (r) => day(r.period_from) },
    {
      key: "contract",
      label: "Contrato",
      render: (r) =>
        r.contract_id ? (
          <Link
            to="/contracts/$id"
            params={{ id: String(r.contract_id) }}
            className="text-text-primary hover:underline"
          >
            {str(r.contract)}
          </Link>
        ) : (
          "—"
        ),
    },
    { key: "company", label: "Empresa", render: (r) => str(r.company) },
    {
      key: "status",
      label: "Situação",
      render: (r) => MEASUREMENT_STATUS_LABEL[String(r.status)] ?? str(r.status),
    },
    { key: "amount", label: "Valor", render: (r) => money(r.amount, r.currency), numeric: true },
  ],
  cost: [
    { key: "date", label: "Data", render: (r) => day(r.date) },
    { key: "project", label: "Projeto", render: (r) => projectLink(r) },
    { key: "person", label: "Pessoa", render: (r) => str(r.person) },
    { key: "seconds", label: "Horas", render: (r) => secs(r.seconds), numeric: true },
    {
      key: "cost_status",
      label: "Tarifa de custo",
      render: (r) => COST_STATUS_LABEL[String(r.cost_status)] ?? str(r.cost_status),
    },
  ],
  alerts: [
    {
      key: "rule_key",
      label: "Regra",
      render: (r) => ALERT_RULE_LABEL[String(r.rule_key)] ?? str(r.rule_key),
    },
    {
      key: "severity",
      label: "Severidade",
      render: (r) => ALERT_SEVERITY_LABEL[String(r.severity)] ?? str(r.severity),
    },
    {
      key: "status",
      label: "Situação",
      render: (r) => ALERT_STATUS_LABEL[String(r.status)] ?? str(r.status),
    },
    {
      key: "target",
      label: "Alvo",
      render: (r) => (r.project_id ? projectLink(r) : str(r.subject)),
    },
    { key: "owner", label: "Responsável", render: (r) => str(r.owner) },
    { key: "last_detected_at", label: "Última detecção", render: (r) => dt(r.last_detected_at) },
  ],
};

/** Causa/evidência legível do alerta (sem custos; projeto oculto nunca é nomeado). */
export function alertEvidenceText(r: Row): string {
  const e = (r.evidence ?? {}) as Record<string, unknown>;
  switch (r.rule_key) {
    case "milestone_overdue":
      return `Marco "${str(e.milestone)}" previsto para ${day(e.due_at)} (${str(e.days_late)} dias de atraso).`;
    case "project_overdue":
      return `Prazo do projeto em ${day(e.due_at)} (${str(e.days_late)} dias de atraso).`;
    case "hours_budget":
      return `${str(e.pct)}% das horas previstas consumidas (aviso em ${str(e.warn_pct)}%, crítico em ${str(e.critical_pct)}%)${e.includes_imported ? "; inclui horas importadas" : ""}.`;
    case "capacity_exceeded":
      return `Alocações acima da jornada em ${str(e.overbooked_days)} dia(s) dos próximos ${str(e.horizon_days)}; carga máxima ${str(e.max_load_pct)}%.`;
    case "hours_unreviewed":
      return `${str(e.entries)} apontamento(s) enviados há mais de ${str(e.days)} dias sem revisão.`;
    case "approver_missing":
    case "schedule_missing":
    case "no_operational_owner":
      return str(e.reason);
    case "deal_won_no_project":
      return `Negócio "${str(e.deal)}" ganho em ${dt(e.closed_at)} sem projeto vinculado nem dispensa.`;
    default:
      return "Ver detalhes no registro de origem.";
  }
}
