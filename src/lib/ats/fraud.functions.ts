// Fraud / risk flags do ATS (Fase 3) — heurísticas simples + scan em lote.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveActiveWorkspace } from "@/lib/active-workspace.server";

type Flag = {
  candidate_id: string;
  kind: string;
  severity: "low" | "medium" | "high";
  details: Json;
  owner_id: string;
};

export const scanCandidateFraud = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const workspaceId = await resolveActiveWorkspace(userId);
    const { data: cands, error } = await supabase
      .from("ats_candidates")
      .select("id, email, phone, cv_parsed, full_name")
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

      const cvText = JSON.stringify(c.cv_parsed ?? "").toLowerCase();
      const aiClues = ["proativo", "team player", "resultados", "comunicação", "dinâmico"].filter(
        (w) => cvText.includes(w),
      ).length;
      const hasDates = /\b(19|20)\d{2}\b/.test(cvText);
      if (cvText.length > 300 && aiClues >= 4 && !hasDates) {
        flags.push({
          owner_id: userId,
          candidate_id: c.id,
          kind: "ai_generated_cv",
          severity: "medium",
          details: { clues: aiClues } as Json,
        });
      }
    }

    for (const [email, ids] of byEmail)
      if (ids.length > 1)
        for (const id of ids)
          flags.push({
            owner_id: userId,
            candidate_id: id,
            kind: "duplicate_email",
            severity: "high",
            details: { email, dup_ids: ids } as Json,
          });
    for (const [phone, ids] of byPhone)
      if (ids.length > 1)
        for (const id of ids)
          flags.push({
            owner_id: userId,
            candidate_id: id,
            kind: "duplicate_phone",
            severity: "high",
            details: { phone, dup_ids: ids } as Json,
          });

    // Recalcular flags automáticas: limpeza idempotente antes de regravar.
    // Não usa guarda de linhas afetadas porque 0 linhas é resultado válido
    // (nenhuma flag automática existente); flags manuais são preservadas.
    await supabase
      .from("ats_candidate_flags")
      .delete()
      .eq("workspace_id", workspaceId)
      .neq("kind", "manual");
    if (flags.length > 0) {
      const { error: e2 } = await supabase.from("ats_candidate_flags").insert(flags);
      if (e2) throw new Error(e2.message);
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
      .from("ats_candidate_flags")
      .update({ resolved: true })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
