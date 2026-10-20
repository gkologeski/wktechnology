// Ação "Criar ou vincular projeto de entrega": chama a mesma porta única do banco usada pela
// fila automática (deal_delivery_workflow_ensure). O banco confere que o negócio é do workspace
// do run, que a política está ativa e aceita a origem workflow e que a etapa é do tipo ganho.
// Idempotente: repetir o fluxo devolve o projeto existente.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LogStep } from "../engine-shared.server";
import type { RunCtx, RunnableAction } from "./run-context";

type EnsureResult = {
  job_status?: string;
  reason?: string;
  error?: string;
  job_id?: string;
  results?: Array<{ group: string; project_id: string; action: "created" | "existing" }>;
};

export async function handleDeliveryAction(
  supabase: SupabaseClient,
  action: RunnableAction,
  ctx: RunCtx,
  at: string,
): Promise<LogStep | null> {
  if (action.type !== "ensure_deal_delivery") return null;
  if (ctx.entity !== "deals") {
    throw new Error("Esta ação só pode ser usada em workflows de Negócios.");
  }
  if (!ctx.workspaceId) throw new Error("Workspace do registro não identificado.");
  const { data, error } = await supabase.rpc("deal_delivery_workflow_ensure", {
    p_deal: ctx.entityId,
    p_workspace: ctx.workspaceId,
  });
  if (error) throw new Error(error.message);
  const res = (data ?? {}) as EnsureResult;
  if (res.job_status === "failed") {
    throw new Error(res.error || "A preparação da entrega falhou; ela fica pendente no negócio.");
  }
  const results = res.results ?? [];
  return {
    at,
    ok: true,
    action: action.type,
    detail: {
      status: res.job_status ?? null,
      skipped: res.job_status === "skipped" ? (res.reason ?? true) : undefined,
      created: results.filter((r) => r.action === "created").length,
      existing: results.filter((r) => r.action === "existing").length,
      project_ids: results.map((r) => r.project_id),
    },
  };
}
