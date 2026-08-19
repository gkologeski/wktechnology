import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function activeWorkspace(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("active_workspace_id")
    .eq("id", userId)
    .maybeSingle();
  if (!data?.active_workspace_id) throw new Error("Workspace ativo não encontrado");
  return data.active_workspace_id as string;
}

const Variant = z.object({
  id: z.string(),
  label: z.string().min(1).max(80),
  weight: z.number().min(0).max(100).default(50),
  payload: z.record(z.any()).default({}),
});

export const listAbTests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase.from("ab_tests") as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { tests: (data ?? []) as any[] };
  });

export const upsertAbTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().min(1).max(120),
        entity_type: z.enum(["email", "landing_page"]),
        entity_id: z.string().uuid().optional().nullable(),
        variants: z.array(Variant).min(2).max(4),
        success_metric: z.enum(["click", "open", "submit", "deal_won"]).default("click"),
        status: z.enum(["draft", "running", "completed", "stopped"]).default("draft"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ws = await activeWorkspace(context.supabase, context.userId);
    const payload = {
      owner_id: ws,
      workspace_id: ws,
      name: data.name,
      entity_type: data.entity_type,
      entity_id: data.entity_id ?? null,
      variants: data.variants,
      success_metric: data.success_metric,
      status: data.status,
      started_at: data.status === "running" ? new Date().toISOString() : null,
    };
    if (data.id) {
      const { error } = await (context.supabase.from("ab_tests") as any)
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await (context.supabase.from("ab_tests") as any)
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const computeAbWinner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: test } = await (context.supabase.from("ab_tests") as any)
      .select("variants,success_metric")
      .eq("id", data.id)
      .single();
    if (!test) throw new Error("Test not found");
    const { data: events } = await (context.supabase.from("ab_test_events") as any)
      .select("variant_id,event_type")
      .eq("test_id", data.id);
    const totals: Record<string, { wins: number; impressions: number }> = {};
    for (const v of test.variants as Array<{ id: string }>)
      totals[v.id] = { wins: 0, impressions: 0 };
    for (const e of (events ?? []) as Array<{ variant_id: string; event_type: string }>) {
      const t = totals[e.variant_id];
      if (!t) continue;
      if (e.event_type === "impression") t.impressions += 1;
      if (e.event_type === test.success_metric) t.wins += 1;
    }
    let winner: string | null = null;
    let best = -1;
    for (const [id, t] of Object.entries(totals)) {
      const rate = t.impressions ? t.wins / t.impressions : 0;
      if (rate > best && t.impressions >= 30) {
        best = rate;
        winner = id;
      }
    }
    if (winner) {
      await (context.supabase.from("ab_tests") as any)
        .update({
          winner_variant_id: winner,
          status: "completed",
          ended_at: new Date().toISOString(),
        })
        .eq("id", data.id);
    }
    return { winner, totals };
  });
