// Sinais de urgência para o kanban de tickets.
// Critérios: SLA (due_at), estagnação (updated_at por status) e prioridade.

import type { Pipeline } from "@/lib/pipelines";
import type { TicketRow, TicketStatus } from "@/components/tickets/types";
import { classifyScore, type KanbanSignals } from "./signals";

const HOUR = 60 * 60 * 1000;

// Tempo (em horas) sem atualização a partir do qual o status é considerado estagnado.
const STALE_HOURS_BY_STATUS: Record<TicketStatus, number> = {
  new: 4,
  open: 24,
  waiting: 72,
  resolved: Number.POSITIVE_INFINITY,
  closed: Number.POSITIVE_INFINITY,
};

const PRIORITY_WEIGHT: Record<string, number> = {
  low: 0,
  medium: 0.3,
  high: 0.7,
  urgent: 1,
};

function isFinishedTicket(ticket: TicketRow, pipeline: Pipeline): boolean {
  if (ticket.status === "resolved" || ticket.status === "closed") return true;
  const stageKey = ticket.stage || ticket.status;
  const stageType = pipeline.stages.find((s) => s.value === stageKey)?.type;
  return stageType === "won" || stageType === "lost";
}

export function computeTicketSignal(
  ticket: TicketRow,
  pipeline: Pipeline,
  now: number = Date.now(),
): KanbanSignals {
  if (isFinishedTicket(ticket, pipeline)) {
    return { score: 0, klass: "neutral", isHot: false, isHighValue: false };
  }

  // 1) SLA — due_at.
  let dueScore = 0;
  let reason: string | undefined;
  if (ticket.due_at) {
    const h = (new Date(ticket.due_at).getTime() - now) / HOUR;
    if (h < 0) {
      dueScore = 1;
      const overdueH = Math.round(-h);
      reason =
        overdueH >= 24
          ? `SLA vencido há ${Math.round(overdueH / 24)}d`
          : `SLA vencido há ${overdueH}h`;
    } else if (h <= 2) {
      dueScore = 1;
      reason = `SLA em ${Math.max(1, Math.round(h))}h`;
    } else if (h <= 24) {
      dueScore = 0.7;
      reason = `SLA em ${Math.round(h)}h`;
    } else if (h <= 72) {
      dueScore = 0.35;
    }
  }

  // 2) Estagnação — updated_at vs. limite por status.
  const staleH = STALE_HOURS_BY_STATUS[ticket.status] ?? 48;
  const updatedAt = ticket.updated_at ? new Date(ticket.updated_at).getTime() : now;
  const idleH = (now - updatedAt) / HOUR;
  let idleScore = 0;
  if (Number.isFinite(staleH)) {
    if (idleH >= staleH * 2) idleScore = 1;
    else if (idleH >= staleH) idleScore = 0.6;
    else if (idleH >= staleH * 0.5) idleScore = 0.2;
  }
  if (!reason && idleScore >= 0.6) {
    const d = idleH / 24;
    reason = d >= 1 ? `Parado há ${Math.round(d)}d` : `Parado há ${Math.round(idleH)}h`;
  }

  // 3) Prioridade.
  const prioScore = PRIORITY_WEIGHT[ticket.priority] ?? 0;

  const score = Math.round(100 * (0.45 * dueScore + 0.3 * idleScore + 0.25 * prioScore));
  const klass = classifyScore(score);
  const isHot = klass === "hot";
  const isHighValue = ticket.priority === "urgent";
  if (!reason && isHighValue) reason = "Prioridade urgente";
  if (!reason && isHot) reason = `Score ${score}`;

  return { score, klass, isHot, isHighValue, reason };
}

export function computeTicketSignals(
  tickets: TicketRow[],
  pipeline: Pipeline,
  now: number = Date.now(),
): Map<string, KanbanSignals> {
  const map = new Map<string, KanbanSignals>();
  for (const t of tickets) map.set(t.id, computeTicketSignal(t, pipeline, now));
  return map;
}
