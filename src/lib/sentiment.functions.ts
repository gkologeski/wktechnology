import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

export const listSentiments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        contact_id: z.string().uuid().optional(),
        lead_id: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(500).default(100),
      })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any)
      .from("message_sentiments")
      .select(
        "id, source, source_id, contact_id, lead_id, label, score, emotion, keywords, analyzed_at",
      )
      .eq("workspace_id", workspaceId)
      .order("analyzed_at", { ascending: false })
      .limit(data.limit);
    if (data.contact_id) q = q.eq("contact_id", data.contact_id);
    if (data.lead_id) q = q.eq("lead_id", data.lead_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as Array<{
      id: string;
      source: string;
      source_id: string;
      contact_id: string | null;
      lead_id: string | null;
      label: "positive" | "neutral" | "negative";
      score: number;
      emotion: string | null;
      keywords: string[];
      analyzed_at: string;
    }>;
  });

export const sentimentOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ days: z.number().int().min(1).max(180).default(30) }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const from = new Date(Date.now() - data.days * 86400_000).toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (supabase as any)
      .from("message_sentiments")
      .select("label, score")
      .eq("workspace_id", workspaceId)
      .gte("analyzed_at", from);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as { label: string; score: number }[];
    const total = list.length || 1;
    const pos = list.filter((r) => r.label === "positive").length;
    const neg = list.filter((r) => r.label === "negative").length;
    const neu = list.filter((r) => r.label === "neutral").length;
    const avg = list.reduce((s, r) => s + Number(r.score || 0), 0) / total;
    return {
      total: list.length,
      positive: pos,
      negative: neg,
      neutral: neu,
      avg_score: Number(avg.toFixed(3)),
    };
  });

export const runSentimentTick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { tickSentiment } = await import("@/lib/sentiment/engine.server");
    return tickSentiment(20);
  });
