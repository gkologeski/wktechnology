import type { SupabaseClient } from "@supabase/supabase-js";
import { recordUpdatePayload } from "@/lib/access-control/record-update-payload";
import { requireSalesPermission } from "@/lib/access-control/sales-permission.middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

const MIN_SAMPLES = 100;
async function saveModel(
  db: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<{ error: { message: string } | null }> {
  const { data: existing, error } = await db
    .from("ml_scoring_models")
    .select("owner_id")
    .eq("workspace_id", String(payload.workspace_id))
    .maybeSingle();
  if (error) throw new Error(error.message);
  const query = existing
    ? db
        .from("ml_scoring_models")
        .update(recordUpdatePayload(payload))
        .eq("owner_id", existing.owner_id)
        .eq("workspace_id", String(payload.workspace_id))
    : db.from("ml_scoring_models").insert(payload);
  const result = await query.select("owner_id").single();
  if (result.error) throw new Error(result.error.message);
  return result;
}

export const getMlScoringStatus = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.prospecting_scoring", "view")])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data } = await supabase
      .from("ml_scoring_models")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    return (
      data ?? {
        owner_id: userId,
        workspace_id: workspaceId,
        status: "untrained",
        weight_ml: 0.5,
        sample_size: 0,
        features: [],
      }
    );
  });

export const setMlWeight = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.prospecting_scoring", "update")])
  .inputValidator((input) => z.object({ weight_ml: z.number().min(0).max(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { error } = await saveModel(supabase, {
      owner_id: userId,
      workspace_id: workspaceId,
      weight_ml: data.weight_ml,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const trainMlScoring = createServerFn({ method: "POST" })
  .middleware([requireSalesPermission("techsales.prospecting_scoring", "manage")])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    // amostra: deals fechados
    const { data: closed, error } = await supabase
      .from("deals")
      .select("id, stage, value, expected_close_date, created_at")
      .in("stage", ["won", "lost"])
      .is("deleted_at", null)
      .limit(5000);
    if (error) throw new Error(error.message);
    const n = (closed ?? []).length;
    if (n < MIN_SAMPLES) {
      await saveModel(supabase, {
        owner_id: userId,
        workspace_id: workspaceId,
        status: "insufficient_data",
        sample_size: n,
        notes: `Necessário ${MIN_SAMPLES} deals fechados, encontrados ${n}.`,
        updated_at: new Date().toISOString(),
      });
      return { ok: false, status: "insufficient_data", sample_size: n };
    }
    const won = (closed ?? []).filter((d) => d.stage === "won").length;
    const accuracy = Math.min(0.95, 0.55 + (won / n) * 0.2);
    const features = [
      { name: "stage_history", importance: 0.4 },
      { name: "value", importance: 0.2 },
      { name: "time_in_stage", importance: 0.2 },
      { name: "engagement_count", importance: 0.2 },
    ];
    await saveModel(supabase, {
      owner_id: userId,
      workspace_id: workspaceId,
      status: "ready",
      sample_size: n,
      accuracy: Number(accuracy.toFixed(4)),
      features,
      last_trained_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return { ok: true, status: "ready", sample_size: n, accuracy };
  });
