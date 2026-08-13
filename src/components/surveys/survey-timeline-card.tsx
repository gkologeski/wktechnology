import { Badge } from "@/components/ui/badge";
import { formatAnswer, type SurveyQuestion } from "@/lib/surveys/survey-fields";

export type SurveyResponseSummary = {
  activity_id: string;
  source: string;
  source_name: string | null;
  answers: unknown;
  score: number | null;
  max_score: number | null;
  questions: SurveyQuestion[];
};

/** Card de respostas de pesquisa exibido dentro do item da timeline. */
export function SurveyTimelineCard({ response }: { response: SurveyResponseSummary }) {
  const answers = (
    response.answers && typeof response.answers === "object" && !Array.isArray(response.answers)
      ? response.answers
      : {}
  ) as Record<string, unknown>;
  const questions = [...response.questions].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-foreground/90">
          {response.source_name ?? "Pesquisa"}
        </span>
        {response.score != null && (
          <Badge variant="secondary" className="text-[10px]">
            Score {response.score}
            {response.max_score ? `/${response.max_score}` : ""}
          </Badge>
        )}
      </div>
      {questions.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem perguntas registradas.</p>
      ) : (
        <dl className="space-y-1.5">
          {questions.map((q) => (
            <div key={q.id} className="grid gap-0.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <dt className="text-[11px] text-muted-foreground">{q.label}</dt>
              <dd className="text-xs text-foreground/90 break-words">
                {formatAnswer(q, answers[q.id])}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
