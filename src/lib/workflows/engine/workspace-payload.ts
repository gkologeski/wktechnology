import type { RunCtx } from "./run-context";

/** Jobs inherit the source workspace; they must never rely on a session/default tenant. */
export function withWorkflowWorkspace(
  ctx: Pick<RunCtx, "workspaceId">,
  row: Record<string, unknown>,
) {
  if (!ctx.workspaceId) throw new Error("Workspace de origem do workflow ausente.");
  if (row.workspace_id != null && row.workspace_id !== ctx.workspaceId) {
    throw new Error("O workflow não pode alterar o workspace de destino.");
  }
  return { ...row, workspace_id: ctx.workspaceId };
}

export function workflowEventWorkspace(event: {
  workspace_id?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}): string {
  if (!event.workspace_id) throw new Error("Evento de workflow sem workspace de origem.");
  for (const snapshot of [event.before, event.after]) {
    if (snapshot?.workspace_id != null && snapshot.workspace_id !== event.workspace_id) {
      throw new Error("Evento de workflow diverge do workspace da entidade.");
    }
  }
  return event.workspace_id;
}
