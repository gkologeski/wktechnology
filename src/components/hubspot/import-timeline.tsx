import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Play, StopCircle } from "lucide-react";
import { toast } from "sonner";
import {
  resumeHubspotImport,
  tickHubspotImportJob,
  cancelHubspotImport,
} from "@/lib/integrations/hubspot.functions";
import { StatusIcon } from "./import-wizard";
import { LiveCountersGrid, type CounterStep, type LiveCounterProps } from "./live-counter";
import { confirmDialog } from "@/components/ui/confirm-dialog";

type StepLog = {
  ts: string;
  level: "info" | "warn" | "error";
  step: string;
  message: string;
  count?: number;
};

type Job = {
  id: string;
  status: string;
  succeeded: number;
  failed: number;
  processed: number;
  total: number;
  error: string | null;
  step_logs: StepLog[];
  finished_at: string | null;
  started_at: string | null;
  scope: { maxCompanies?: number; maxPerObject?: number } | null;
};
type Item = {
  id: string;
  status: string;
  step?: string;
  order?: number;
  depends_on?: string[];
  started_at?: string;
  running_succeeded?: string | number;
  running_failed?: string | number;
  discovered?: string | number;
  after_succeeded?: string | number;
  after_failed?: string | number;
  after_finished_at?: string;
  before: {
    step: string;
    order: number;
    depends_on?: string[];
    started_at?: string;
    running_succeeded?: number;
    running_failed?: number;
    discovered?: number;
  } | null;
  after: { succeeded?: number; failed?: number; finished_at?: string } | null;
};

const KNOWN_STEPS: CounterStep[] = [
  "companies",
  "contacts",
  "deals",
  "leads",
  "tickets",
  "activities",
];

