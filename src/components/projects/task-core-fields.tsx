// TechProjects — campos principais da tarefa no painel de detalhes.
// A edição usa `updateTask` (servidor revalida permissão do cargo e do
// registro via `assertWorkRecord`); aqui só controlamos a disponibilidade.
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActivityDateTimePicker } from "@/components/activity/activity-date-time-picker";
import { useWorkRecordCapability } from "@/components/work-action";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";
import { updateTask } from "@/lib/projects.functions";

export const TASK_STATUS_LABEL: Record<string, string> = {
  todo: "A fazer",
  doing: "Em execução",
  review: "Em revisão",
  done: "Concluída",
};

export const TASK_PRIORITY_LABEL: Record<string, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

type TaskStatus = "todo" | "doing" | "review" | "done";

export type TaskCoreValues = {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  assignee_id?: string | null;
  due_at?: string | null;
  estimated_hours?: number | string | null;
  projects?: { id: string; name: string } | null;
};

type Patch = {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  assignee_id?: string | null;
  due_at?: string | null;
  estimated_hours?: number | null;
};

const NO_ASSIGNEE = "__none__";

/** Invalida todas as telas que mostram tarefas de projetos. */
export const TASK_QUERY_KEYS = [["project_tasks"], ["project-tasks"], ["project-list"]] as const;

export function TaskCoreFields({ task }: { task: TaskCoreValues }) {
  const capability = useWorkRecordCapability("techprojects.tasks", task.id);
  const canEdit = capability.can_update;
  const qc = useQueryClient();
  const updateFn = useServerFn(updateTask);
  const members = useWorkspaceMembers();

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [hours, setHours] = useState(
    task.estimated_hours == null ? "" : String(task.estimated_hours),
  );

  const m = useMutation({
    mutationFn: (patch: Patch) => updateFn({ data: { id: task.id, patch } }),
    onSuccess: () => {
      toast.success("Tarefa atualizada");
      TASK_QUERY_KEYS.forEach((key) => void qc.invalidateQueries({ queryKey: [...key] }));
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível atualizar a tarefa."),
  });

  const save = (patch: Patch) => {
    if (!canEdit) return;
    m.mutate(patch);
  };

  const saveTitle = () => {
    const next = title.trim();
    if (!next) {
      setTitle(task.title);
      toast.error("O título não pode ficar vazio.");
      return;
    }
    if (next !== task.title) save({ title: next });
  };

  const saveDescription = () => {
    const next = description.trim() ? description : null;
    if ((next ?? "") !== (task.description ?? "")) save({ description: next });
  };

  const saveHours = () => {
    const raw = hours.trim().replace(",", ".");
    const next = raw === "" ? null : Number(raw);
    if (next != null && (!Number.isFinite(next) || next < 0)) {
      toast.error("Informe um número de horas válido.");
      setHours(task.estimated_hours == null ? "" : String(task.estimated_hours));
      return;
    }
    const current = task.estimated_hours == null ? null : Number(task.estimated_hours);
    if (next !== current) save({ estimated_hours: next });
  };

  const statusKnown = !!task.status && task.status in TASK_STATUS_LABEL;
  const fieldId = (name: string) => `task-${task.id}-${name}`;

  return (
    <section className="space-y-4" aria-label="Dados da tarefa">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Dados da tarefa
        </div>
        {m.isPending && (
          <span className="text-xs text-muted-foreground" role="status">
            Salvando…
          </span>
        )}
      </div>

      {!canEdit && (
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {capability.can_view
            ? "Você pode consultar esta tarefa, mas não tem permissão para alterá-la."
            : "Verificando permissão para editar esta tarefa…"}
        </p>
      )}

      <div className="space-y-1.5">
        <Label htmlFor={fieldId("title")}>Título</Label>
        <Input
          id={fieldId("title")}
          value={title}
          disabled={!canEdit}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={fieldId("status")}>Status</Label>
          <Select
            value={statusKnown ? (task.status as string) : undefined}
            disabled={!canEdit}
            onValueChange={(v) => v !== task.status && save({ status: v as TaskStatus })}
          >
            <SelectTrigger id={fieldId("status")}>
              <SelectValue placeholder="Sem status" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TASK_STATUS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <span className="text-sm font-medium leading-none">Prioridade</span>
          <div className="flex h-10 items-center">
            <Badge variant="outline">
              {TASK_PRIORITY_LABEL[task.priority ?? ""] ?? "Não definida"}
            </Badge>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={fieldId("assignee")}>Responsável</Label>
          <Select
            value={task.assignee_id ?? NO_ASSIGNEE}
            disabled={!canEdit || members.isLoading}
            onValueChange={(v) => {
              const next = v === NO_ASSIGNEE ? null : v;
              if (next !== (task.assignee_id ?? null)) save({ assignee_id: next });
            }}
          >
            <SelectTrigger id={fieldId("assignee")}>
              <SelectValue placeholder={members.isLoading ? "Carregando…" : "Sem responsável"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_ASSIGNEE}>Sem responsável</SelectItem>
              {task.assignee_id && !members.data?.some((x) => x.user_id === task.assignee_id) && (
                <SelectItem value={task.assignee_id}>
                  {members.nameFor(task.assignee_id)} (inativo)
                </SelectItem>
              )}
              {(members.data ?? []).map((x) => (
                <SelectItem key={x.user_id} value={x.user_id}>
                  {x.full_name?.trim() || "Sem nome"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {members.isError && (
            <p className="text-xs text-destructive" role="alert">
              Não foi possível carregar os membros.
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={fieldId("hours")}>Horas estimadas</Label>
          <Input
            id={fieldId("hours")}
            inputMode="decimal"
            value={hours}
            disabled={!canEdit}
            placeholder="—"
            onChange={(e) => setHours(e.target.value)}
            onBlur={saveHours}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={fieldId("due")}>Prazo</Label>
          <ActivityDateTimePicker
            id={fieldId("due")}
            ariaLabel="Prazo"
            value={task.due_at ?? null}
            valueFormat="iso"
            optional
            disabled={!canEdit}
            onChange={(v) => v !== (task.due_at ?? null) && save({ due_at: v })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={fieldId("description")}>Descrição</Label>
        <Textarea
          id={fieldId("description")}
          rows={4}
          value={description}
          disabled={!canEdit}
          placeholder="Sem descrição"
          onChange={(e) => setDescription(e.target.value)}
          onBlur={saveDescription}
        />
      </div>

      {task.projects && (
        <p className="text-xs text-muted-foreground">
          Projeto:{" "}
          <Link
            to="/projects/$id"
            params={{ id: task.projects.id }}
            className="font-medium text-foreground hover:underline"
          >
            {task.projects.name}
          </Link>
        </p>
      )}
    </section>
  );
}
