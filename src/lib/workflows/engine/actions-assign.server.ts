import { assertSalesWorker } from "@/lib/access-control/sales-worker.server";
import { SALES_TABLE_RESOURCES } from "@/lib/access-control/sales-resources";
import { workflowRecord } from "./record-write.server";
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
      await workflowRecord(supabase, ctx, ctx.entity, "update", ctx.entityId, {
        [assignField]: action.user_id,
      });
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
      const r = await applyRotation(
        supabase,
        action.rule_id,
        ctx.entity,
        ctx.entityId,
        async (table, id, payload) => {
          if (table === ctx.entity) {
            if (!ctx.workflowId) throw new Error("Workflow sem origem de autorização.");
            const subject = String(payload[assignFieldFor(ctx.entity)] ?? "");
            await assertSalesWorker(supabase, "workflows", ctx.workflowId, [
              { table, id, action: "assign" },
              {
                resource: (SALES_TABLE_RESOURCES as Record<string, string>)[table],
                action: "assign",
                subject_id: subject,
              },
            ]);
          }
          await workflowRecord(supabase, ctx, table, "update", id, payload);
        },
      );
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
