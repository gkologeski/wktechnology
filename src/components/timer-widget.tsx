// Sprint D — Widget flutuante de timer (Clockify-like).
// Renderizado no layout autenticado; aparece como pill fixa no canto inferior direito.
// Mostra tempo decorrido em tempo real e permite start/stop.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Play, Square, Timer as TimerIcon, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { getRunningTimer, stopTimer, startTimer } from "@/lib/project-timer.functions";
import { listProjects, listAllProjectTasks } from "@/lib/projects.functions";
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
import { cn } from "@/lib/utils";

function formatElapsed(startedAt: string | null | undefined): string {
  if (!startedAt) return "00:00:00";
  const diff = Math.max(0, Date.now() - new Date(startedAt).getTime());
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function TimerWidget() {
  const qc = useQueryClient();
  const getRunning = useServerFn(getRunningTimer);
  const stopFn = useServerFn(stopTimer);
  const startFn = useServerFn(startTimer);

  const runningQuery = useQuery({
    queryKey: ["timer", "running"],
    queryFn: () => getRunning(),
    refetchInterval: 30_000,
    staleTime: 15_000,
    // Widget acessório: uma falha transitória não deve propagar para o
    // error boundary da página (tela em branco). Tenta de novo e segue vazio.
    retry: 2,
    retryDelay: (attempt) => Math.min(2_000 * 2 ** attempt, 10_000),
    throwOnError: false,
  });

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!runningQuery.data) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [runningQuery.data]);

  const stopMut = useMutation({
    mutationFn: () => stopFn({}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timer"] });
      qc.invalidateQueries({ queryKey: ["timesheet"] });
      toast.success("Timer parado");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao parar timer"),
  });

  const running = runningQuery.data as
    | (Record<string, unknown> & {
        started_at?: string | null;
        project_tasks?: { title?: string } | null;
        projects?: { name?: string } | null;
      })
    | null;

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("timer-widget:collapsed") === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("timer-widget:collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  // Auto-expande quando um timer inicia
  const hasRunning = !!running;
  useEffect(() => {
    if (hasRunning) setCollapsed(false);
  }, [hasRunning]);

  if (collapsed) {
    return (
      <div className="fixed bottom-6 right-36 z-50" data-tick={tick}>
        <Button
          type="button"
          size="icon"
          variant={running ? "default" : "secondary"}
          onClick={() => setCollapsed(false)}
          aria-label="Expandir timer"
          title={
            running ? `Timer ativo — ${formatElapsed(running.started_at ?? null)}` : "Abrir timer"
          }
          className="h-12 w-12 rounded-full shadow-lg relative"
        >
          <TimerIcon className="h-5 w-5" />
          {running && (
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-36 z-50 flex items-center gap-1" data-tick={tick}>
      {running ? (
        <div className="flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-3 py-2 shadow-lg border border-primary/20">
          <TimerIcon className="h-4 w-4" />
          <div className="flex flex-col leading-tight">
            <span className="font-mono text-xs tabular-nums">
              {formatElapsed(running.started_at ?? null)}
            </span>
            <span className="text-[10px] opacity-90 max-w-[180px] truncate">
              {running.project_tasks?.title ?? running.projects?.name ?? "Sem tarefa"}
            </span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="h-7 px-2"
            disabled={stopMut.isPending}
            onClick={() => stopMut.mutate()}
          >
            {stopMut.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Square className="h-3 w-3" />
            )}
          </Button>
        </div>
      ) : (
        <StartTimerPopover
          onStarted={() => qc.invalidateQueries({ queryKey: ["timer"] })}
          startFn={startFn}
        />
      )}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={() => setCollapsed(true)}
        aria-label="Recolher timer"
        title="Recolher"
        className="h-7 w-7 rounded-full bg-background/80 shadow border"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function StartTimerPopover({
  onStarted,
  startFn,
}: {
  onStarted: () => void;
  startFn: ReturnType<typeof useServerFn<typeof startTimer>>;
}) {
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState<string>("");
  const [taskId, setTaskId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [billable, setBillable] = useState(true);

  const projectsQuery = useQuery({
    queryKey: ["projects", "for-timer"],
    queryFn: () => useServerFnBypass(listProjects, { status: "active" }),
    enabled: open,
  });
  const tasksQuery = useQuery({
    queryKey: ["project-tasks", "for-timer", projectId],
    queryFn: () => useServerFnBypass(listAllProjectTasks, projectId ? { projectId } : {}),
    enabled: open && Boolean(projectId),
  });

  const startMut = useMutation({
    mutationFn: (payload: {
      projectId: string;
      taskId?: string | null;
      description?: string | null;
      billable: boolean;
    }) => startFn({ data: payload }),
    onSuccess: () => {
      toast.success("Timer iniciado");
      setOpen(false);
      setProjectId("");
      setTaskId("");
      setDescription("");
      onStarted();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao iniciar timer"),
  });

  const projects = (projectsQuery.data ?? []) as Array<{ id: string; name: string }>;
  const tasks = (tasksQuery.data ?? []) as Array<{ id: string; title: string }>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          className={cn(
            "rounded-full shadow-lg h-10 px-4 gap-2",
            "bg-primary text-primary-foreground",
          )}
        >
          <Play className="h-4 w-4" />
          Timer
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-80 space-y-3">
        <div className="text-sm font-semibold">Iniciar timer</div>
        <div className="space-y-2">
          <Label className="text-xs">Projeto</Label>
          <Select
            value={projectId}
            onValueChange={(v) => {
              setProjectId(v);
              setTaskId("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um projeto" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Tarefa (opcional)</Label>
          <Select value={taskId} onValueChange={setTaskId} disabled={!projectId}>
            <SelectTrigger>
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
          <Label className="text-xs">Descrição</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="O que você está fazendo?"
          />
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-xs">Billable</Label>
          <Switch checked={billable} onCheckedChange={setBillable} />
        </div>
        <div className="flex items-center justify-between pt-1">
          <Link
            to="/projects/timesheet"
            onClick={() => setOpen(false)}
            className="text-xs text-muted-foreground hover:underline"
          >
            Ver timesheet
          </Link>
          <Button
            size="sm"
            disabled={!projectId || startMut.isPending}
            onClick={() =>
              startMut.mutate({
                projectId,
                taskId: taskId || null,
                description: description || null,
                billable,
              })
            }
          >
            {startMut.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            Iniciar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Wrapper para invocar server function fora de contexto React (query fn).
// Simples: chama diretamente já que server functions são funções isoladas.
function useServerFnBypass<T extends (...args: never[]) => unknown>(
  fn: T,
  data: Record<string, unknown>,
): ReturnType<T> {
  return (fn as unknown as (arg: { data: Record<string, unknown> }) => ReturnType<T>)({ data });
}
