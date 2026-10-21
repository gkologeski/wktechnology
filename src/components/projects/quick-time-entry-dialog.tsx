// Apontamento rápido de horas do TechProjects.
// Objetivo de UX: registrar um apontamento em menos de 20 segundos.
// Dois modos explícitos: "Início e fim" (sobreposição verificada) ou "Só duração" (sem horário
// inventado; o banco marca como sem posição e o aprovador vê o alerta).
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Star } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listTrackableProjects,
  listTrackableTasks,
  saveTimeEntry,
} from "@/lib/projects/time-tracking.functions";
import { toggleFavoriteProject } from "@/lib/projects/time-workflow.functions";
import { useOfflineTimeQueue } from "@/hooks/use-offline-time-queue";
import { classifyError, type OfflinePayload } from "@/lib/projects/offline-queue";
import {
  browserTimeZone,
  durationMinutes,
  formatMinutes,
  parseDurationInput,
} from "@/lib/projects/time-entry.shared";

export type TimeEntryDraft = {
  id?: string;
  projectId?: string | null;
  taskId?: string | null;
  entryDate?: string;
  startTime?: string;
  endTime?: string;
  durationSeconds?: number | null;
  mode?: "interval" | "duration";
  description?: string | null;
  billable?: boolean;
};

const todayIso = () => new Date().toLocaleDateString("sv-SE");
const hhmm = (v: string | null | undefined) => (v ? v.slice(0, 5) : "");
const secondsToInput = (s: number | null | undefined) =>
  s ? `${Math.floor(s / 3600)}h${String(Math.round((s % 3600) / 60)).padStart(2, "0")}` : "";

