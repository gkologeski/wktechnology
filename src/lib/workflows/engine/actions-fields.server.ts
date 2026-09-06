// Ações de campo: definir, sub-status, limpar, incrementar, copiar de associação
// e formatar dados. Extraído de engine-actions.server.ts sem mudança de comportamento.
import type { SupabaseClient } from "@supabase/supabase-js";
import { toStr } from "../render-tokens";
import { type AnyRow, type LogStep, getField, renderTokens } from "../engine-shared.server";
import type { RunCtx, RunnableAction } from "./run-context";

export async function handleFieldAction(
  supabase: SupabaseClient,
  action: RunnableAction,
  ctx: RunCtx,
  at: string,
): Promise<LogStep | null> {
  switch (action.type) {
    case "set_field": {
      const value = renderTokens(action.value, ctx.after);
      const { error } = await supabase
        .from(ctx.entity)
        .update({ [action.field]: value })
        .eq("id", ctx.entityId);
      if (error) throw new Error(error.message);
      return { at, ok: true, action: "set_field", detail: { field: action.field, value } };
    }
    case "set_substatus": {
      if (ctx.entity !== "leads" && ctx.entity !== "deals") {
        throw new Error("set_substatus suporta apenas leads e negócios");
      }
      const { error } = await supabase
        .from(ctx.entity)
        .update({ stage_substatus_id: action.substatus_id })
        .eq("id", ctx.entityId);
      if (error) throw new Error(error.message);
      return {
        at,
        ok: true,
        action: "set_substatus",
        detail: { substatus_id: action.substatus_id },
      };
    }
    case "clear_field": {
      const { error } = await supabase
        .from(ctx.entity)
        .update({ [action.field]: null })
        .eq("id", ctx.entityId);
      if (error) throw new Error(error.message);
      return { at, ok: true, action: "clear_field", detail: { field: action.field } };
    }
    case "increment_field": {
      const current = Number(ctx.after?.[action.field] ?? 0) || 0;
      const next = current + (Number(action.amount) || 0);
      const { error } = await supabase
        .from(ctx.entity)
        .update({ [action.field]: next })
        .eq("id", ctx.entityId);
      if (error) throw new Error(error.message);
      return {
        at,
        ok: true,
        action: "increment_field",
        detail: { field: action.field, from: current, to: next },
      };
    }
    case "copy_field_from_association": {
      const { findAssociation } = await import("../associations");
      const assoc = findAssociation(ctx.entity, action.association);
      if (!assoc) throw new Error(`associação desconhecida: ${action.association}`);
      const targetId = ctx.after ? (ctx.after[assoc.fk_column] as string | null) : null;
      if (!targetId) throw new Error(`sem valor em ${assoc.fk_column}`);
      const { data: assocRow, error: readErr } = await supabase
        .from(assoc.target_table)
        .select(action.source_field)
        .eq("id", targetId)
        .maybeSingle();
      if (readErr) throw new Error(readErr.message);
      const value = (assocRow as AnyRow | null)?.[action.source_field] ?? null;
      const { error } = await supabase
        .from(ctx.entity)
        .update({ [action.target_field]: value })
        .eq("id", ctx.entityId);
      if (error) throw new Error(error.message);
      return {
        at,
        ok: true,
        action: "copy_field_from_association",
        detail: {
          from: `${assoc.target_table}.${action.source_field}`,
          target: action.target_field,
          value,
        },
      };
    }
    case "format_data": {
      ctx.vars = ctx.vars ?? {};
      const src = action.source_field ? getField(ctx.after, action.source_field) : undefined;
      let out: unknown = src;
      try {
        switch (action.op) {
          case "upper":
            out = toStr(src).toUpperCase();
            break;
          case "lower":
            out = toStr(src).toLowerCase();
            break;
          case "trim":
            out = toStr(src).trim();
            break;
          case "template_string":
            out = renderTokens(action.template ?? "", ctx.after, ctx.vars);
            break;
          case "date_add": {
            const base = src ? new Date(String(src)) : new Date();
            if (Number.isNaN(base.getTime())) throw new Error("data inválida");
            const mult =
              action.unit === "minutes" ? 60_000 : action.unit === "hours" ? 3_600_000 : 86_400_000;
            out = new Date(base.getTime() + (action.amount ?? 0) * mult).toISOString();
            break;
          }
          case "date_format": {
            const d = src ? new Date(String(src)) : new Date();
            if (Number.isNaN(d.getTime())) throw new Error("data inválida");
            const fmt = action.format ?? "yyyy-MM-dd";
            const pad = (n: number, w = 2) => String(n).padStart(w, "0");
            out = fmt
              .replace(/yyyy/g, String(d.getFullYear()))
              .replace(/MM/g, pad(d.getMonth() + 1))
              .replace(/dd/g, pad(d.getDate()))
              .replace(/HH/g, pad(d.getHours()))
              .replace(/mm/g, pad(d.getMinutes()))
              .replace(/ss/g, pad(d.getSeconds()));
            break;
          }
          case "number_round": {
            const n = typeof src === "number" ? src : parseFloat(String(src));
            if (Number.isNaN(n)) throw new Error("valor não numérico");
            const p = Math.max(0, Math.floor(action.amount ?? 0));
            const factor = Math.pow(10, p);
            out = Math.round(n * factor) / factor;
            break;
          }
        }
      } catch (e) {
        throw new Error(`format_data: ${e instanceof Error ? e.message : String(e)}`);
      }
      (ctx.vars as AnyRow)[action.target_var] = out;
      return {
        at,
        ok: true,
        action: "format_data",
        detail: { op: action.op, target_var: action.target_var, value: out },
      };
    }
    default:
      return null;
  }
}
