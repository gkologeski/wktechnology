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
  },
): Promise<void> {
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

    // Reaproveita a atividade já existente para este questionário + registro.
    const { data: prior } = await supabase
      .from("activities")
      .select("id")
      .eq("type", "survey")
      .eq(relatedKey, args.entityId)
      .order("created_at", { ascending: false })
      .limit(50);
    const priorIds = ((prior as { id: string }[] | null) ?? []).map((r) => r.id);
    let activityId: string | null = null;
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

    if (activityId) {
      await supabase.from("activities").update({ subject, body } as never).eq("id", activityId);
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
        } as never)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      activityId = (inserted as { id: string }).id;
    }

    if (!args.workspaceId) return;
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
        responded_at: new Date().toISOString(),
      } as never,
      { onConflict: "activity_id" },
    );
  } catch (e) {
    // A timeline é acessória: não bloqueia o salvamento da qualificação.
    console.error("[qualification] timeline activity", e);
  }
}