export function QuickTimeEntryDialog({
  open,
  onOpenChange,
  draft,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  draft?: TimeEntryDraft;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const projectsFn = useServerFn(listTrackableProjects);
  const tasksFn = useServerFn(listTrackableTasks);
  const saveFn = useServerFn(saveTimeEntry);
  const favFn = useServerFn(toggleFavoriteProject);
  const offline = useOfflineTimeQueue();

  const [projectId, setProjectId] = useState<string>("");
  const [taskId, setTaskId] = useState<string>("");
  const [taskTitle, setTaskTitle] = useState("");
  const [entryDate, setEntryDate] = useState(todayIso());
  const [mode, setMode] = useState<"interval" | "duration">("interval");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [durationText, setDurationText] = useState("");
  const [description, setDescription] = useState("");
  const [billable, setBillable] = useState(true);
  const timezone = useMemo(() => browserTimeZone(), []);

  const projectsQuery = useQuery({
    queryKey: ["trackable-projects"],
    queryFn: () => projectsFn(),
    enabled: open,
  });
  const projects = useMemo(() => projectsQuery.data?.projects ?? [], [projectsQuery.data]);
  const durationAllowed = projectsQuery.data?.policy?.duration_entries_allowed !== false;
  const favorites = projects.filter((p) => p.favorite);
  const recent = projects
    .filter((p) => !p.favorite && p.last_used)
    .sort((a, b) => (b.last_used ?? "").localeCompare(a.last_used ?? ""))
    .slice(0, 5);
  const others = projects.filter((p) => !p.favorite && !recent.includes(p));

  // Só reinicializa o formulário na ABERTURA do modal. Referências novas de
  // `draft` (re-render do pai por refetch) não devem apagar o que o usuário digitou.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const wasOpen = useRef(false);

  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      return;
    }
    if (wasOpen.current) return;
    wasOpen.current = true;
    const d = draftRef.current;
    setProjectId(d?.projectId ?? "");
    setTaskId(d?.taskId ?? "");
    setTaskTitle("");
    setEntryDate(d?.entryDate ?? todayIso());
    const m = d?.mode ?? (d?.id && !d.startTime && d.durationSeconds ? "duration" : "interval");
    setMode(m);
    setStartTime(hhmm(d?.startTime) || "09:00");
    setEndTime(hhmm(d?.endTime) || "10:00");
    setDurationText(secondsToInput(d?.durationSeconds));
    setDescription(d?.description ?? "");
    setBillable(d?.billable ?? true);
  }, [open]);

  // Projeto único: seleciona automaticamente.
  useEffect(() => {
    if (open && !projectId && projects.length === 1) setProjectId(projects[0]!.id);
  }, [open, projectId, projects]);

  const tasksQuery = useQuery({
    queryKey: ["trackable-tasks", projectId],
    queryFn: () => tasksFn({ data: { projectId } }),
    enabled: open && !!projectId,
  });
  const tasks = tasksQuery.data?.tasks ?? [];

  const minutes = useMemo(() => durationMinutes(startTime, endTime), [startTime, endTime]);
  const durationSeconds = useMemo(() => parseDurationInput(durationText), [durationText]);

  const favMut = useMutation({
    mutationFn: (v: { projectId: string; favorite: boolean }) => favFn({ data: v }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["trackable-projects"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Fila offline (opt-in): só apontamento NOVO com atividade já existente; nada é dado como salvo
  // antes da confirmação do servidor.
  const offlineEligible = !draft?.id && !!taskId && offline.optIn && offline.ready;
  const offlinePayload = (): OfflinePayload => ({
    project_id: projectId,
    task_id: taskId,
    entry_date: entryDate,
    mode,
    ...(mode === "interval"
      ? { start_time: startTime.length === 5 ? `${startTime}:00` : startTime, end_time: endTime.length === 5 ? `${endTime}:00` : endTime }
      : { duration_seconds: durationSeconds ?? undefined }),
    timezone,
    ...(description.trim() ? { description: description.trim() } : {}),
    billable,
  });
  const keepOffline = async () => {
    const proj = projects.find((p) => p.id === projectId)?.name ?? "Projeto";
    const task = tasks.find((t) => t.id === taskId)?.title ?? "Atividade";
    await offline.enqueueEntry(offlinePayload(), `${proj} · ${task}`);
    toast.warning("Sem conexão: guardado neste aparelho", {
      description: "Ainda NÃO foi enviado. Será enviado e conferido pelo servidor quando a conexão voltar (veja em Minhas Horas).",
    });
    onOpenChange(false);
  };

  const mutation = useMutation({
    mutationFn: async (input: { keepOpen: boolean }) => {
      if (offlineEligible && typeof navigator !== "undefined" && navigator.onLine === false) {
        await keepOffline();
        return { res: null, keepOpen: false, offline: true as const };
      }
      return saveFn({
        data: {
          id: draft?.id,
          projectId,
          taskId: taskId || null,
          taskTitle: !taskId && taskTitle.trim() ? taskTitle.trim() : undefined,
          entryDate,
          mode,
          startTime: mode === "interval" ? startTime : undefined,
          endTime: mode === "interval" ? endTime : undefined,
          durationSeconds: mode === "duration" ? (durationSeconds ?? undefined) : undefined,
          timezone,
          description: description.trim() || null,
          billable,
        },
      }).then((res) => ({ res, keepOpen: input.keepOpen, offline: false as const }));
    },
    onSuccess: ({ keepOpen, res, offline: wasOffline }) => {
      if (wasOffline || !res) return;
      const flags = (res.entry as { review_flags?: string[] | null }).review_flags ?? [];
      toast.success(draft?.id ? "Apontamento atualizado" : "Horas apontadas", {
        description: flags.includes("daily_excess")
          ? "O dia passou do limite da política e ficará marcado para o aprovador."
          : undefined,
      });
      void qc.invalidateQueries({ queryKey: ["time-entries"] });
      void qc.invalidateQueries({ queryKey: ["my-time-summary"] });
      void qc.invalidateQueries({ queryKey: ["my-month-calendar"] });
      void qc.invalidateQueries({ queryKey: ["timesheet"] });
      void qc.invalidateQueries({ queryKey: ["timesheet-overview"] });
      onSaved?.();
      if (keepOpen) {
        // Próximo apontamento começa onde o anterior terminou.
        if (mode === "interval") {
          setStartTime(endTime);
          const end = durationMinutes(endTime, "23:59");
          setEndTime(end && end > 60 ? shift(endTime, 60) : "23:59");
        } else {
          setDurationText("");
        }
        setTaskId("");
        setTaskTitle("");
        setDescription("");
      } else {
        onOpenChange(false);
      }
    },
    onError: async (err: Error) => {
      if (!draft?.id && offline.optIn && classifyError(err).kind === "retry") {
        if (!taskId) {
          toast.error("Sem conexão", {
            description: "Para guardar no aparelho, escolha uma atividade já existente (nova atividade exige conexão).",
          });
          return;
        }
        try {
          await keepOffline();
        } catch (e) {
          toast.error((e as Error).message);
        }
        return;
      }
      toast.error(err.message);
    },
  });

  const timeInvalid =
    mode === "interval"
      ? minutes === null || minutes <= 0
      : !durationSeconds || durationSeconds < 60;
  const invalid = !projectId || (!taskId && taskTitle.trim().length < 2) || timeInvalid;
  const noProjects = !projectsQuery.isLoading && !projectsQuery.isError && projects.length === 0;
  const selected = projects.find((p) => p.id === projectId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{draft?.id ? "Editar apontamento" : "Apontar horas"}</DialogTitle>
          <DialogDescription>
            Projeto, atividade e o tempo trabalhado. Fuso: {timezone}.
          </DialogDescription>
        </DialogHeader>

        {noProjects ? (
          <div className="rounded-md border border-dashed p-4 text-sm" role="status">
            <p className="font-medium">
              Você ainda não está liberado para apontar em nenhum projeto.
            </p>
            <p className="mt-1 text-muted-foreground">
              {projectsQuery.data?.personLinked
                ? "Peça ao gestor do projeto para incluir você como membro ou registrar sua alocação."
                : "Seu login ainda não está ligado a uma pessoa do TechPeople. Peça ao RH/gestor para fazer o vínculo e a alocação."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="tt-project">Projeto</Label>
                {selected && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    aria-pressed={selected.favorite}
                    disabled={favMut.isPending}
                    onClick={() =>
                      favMut.mutate({ projectId: selected.id, favorite: !selected.favorite })
                    }
                  >
                    <Star
                      className={`mr-1 h-3.5 w-3.5 ${selected.favorite ? "fill-current" : ""}`}
                    />
                    {selected.favorite ? "Favorito" : "Favoritar"}
                  </Button>
                )}
              </div>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger id="tt-project" aria-label="Projeto">
                  <SelectValue
                    placeholder={projectsQuery.isLoading ? "Carregando..." : "Selecione o projeto"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {favorites.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Favoritos</SelectLabel>
                      {favorites.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {recent.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Recentes</SelectLabel>
                      {recent.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {others.length > 0 && (
                    <SelectGroup>
                      {(favorites.length > 0 || recent.length > 0) && (
                        <SelectLabel>Todos</SelectLabel>
                      )}
                      {others.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="tt-task">Atividade</Label>
              <Select
                value={taskId || "__free"}
                onValueChange={(v) => setTaskId(v === "__free" ? "" : v)}
              >
                <SelectTrigger id="tt-task" aria-label="Atividade" disabled={!projectId}>
                  <SelectValue placeholder="Selecione ou descreva a atividade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__free">Nova atividade (digitar)</SelectItem>
                  {tasks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!taskId && (
                <Input
                  aria-label="Nome da nova atividade"
                  placeholder="Ex.: Desenvolvimento do endpoint de autenticação"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  disabled={!projectId}
                />
              )}
            </div>

            <div className="grid gap-2">
              <Label id="tt-mode-label">Como registrar</Label>
              <ToggleGroup
                type="single"
                value={mode}
                onValueChange={(v) => v && setMode(v as "interval" | "duration")}
                aria-labelledby="tt-mode-label"
                className="justify-start"
              >
                <ToggleGroupItem value="interval" size="sm">
                  Início e fim
                </ToggleGroupItem>
                <ToggleGroupItem value="duration" size="sm" disabled={!durationAllowed}>
                  Só duração
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="tt-date">Data</Label>
                <Input
                  id="tt-date"
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </div>
              {mode === "interval" ? (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="tt-start">Início</Label>
                    <Input
                      id="tt-start"
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="tt-end">Término</Label>
                    <Input
                      id="tt-end"
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="tt-duration">Duração</Label>
                  <Input
                    id="tt-duration"
                    inputMode="decimal"
                    placeholder="Ex.: 1h30, 2:15, 45m ou 1,5"
                    value={durationText}
                    onChange={(e) => setDurationText(e.target.value)}
                  />
                </div>
              )}
            </div>

            <p className="text-sm text-muted-foreground" aria-live="polite">
              {mode === "interval"
                ? minutes === null
                  ? "O horário final deve ser maior que o inicial."
                  : `Total: ${formatMinutes(minutes)}`
                : durationSeconds
                  ? `Total: ${formatMinutes(durationSeconds / 60)} · sem horário, a sobreposição com outros apontamentos não é verificável.`
                  : "Informe a duração (mínimo de 1 minuto)."}
            </p>

            <div className="grid gap-2">
              <Label htmlFor="tt-desc">Descrição</Label>
              <Textarea
                id="tt-desc"
                rows={3}
                placeholder="Detalhe o que foi executado"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch id="tt-billable" checked={billable} onCheckedChange={setBillable} />
              <Label htmlFor="tt-billable">Faturável</Label>
            </div>
            {!draft?.id && offline.supported && offline.ready && (
              <div className="flex items-start gap-2 rounded-md border border-dashed p-2">
                <Switch id="tt-offline" checked={offline.optIn} onCheckedChange={offline.setOptIn} />
                <div className="grid gap-0.5">
                  <Label htmlFor="tt-offline">Guardar neste aparelho se a conexão cair</Label>
                  <p className="text-xs text-muted-foreground">
                    Só para atividade existente. Fica pendente até o servidor confirmar.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {!draft?.id && !noProjects && (
            <Button
              variant="outline"
              disabled={invalid || mutation.isPending}
              onClick={() => mutation.mutate({ keepOpen: true })}
            >
              Salvar e adicionar outro
            </Button>
          )}
          {!noProjects && (
            <Button
              disabled={invalid || mutation.isPending}
              onClick={() => mutation.mutate({ keepOpen: false })}
            >
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function shift(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, (h ?? 0) * 60 + (m ?? 0) + minutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
