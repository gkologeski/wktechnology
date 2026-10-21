// Widget flutuante do cronômetro (TechProjects). O estado vive no servidor
// (`project_timer_sessions`): um cronômetro ativo por pessoa e workspace, pausas pagas/não pagas,
// troca de atividade e finalização idempotentes. A tela nunca marca como salvo o que o servidor
// não confirmou; em falha mostra o erro e mantém o último estado confirmado.
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Play,
  Pause,
  Square,
  Timer as TimerIcon,
  Loader2,
  ChevronRight,
  Coffee,
  Repeat,
  CloudOff,
} from "lucide-react";
import { toast } from "sonner";

import { getRunningTimer } from "@/lib/project-timer.functions";
import { startTimerSession, timerAct } from "@/lib/projects/time-workflow.functions";
import { listTrackableProjects, listTrackableTasks } from "@/lib/projects/time-tracking.functions";
import type { TimerState } from "@/lib/projects/time-workflow.types";
import { browserTimeZone, formatSeconds } from "@/lib/projects/time-entry.shared";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

type Action = "pause_paid" | "pause_unpaid" | "resume" | "switch" | "stop" | "discard";

const ACTION_DONE: Record<Action, string> = {
  pause_paid: "Pausa paga iniciada",
  pause_unpaid: "Pausa não paga iniciada",
  resume: "Cronômetro retomado",
  switch: "Atividade trocada",
  stop: "Cronômetro finalizado e horas salvas",
  discard: "Cronômetro descartado",
};

