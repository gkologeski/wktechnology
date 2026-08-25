import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCandidateFlags,
  scanCandidateFraud,
  resolveCandidateFlag,
} from "@/lib/ats/fraud.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/fraud-flags")({
  component: FraudFlagsPage,
});

type FlagRow = Awaited<ReturnType<typeof listCandidateFlags>>[number];

function FraudFlagsPage() {
  const list = useServerFn(listCandidateFlags);
  const scan = useServerFn(scanCandidateFraud);
  const resolve = useServerFn(resolveCandidateFlag);
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["fraud-flags"],
    queryFn: () => list({ data: undefined as never }),
  });
  const scanM = useMutation({
    mutationFn: () => scan({ data: undefined as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fraud-flags"] }),
  });
  const resM = useMutation({
    mutationFn: (id: string) => resolve({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fraud-flags"] }),
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold">Flags de risco</h1>
          <p className="text-sm text-muted-foreground">
            Duplicatas, CVs suspeitos e sinais de fraude.
          </p>
        </div>
        <Button disabled={scanM.isPending} onClick={() => scanM.mutate()}>
          {scanM.isPending ? "Analisando..." : "Rodar scan agora"}
        </Button>
      </div>
      <div className="rounded border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30">
            <tr>
              <th className="p-2 text-left">Candidato</th>
              <th className="p-2 text-left">Tipo</th>
              <th className="p-2 text-left">Severidade</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {(q.data ?? []).map((f: FlagRow) => (
              <tr key={f.id} className="border-b">
                <td className="p-2">{f.ats_candidates?.full_name ?? "-"}</td>
                <td className="p-2">{f.kind}</td>
                <td className="p-2">
                  <Badge
                    variant={
                      f.severity === "high"
                        ? "destructive"
                        : f.severity === "medium"
                          ? "default"
                          : "outline"
                    }
                  >
                    {f.severity}
                  </Badge>
                </td>
                <td className="p-2">{f.resolved ? "Resolvido" : "Aberto"}</td>
                <td className="p-2">
                  {!f.resolved && (
                    <Button size="sm" variant="ghost" onClick={() => resM.mutate(f.id)}>
                      Marcar resolvido
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {(q.data ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-muted-foreground">
                  Sem flags. Rode um scan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
