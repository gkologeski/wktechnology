// Sprint C - Fase 4.2 parte 1
// Detalhe da Lista: views List e Board, status customizados por lista.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, LayoutGrid, List as ListIcon, Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateTime } from "@/lib/crm";
import {
  getList,
  createStatus,
  deleteStatus,
  createListTask,
  moveTaskStatus,
  deleteListTask,
} from "@/lib/project-hierarchy.functions";
import { TaskDetailsSheet } from "@/components/projects/task-details-sheet";

export const Route = createFileRoute("/_authenticated/projects/lists/$id")({
  head: () => ({
    meta: [
      { title: "Lista — TechProjects" },
      { name: "description", content: "Tarefas da lista com views de List e Board e status customizados." },
    ],
  }),
  component: ListDetailPage,
});

type Status = { id: string; name: string; color: string | null; category: "todo" | "doing" | "done"; sort_order: number; is_default: boolean };
type Task = {
  id: string;
  title: string;
  due_at: string | null;
  estimated_hours: number | null;
  priority: "low" | "normal" | "high" | "urgent";
  custom_status_id: string | null;
  project_id?: string | null;
  tags?: string[];
};

const PRIORITY_LABEL: Record<Task["priority"], string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};
const PRIORITY_TONE: Record<Task["priority"], string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  high: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  urgent: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

function ListDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const getListFn = useServerFn(getList);
  const { data, isLoading } = useQuery({
    queryKey: ["project-list", id],
    queryFn: () => getListFn({ data: { id } }),
  });

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["project-list", id] });

  if (isLoading || !data) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  }

  const list = data.list as {
    id: string;
    name: string;
    color: string | null;
    project_spaces: { id: string; name: string; color: string | null } | null;
    project_folders: { id: string; name: string } | null;
    projects: { id: string; name: string } | null;
  } | null;

  if (!list) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-muted-foreground">Lista não encontrada.</p>
        <Button asChild variant="outline"><Link to="/projects/spaces">Voltar para espaços</Link></Button>
      </div>
    );
  }

  const statuses = (data.statuses as Status[]).sort((a, b) => a.sort_order - b.sort_order);
  const tasks = data.tasks as Task[];
  const hasProject = !!list.projects;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Button asChild variant="ghost" size="sm" className="h-7 -ml-2">
          <Link to="/projects/spaces">
            <ArrowLeft className="h-4 w-4 mr-1" /> Espaços
          </Link>
        </Button>
        {list.project_spaces && <span>/ {list.project_spaces.name}</span>}
        {list.project_folders && <span>/ {list.project_folders.name}</span>}
      </div>

      <PageHeader
        title={list.name}
        description={
          list.projects
            ? `Vinculada ao projeto ${list.projects.name}`
            : "Sem projeto vinculado — vincule um projeto para criar tarefas."
        }
        count={tasks.length}
        countLabel={tasks.length === 1 ? "tarefa" : "tarefas"}
        actions={
          <div className="flex items-center gap-2">
            <ManageStatusesButton listId={id} statuses={statuses} onChanged={invalidate} />
            <NewTaskButton listId={id} statuses={statuses} disabled={!hasProject} onCreated={invalidate} />
          </div>
        }
      />

      {!hasProject && (
        <div className="rounded-md border border-amber-300 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          Vincule esta lista a um projeto (em <Link to="/projects/spaces" className="underline">Espaços</Link>) para começar a criar tarefas.
        </div>
      )}

      <Tabs defaultValue="board">
        <TabsList>
          <TabsTrigger value="board"><LayoutGrid className="h-4 w-4 mr-2" /> Board</TabsTrigger>
          <TabsTrigger value="list"><ListIcon className="h-4 w-4 mr-2" /> Lista</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="mt-4">
          <BoardView statuses={statuses} tasks={tasks} onChanged={invalidate} onOpen={setSelectedTask} />
        </TabsContent>

        <TabsContent value="list" className="mt-4">
          <ListView statuses={statuses} tasks={tasks} onChanged={invalidate} onOpen={setSelectedTask} />
        </TabsContent>
      </Tabs>

      <TaskDetailsSheet
        task={selectedTask}
        open={Boolean(selectedTask)}
        onOpenChange={(v) => { if (!v) setSelectedTask(null); }}
      />
    </div>
  );
}

