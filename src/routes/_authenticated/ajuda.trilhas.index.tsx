import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Award, GraduationCap } from "lucide-react";
import { EmptyState, PageHeader, Skeletons } from "@/components/techhire/ui";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getTrainingOverview } from "@/lib/help/training.functions";

export const Route = createFileRoute("/_authenticated/ajuda/trilhas/")({
  head: () => ({
    meta: [
      { title: "Trilhas de treinamento — TechERP" },
      { name: "description", content: "Trilhas por papel, progresso, quizzes e selos de conclusão." },
      { property: "og:title", content: "Trilhas de treinamento — TechERP" },
      { property: "og:description", content: "Aprenda cada módulo do TechERP com trilhas e quizzes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TracksPage,
});

function TracksPage() {
  const fn = useServerFn(getTrainingOverview);
  const q = useQuery({ queryKey: ["help-training"], queryFn: () => fn() });

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageHeader
        title="Trilhas de treinamento"
        description="Leia os artigos de cada trilha e faça o quiz de 5 perguntas para ganhar o selo do módulo."
        secondaryActions={
          <Button variant="outline" asChild>
            <Link to="/ajuda">Voltar à Ajuda</Link>
          </Button>
        }
      />
      {q.isLoading && <div className="grid gap-4 sm:grid-cols-2"><Skeletons.Card /><Skeletons.Card /><Skeletons.Card /><Skeletons.Card /></div>}
      {q.isError && (
        <EmptyState
          title="Não foi possível carregar as trilhas"
          description="Tente novamente em instantes."
          action={<Button onClick={() => q.refetch()}>Tentar novamente</Button>}
        />
      )}
      {q.data && q.data.tracks.length === 0 && (
        <EmptyState
          icon={GraduationCap}
          title="Nenhuma trilha disponível"
          description="Seu acesso atual não libera nenhum módulo com trilha."
        />
      )}
      {q.data && q.data.tracks.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {q.data.tracks.map((t) => (
            <Link
              key={t.id}
              to="/ajuda/trilhas/$track"
              params={{ track: t.id }}
              className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                  <h2 className="font-semibold">{t.title}</h2>
                </div>
                {t.badge ? (
                  <Badge className="gap-1">
                    <Award className="h-3 w-3" aria-hidden /> Concluída
                  </Badge>
                ) : t.quizPassed ? (
                  <Badge variant="secondary">Quiz aprovado</Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
              <div className="mt-3 space-y-1">
                <Progress
                  value={t.total ? (t.read / t.total) * 100 : 0}
                  aria-label={`Progresso da trilha ${t.title}`}
                />
                <p className="text-xs text-muted-foreground">
                  {t.read} de {t.total} artigos lidos
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
