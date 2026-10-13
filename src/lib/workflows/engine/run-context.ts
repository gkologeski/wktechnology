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
  /**
   * Retomada dentro de caminhos: um quadro por nível (de fora para dentro),
   * dizendo em qual caminho e em qual passo dele continuar.
   */
  resumeFrames?: ResumeFrame[];
  /** Estado durável de esperas e caminhos paralelos, por posição do passo. */
  state?: Record<string, unknown>;
}

export type ResumeFrame = { key: string; cursor: number };

export interface RunResult {
  log: LogStep[];
  hadError: boolean;
  // Se != null, execução foi suspensa para retomar depois desse índice na lista de ações.
  suspendedAt?: {
    runAtIso: string;
    resumeCursor: number;
    /** Estado de espera (aguardar resposta), gravado no evento de retomada. */
    waitState?: { cursor: number; started_at: string; deadline: string };
    /** Caminho até o passo pausado quando ele está dentro de um ramo. */
    resumePath?: ResumeFrame[];
    /** Estado durável (`ctx.state`) a gravar no evento de retomada. */
    state?: Record<string, unknown>;
  };
  // Fase 5b: aguardando decisão de aprovação (retomada acontece via decideApproval).
  waitingApproval?: { approvalId: string; resumeCursor: number; resumePath?: ResumeFrame[] };
}

/** Ações de passo simples (sem controle de fluxo), tratadas por `runAction`. */
export type RunnableAction = Exclude<
  WorkflowAction,
  | { type: "delay" }
  | { type: "branch_if" }
  | { type: "wait_for_reply" }
  | { type: "switch_by_value" }
  | { type: "branch_multi" }
  | { type: "delay_until_date" }
  | { type: "approval_step" }
  | { type: "parallel" }
>;

/** Contrato dos módulos de ação: devolve o passo ou `null` se não trata o tipo. */
export type ActionHandler = (
  supabase: import("@supabase/supabase-js").SupabaseClient,
  action: RunnableAction,
  ctx: RunCtx,
  at: string,
) => Promise<LogStep | null>;
