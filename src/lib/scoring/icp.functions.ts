// Server functions do ICP (Perfil de Cliente Ideal) e do detalhamento de score.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getActiveWorkspaceId } from "@/lib/access-control/enforce.server";
import { runIcpScan, getLeadIcpFit as getFit } from "@/lib/scoring/icp.server";

const OpEnum = z.enum(["eq", "neq", "in", "contains", "gt", "lt", "is_empty", "is_not_empty"]);

const CriterionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  entity: z.enum(["lead", "company"]),
  field: z.string().min(1).max(120),
  op: OpEnum,
  value: z.unknown().optional(),
  points: z.number().int().min(-1000).max(1000),
  enabled: z.boolean(),
});

export const listIcpCriteria = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("icp_criteria")
      .select("id, name, entity, field, op, value, points, enabled, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveIcpCriterion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CriterionSchema.parse(i))
  .handler(async ({ context, data }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    const payload = {
      owner_id: context.userId,
      workspace_id: ws,
      name: data.name,
      entity: data.entity,
      field: data.field,
      op: data.op,
      value: (data.value ?? null) as never,
      points: data.points,
      enabled: data.enabled,
    } as never;
    if (data.id) {
      const { owner_id: _o, workspace_id: _w, ...updatable } = payload as Record<string, unknown>;
      const { error } = await context.supabase
        .from("icp_criteria")
        .update(updatable as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("icp_criteria")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteIcpCriterion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("icp_criteria").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const runIcpScanNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ws = await getActiveWorkspaceId(context.supabase, context.userId);
    return await runIcpScan(context.supabase, { ownerId: context.userId, workspaceId: ws });
  });

export const getLeadIcpFit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ lead_id: z.string().uuid() }).parse(i))
  .handler(async ({ context, data }) => {
    return await getFit(context.supabase, data.lead_id);
  });

/** Detalhamento do score de um registro por origem (Regras / Qualificação / ICP). */
export const getScoreBreakdown = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        entity: z.enum(["leads", "contacts", "companies"]),
        entity_id: z.string().uuid(),
      })
      .parse(i),
  )
  .handler(async ({ context, data }) => {
    const [{ data: contribs }, { data: events }, { data: row }] = await Promise.all([
      context.supabase
        .from("score_contributions")
        .select("source, points, reason, updated_at")
        .eq("entity", data.entity)
        .eq("entity_id", data.entity_id),
      context.supabase
        .from("score_events")
        .select("points")
        .eq("entity", data.entity)
        .eq("entity_id", data.entity_id),
      context.supabase.from(data.entity).select("score").eq("id", data.entity_id).maybeSingle(),
    ]);

    const bySource: Record<string, number> = { rules: 0, qualification: 0, icp: 0 };
    for (const c of (contribs ?? []) as { source: string; points: number }[]) {
      bySource[c.source] = (bySource[c.source] ?? 0) + Number(c.points ?? 0);
    }
    // Regras usam score_events (legado, uma linha por regra aplicada).
    bySource.rules += ((events ?? []) as { points: number }[]).reduce(
      (s, e) => s + Number(e.points ?? 0),
      0,
    );

    return {
      total: Number((row?.score as number | null) ?? 0),
      rules: bySource.rules,
      qualification: bySource.qualification ?? 0,
      icp: bySource.icp ?? 0,
      details: (contribs ?? []) as unknown as {
        source: string;
        points: number;
        reason: string | null;
        updated_at: string;
      }[],
    };
  });
