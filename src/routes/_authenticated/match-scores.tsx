import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listMatchScores, computeMatchScore } from "@/lib/ats/match.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/match-scores")({
  component: MatchScoresPage,
});

type Row = Awaited<ReturnType<typeof listMatchScores>>[number];

function MatchScoresPage() {
  const list = useServerFn(listMatchScores);
  const compute = useServerFn(computeMatchScore);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["match-scores"],
    queryFn: () => list({ data: {} }),
  });

  const m = useMutation({
    mutationFn: (v: { job_id: string; candidate_id: string }) => compute({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["match-scores"] }),
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Match Scores (IA)</h1>
      <p className="text-sm text-muted-foreground mb-4">
        Comparações entre vagas e candidatos usando IA. Use o botão "Avaliar match" no detalhe da
        vaga.
      </p>
      <div className="rounded border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30">
            <tr>
              <th className="p-2 text-left">Vaga</th>
              <th className="p-2 text-left">Candidato</th>
              <th className="p-2 text-left">Score</th>
              <th className="p-2 text-left">Resumo</th>
              <th className="p-2 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((r: Row) => (
              <tr key={r.id} className="border-b">
                <td className="p-2">{r.ats_jobs?.title ?? "-"}</td>
                <td className="p-2">{r.ats_candidates?.full_name ?? "-"}</td>
                <td className="p-2">
                  <Badge
                    variant={r.score >= 70 ? "default" : r.score >= 40 ? "secondary" : "outline"}
                  >
                    {Math.round(r.score)}
                  </Badge>
                </td>
                <td className="p-2 max-w-md truncate">{r.summary}</td>
                <td className="p-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={m.isPending}
                    onClick={() => m.mutate({ job_id: r.job_id, candidate_id: r.candidate_id })}
                  >
                    Recalcular
                  </Button>
                </td>
              </tr>
            ))}
            {(q.data ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Nenhum match calculado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