// ============ BOARD VIEW ============
function BoardView({
  statuses,
  tasks,
  onChanged,
  onOpen,
}: {
  statuses: Status[];
  tasks: Task[];
  onChanged: () => void;
  onOpen: (t: Task) => void;
}) {
  const move = useServerFn(moveTaskStatus);
  const moveM = useMutation({
    mutationFn: (v: { taskId: string; statusId: string }) =>
      move({ data: { taskId: v.taskId, customStatusId: v.statusId } }),
    onSuccess: onChanged,
    onError: (e: Error) => toast.error(e.message),
  });

  const [draggingId, setDraggingId] = useState<string | null>(null);

  const byStatus = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const s of statuses) map.set(s.id, []);
    for (const t of tasks) {
      const list = t.custom_status_id && map.get(t.custom_status_id);
      if (list) list.push(t);
    }
    return map;
  }, [statuses, tasks]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {statuses.map((s) => (
        <div
          key={s.id}
          className="min-w-[280px] w-72 flex-shrink-0 rounded-lg border bg-muted/30"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (draggingId) {
              moveM.mutate({ taskId: draggingId, statusId: s.id });
              setDraggingId(null);
            }
          }}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color ?? "#94a3b8" }} />
            <div className="text-sm font-medium flex-1">{s.name}</div>
            <Badge variant="outline" className="text-xs">{byStatus.get(s.id)?.length ?? 0}</Badge>
          </div>
          <div className="p-2 space-y-2 min-h-24">
            {(byStatus.get(s.id) ?? []).map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                onDragStart={() => setDraggingId(t.id)}
                onChanged={onChanged}
                onOpen={() => onOpen(t)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskCard({
  task,
  onDragStart,
  onChanged,
  onOpen,
}: {
  task: Task;
  onDragStart: () => void;
  onChanged: () => void;
  onOpen: () => void;
}) {
  const del = useServerFn(deleteListTask);
  const delM = useMutation({
    mutationFn: () => del({ data: { id: task.id } }),
    onSuccess: () => {
      toast.success("Tarefa removida");
      onChanged();
    },
  });
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onOpen}
      className="rounded-md border bg-card p-3 cursor-pointer hover:border-primary/40 active:cursor-grabbing"
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium leading-snug">{task.title}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={`text-[10px] ${PRIORITY_TONE[task.priority]}`}>
              {PRIORITY_LABEL[task.priority]}
            </Badge>
            {task.due_at && (
              <span className="text-[10px] text-muted-foreground">
                {formatDateTime(task.due_at).split(" ")[0]}
              </span>
            )}
            {task.estimated_hours && (
              <span className="text-[10px] text-muted-foreground">{task.estimated_hours}h</span>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-6 w-6">…</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem className="text-destructive" onClick={() => delM.mutate()}>
              <Trash2 className="h-4 w-4 mr-2" /> Remover
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ============ LIST VIEW ============
function ListView({
  statuses,
  tasks,
  onChanged,
  onOpen,
}: {
  statuses: Status[];
  tasks: Task[];
  onChanged: () => void;
  onOpen: (t: Task) => void;
}) {
  const statusById = useMemo(() => new Map(statuses.map((s) => [s.id, s])), [statuses]);
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="text-left px-3 py-2 font-medium">Título</th>
            <th className="text-left px-3 py-2 font-medium">Status</th>
            <th className="text-left px-3 py-2 font-medium">Prioridade</th>
            <th className="text-right px-3 py-2 font-medium">Horas est.</th>
            <th className="text-left px-3 py-2 font-medium">Prazo</th>
            <th className="w-8" />
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-muted-foreground py-8">
                Nenhuma tarefa nesta lista ainda.
              </td>
            </tr>
          )}
          {tasks.map((t) => {
            const st = t.custom_status_id ? statusById.get(t.custom_status_id) : undefined;
            return <ListRow key={t.id} task={t} status={st} onChanged={onChanged} />;
          })}
        </tbody>
      </table>
    </div>
  );
}

function ListRow({ task, status, onChanged }: { task: Task; status?: Status; onChanged: () => void }) {
  const del = useServerFn(deleteListTask);
  const delM = useMutation({
    mutationFn: () => del({ data: { id: task.id } }),
    onSuccess: () => {
      toast.success("Tarefa removida");
      onChanged();
    },
  });
  return (
    <tr className="border-t hover:bg-muted/30">
      <td className="px-3 py-2 font-medium">{task.title}</td>
      <td className="px-3 py-2">
        {status ? (
          <span className="inline-flex items-center gap-1.5 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: status.color ?? "#94a3b8" }} />
            {status.name}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2">
        <Badge variant="outline" className={`text-[10px] ${PRIORITY_TONE[task.priority]}`}>
          {PRIORITY_LABEL[task.priority]}
        </Badge>
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{task.estimated_hours ?? "—"}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">
        {task.due_at ? formatDateTime(task.due_at).split(" ")[0] : "—"}
      </td>
      <td className="px-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => delM.mutate()}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}

// ============ NEW TASK ============
function NewTaskButton({
  listId,
  statuses,
  disabled,
  onCreated,
}: {
  listId: string;
  statuses: Status[];
  disabled?: boolean;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("normal");
  const defaultStatus = statuses.find((s) => s.is_default) ?? statuses[0];
  const [statusId, setStatusId] = useState<string>(defaultStatus?.id ?? "");
  const create = useServerFn(createListTask);
  const m = useMutation({
    mutationFn: () =>
      create({
        data: {
          listId,
          title,
          priority,
          customStatusId: statusId || null,
        },
      }),
    onSuccess: () => {
      toast.success("Tarefa criada");
      setOpen(false);
      setTitle("");
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v && defaultStatus) setStatusId(defaultStatus.id); }}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled}>
          <Plus className="h-4 w-4 mr-2" /> Nova tarefa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Título</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Status</label>
              <select
                value={statusId}
                onChange={(e) => setStatusId(e.target.value)}
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Prioridade</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Task["priority"])}
                className="w-full h-10 rounded-md border bg-background px-3 text-sm"
              >
                {(Object.keys(PRIORITY_LABEL) as Task["priority"][]).map((p) => (
                  <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => m.mutate()} disabled={!title.trim() || m.isPending}>Criar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ MANAGE STATUSES ============
function ManageStatusesButton({
  listId,
  statuses,
  onChanged,
}: {
  listId: string;
  statuses: Status[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#0ea5e9");
  const [category, setCategory] = useState<"todo" | "doing" | "done">("todo");
  const createFn = useServerFn(createStatus);
  const deleteFn = useServerFn(deleteStatus);
  const createM = useMutation({
    mutationFn: () => createFn({ data: { listId, name, color, category } }),
    onSuccess: () => {
      toast.success("Status criado");
      setName("");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Status removido");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="h-4 w-4 mr-2" /> Status
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Status da lista</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            {statuses.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded border p-2">
                <span className="h-3 w-3 rounded-full" style={{ background: s.color ?? "#94a3b8" }} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{s.name}</div>
                  <div className="text-xs text-muted-foreground">Categoria: {s.category}</div>
                </div>
                {s.is_default && <Badge variant="outline" className="text-xs">Padrão</Badge>}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    if (confirm("Remover status? As tarefas nele ficarão sem status.")) deleteM.mutate(s.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
          <div className="border-t pt-3 space-y-2">
            <div className="text-sm font-medium">Adicionar status</div>
            <div className="grid grid-cols-3 gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" className="col-span-2" />
              <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 p-1" />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as "todo" | "doing" | "done")}
                className="h-9 rounded-md border bg-background px-2 text-sm flex-1"
              >
                <option value="todo">A fazer</option>
                <option value="doing">Em andamento</option>
                <option value="done">Concluído</option>
              </select>
              <Button size="sm" onClick={() => createM.mutate()} disabled={!name.trim() || createM.isPending}>
                Adicionar
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
