import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getSurveyByToken, submitSurvey } from "@/lib/surveys.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/survey/$token")({
  component: SurveyPage,
});

function SurveyPage() {
  const { token } = Route.useParams();
  const fetchSurvey = useServerFn(getSurveyByToken);
  const submit = useServerFn(submitSurvey);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [sent, setSent] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["survey", token],
    queryFn: () => fetchSurvey({ data: { token } }),
  });

  async function send() {
    if (score === null) { toast.error("Selecione uma pontuação."); return; }
    try {
      await submit({ data: { token, score, comment: comment.trim() || undefined } });
      setSent(true);
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar.");
    }
  }

  if (isLoading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Carregando…</div>;
  if (error) return <div className="min-h-screen grid place-items-center text-destructive">{(error as Error).message}</div>;

  const s = data!.survey;
  const isNps = s.kind === "nps";
  const max = isNps ? 10 : 5;
  const scale = Array.from({ length: max + 1 }, (_, i) => i);
  const alreadyAnswered = !!s.responded_at || sent;

  return (
    <div className="min-h-screen grid place-items-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{isNps ? "Avalie sua experiência (NPS)" : "Como foi nosso atendimento?"}</CardTitle>
          {data!.ticketSubject && <p className="text-sm text-muted-foreground mt-1">Ticket: {data!.ticketSubject}</p>}
        </CardHeader>
        <CardContent className="space-y-4">
          {alreadyAnswered ? (
            <p className="text-sm">Obrigado! Sua resposta foi registrada.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 justify-center">
                {scale.map((n) => (
                  <button
                    key={n}
                    onClick={() => setScore(n)}
                    className={`h-10 w-10 rounded-md border text-sm font-medium transition-colors ${
                      score === n ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground px-1">
                <span>{isNps ? "Nem um pouco provável" : "Muito ruim"}</span>
                <span>{isNps ? "Extremamente provável" : "Excelente"}</span>
              </div>
              <Textarea
                rows={3}
                placeholder="Comentário (opcional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <Button className="w-full" onClick={send}>Enviar</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