function fmtElapsed(startedAt: string | null, finishedAt: string | null): string {
  if (!startedAt) return "00:00:00";
  const start = new Date(startedAt).getTime();
  const end = finishedAt ? new Date(finishedAt).getTime() : Date.now();
  const s = Math.max(0, Math.floor((end - start) / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function ImportTimeline({ jobId, onReset }: { jobId: string; onReset: () => void }) {
  const [job, setJob] = useState<Job | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [continuing, setContinuing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [, setTick] = useState(0);
  const resumeFn = useServerFn(resumeHubspotImport);
  const tickFn = useServerFn(tickHubspotImportJob);
  const cancelFn = useServerFn(cancelHubspotImport);

  const normalizeItem = (it: Item): Item => ({
    id: it.id,
    status: it.status,
    before: it.before ?? {
      step: it.step ?? "",
      order: Number(it.order ?? 0),
      depends_on: it.depends_on ?? [],
      started_at: it.started_at,
      running_succeeded: Number(it.running_succeeded ?? 0),
      running_failed: Number(it.running_failed ?? 0),
      discovered: it.discovered === undefined ? undefined : Number(it.discovered),
    },
    after: it.after ?? {
      succeeded: it.after_succeeded === undefined ? undefined : Number(it.after_succeeded),
      failed: it.after_failed === undefined ? undefined : Number(it.after_failed),
      finished_at: it.after_finished_at,
    },
  });

  useEffect(() => {
    let active = true;
    const loadSnapshot = async () => {
      const { data: j } = await supabase
        .from("enrichment_jobs")
        .select(
          "id,status,succeeded,failed,processed,total,error,step_logs,finished_at,started_at,scope",
        )
        .eq("id", jobId)
        .single();
      if (active && j) setJob(j as unknown as Job);
      const { data: its } = await supabase
        .from("enrichment_job_items")
        .select(
          "id,status,step:before->>step,order:before->>order,depends_on:before->depends_on,started_at:before->>started_at,running_succeeded:before->>running_succeeded,running_failed:before->>running_failed,discovered:before->>discovered,after_succeeded:after->>succeeded,after_failed:after->>failed,after_finished_at:after->>finished_at",
        )
        .eq("job_id", jobId);
      if (active && its)
        setItems(
          (its as unknown as Item[])
            .map(normalizeItem)
            .sort((a, b) => (a.before?.order ?? 0) - (b.before?.order ?? 0)),
        );
    };
    void loadSnapshot();

    let refreshTimer: number | null = null;
    const scheduleSnapshot = () => {
      if (refreshTimer) return;
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        void loadSnapshot();
      }, 400);
    };

    // Use a unique topic per mount. In React dev/StrictMode the previous
    // channel can still be subscribed while the effect reconnects; reusing the
    // same topic can make supabase-js return a subscribed channel, and then
    // adding `postgres_changes` callbacks throws and crashes the import screen.
    const channelName = `job-${jobId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const ch = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "enrichment_jobs", filter: `id=eq.${jobId}` },
        (payload) => {
          setJob(payload.new as unknown as Job);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "enrichment_job_items",
          filter: `job_id=eq.${jobId}`,
        },
        () => scheduleSnapshot(),
      )
      .subscribe();

    // tick every second so elapsed time updates
    const interval = window.setInterval(() => setTick((t) => t + 1), 1000);
    const snapshotInterval = window.setInterval(() => void loadSnapshot(), 5000);

    return () => {
      active = false;
      supabase.removeChannel(ch);
      if (refreshTimer) window.clearTimeout(refreshTimer);
      window.clearInterval(interval);
      window.clearInterval(snapshotInterval);
    };
  }, [jobId]);

  useEffect(() => {
    if (job?.status !== "queued" && job?.status !== "running") return;
    let cancelled = false;
    let timer: number | null = null;
    const loop = async () => {
      if (cancelled) return;
      try {
        const r = await tickFn({ data: { jobId } });
        if (r.kind === "no_pending" || r.kind === "no_job") return;
      } catch {
        // mantém o polling; pode haver outro worker com o item em execução
      }
      if (!cancelled) timer = window.setTimeout(loop, 2500);
    };
    loop();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [job?.status, jobId, tickFn]);

  const finished = job?.status === "done" || job?.status === "failed";
  const canContinue =
    job?.status === "failed" &&
    items.some((it) => {
      if (it.status === "failed" || it.status === "running") return true;
      const hasEmptyResult =
        it.status === "done" &&
        (it.after?.succeeded ?? 0) === 0 &&
        (it.after?.failed ?? 0) === 0 &&
        (it.before?.depends_on?.length ?? 0) > 0;
      return hasEmptyResult;
    });
  // Trava monotônica: o scheduler pode reabrir etapas (status done→pending),
  // o que faria a barra do topo retroceder. Mantemos o maior valor já visto.
  const highWaterRef = useRef({ processed: 0, succeeded: 0, progress: 0 });
  if (job && (job.processed ?? 0) > highWaterRef.current.processed) {
    highWaterRef.current.processed = job.processed ?? 0;
  }
  if (job && (job.succeeded ?? 0) > highWaterRef.current.succeeded) {
    highWaterRef.current.succeeded = job.succeeded ?? 0;
  }
  // Reset ao reiniciar/continuar
  if (job?.status === "queued" && (job.processed ?? 0) === 0) {
    highWaterRef.current = { processed: 0, succeeded: 0, progress: 0 };
  }
  const liveSucceeded = items.reduce(
    (acc, it) => acc + (it.after?.succeeded ?? it.before?.running_succeeded ?? 0),
    0,
  );
  const liveFailed = items.reduce(
    (acc, it) => acc + (it.after?.failed ?? it.before?.running_failed ?? 0),
    0,
  );
  if (liveSucceeded > highWaterRef.current.succeeded) {
    highWaterRef.current.succeeded = liveSucceeded;
  }
  const displaySucceeded = Math.max(
    job?.succeeded ?? 0,
    liveSucceeded,
    highWaterRef.current.succeeded,
  );
  const displayFailed = Math.max(job?.failed ?? 0, liveFailed);

  // Progresso ponderado por registros: cada etapa contribui com sua fração
  // (succeeded/discovered). Quando uma etapa não tem total conhecido, conta
  // como 1 quando concluída, 0 caso contrário. Isso evita saltos bruscos de
  // 11% em 11% (1/9 etapas) e mostra movimento contínuo dentro de cada etapa.
  const totalSteps = Math.max(items.length, job?.total ?? 0, 1);
  const fractional = items.reduce((acc, it) => {
    if (it.status === "done") return acc + 1;
    if (it.status === "failed") return acc + 1;
    const succ = it.after?.succeeded ?? it.before?.running_succeeded ?? 0;
    const disc = it.before?.discovered ?? 0;
    if (it.status === "running") {
      if (disc > 0) return acc + Math.min(0.99, succ / disc);
      return acc + (succ > 0 ? 0.5 : 0.1);
    }
    return acc;
  }, 0);
  const rawProgress = Math.min(100, Math.round((fractional / totalSteps) * 100));
  if (rawProgress > highWaterRef.current.progress) {
    highWaterRef.current.progress = rawProgress;
  }
  const progress = Math.max(rawProgress, highWaterRef.current.progress);
  const stableProcessed = Math.max(job?.processed ?? 0, highWaterRef.current.processed);
  const elapsed = fmtElapsed(job?.started_at ?? null, finished ? (job?.finished_at ?? null) : null);

  // Build counter cards in the canonical order — only for steps present in the plan
  const counters: LiveCounterProps[] = useMemo(() => {
    const byStep = new Map<string, Item>();
    const activityItems: Item[] = [];
    for (const it of items) {
      const step = it.before?.step;
      if (!step) continue;
      if (step.startsWith("activities-")) activityItems.push(it);
      else byStep.set(step, it);
    }
    if (activityItems.length > 0) {
      const running = activityItems.find((it) => it.status === "running");
      const failed = activityItems.find((it) => it.status === "failed");
      const pending = activityItems.find((it) => it.status === "pending");
      const base = running ?? failed ?? pending ?? activityItems[activityItems.length - 1];
      byStep.set("activities", {
        ...base,
        status: running ? "running" : failed ? "failed" : pending ? "pending" : "done",
        before: {
          ...(base.before ?? { step: "activities", order: 4 }),
          step: "activities",
          discovered: activityItems.reduce((acc, it) => acc + (it.before?.discovered ?? 0), 0),
          running_succeeded: activityItems.reduce(
            (acc, it) => acc + (it.before?.running_succeeded ?? 0),
            0,
          ),
          running_failed: activityItems.reduce(
            (acc, it) => acc + (it.before?.running_failed ?? 0),
            0,
          ),
        },
        after: {
          succeeded: activityItems.reduce((acc, it) => acc + (it.after?.succeeded ?? 0), 0),
          failed: activityItems.reduce((acc, it) => acc + (it.after?.failed ?? 0), 0),
        },
      });
    }

    return KNOWN_STEPS.filter((s) => byStep.has(s)).map((s) => {
      const it = byStep.get(s)!;
      const status = (it.status as LiveCounterProps["status"]) ?? "pending";
      const succeeded = it.after?.succeeded ?? it.before?.running_succeeded ?? 0;
      const failed = it.after?.failed ?? it.before?.running_failed ?? 0;
      const discovered = it.before?.discovered;
      // Só usa denominador quando descobrimos o total real no HubSpot;
      // nunca caímos em maxCompanies (que era um teto, não o total real).
      return { step: s, status, succeeded, failed, target: discovered, discovered };
    });
  }, [items]);

  async function handleContinue() {
    setContinuing(true);
    try {
      await resumeFn({ data: { jobId } });
      setJob((prev) =>
        prev ? { ...prev, status: "queued", error: null, finished_at: null } : prev,
      );
      void tickFn({ data: { jobId } });
      toast.success("Importação retomada do último ponto salvo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao continuar importação");
    } finally {
      setContinuing(false);
    }
  }

  async function handleCancel() {
    if (!(await confirmDialog("Cancelar a importação em andamento? Você poderá retomá-la depois.")))
      return;
    setCancelling(true);
    try {
      await cancelFn({ data: { jobId } });
      toast.success("Importação cancelada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao cancelar");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold">Execução em tempo real</h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono tabular-nums">
              tempo decorrido: {elapsed}
            </p>
          </div>
          <Badge
            variant={
              job?.status === "done"
                ? "default"
                : job?.status === "failed"
                  ? "destructive"
                  : "secondary"
            }
          >
            {job?.status ?? "iniciando"}
          </Badge>
        </div>
        <Progress value={progress} className="mb-2" />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {stableProcessed}/{job?.total ?? 0} etapas · {displaySucceeded} registros importados
            {displayFailed ? ` · ${displayFailed} falhas` : ""}
          </span>
          {finished ? (
            <div className="flex items-center gap-2">
              {canContinue && (
                <Button size="sm" onClick={() => void handleContinue()} disabled={continuing}>
                  {continuing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Continuar importação
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={onReset}>
                Nova importação
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => void handleCancel()}
              disabled={cancelling}
            >
              {cancelling ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <StopCircle className="mr-2 h-4 w-4" />
              )}
              Parar importação
            </Button>
          )}
        </div>
        {job?.error && <p className="mt-3 text-sm text-destructive">{job.error}</p>}
      </section>

      <LiveCountersGrid steps={counters} />

      <section className="rounded-lg border bg-card p-5">
        <h3 className="font-semibold mb-3">Etapas</h3>
        <ol className="space-y-2">
          {items.map((it) => {
            const ok = it.after?.succeeded ?? it.before?.running_succeeded ?? 0;
            const fail = it.after?.failed ?? it.before?.running_failed ?? 0;
            return (
              <li
                key={it.id}
                className="flex items-center gap-3 p-3 rounded-md border bg-background"
              >
                <StatusIcon status={it.status} />
                <div className="flex-1">
                  <p className="font-medium text-sm capitalize">{it.before?.step ?? "—"}</p>
                  {it.before?.depends_on && it.before.depends_on.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      depende de: {it.before.depends_on.join(", ")}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
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
          {(job?.step_logs ?? [])
            .slice()
            .reverse()
            .map((l, i) => (
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
