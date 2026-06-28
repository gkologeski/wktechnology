/**
 * Referrals Leaderboard — Onda 5 / Slice 5.3.
 * Top indicadores por programa, com total e contratados.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getReferralsLeaderboard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        program_id: z.string().uuid().nullable().optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    let q = context.supabase
      .from("ats_referrals")
      .select("id, status, referrer_user_id, referrer_name, referrer_email");
    if (data.program_id) q = q.eq("program_id", data.program_id);
    const { data: rows, error } = await q.limit(5000);
    if (error) throw new Error(error.message);

    const agg = new Map<
      string,
      { key: string; label: string; total: number; hired: number; user_id: string | null }
    >();
    for (const r of rows ?? []) {
      const key =
        (r.referrer_user_id as string | null) ??
        (r.referrer_email as string | null) ??
        (r.referrer_name as string | null) ??
        "anonymous";
      const label =
        (r.referrer_name as string | null) ??
        (r.referrer_email as string | null) ??
        (r.referrer_user_id ? "Colaborador" : "Anônimo");
      const cur = agg.get(key) ?? {
        key,
        label,
        total: 0,
        hired: 0,
        user_id: (r.referrer_user_id as string | null) ?? null,
      };
      cur.total += 1;
      if (r.status === "hired" || r.status === "paid") cur.hired += 1;
      agg.set(key, cur);
    }

    const ranked = Array.from(agg.values())
      .sort((a, b) => b.hired - a.hired || b.total - a.total)
      .slice(0, data.limit);
    return { leaderboard: ranked };
  });
