/**
 * Backfill das qualificações antigas na timeline.
 *
 * Cria a atividade do tipo "Pesquisa" para qualificações concluídas antes da
 * correção que passou a registrar a timeline no salvamento. Idempotente:
 * reaproveita a checagem de existência de `logQualificationActivity`.
 * Restrito a super-admins (platform_admins).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Evita o parsing das strings de select no nível de tipos (typecheck lento). */
const sel = (s: string): string => s;

const QUESTION_COLUMNS = "id, type, weight, options, text_points, text_min_chars";

type QualRow = {
  id: string;
  owner_id: string;
  questionnaire_id: string;
  entity: "lead" | "contact";
  entity_id: string;
  answers: Record<string, unknown>;
  score: number;
  decision: string;
  decision_reason: string | null;
  qualified_at: string | null;
  created_at: string;
};

export const backfillQualificationActivities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { logQualificationActivity } =
      await import("@/lib/prospecting/qualification-activity.server");

    const { data: admin, error: adminErr } = await supabaseAdmin
      .from("platform_admins")
      .select(sel("user_id"))
      .eq("user_id", context.userId)
      .maybeSingle();
    if (adminErr) throw new Error(adminErr.message);
    if (!admin) throw new Error("Acesso restrito a super-admins.");

    const { data: quals, error } = await supabaseAdmin
      .from("prospecting_qualifications")
      .select(
        sel(
          "id, owner_id, questionnaire_id, entity, entity_id, answers, score, decision, decision_reason, qualified_at, created_at",
        ),
      )
      .neq("decision", "pending")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = (quals ?? []) as unknown as QualRow[];
    const questionsCache = new Map<string, unknown[]>();
    let created = 0;
    let existing = 0;
    let failed = 0;

    for (const q of rows) {
      try {
        let questions = questionsCache.get(q.questionnaire_id);
        if (!questions) {
          const { data: qs } = await supabaseAdmin
            .from("prospecting_questions")
            .select(sel(QUESTION_COLUMNS))
            .eq("questionnaire_id", q.questionnaire_id);
          questions = (qs ?? []) as unknown[];
          questionsCache.set(q.questionnaire_id, questions);
        }

        // Vínculos e workspace derivados do registro de origem.
        let workspaceId: string | null = null;
        let contactId: string | null = null;
        let companyId: string | null = null;
        if (q.entity === "lead") {
          const { data: lead } = await supabaseAdmin
            .from("leads")
            .select(sel("workspace_id, company_id, converted_contact_id"))
            .eq("id", q.entity_id)
            .maybeSingle();
          const l = lead as {
            workspace_id?: string | null;
            company_id?: string | null;
            converted_contact_id?: string | null;
          } | null;
          workspaceId = l?.workspace_id ?? null;
          companyId = l?.company_id ?? null;
          contactId = l?.converted_contact_id ?? null;
        } else {
          const { data: contact } = await supabaseAdmin
            .from("contacts")
            .select(sel("workspace_id, company_id"))
            .eq("id", q.entity_id)
            .maybeSingle();
          const c = contact as { workspace_id?: string | null; company_id?: string | null } | null;
          workspaceId = c?.workspace_id ?? null;
          companyId = c?.company_id ?? null;
        }

        const res = await logQualificationActivity(supabaseAdmin as never, {
          userId: q.owner_id,
          workspaceId,
          entity: q.entity,
          entityId: q.entity_id,
          questionnaireId: q.questionnaire_id,
          questions: questions as never,
          answers: (q.answers ?? {}) as Record<string, unknown>,
          score: q.score,
          decision: q.decision as "qualified" | "disqualified" | "nurture" | "scheduled",
          decisionReason: q.decision_reason,
          occurredAt: q.qualified_at ?? q.created_at,
          links: { contactId, companyId },
        });
        if (res.skipped) failed += 1;
        else if (res.created) created += 1;
        else existing += 1;
      } catch (e) {
        console.error("[qualification-backfill]", q.id, e);
        failed += 1;
      }
    }

    return { total: rows.length, created, existing, failed };
  });
