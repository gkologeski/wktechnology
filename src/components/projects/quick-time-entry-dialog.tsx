// Apontamento rápido de horas do TechProjects.
// Objetivo de UX: registrar um apontamento em menos de 20 segundos.
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listTrackableProjects,
  listTrackableTasks,
  saveTimeEntry,
} from "@/lib/projects/time-tracking.functions";
import { durationMinutes, formatMinutes } from "@/lib/projects/time-entry.shared";

export type TimeEntryDraft = {
  id?: string;
  projectId?: string | null;
  taskId?: string | null;
  entryDate?: string;
  startTime?: string;
  endTime?: string;
  description?: string | null;
  billable?: boolean;
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const hhmm = (v: string | null | undefined) => (v ? v.slice(0, 5) : "");

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

  const [projectId, setProjectId] = useState<string>("");
  const [taskId, setTaskId] = useState<string>("");
  const [taskTitle, setTaskTitle] = useState("");
  const [entryDate, setEntryDate] = useState(todayIso());
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [description, setDescription] = useState("");
  const [billable, setBillable] = useState(true);

  const projectsQuery = useQuery({
    queryKey: ["trackable-projects"],
    queryFn: () => projectsFn(),
    enabled: open,
  });
  const projects = projectsQuery.data?.projects ?? [];

  useEffect(() => {
    if (!open) return;
    setProjectId(draft?.projectId ?? "");
    setTaskId(draft?.taskId ?? "");
    setTaskTitle("");
    setEntryDate(draft?.entryDate ?? todayIso());
    setStartTime(hhmm(draft?.startTime) || "09:00");
    setEndTime(hhmm(draft?.endTime) || "10:00");
    setDescription(draft?.description ?? "");
    setBillable(draft?.billable ?? true);
  }, [open, draft]);

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

  const mutation = useMutation({
    mutationFn: (input: { keepOpen: boolean }) =>
      saveFn({
        data: {
          id: draft?.id,
          projectId,
          taskId: taskId || null,
          taskTitle: !taskId && taskTitle.trim() ? taskTitle.trim() : undefined,
          entryDate,
          startTime,
          endTime,
          description: description.trim() || null,
          billable,
        },
      }).then((res) => ({ res, keepOpen: input.keepOpen })),
    onSuccess: ({ keepOpen }) => {
      toast.success(draft?.id ? "Apontamento atualizado" : "Horas apontadas");
      void qc.invalidateQueries({ queryKey: ["time-entries"] });
      void qc.invalidateQueries({ queryKey: ["my-time-summary"] });
      void qc.invalidateQueries({ queryKey: ["my-month-calendar"] });
      void qc.invalidateQueries({ queryKey: ["timesheet"] });
      onSaved?.();
      if (keepOpen) {
        // Próximo apontamento começa onde o anterior terminou.
        setStartTime(endTime);
        const end = durationMinutes(endTime, "23:59");
        setEndTime(end && end > 60 ? shift(endTime, 60) : "23:59");
        setTaskId("");
        setTaskTitle("");
        setDescription("");
      } else {
        onOpenChange(false);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const invalid =
    !projectId || (!taskId && taskTitle.trim().length < 2) || minutes === null || minutes <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{draft?.id ? "Editar apontamento" : "Apontar horas"}</DialogTitle>
          <DialogDescription>
            Registre o tempo trabalhado informando projeto, atividade e horários.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="tt-project">Projeto</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger id="tt-project" aria-label="Projeto">
                <SelectValue
                  placeholder={projectsQuery.isLoading ? "Carregando..." : "Selecione o projeto"}
                />
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
          </div>

          <p className="text-sm text-muted-foreground" aria-live="polite">
            {minutes === null
              ? "O horário final deve ser maior que o inicial."
              : `Total: ${formatMinutes(minutes)}`}
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
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {!draft?.id && (
            <Button
              variant="outline"
              disabled={invalid || mutation.isPending}
              onClick={() => mutation.mutate({ keepOpen: true })}
            >
              Salvar e adicionar outro
            </Button>
          )}
          <Button
            disabled={invalid || mutation.isPending}
            onClick={() => mutation.mutate({ keepOpen: false })}
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
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
