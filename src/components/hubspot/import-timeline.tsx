import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { StatusIcon } from "./import-wizard";

type Job = {
  id: string;
  status: string;
  succeeded: number;
  failed: number;
  processed: number;
  total: number;
  error: string | null;
  step_logs: { ts: string; level: "info" | "warn" | "error"; step: string; message: string; count?: number }[];
  finished_at: string | null;
};
type Item = {
  id: string;
  status: string;
  before: { step: string; order: number; depends_on?: string[]; started_at?: string } | null;
  after: { succeeded?: number; failed?: number; finished_at?: string } | null;
};

export function ImportTimeline({ jobId, onReset }: { jobId: string; onReset: () => void }) {
  const [job, setJob] = useState<Job | null>(null);
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: j } = await supabase.from("enrichment_jobs").select("*").eq("id", jobId).single();
      if (active && j) setJob(j as unknown as Job);
      const { data: its } = await supabase
        .from("enrichment_job_items")
        .select("*")
        .eq("job_id", jobId);
      if (active && its) setItems((its as unknown as Item[]).sort((a, b) => (a.before?.order ?? 0) - (b.before?.order ?? 0)));
    })();

    const ch = supabase
      .channel(`job-${jobId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "enrichment_jobs", filter: `id=eq.${jobId}` }, (payload) => {
        setJob(payload.new as unknown as Job);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "enrichment_job_items", filter: `job_id=eq.${jobId}` }, (payload) => {
        setItems((prev) => {
          const next = [...prev];
          const row = payload.new as unknown as Item;
          const idx = next.findIndex((i) => i.id === row.id);
          if (idx >= 0) next[idx] = row;
          else next.push(row);
          return next.sort((a, b) => (a.before?.order ?? 0) - (b.before?.order ?? 0));
        });
      })
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [jobId]);

  const finished = job?.status === "done" || job?.status === "failed";
  const progress = job && job.total > 0 ? Math.round((job.processed / job.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Execução em tempo real</h2>
          <Badge
            variant={
              job?.status === "done" ? "default" : job?.status === "failed" ? "destructive" : "secondary"
            }
          >
            {job?.status ?? "iniciando"}
          </Badge>
        </div>
        <Progress value={progress} className="mb-2" />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {job?.processed ?? 0}/{job?.total ?? 0} etapas · {job?.succeeded ?? 0} registros importados
            {job?.failed ? ` · ${job.failed} falhas` : ""}
          </span>
          {finished && (
            <Button size="sm" variant="outline" onClick={onReset}>
              Nova importação
            </Button>
          )}
        </div>
        {job?.error && <p className="mt-3 text-sm text-destructive">{job.error}</p>}
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h3 className="font-semibold mb-3">Etapas</h3>
        <ol className="space-y-2">
          {items.map((it) => {
            const ok = it.after?.succeeded ?? 0;
            const fail = it.after?.failed ?? 0;
            return (
              <li key={it.id} className="flex items-center gap-3 p-3 rounded-md border bg-background">
                <StatusIcon status={it.status} />
                <div className="flex-1">
                  <p className="font-medium text-sm capitalize">{it.before?.step ?? "—"}</p>
                  {it.before?.depends_on && it.before.depends_on.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      depende de: {it.before.depends_on.join(", ")}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {ok > 0 || fail > 0 ? `${ok} ok · ${fail} falhas` : ""}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h3 className="font-semibold mb-3">Log</h3>
        <div className="max-h-72 overflow-y-auto space-y-1 font-mono text-xs">
          {(job?.step_logs ?? []).slice().reverse().map((l, i) => (
            <div
              key={i}
              className={
                l.level === "error"
                  ? "text-destructive"
                  : l.level === "warn"
                    ? "text-amber-600"
                    : "text-muted-foreground"
              }
            >
              <span className="opacity-60">{new Date(l.ts).toLocaleTimeString("pt-BR")}</span>{" "}
              <span className="font-semibold">[{l.step}]</span> {l.message}
            </div>
          ))}
          {(!job?.step_logs || job.step_logs.length === 0) && (
            <p className="text-muted-foreground italic">Aguardando eventos…</p>
          )}
        </div>
      </section>
    </div>
  );
}
