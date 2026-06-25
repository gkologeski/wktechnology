// Fraud / risk flags do ATS (Fase 3)
// Heurísticas simples + scan em lote.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Flag = {
  candidate_id: string;
  kind: string;
  severity: "low" | "medium" | "high";
  details: Record<string, unknown>;
};

export const scanCandidateFraud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: cands, error } = await supabase
      .from("ats_candidates")
      .select("id, email, phone, cv_text, full_name")
      .limit(2000);
    if (error) throw new Error(error.message);

    const byEmail = new Map<string, string[]>();
    const byPhone = new Map<string, string[]>();
    const flags: Flag[] = [];

    for (const c of cands ?? []) {
      const e = (c.email ?? "").toLowerCase().trim();
      const p = (c.phone ?? "").replace(/\D/g, "");
      if (e) byEmail.set(e, [...(byEmail.get(e) ?? []), c.id]);
      if (p && p.length >= 8) byPhone.set(p, [...(byPhone.get(p) ?? []), c.id]);

      // Heurística IA-CV: muitos clichês / sem números / sem datas
      const t = (c.cv_text ?? "").toLowerCase();
      const aiClues = ["proativo", "team player", "resultados", "comunicação", "dinâmico"].filter((w) => t.includes(w)).length;
      const hasDates = /\b(19|20)\d{2}\b/.test(t);
      if (t.length > 300 && aiClues >= 4 && !hasDates) {
        flags.push({ candidate_id: c.id, kind: "ai_generated_cv", severity: "medium", details: { clues: aiClues } });
      }
    }

    for (const [email, ids] of byEmail) if (ids.length > 1) for (const id of ids)
      flags.push({ candidate_id: id, kind: "duplicate_email", severity: "high", details: { email, dup_ids: ids } });
    for (const [phone, ids] of byPhone) if (ids.length > 1) for (const id of ids)
      flags.push({ candidate_id: id, kind: "duplicate_phone", severity: "high", details: { phone, dup_ids: ids } });

    // Limpa flags automáticas anteriores deste owner
    await supabase.from("ats_candidate_flags").delete().eq("owner_id", userId).neq("kind", "manual");
    if (flags.length > 0) {
      await supabase.from("ats_candidate_flags").insert(flags.map((f) => ({ ...f, owner_id: userId })));
    }
    return { flags_created: flags.length };
  });

export const listCandidateFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ats_candidate_flags")
      .select("*, ats_candidates(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const resolveCandidateFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("ats_candidate_flags").update({ resolved: true }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
