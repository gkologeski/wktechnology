import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, Clock } from "lucide-react";
import { listPipelinesForSla, listSlaBreaches, setPipelineSla } from "@/lib/sla.functions";

export const Route = createFileRoute("/_authenticated/settings/sla")({
  component: SlaPage,
});

type StageRow = { value: string; label: string; sla_hours?: number | null };
type Pipe = { id: string; name: string; entity: string; stages: StageRow[]; is_default: boolean };

function SlaPage() {
  const listPipes = useServerFn(listPipelinesForSla);
  const listBreaches = useServerFn(listSlaBreaches);
  const savePipe = useServerFn(setPipelineSla);

  const pipesQ = useQuery({ queryKey: ["sla", "pipelines"], queryFn: () => listPipes() });
  const breachesQ = useQuery({
    queryKey: ["sla", "breaches"],
    queryFn: () => listBreaches(),
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            SLAs vencidos ({breachesQ.data?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {breachesQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (breachesQ.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro com SLA vencido. 🎉</p>
          ) : (
            <div className="divide-y">
              {(breachesQ.data ?? []).map((b) => (
                <div key={b.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to={b.entity === "leads" ? "/leads/$id" : "/deals"}
                      params={{ id: b.entity_id } as never}
                      className="font-medium hover:underline truncate block"
                    >
                      {b.entity_label}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {b.entity === "leads" ? "Lead" : "Negócio"} · etapa <span className="font-mono">{b.stage_id}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {formatHours(b.elapsed_hours)} / {formatHours(b.sla_hours)}
                    </Badge>
                    <Badge variant="destructive">+{formatHours(b.overdue_hours)} atraso</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {(pipesQ.data ?? []).map((p) => (
          <PipelineEditor
            key={p.id}
            pipe={p as Pipe}
            onSave={async (sla) => {
              await savePipe({ data: { pipeline_id: p.id, sla } });
              toast.success("SLA atualizado");
              breachesQ.refetch();
              pipesQ.refetch();
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PipelineEditor({ pipe, onSave }: { pipe: Pipe; onSave: (sla: Record<string, number | null>) => Promise<void> }) {
  const initial = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of pipe.stages) m[s.value] = s.sla_hours != null ? String(s.sla_hours) : "";
    return m;
  }, [pipe]);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);
  useEffect(() => setValues(initial), [initial]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {pipe.name}
          <Badge variant="outline" className="ml-2 capitalize">{pipe.entity}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {pipe.stages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem estágios configurados.</p>
        ) : pipe.stages.map((s) => (
          <div key={s.value} className="flex items-center gap-2">
            <span className="text-sm flex-1 truncate">{s.label || s.value}</span>
            <Input
              type="number"
              min={0}
              step={1}
              placeholder="—"
              className="w-28 h-8"
              value={values[s.value] ?? ""}
              onChange={(e) => setValues({ ...values, [s.value]: e.target.value })}
            />
            <span className="text-xs text-muted-foreground w-8">h</span>
          </div>
        ))}
        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                const sla: Record<string, number | null> = {};
                for (const [k, v] of Object.entries(values)) {
                  sla[k] = v === "" ? null : Number(v);
                }
                await onSave(sla);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Erro ao salvar");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Salvando…" : "Salvar SLA"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function formatHours(h: number): string {
  if (!isFinite(h)) return "—";
  if (h < 1) return `${Math.round(h * 60)}min`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${Math.round(h / 24)}d`;
}
