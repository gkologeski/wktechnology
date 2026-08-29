import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listSecurityScans,
  getSecurityScanFindings,
  runSecurityScanNow,
} from "@/lib/security-scan.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useIsPlatformAdmin } from "@/lib/use-platform-admin";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Play, RefreshCw, ShieldAlert } from "lucide-react";

type Severity = "info" | "warning" | "error" | "critical";

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Crítico",
  error: "Erro",
  warning: "Aviso",
  info: "Info",
};

function sevVariant(s: Severity): "destructive" | "secondary" | "outline" {
  if (s === "critical" || s === "error") return "destructive";
  if (s === "warning") return "secondary";
  return "outline";
}

export function SecurityScansPage() {
  const { isPlatformAdmin, loading } = useIsPlatformAdmin();
  const qc = useQueryClient();
  const listFn = useServerFn(listSecurityScans);
  const findingsFn = useServerFn(getSecurityScanFindings);
  const runNowFn = useServerFn(runSecurityScanNow);

  const [selectedRun, setSelectedRun] = useState<string | null>(null);

  const runs = useQuery({
    queryKey: ["security-scan-runs"],
    queryFn: () => listFn(),
    enabled: isPlatformAdmin,
    refetchInterval: 60_000,
  });

  const findings = useQuery({
    queryKey: ["security-scan-findings", selectedRun],
    queryFn: () => findingsFn({ data: { run_id: selectedRun! } }),
    enabled: !!selectedRun,
  });

  const runNow = useMutation({
    mutationFn: () => runNowFn(),
    onSuccess: () => {
      toast.success("Varredura concluída");
      qc.invalidateQueries({ queryKey: ["security-scan-runs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <div className="p-6">Carregando…</div>;
  if (!isPlatformAdmin) return <div className="p-6">Acesso restrito a super-admins.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6" /> Varreduras de Segurança
          </h1>
          <p className="text-sm text-muted-foreground">
            Cron diário (03:00 UTC) verifica RLS, GRANTs a anon, funções SECURITY DEFINER e segredos
            de webhooks. Admins recebem notificação quando há aviso ou pior.
          </p>
        </div>
        <Button onClick={() => runNow.mutate()} disabled={runNow.isPending}>
          {runNow.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Rodar agora
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Execuções recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.isLoading ? (
            "Carregando…"
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Crítico</TableHead>
                  <TableHead>Erro</TableHead>
                  <TableHead>Aviso</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(runs.data?.runs ?? []).map((r: any) => {
                  const t = r.totals ?? {};
                  return (
                    <TableRow key={r.id} className={selectedRun === r.id ? "bg-muted/50" : ""}>
                      <TableCell>
                        {formatDistanceToNow(new Date(r.started_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            r.status === "success"
                              ? "outline"
                              : r.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{t.critical ?? 0}</TableCell>
                      <TableCell>{t.error ?? 0}</TableCell>
                      <TableCell>{t.warning ?? 0}</TableCell>
                      <TableCell>
                        <strong>{t.total ?? 0}</strong>
                      </TableCell>
                      <TableCell>{r.duration_ms ? `${r.duration_ms}ms` : "—"}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedRun(r.id)}>
                          Ver achados
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(runs.data?.runs ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      Nenhuma varredura ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedRun && (
        <Card>
          <CardHeader>
            <CardTitle>Achados da execução</CardTitle>
          </CardHeader>
          <CardContent>
            {findings.isLoading ? (
              "Carregando…"
            ) : (findings.data?.findings ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum achado nessa execução.</p>
            ) : (
              <div className="space-y-3">
                {(findings.data?.findings ?? []).map((f: any) => (
                  <div key={f.id} className="border rounded-md p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={sevVariant(f.severity as Severity)}>
                        {SEVERITY_LABEL[f.severity as Severity] ?? f.severity}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {f.scanner} · {f.category}
                      </span>
                    </div>
                    <div className="font-medium">{f.title}</div>
                    {f.detail && <div className="text-sm text-muted-foreground">{f.detail}</div>}
                    {f.ref && Object.keys(f.ref).length > 0 && (
                      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                        {JSON.stringify(f.ref, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
