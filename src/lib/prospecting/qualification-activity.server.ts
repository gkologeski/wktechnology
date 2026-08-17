/**
 * Registro da qualificação na timeline do lead/contato.
 *
 * Cria (ou atualiza) uma atividade do tipo `survey` com a decisão, o score e o
 * motivo da qualificação, além da resposta em `activity_survey_responses` para
 * o card de pesquisa da timeline. Idempotente por questionário + registro:
 * reeditar a qualificação atualiza a mesma atividade em vez de duplicar.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeQualificationMaxScore,
  scorePercent,
  type ScoreQuestion,
} from "@/lib/prospecting/score";

type Decision = "pending" | "qualified" | "disqualified" | "nurture" | "scheduled";

const DECISION_LABEL: Record<Exclude<Decision, "pending">, string> = {
  qualified: "Qualificado",
  disqualified: "Desqualificado",
  nurture: "Nutrição",
  scheduled: "Agendado",
};

export async function logQualificationActivity(
  supabase: SupabaseClient,
  args: {
    userId: string;
    workspaceId: string | null;
    entity: "lead" | "contact";
    entityId: string;
    questionnaireId: string;
    questions: ScoreQuestion[];
    answers: Record<string, unknown>;
    score: number;
    decision: Exclude<Decision, "pending">;
    decisionReason?: string | null;
    /** Data histórica da atividade (backfill). Padrão: agora. */
    occurredAt?: string | null;
    /** Vínculos adicionais (contato/empresa do lead). */
    links?: { contactId?: string | null; companyId?: string | null };
    /** Atividade de pesquisa já existente (criada por workflow) a reaproveitar. */
    activityId?: string | null;
  },
): Promise<{ created: boolean; skipped: boolean }> {
  try {
    const relatedKey = args.entity === "lead" ? "related_lead_id" : "related_contact_id";

    const { data: q } = await supabase
      .from("prospecting_questionnaires")
      .select("name")
      .eq("id", args.questionnaireId)
      .maybeSingle();
    const name = (q as { name?: string } | null)?.name ?? "Qualificação";

    const { max } = computeQualificationMaxScore(args.questions);
    const maxScore = max > 0 ? max : null;
    const pct = maxScore ? scorePercent(args.score, maxScore) : null;

    const subject = `Qualificação — ${name}`;
    const bodyLines = [
      `Decisão: ${DECISION_LABEL[args.decision]}`,
      maxScore
        ? `Score: ${args.score}/${maxScore}${pct != null ? ` (${pct}%)` : ""}`
        : `Score: ${args.score}`,
    ];
    if (args.decisionReason?.trim()) bodyLines.push(`Motivo: ${args.decisionReason.trim()}`);
    const body = bodyLines.join("\n");

    // Reaproveita a atividade já existente para este questionário + registro:
    // 1) a atividade informada pelo chamador (criada por workflow);
    // 2) a que já tem resposta gravada para o mesmo questionário;
    // 3) a atividade de pesquisa pendente marcada com a mesma origem.
    let activityId: string | null = args.activityId ?? null;
    if (!activityId) {
      const { data: prior } = await supabase
        .from("activities")
        .select("id, custom_fields")
        .eq("type", "survey")
        .eq(relatedKey, args.entityId)
        .order("created_at", { ascending: false })
        .limit(50);
      const priorRows = (prior as { id: string; custom_fields: unknown }[] | null) ?? [];
      const priorIds = priorRows.map((r) => r.id);
      if (priorIds.length > 0) {
        const { data: matches } = await supabase
          .from("activity_survey_responses")
          .select("activity_id")
          .in("activity_id", priorIds)
          .eq("source", "prospecting_questionnaire")
          .eq("source_id", args.questionnaireId)
          .limit(1);
        activityId = ((matches as { activity_id: string }[] | null) ?? [])[0]?.activity_id ?? null;
      }
      if (!activityId) {
        const marked = priorRows.find((r) => {
          const cf = (r.custom_fields ?? {}) as Record<string, unknown>;
          return (
            cf["survey_source"] === "prospecting_questionnaire" &&
            cf["survey_source_id"] === args.questionnaireId
          );
        });
        activityId = marked?.id ?? null;
      }
    }

    let created = false;
    if (activityId) {
      await supabase
        .from("activities")
        .update({ subject, body } as never)
        .eq("id", activityId);
    } else {
      const { data: inserted, error } = await supabase
        .from("activities")
        .insert({
          owner_id: args.userId,
          created_by: args.userId,
          type: "survey",
          subject,
          body,
          completed: true,
          [relatedKey]: args.entityId,
          ...(args.workspaceId ? { workspace_id: args.workspaceId } : {}),
          ...(args.occurredAt ? { created_at: args.occurredAt } : {}),
          ...(args.links?.contactId && args.entity !== "contact"
            ? { related_contact_id: args.links.contactId }
            : {}),
          ...(args.links?.companyId ? { related_company_id: args.links.companyId } : {}),
        } as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      activityId = (inserted as { id: string }).id;
      created = true;
    }

    if (!args.workspaceId) return { created, skipped: false };
    await supabase.from("activity_survey_responses").upsert(
      {
        activity_id: activityId,
        owner_id: args.userId,
        workspace_id: args.workspaceId,
        source: "prospecting_questionnaire",
        source_id: args.questionnaireId,
        source_name: name,
        answers: args.answers,
        score: args.score,
        max_score: maxScore,
        responded_by: args.userId,
        responded_at: args.occurredAt ?? new Date().toISOString(),
      } as never,
      { onConflict: "activity_id" },
    );
    return { created, skipped: false };
  } catch (e) {
    // A timeline é acessória: não bloqueia o salvamento da qualificação.
    console.error("[qualification] timeline activity", e);
    return { created: false, skipped: true };
  }
}
