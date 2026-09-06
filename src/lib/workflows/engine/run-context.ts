// Tipos compartilhados pelos módulos de execução de ações do motor de workflows.
import type { WorkflowAction, WorkflowEntity } from "../types";
import type { AnyRow, LogStep } from "../engine-shared.server";

export interface RunCtx {
  entity: WorkflowEntity;
  entityId: string;
  ownerId: string;
  workspaceId: string;
  after: AnyRow | null;
  before: AnyRow | null;
  /** Fase 5 — variáveis mutáveis do run, populadas por format_data e lidas via {{vars.X}}. */
  vars?: AnyRow;
  /** Fase 5b — usados para vincular workflow_approvals ao run/workflow atuais. */
  workflowId?: string;
  runId?: string;
}

export interface RunResult {
  log: LogStep[];
  hadError: boolean;
  // Se != null, execução foi suspensa para retomar depois desse índice na lista de ações.
  suspendedAt?: { runAtIso: string; resumeCursor: number };
  // Fase 5b: aguardando decisão de aprovação (retomada acontece via decideApproval).
  waitingApproval?: { approvalId: string; resumeCursor: number };
}

/** Ações de passo simples (sem controle de fluxo), tratadas por `runAction`. */
export type RunnableAction = Exclude<
  WorkflowAction,
  | { type: "delay" }
  | { type: "branch_if" }
  | { type: "switch_by_value" }
  | { type: "branch_multi" }
  | { type: "delay_until_date" }
  | { type: "approval_step" }
>;

/** Contrato dos módulos de ação: devolve o passo ou `null` se não trata o tipo. */
export type ActionHandler = (
  supabase: import("@supabase/supabase-js").SupabaseClient,
  action: RunnableAction,
  ctx: RunCtx,
  at: string,
) => Promise<LogStep | null>;
