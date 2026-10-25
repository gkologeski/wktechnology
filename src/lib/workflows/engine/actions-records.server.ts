import { workflowRecord } from "./record-write.server";
import { workRpc } from "@/lib/access-control/work-core.server";
// Ações de registros genéricos e associações: associar, desassociar, criar,
// atualizar e excluir registro. Extraído sem mudança de comportamento.
import type { SupabaseClient } from "@supabase/supabase-js";
import { type LogStep, renderTokens } from "../engine-shared.server";
import type { RunCtx, RunnableAction } from "./run-context";

/**
 * Resolve os valores do passo. Quando o usuário deixou um campo preenchido só
 * com variável (ex.: `{{amendment_of_id}}`) e o registro de origem não tem esse
 * dado, a variável resolve para texto vazio — enviar "" para uma coluna uuid,
 * número ou data quebra a execução ("invalid input syntax for type uuid").
 * Nesse caso o campo é simplesmente omitido, deixando o padrão da coluna.
 */
export function renderActionValues(
  values: Record<string, unknown> | undefined,
  ctx: RunCtx,
): { rendered: Record<string, unknown>; skipped: string[] } {
  const rendered: Record<string, unknown> = {};
  const skipped: string[] = [];
  for (const [k, v] of Object.entries(values ?? {})) {
    if (typeof v !== "string") {
      rendered[k] = v;
      continue;
    }
    const out = renderTokens(v, ctx.after, ctx.vars);
    // Qualquer valor vazio é omitido (não só o que veio de variável): enviar ""
    // para colunas uuid, número, data ou jsonb quebra a execução.
    if (out == null || (typeof out === "string" && out.trim() === "")) {
      skipped.push(k);
      continue;
    }
    rendered[k] = out;
  }
  return { rendered, skipped };
}

export async function handleRecordAction(
  supabase: SupabaseClient,
  action: RunnableAction,
  ctx: RunCtx,
  at: string,
): Promise<LogStep | null> {
  switch (action.type) {
    case "associate_records": {
      const { findAssociation } = await import("../associations");
      const assoc = findAssociation(ctx.entity, action.association);
      if (!assoc) throw new Error(`associação desconhecida: ${action.association}`);
      const targetId = (renderTokens(action.target_id, ctx.after) as string).trim();
      if (!targetId) throw new Error("target_id vazio");
      await workflowRecord(supabase, ctx, ctx.entity, "update", ctx.entityId, {
        [assoc.fk_column]: targetId,
      });
      return {
        at,
        ok: true,
        action: "associate_records",
        detail: { [assoc.fk_column]: targetId },
      };
    }
    case "disassociate_records": {
      const { findAssociation } = await import("../associations");
      const assoc = findAssociation(ctx.entity, action.association);
      if (!assoc) throw new Error(`associação desconhecida: ${action.association}`);
      await workflowRecord(supabase, ctx, ctx.entity, "update", ctx.entityId, {
        [assoc.fk_column]: null,
      });
      return {
        at,
        ok: true,
        action: "disassociate_records",
        detail: { [assoc.fk_column]: null },
      };
    }
    case "create_record": {
      const { rendered, skipped } = renderActionValues(action.values, ctx);
      // Fallbacks contextuais: quando o workflow dispara de uma entidade e
      // cria um registro filho, preenche automaticamente a FK de origem caso
      // o usuário não a tenha informado explicitamente.
      if (action.table === "contracts") {
        if (ctx.entity === "deals" && !rendered.deal_id) {
          rendered.deal_id = ctx.entityId;
        }
        if (ctx.entity === "contracts" && !rendered.parent_contract_id) {
          rendered.parent_contract_id = ctx.entityId;
        }
      }
      if (!ctx.workflowId) throw new Error("Workflow sem origem de autorização.");
      const payload: Record<string, unknown> = { ...rendered };
      if (action.owner_id && action.owner_id !== ctx.ownerId) {
        if (
          ["leads", "contacts", "companies", "deals", "quotes", "proposals"].includes(action.table)
        )
          payload.assigned_to = action.owner_id;
        else throw new Error("Use a ação específica de atribuição para outro responsável.");
      }
      const inserted = await workRpc<{ id: string }>(supabase, "sales_workflow_record", {
        p_workflow: ctx.workflowId,
        p_table: action.table,
        p_action: "create",
        p_id: null,
        p_payload: payload,
      });
      return {
        at,
        ok: true,
        action: "create_record",
        detail: {
          table: action.table,
          id: inserted.id,
          ...(skipped.length > 0
            ? {
                campos_ignorados: skipped,
                aviso: `Campos sem valor no registro de origem foram ignorados: ${skipped.join(", ")}.`,
              }
            : {}),
        },
      };
    }
    case "update_record": {
      const targetId = renderTokens(action.target_id, ctx.after, ctx.vars) as string;
      if (!targetId) throw new Error("target_id vazio");
      const { rendered } = renderActionValues(action.values, ctx);
      if (!ctx.workflowId) throw new Error("Workflow sem origem de autorização.");
      await workRpc(supabase, "sales_workflow_record", {
        p_workflow: ctx.workflowId,
        p_table: action.table,
        p_action: "update",
        p_id: targetId,
        p_payload: rendered,
      });
      return {
        at,
        ok: true,
        action: "update_record",
        detail: { table: action.table, id: targetId },
      };
    }
    case "delete_record": {
      const targetId = renderTokens(action.target_id, ctx.after, ctx.vars) as string;
      if (!targetId) throw new Error("target_id vazio");
      if (!ctx.workflowId) throw new Error("Workflow sem origem de autorização.");
      await workRpc(supabase, "sales_workflow_record", {
        p_workflow: ctx.workflowId,
        p_table: action.table,
        p_action: "delete",
        p_id: targetId,
        p_payload: {},
      });
      return {
        at,
        ok: true,
        action: "delete_record",
        detail: { table: action.table, id: targetId },
      };
    }
    default:
      return null;
  }
}