function newRequestId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function TimerWidget() {
  const qc = useQueryClient();
  const getRunning = useServerFn(getRunningTimer);
  const actFn = useServerFn(timerAct);

  const runningQuery = useQuery({
    queryKey: ["timer", "running"],
    queryFn: () => getRunning(),
    refetchInterval: 30_000,
    staleTime: 10_000,
    // Widget acessório: uma falha transitória não deve propagar para o error boundary da página.
    retry: 2,
    retryDelay: (attempt) => Math.min(2_000 * 2 ** attempt, 10_000),
    throwOnError: false,
  });
  const timer = (runningQuery.data ?? null) as TimerState | null;

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!timer || timer.state !== "running") return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [timer]);

  const elapsed = useMemo(() => {
    if (!timer) return 0;
    if (timer.state !== "running") return timer.work_seconds;
    const drift = (Date.now() - runningQuery.dataUpdatedAt) / 1000;
    return timer.work_seconds + Math.max(0, drift);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timer, runningQuery.dataUpdatedAt, tick]);

  const [lastError, setLastError] = useState<string | null>(null);
  const act = useMutation({
    mutationFn: (v: { action: Action; taskId?: string | null }) =>
      actFn({
        data: {
          sessionId: timer!.id,
          version: timer!.version,
          action: v.action,
          taskId: v.taskId ?? null,
        },
      }),
    onSuccess: (state, v) => {
      setLastError(null);
      qc.setQueryData(
        ["timer", "running"],
        state.state === "running" || state.state === "paused" ? state : null,
      );
      if (v.action === "stop" || v.action === "discard") {
        void qc.invalidateQueries({ queryKey: ["time-entries"] });
        void qc.invalidateQueries({ queryKey: ["my-time-summary"] });
        void qc.invalidateQueries({ queryKey: ["timesheet"] });
        void qc.invalidateQueries({ queryKey: ["timesheet-overview"] });
      }
      const flagged = state.entries?.some((e) => e.review_flags?.length);
      toast.success(state.idempotent ? "Já estava salvo" : ACTION_DONE[v.action], {
        description:
          v.action === "stop" && flagged
            ? "Algum trecho ficou marcado para revisão (veja em Minhas Horas)."
            : undefined,
      });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Falha ao salvar no servidor";
      setLastError(msg);
      toast.error(`Não salvo no servidor: ${msg}`);
      void runningQuery.refetch();
    },
  });

  const [collapsed, setCollapsed] = useState<boolean>(false);
  useEffect(() => {
    setCollapsed(window.localStorage.getItem("timer-widget:collapsed") === "1");
  }, []);
  useEffect(() => {
    window.localStorage.setItem("timer-widget:collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  const hasTimer = !!timer;
  useEffect(() => {
    if (hasTimer) setCollapsed(false);
  }, [hasTimer]);

  const syncError = lastError ?? (runningQuery.isError ? "Sem conexão com o servidor" : null);

  if (collapsed) {
    return (
      <div className="fixed bottom-6 right-36 z-50" data-tick={tick}>
        <Button
          type="button"
          size="icon"
          variant={timer ? "default" : "secondary"}
          onClick={() => setCollapsed(false)}
          aria-label="Expandir cronômetro"
          title={timer ? `Cronômetro — ${formatSeconds(elapsed)}` : "Abrir cronômetro"}
          className="relative h-12 w-12 rounded-full shadow-lg"
        >
          <TimerIcon className="h-5 w-5" />
          {timer && (
            <span
              className={cn(
                "absolute -right-1 -top-1 h-3 w-3 rounded-full ring-2 ring-background",
                timer.state === "running" ? "animate-pulse bg-primary" : "bg-muted-foreground",
              )}
            />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-36 z-50 flex items-center gap-1" data-tick={tick}>
      {timer ? (
        <ActiveTimer
          timer={timer}
          elapsed={elapsed}
          pending={act.isPending}
          syncError={syncError}
          savedAt={runningQuery.dataUpdatedAt}
          onAct={(action, taskId) => act.mutate({ action, taskId })}
        />
      ) : (
        <StartTimerPopover onStarted={(s) => qc.setQueryData(["timer", "running"], s)} />
      )}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={() => setCollapsed(true)}
        aria-label="Recolher cronômetro"
        title="Recolher"
        className="h-7 w-7 rounded-full border bg-background/80 shadow"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function ActiveTimer({
  timer,
  elapsed,
  pending,
  syncError,
  savedAt,
  onAct,
}: {
  timer: TimerState;
  elapsed: number;
  pending: boolean;
  syncError: string | null;
  savedAt: number;
  onAct: (a: Action, taskId?: string | null) => void;
}) {
  const tasksFn = useServerFn(listTrackableTasks);
  const [open, setOpen] = useState(false);
  const tasksQuery = useQuery({
    queryKey: ["trackable-tasks", timer.project_id],
    queryFn: () => tasksFn({ data: { projectId: timer.project_id } }),
    enabled: open,
  });
  const paused = timer.state === "paused";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-full border px-3 py-2 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            paused
              ? "border-border bg-card text-foreground"
              : "border-primary/20 bg-primary text-primary-foreground",
          )}
          aria-label={`Cronômetro ${paused ? "pausado" : "em andamento"}: ${formatSeconds(elapsed)}`}
        >
          {syncError ? (
            <CloudOff className="h-4 w-4" aria-hidden />
          ) : (
            <TimerIcon className="h-4 w-4" aria-hidden />
          )}
          <span className="flex flex-col text-left leading-tight">
            <span className="font-mono text-xs tabular-nums">{formatSeconds(elapsed)}</span>
            <span className="max-w-[180px] truncate text-[10px] opacity-90">
              {paused ? "Pausado · " : ""}
              {timer.task_title ?? timer.project_name ?? "Sem tarefa"}
            </span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-80 space-y-3">
        <div>
          <p className="text-sm font-semibold">{timer.project_name ?? "Projeto"}</p>
          <p className="text-xs text-muted-foreground">
            Fuso {timer.timezone} · pausas pagas {formatSeconds(timer.paid_break_seconds)} · não
            pagas {formatSeconds(timer.unpaid_break_seconds)}
          </p>
          <p
            className={cn("mt-1 text-xs", syncError ? "text-destructive" : "text-muted-foreground")}
            aria-live="polite"
          >
            {syncError
              ? `Erro: ${syncError}. Nada foi alterado no servidor.`
              : `Salvo no servidor às ${new Date(savedAt).toLocaleTimeString("pt-BR")}`}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {paused ? (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => onAct("resume")}
              className="col-span-2"
            >
              <Play className="mr-1 h-3.5 w-3.5" /> Retomar
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onAct("pause_paid")}
              >
                <Coffee className="mr-1 h-3.5 w-3.5" /> Pausa paga
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => onAct("pause_unpaid")}
              >
                <Pause className="mr-1 h-3.5 w-3.5" /> Pausa não paga
              </Button>
            </>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Pausa paga conta como presença, não como hora produtiva no projeto.
        </p>
        <div className="space-y-1">
          <Label className="text-xs" htmlFor="timer-switch">
            <Repeat className="mr-1 inline h-3 w-3" aria-hidden /> Trocar atividade
          </Label>
          <Select
            value={timer.task_id ?? "__none"}
            onValueChange={(v) => onAct("switch", v === "__none" ? null : v)}
            disabled={pending}
          >
            <SelectTrigger id="timer-switch">
              <SelectValue placeholder="Sem tarefa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Sem tarefa</SelectItem>
              {(tasksQuery.data?.tasks ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              void confirmDialog({
                title: "Descartar o cronômetro?",
                description: "Nenhuma hora será gravada desta sessão.",
                confirmLabel: "Descartar",
                variant: "destructive",
              }).then((ok) => ok && onAct("discard"))
            }
          >
            Descartar
          </Button>
          <Button size="sm" disabled={pending} onClick={() => onAct("stop")}>
            {pending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Square className="mr-1 h-3.5 w-3.5" />
            )}
            Finalizar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function StartTimerPopover({ onStarted }: { onStarted: (s: TimerState) => void }) {
  const projectsFn = useServerFn(listTrackableProjects);
  const tasksFn = useServerFn(listTrackableTasks);
  const startFn = useServerFn(startTimerSession);
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string>("");
  const [taskId, setTaskId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [billable, setBillable] = useState(true);
  const requestId = useRef<string>(newRequestId());

  const projectsQuery = useQuery({
    queryKey: ["trackable-projects"],
    queryFn: () => projectsFn(),
    enabled: open,
  });
  const tasksQuery = useQuery({
    queryKey: ["trackable-tasks", projectId],
    queryFn: () => tasksFn({ data: { projectId } }),
    enabled: open && Boolean(projectId),
  });

  const startMut = useMutation({
    mutationFn: () =>
      startFn({
        data: {
          projectId,
          taskId: taskId || null,
          description: description || null,
          billable,
          timezone: browserTimeZone(),
          requestId: requestId.current,
        },
      }),
    onSuccess: (s) => {
      requestId.current = newRequestId();
      toast[s.conflict ? "info" : "success"](
        s.conflict
          ? "Já existe um cronômetro em andamento (outra aba ou dispositivo)."
          : "Cronômetro iniciado",
      );
      setOpen(false);
      setProjectId("");
      setTaskId("");
      setDescription("");
      onStarted(s);
    },
    onError: (e: unknown) =>
      toast.error(`Não iniciado no servidor: ${e instanceof Error ? e.message : "falha"}`),
  });

  const projects = projectsQuery.data?.projects ?? [];
  const tasks = tasksQuery.data?.tasks ?? [];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" className="h-10 gap-2 rounded-full px-4 shadow-lg">
          <Play className="h-4 w-4" />
          Cronômetro
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-80 space-y-3">
        <div className="text-sm font-semibold">Iniciar cronômetro</div>
        {projectsQuery.isSuccess && projects.length === 0 ? (
          <p className="text-sm text-muted-foreground" role="status">
            Você não está liberado para apontar em nenhum projeto. Peça ao gestor para incluir você
            como membro ou registrar sua alocação.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="text-xs" htmlFor="timer-project">
                Projeto
              </Label>
              <Select
                value={projectId}
                onValueChange={(v) => {
                  setProjectId(v);
                  setTaskId("");
                }}
              >
                <SelectTrigger id="timer-project">
                  <SelectValue
                    placeholder={projectsQuery.isLoading ? "Carregando..." : "Selecione um projeto"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.favorite ? "★ " : ""}
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs" htmlFor="timer-task">
                Tarefa (opcional)
              </Label>
              <Select value={taskId} onValueChange={setTaskId} disabled={!projectId}>
                <SelectTrigger id="timer-task">
                  <SelectValue placeholder="Sem tarefa" />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs" htmlFor="timer-desc">
                Descrição
              </Label>
              <Input
                id="timer-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="O que você está fazendo?"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs" htmlFor="timer-billable">
                Faturável
              </Label>
              <Switch id="timer-billable" checked={billable} onCheckedChange={setBillable} />
            </div>
          </>
        )}
        <div className="flex items-center justify-between pt-1">
          <Link
            to="/projects/my-hours"
            onClick={() => setOpen(false)}
            className="text-xs text-muted-foreground hover:underline"
          >
            Minhas Horas
          </Link>
          <Button
            size="sm"
            disabled={!projectId || startMut.isPending}
            onClick={() => startMut.mutate()}
          >
            {startMut.isPending ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Play className="mr-1 h-3 w-3" />
            )}
            Iniciar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
