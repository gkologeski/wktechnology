// Ações de responsável: atribuir, rodízio e atribuir recrutador.
// Extraído de engine-actions.server.ts sem mudança de comportamento.
import type { SupabaseClient } from "@supabase/supabase-js";
import { applyRotation } from "@/lib/rotation/engine.server";
import { type LogStep, assignFieldFor } from "../engine-shared.server";
import type { RunCtx, RunnableAction } from "./run-context";

export async function handleAssignAction(
  supabase: SupabaseClient,
  action: RunnableAction,
  ctx: RunCtx,
  at: string,
): Promise<LogStep | null> {
  switch (action.type) {
    case "assign_to": {
      const assignField = assignFieldFor(ctx.entity);
      const { error } = await supabase
        .from(ctx.entity)
        .update({ [assignField]: action.user_id })
        .eq("id", ctx.entityId);
      if (error) throw new Error(error.message);
      return {
        at,
        ok: true,
        action: "assign_to",
        detail: { user_id: action.user_id, field: assignField },
      };
    }
    case "rotate_assign": {
      if (ctx.entity !== "leads" && ctx.entity !== "deals" && ctx.entity !== "tickets") {
        throw new Error("rotate_assign suporta apenas leads/deals/tickets");
      }
      const r = await applyRotation(supabase, action.rule_id, ctx.entity, ctx.entityId);
      return {
        at,
        ok: true,
        action: "rotate_assign",
        detail: { rule_id: action.rule_id, assigned_to: r.user_id },
      };
    }
    case "assign_recruiter": {
      const target =
        action.target && action.target !== "auto"
          ? action.target
          : ctx.entity === "ats_jobs"
            ? "job"
            : ctx.entity === "ats_candidates"
              ? "candidate"
              : ctx.entity === "ats_applications"
                ? "application"
                : ctx.entity === "ats_interviews"
                  ? "interview"
                  : "job";
      const table =
        target === "job"
          ? "ats_jobs"
          : target === "candidate"
            ? "ats_candidates"
            : target === "application"
              ? "ats_applications"
              : "ats_interviews";
      const column =
        target === "job" ? "recruiter_id" : target === "interview" ? "interviewer_id" : "owner_id";
      const { error } = await supabase
        .from(table)
        .update({ [column]: action.user_id })
        .eq("id", ctx.entityId);
      if (error) throw new Error(error.message);
      return {
        at,
        ok: true,
        action: "assign_recruiter",
        detail: { target, user_id: action.user_id, column },
      };
    }
    default:
      return null;
  }
}
