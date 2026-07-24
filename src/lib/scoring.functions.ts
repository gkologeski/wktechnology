// Server functions do módulo de Lead Scoring.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runScoringFullScan } from "@/lib/scoring/engine.server";

const EntityEnum = z.enum(["lead", "contact", "company"]);
const OpEnum = z.enum([
  "eq",
  "neq",
  "in",
  "contains",
  "gt",
  "lt",
  "changed_to",
  "is_empty",
  "is_not_empty",
]);

const ConditionSchema = z.object({
  field: z.string().min(1).max(100),
  op: OpEnum,
  value: z.unknown().optional(),
});

const SaveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  entity: EntityEnum,
  enabled: z.boolean(),
  points: z.number().int().min(-1000).max(1000),
  condition: ConditionSchema,
});

export const listScoringRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("scoring_rules")
      .select("id, name, entity, enabled, points, condition, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveScoringRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SaveSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const payload = {
      owner_id: userId,
      name: data.name,
      entity: data.entity,
      enabled: data.enabled,
      points: data.points,
      condition: data.condition,
    } as never;
    if (data.id) {
      const { error } = await supabase.from("scoring_rules").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await supabase
      .from("scoring_rules")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteScoringRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("scoring_rules").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listRecentScoreEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("score_events")
      .select("id, rule_id, entity, entity_id, points, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const runScoringTickNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Full-scan: aplica todas as regras habilitadas sobre a base visível ao caller (RLS).
    return await runScoringFullScan(context.supabase);
  });
