// DEI Analytics (Fase 4) — agregações dos campos auto-declarados.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function groupCount(rows: Array<Record<string, unknown>>, key: string) {
  const m = new Map<string, number>();
  for (const r of rows) {
    const v = (r[key] as string | null) ?? "Não informado";
    m.set(v, (m.get(v) ?? 0) + 1);
  }
  return Array.from(m.entries()).map(([label, value]) => ({ label, value }));
}

export const getDeiAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ats_candidates")
      .select("dei_gender, dei_race, dei_disability, dei_lgbtqia")
      .limit(5000);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    return {
      total: rows.length,
      gender: groupCount(rows, "dei_gender"),
      race: groupCount(rows, "dei_race"),
      disability: groupCount(rows, "dei_disability"),
      lgbtqia: groupCount(rows, "dei_lgbtqia"),
    };
  });
