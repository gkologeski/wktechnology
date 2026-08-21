// Série mensal de fechamentos de negócios (ganhos x perdidos) por data real de fechamento.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  months: z.number().int().min(1).max(36).default(12),
});

export type DealClosingMonth = {
  /** Primeiro dia do mês em ISO (YYYY-MM-01). */
  month: string;
  /** Rótulo curto pt-BR, ex.: "ago/25". */
  label: string;
  wonCount: number;
  lostCount: number;
  wonValue: number;
  lostValue: number;
  /** Ganhos ÷ (ganhos + perdidos) em %, ou null quando não houve fechamento. */
  conversionRate: number | null;
};

export const getDealClosingsByMonth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d ?? {}))
  .handler(async ({ context, data }): Promise<DealClosingMonth[]> => {
    const { supabase } = context;
    const months = data.months;

    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
    const startIso = start.toISOString();

    const buckets = new Map<string, DealClosingMonth>();
    const order: string[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      order.push(key);
      buckets.set(key, {
        month: key,
        label: d
          .toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
          .replace(".", ""),
        wonCount: 0,
        lostCount: 0,
        wonValue: 0,
        lostValue: 0,
        conversionRate: null,
      });
    }

    const keyOf = (iso: string) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    };

    const [won, lost] = await Promise.all([
      supabase
        .from("deals")
        .select("value, closed_at")
        .eq("stage", "won")
        .gte("closed_at", startIso)
        .range(0, 9999),
      supabase
        .from("deals")
        .select("value, lost_at")
        .eq("stage", "lost")
        .gte("lost_at", startIso)
        .range(0, 9999),
    ]);

    if (won.error) throw won.error;
    if (lost.error) throw lost.error;

    for (const row of (won.data ?? []) as Array<{ value: number | null; closed_at: string | null }>) {
      if (!row.closed_at) continue;
      const b = buckets.get(keyOf(row.closed_at));
      if (!b) continue;
      b.wonCount += 1;
      b.wonValue += Number(row.value) || 0;
    }
    for (const row of (lost.data ?? []) as Array<{ value: number | null; lost_at: string | null }>) {
      if (!row.lost_at) continue;
      const b = buckets.get(keyOf(row.lost_at));
      if (!b) continue;
      b.lostCount += 1;
      b.lostValue += Number(row.value) || 0;
    }

    return order.map((k) => {
      const b = buckets.get(k)!;
      const total = b.wonCount + b.lostCount;
      return { ...b, conversionRate: total > 0 ? (b.wonCount / total) * 100 : null };
    });
  });
