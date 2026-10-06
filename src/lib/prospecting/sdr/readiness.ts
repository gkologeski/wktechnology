// Checagens puras de prontidão do SDR (sem banco): viabilidade do limiar de
// qualificação, rótulo de preço e saúde da página de agenda.
import { computeQualificationMaxScore, type ScoreQuestion } from "@/lib/prospecting/score";
import {
  ICP_MAX_POINTS,
  LEAD_SCORE_MAX,
  QUESTIONNAIRE_MAX_POINTS,
} from "@/lib/prospecting/lead-score";

export type QualificationFeasibility = {
  scaleMax: number;
  threshold: number;
  questionnaireMaxRaw: number;
  questionnairePossible: number;
  icpCriteria: number;
  icpPossible: number;
  /** Nota máxima alcançável hoje quando o alvo é Lead (questionário + ICP). */
  leadMax: number;
  /** Contatos não têm ICP no cálculo atual: máximo é só o questionário. */
  contactMax: number;
  feasibleForLead: boolean;
  feasibleForContact: boolean;
  issues: string[];
};

export function qualificationFeasibility(p: {
  questions: ScoreQuestion[];
  icpEnabledCriteria: { points: number | null }[];
  threshold: number;
}): QualificationFeasibility {
  const { max } = computeQualificationMaxScore(p.questions);
  const questionnairePossible = max > 0 ? QUESTIONNAIRE_MAX_POINTS : 0;
  const icpPositive = p.icpEnabledCriteria.filter((c) => Number(c.points ?? 0) > 0);
  const icpPossible = icpPositive.length ? ICP_MAX_POINTS : 0;
  const leadMax = questionnairePossible + icpPossible;
  const contactMax = questionnairePossible;
  const issues: string[] = [];
  if (!p.questions.length) issues.push("O playbook não tem questionário: a nota fica sempre 0.");
  else if (max <= 0) issues.push("As perguntas do questionário não atribuem pontos.");
  if (!icpPositive.length)
    issues.push("Não há critérios de ICP ativos com pontos: a nota fica limitada a 50.");
  if (p.threshold > LEAD_SCORE_MAX)
    issues.push(`O limiar ${p.threshold} é maior que a escala (0–${LEAD_SCORE_MAX}).`);
  else if (p.threshold > leadMax)
    issues.push(
      `Com os critérios atuais, a nota máxima de um Lead é ${leadMax}; o limiar ${p.threshold} nunca será atingido.`,
    );
  if (p.threshold > contactMax && contactMax < leadMax)
    issues.push(
      `Conversas ligadas a Contato (sem Lead) somam no máximo ${contactMax}, pois o ICP só é calculado para Leads; elas não geram oportunidade automática com limiar ${p.threshold} e seguem para revisão humana.`,
    );
  return {
    scaleMax: LEAD_SCORE_MAX,
    threshold: p.threshold,
    questionnaireMaxRaw: max,
    questionnairePossible,
    icpCriteria: icpPositive.length,
    icpPossible,
    leadMax,
    contactMax,
    feasibleForLead: p.threshold <= leadMax && leadMax > 0,
    feasibleForContact: p.threshold <= contactMax && contactMax > 0,
    issues,
  };
}

/** Preço de catálogo zero/ausente significa "sob proposta", nunca gratuito. */
export function pricingLabel(basePrice: number | null | undefined): string {
  const n = Number(basePrice ?? 0);
  return Number.isFinite(n) && n > 0 ? "Valor de referência interno" : "Sob proposta";
}

export type BookingReadiness = {
  ok: boolean;
  checks: { key: string; label: string; ok: boolean; detail?: string }[];
};

export function bookingReadiness(p: {
  page: {
    active: boolean;
    workspace_id: string | null;
    owner_id: string;
    timezone: string | null;
    availability: unknown;
    calendar_account_id: string | null;
  } | null;
  workspaceId: string;
  hostActive: boolean;
  calendar: {
    provider: string;
    owner_id: string;
    workspace_id: string | null;
    sync_enabled: boolean | null;
    last_status: string | null;
    has_refresh: boolean;
    can_write_events: boolean;
  } | null;
}): BookingReadiness {
  const pg = p.page;
  const av = (pg?.availability ?? {}) as Record<string, unknown[]>;
  const slots = Object.values(av).reduce((n, v) => n + (Array.isArray(v) ? v.length : 0), 0);
  const c = p.calendar;
  const checks = [
    { key: "page", label: "Página ativa", ok: !!pg?.active },
    {
      key: "workspace",
      label: "Página no mesmo workspace",
      ok: !!pg && pg.workspace_id === p.workspaceId,
    },
    { key: "host", label: "Anfitrião ativo no workspace", ok: p.hostActive },
    {
      key: "availability",
      label: "Disponibilidade semanal definida",
      ok: slots > 0,
      detail: `${slots} faixa(s)`,
    },
    {
      key: "timezone",
      label: "Fuso horário definido",
      ok: !!pg?.timezone,
      detail: pg?.timezone ?? undefined,
    },
    { key: "calendar", label: "Agenda Google vinculada", ok: !!c && c.provider === "google" },
    {
      key: "calendar_owner",
      label: "Agenda pertence ao anfitrião e ao workspace",
      ok: !!c && !!pg && c.owner_id === pg.owner_id && c.workspace_id === p.workspaceId,
    },
    {
      key: "calendar_auth",
      label: "Autorização Google renovável e com escrita de eventos",
      ok: !!c && c.has_refresh && c.can_write_events,
    },
    {
      key: "calendar_sync",
      label: "Última sincronização sem erro",
      ok: !!c && c.sync_enabled !== false && (c.last_status ?? "ok") === "ok",
      detail: c?.last_status ?? undefined,
    },
  ];
  return { ok: checks.every((x) => x.ok), checks };
}
