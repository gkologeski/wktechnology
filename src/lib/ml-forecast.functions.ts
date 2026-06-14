import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Feature = { name: string; weight: number; value: number | string };

const STAGE_BASELINE: Record<string, number> = {
  new: 0.1,
  qualified: 0.25,
  proposal: 0.45,
  negotiation: 0.65,
  won: 1.0,
  lost: 0.0,
};

function clamp(x: number, lo = 0.01, hi = 0.99) {
  return Math.max(lo, Math.min(hi, x));
}

function scoreDeal(deal: Record<string, unknown>): {
  p: number;
  ev: number;
  lo: number;
  hi: number;
  features: Feature[];
} {
  const stage = String(deal.stage ?? "new").toLowerCase();
  const base = STAGE_BASELINE[stage] ?? 0.2;
  const value = Number(deal.value ?? 0);
  const features: Feature[] = [{ name: "stage", weight: 0.6, value: stage }];

  // Recência
  const updated = deal.updated_at ? new Date(deal.updated_at as string).getTime() : Date.now();
  const ageDays = Math.max(0, (Date.now() - updated) / 86400000);
  const recencyFactor = ageDays > 30 ? -0.1 : ageDays > 14 ? -0.05 : 0.05;
  features.push({
    name: "recency",
    weight: Math.abs(recencyFactor),
    value: `${Math.round(ageDays)}d`,
  });

  // Proximidade do fechamento esperado
  let closeFactor = 0;
  if (deal.expected_close_date) {
    const d = (new Date(deal.expected_close_date as string).getTime() - Date.now()) / 86400000;
    if (d >= 0 && d <= 14) closeFactor = 0.1;
    else if (d < 0) closeFactor = -0.1;
    features.push({
      name: "expected_close",
      weight: Math.abs(closeFactor) || 0.02,
      value: `${Math.round(d)}d`,
    });
  }

  // Probabilidade HubSpot, se houver
  let hsFactor = 0;
  const hsP = deal.hs_deal_stage_probability;
  if (hsP != null) {
    const hp = Number(hsP);
    hsFactor = (hp - base) * 0.4;
    features.push({ name: "hs_probability", weight: 0.2, value: hp });
  }

  const p = clamp(base + recencyFactor + closeFactor + hsFactor);
  const ev = value * p;
  const margin = 0.15 * (1 - Math.abs(p - 0.5) * 2 + 0.2);
  return {
    p,
    ev,
    lo: clamp(p - margin),
    hi: clamp(p + margin),
    features: features.sort((a, b) => b.weight - a.weight).slice(0, 3),
  };
}

export const computeDealForecast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ deal_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: d, error } = await supabase
      .from("deals")
      .select("id, value, stage, updated_at, expected_close_date, hs_deal_stage_probability")
      .eq("id", data.deal_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!d) throw new Error("Deal não encontrado");
    const s = scoreDeal(d);
    const row = {
      owner_id: userId,
      deal_id: d.id,
      probability: Number(s.p.toFixed(4)),
      expected_value: Number(s.ev.toFixed(2)),
      confidence_lo: Number(s.lo.toFixed(4)),
      confidence_hi: Number(s.hi.toFixed(4)),
      top_features: s.features,
      model_version: "heuristic-v1",
      computed_at: new Date().toISOString(),
    };
    const { error: uErr } = await supabase
      .from("ml_forecast_scores")
      .upsert(row, { onConflict: "deal_id" });
    if (uErr) throw new Error(uErr.message);
    return row;
  });

export const recomputeAllForecasts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: deals, error } = await supabase
      .from("deals")
      .select("id, value, stage, updated_at, expected_close_date, hs_deal_stage_probability")
      .is("deleted_at", null)
      .not("stage", "in", "(won,lost)")
      .limit(1000);
    if (error) throw new Error(error.message);
    const rows = (deals ?? []).map((d) => {
      const s = scoreDeal(d as Record<string, unknown>);
      return {
        owner_id: userId,
        deal_id: d.id as string,
        probability: Number(s.p.toFixed(4)),
        expected_value: Number(s.ev.toFixed(2)),
        confidence_lo: Number(s.lo.toFixed(4)),
        confidence_hi: Number(s.hi.toFixed(4)),
        top_features: s.features,
        model_version: "heuristic-v1",
        computed_at: new Date().toISOString(),
      };
    });
    if (rows.length) {
      const { error: uErr } = await supabase
        .from("ml_forecast_scores")
        .upsert(rows, { onConflict: "deal_id" });
      if (uErr) throw new Error(uErr.message);
    }
    return { processed: rows.length };
  });

export const listForecasts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("ml_forecast_scores")
      .select(
        "deal_id, probability, expected_value, confidence_lo, confidence_hi, top_features, model_version, computed_at",
      )
      .order("expected_value", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return { items: data ?? [] };
  });
