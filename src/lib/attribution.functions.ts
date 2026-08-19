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

export const recordTouchpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        contact_id: z.string().uuid().optional().nullable(),
        lead_id: z.string().uuid().optional().nullable(),
        deal_id: z.string().uuid().optional().nullable(),
        channel: z.string().min(1).max(60),
        source: z.string().max(120).optional(),
        campaign: z.string().max(120).optional(),
        medium: z.string().max(60).optional(),
        content: z.string().max(200).optional(),
        term: z.string().max(120).optional(),
        url: z.string().max(500).optional(),
        metadata: z.record(z.any()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const ws = await activeWorkspace(context.supabase, context.userId);
    const { error } = await (context.supabase.from("attribution_touchpoints") as any).insert({
      owner_id: ws,
      workspace_id: ws,
      ...data,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type Model = "first_touch" | "last_touch" | "linear" | "u_shaped";

export const computeAttribution = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        model: z.enum(["first_touch", "last_touch", "linear", "u_shaped"]).default("linear"),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Pega deals "won" (estágio configurável) — usamos stage que contenha 'won' ou 'ganho'
    const { data: deals } = await (context.supabase.from("deals") as any)
      .select("id,value,contact_id,updated_at,stage")
      .ilike("stage", "%won%")
      .limit(500);

    const byChannel: Record<string, { revenue: number; deals: number }> = {};
    for (const d of (deals ?? []) as Array<{
      id: string;
      value: number | null;
      contact_id: string | null;
      updated_at: string;
    }>) {
      if (!d.contact_id) continue;
      const closedAt = d.updated_at ?? new Date().toISOString();
      if (data.from && closedAt < data.from) continue;
      if (data.to && closedAt > data.to) continue;
      const { data: tps } = await (context.supabase.from("attribution_touchpoints") as any)
        .select("channel,occurred_at")
        .eq("contact_id", d.contact_id)
        .lte("occurred_at", closedAt)
        .order("occurred_at", { ascending: true });
      const arr = (tps ?? []) as Array<{ channel: string }>;
      if (arr.length === 0) continue;
      const value = Number(d.value ?? 0);
      const weights = computeWeights(arr.length, data.model as Model);
      arr.forEach((t, i) => {
        const w = weights[i] ?? 0;
        byChannel[t.channel] = byChannel[t.channel] ?? { revenue: 0, deals: 0 };
        byChannel[t.channel].revenue += value * w;
        byChannel[t.channel].deals += w;
      });
    }
    return { model: data.model, channels: byChannel };
  });

function computeWeights(n: number, model: Model): number[] {
  if (n === 0) return [];
  if (model === "first_touch") return [1, ...Array(n - 1).fill(0)];
  if (model === "last_touch") return [...Array(n - 1).fill(0), 1];
  if (model === "linear") return Array(n).fill(1 / n);
  if (model === "u_shaped") {
    if (n === 1) return [1];
    if (n === 2) return [0.5, 0.5];
    const mid = (1 - 0.8) / (n - 2);
    return Array.from({ length: n }, (_, i) => (i === 0 || i === n - 1 ? 0.4 : mid));
  }
  return Array(n).fill(1 / n);
}
