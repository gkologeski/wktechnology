// Ações de registros genéricos e associações: associar, desassociar, criar,
// atualizar e excluir registro. Extraído sem mudança de comportamento.
import type { SupabaseClient } from "@supabase/supabase-js";
import { type LogStep, renderTokens } from "../engine-shared.server";
import type { RunCtx, RunnableAction } from "./run-context";

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
      const { error } = await supabase
        .from(ctx.entity)
        .update({ [assoc.fk_column]: targetId })
        .eq("id", ctx.entityId);
      if (error) throw new Error(error.message);
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
      const { error } = await supabase
        .from(ctx.entity)
        .update({ [assoc.fk_column]: null })
        .eq("id", ctx.entityId);
      if (error) throw new Error(error.message);
      return {
        at,
        ok: true,
        action: "disassociate_records",
        detail: { [assoc.fk_column]: null },
      };
    }
    case "create_record": {
      const rendered: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(action.values ?? {})) {
        rendered[k] = typeof v === "string" ? renderTokens(v, ctx.after, ctx.vars) : v;
      }
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
      const ownerId = action.owner_id?.trim() || ctx.ownerId;
      const withOwner = { ...rendered, owner_id: ownerId };
      // Tenta com owner_id; se a tabela não tiver essa coluna, refaz sem.
      let insertRes = await supabase
        .from(action.table)
        .insert(withOwner as never)
        .select("id")
        .maybeSingle();
      if (insertRes.error && /owner_id/.test(insertRes.error.message)) {
        insertRes = await supabase
          .from(action.table)
          .insert(rendered as never)
          .select("id")
          .maybeSingle();
      }
      if (insertRes.error) throw new Error(insertRes.error.message);
      return {
        at,
        ok: true,
        action: "create_record",
        detail: {
          table: action.table,
          id: (insertRes.data as { id?: string } | null)?.id ?? null,
        },
      };
    }
    case "update_record": {
      const targetId = renderTokens(action.target_id, ctx.after, ctx.vars) as string;
      if (!targetId) throw new Error("target_id vazio");
      const rendered: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(action.values ?? {})) {
        rendered[k] = typeof v === "string" ? renderTokens(v, ctx.after, ctx.vars) : v;
      }
      const { error } = await supabase
        .from(action.table)
        .update(rendered as never)
        .eq("id", targetId);
      if (error) throw new Error(error.message);
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
      const { error } = await supabase.from(action.table).delete().eq("id", targetId);
      if (error) throw new Error(error.message);
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
