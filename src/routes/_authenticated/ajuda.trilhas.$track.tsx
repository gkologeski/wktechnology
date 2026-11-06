import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Award, CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader, SectionHeader, Skeletons } from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  getTrainingTrack,
  setTrainingArticleRead,
  submitTrainingQuiz,
} from "@/lib/help/training.functions";
import { QUIZ_PASS_SCORE } from "@/lib/help/training-catalogue";

export const Route = createFileRoute("/_authenticated/ajuda/trilhas/$track")({
  head: () => ({
    meta: [
      { title: "Trilha de treinamento — TechERP" },
      { name: "description", content: "Artigos da trilha, progresso e quiz do módulo." },
      { property: "og:title", content: "Trilha de treinamento — TechERP" },
      { property: "og:description", content: "Artigos da trilha, progresso e quiz do módulo." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackPage,
});

type QuizResult = { score: number; total: number; passed: boolean; correct: boolean[] };

function TrackPage() {
  const { track } = Route.useParams();
  const qc = useQueryClient();
  const loadFn = useServerFn(getTrainingTrack);
  const readFn = useServerFn(setTrainingArticleRead);
  const quizFn = useServerFn(submitTrainingQuiz);
  const key = ["help-training-track", track];
  const q = useQuery({ queryKey: key, queryFn: () => loadFn({ data: { track } }) });
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<QuizResult | null>(null);

  const toggle = useMutation({
    mutationFn: (v: { module: string; slug: string; read: boolean }) => readFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["help-training"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const submit = useMutation({
    mutationFn: (list: number[]) => quizFn({ data: { track, answers: list } }),
    onSuccess: (r) => {
      setResult(r);
      toast[r.passed ? "success" : "info"](
        r.passed ? "Quiz aprovado!" : `Você acertou ${r.score} de ${r.total}. Tente de novo.`,
      );
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["help-training"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading)
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Skeletons.Cards count={3} />
      </div>
    );
  if (q.isError || !q.data || !q.data.allowed)
    return (
      <div className="mx-auto max-w-4xl p-6">
        <EmptyState
          title="Trilha indisponível"
          description="Esta trilha não existe ou seu acesso não libera este módulo."
          action={
            <Button asChild>
              <Link to="/ajuda/trilhas">Ver trilhas</Link>
            </Button>
          }
        />
      </div>
    );

  const d = q.data;
  const read = d.articles.filter((a) => a.read).length;
  const allAnswered = d.quiz.length > 0 && d.quiz.every((_, i) => answers[i] !== undefined);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <PageHeader
        title={d.track.title}
        description={`${d.track.role} · ${d.track.description}`}
        actions={
          <Button variant="outline" asChild>
            <Link to="/ajuda/trilhas">Todas as trilhas</Link>
          </Button>
        }
      />
      {d.badge && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-4" role="status">
          <Award className="h-8 w-8 text-primary" aria-hidden />
          <div>
            <p className="font-semibold">Selo de conclusão conquistado</p>
            <p className="text-sm text-muted-foreground">Você leu todos os artigos e foi aprovado no quiz.</p>
          </div>
        </div>
      )}

      <section className="space-y-3">
        <SectionHeader title="Artigos" description={`${read} de ${d.articles.length} lidos`} />
        <Progress value={d.articles.length ? (read / d.articles.length) * 100 : 0} aria-label="Progresso de leitura" />
        <ol className="divide-y rounded-lg border bg-card">
          {d.articles.map((a, i) => (
            <li key={a.slug} className="flex items-center gap-3 p-3">
              {a.read ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-label="Lido" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-label="Não lido" />
              )}
              <div className="min-w-0 flex-1">
                <Link
                  to="/ajuda/$module/$slug"
                  params={{ module: d.track.module, slug: a.slug }}
                  className="font-medium hover:underline"
                >
                  {i + 1}. {a.title}
                </Link>
                <p className="truncate text-sm text-muted-foreground">{a.summary}</p>
              </div>
              <Button
                size="sm"
                variant={a.read ? "ghost" : "outline"}
                disabled={toggle.isPending}
                onClick={() => toggle.mutate({ module: d.track.module, slug: a.slug, read: !a.read })}
              >
                {a.read ? "Desmarcar" : "Marcar como lido"}
              </Button>
            </li>
          ))}
        </ol>
      </section>

      {d.quiz.length > 0 && (
        <section className="space-y-3">
          <SectionHeader
            title="Quiz do módulo"
            description={`5 perguntas. Aprovação com ${QUIZ_PASS_SCORE} acertos.`}
            actions={d.quizPassed ? <Badge>Aprovado</Badge> : undefined}
          />
          <div className="space-y-4 rounded-lg border bg-card p-4">
            {d.quiz.map((question, i) => (
              <fieldset key={i} className="space-y-2">
                <legend className="font-medium">
                  {i + 1}. {question.q}
                  {result && (
                    <span className={result.correct[i] ? "ml-2 text-sm text-primary" : "ml-2 text-sm text-destructive"}>
                      {result.correct[i] ? "Correta" : "Incorreta"}
                    </span>
                  )}
                </legend>
                <RadioGroup
                  value={answers[i] !== undefined ? String(answers[i]) : ""}
                  onValueChange={(v) => {
                    setResult(null);
                    setAnswers((s) => ({ ...s, [i]: Number(v) }));
                  }}
                >
                  {question.options.map((opt, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <RadioGroupItem value={String(j)} id={`q${i}-o${j}`} />
                      <Label htmlFor={`q${i}-o${j}`} className="font-normal">
                        {opt}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </fieldset>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                disabled={!allAnswered || submit.isPending}
                onClick={() => submit.mutate(d.quiz.map((_, i) => answers[i]))}
              >
                {submit.isPending ? "Enviando…" : "Enviar respostas"}
              </Button>
              {result && (
                <p className="text-sm" aria-live="polite">
                  Você acertou {result.score} de {result.total}.
                </p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
