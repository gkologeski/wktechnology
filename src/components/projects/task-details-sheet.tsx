// Sprint D — Sheet de detalhes de uma tarefa de projeto.
// Expõe checklist, dependências e tags (múltiplos assignees ainda são geridos via campo assignee_id).
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, X, ListChecks, Link2, Tag as TagIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listChecklist,
  addChecklistItem,
  toggleChecklistItem,
  removeChecklistItem,
  listDependencies,
  addDependency,
  removeDependency,
  updateTaskTags,
  listWorkspaceTaskTags,
} from "@/lib/project-tasks-advanced.functions";
import { listAllProjectTasks } from "@/lib/projects.functions";
import { listCustomFields, updateTaskCustomFieldValues } from "@/lib/project-list-extras.functions";

type TaskLite = {
  id: string;
  title: string;
  project_id?: string | null;
  list_id?: string | null;
  tags?: string[];
  custom_field_values?: Record<string, any> | null;
};

export function TaskDetailsSheet({
  task,
  open,
  onOpenChange,
}: {
  task: TaskLite | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  if (!task) return null;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">{task.title}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-6">
          <TagsSection task={task} />
          {task.list_id && (
            <>
              <Separator />
              <CustomFieldsSection
                taskId={task.id}
                listId={task.list_id}
                initialValues={task.custom_field_values ?? {}}
              />
            </>
          )}
          <Separator />
          <ChecklistSection taskId={task.id} />
          <Separator />
          <DependenciesSection task={task} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ============= CUSTOM FIELDS =============
function CustomFieldsSection({
  taskId,
  listId,
  initialValues,
}: {
  taskId: string;
  listId: string;
  initialValues: Record<string, any>;
}) {
  const listFn = useServerFn(listCustomFields);
  const updateFn = useServerFn(updateTaskCustomFieldValues);
  const qc = useQueryClient();
  const { data: fields = [], isLoading } = useQuery({
    queryKey: ["project-list-custom-fields", listId],
    queryFn: () => listFn({ data: { listId } }),
  });
  const [values, setValues] = useState<Record<string, any>>(initialValues);
  const m = useMutation({
    mutationFn: (v: Record<string, any>) => updateFn({ data: { taskId, values: v } }),
    onSuccess: () => {
      toast.success("Campo atualizado");
      qc.invalidateQueries({ queryKey: ["project-list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const setAndSave = (key: string, v: any) => {
    const next = { ...values, [key]: v };
    setValues(next);
    m.mutate(next);
  };
  if (isLoading) return null;
  if (fields.length === 0) return null;
  return (
    <section className="space-y-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Campos personalizados
      </div>
      <div className="space-y-2">
        {fields.map((f: any) => (
          <div key={f.id} className="grid grid-cols-3 items-center gap-2">
            <label className="text-xs text-muted-foreground truncate col-span-1" title={f.label}>
              {f.label}
            </label>
            <div className="col-span-2">
              {f.type === "text" && (
                <Input
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  onBlur={() => m.mutate(values)}
                />
              )}
              {f.type === "number" && (
                <Input
                  type="number"
                  value={values[f.key] ?? ""}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      [f.key]: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  onBlur={() => m.mutate(values)}
                />
              )}
              {f.type === "date" && (
                <Input
                  type="date"
                  value={values[f.key] ?? ""}
                  onChange={(e) => setAndSave(f.key, e.target.value || null)}
                />
              )}
              {f.type === "url" && (
                <Input
                  type="url"
                  value={values[f.key] ?? ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  onBlur={() => m.mutate(values)}
                  placeholder="https://..."
                />
              )}
              {f.type === "checkbox" && (
                <Checkbox
                  checked={!!values[f.key]}
                  onCheckedChange={(v) => setAndSave(f.key, !!v)}
                />
              )}
              {f.type === "select" && (
                <Select
                  value={values[f.key] ?? ""}
                  onValueChange={(v) => setAndSave(f.key, v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar…" />
                  </SelectTrigger>
                  <SelectContent>
                    {((f.options as string[] | null) ?? []).map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ============= TAGS =============
function TagsSection({ task }: { task: TaskLite }) {
  const qc = useQueryClient();
  const updateFn = useServerFn(updateTaskTags);
  const suggestionsFn = useServerFn(listWorkspaceTaskTags);
  const [input, setInput] = useState("");
  const [current, setCurrent] = useState<string[]>(task.tags ?? []);

  const sugQuery = useQuery({
    queryKey: ["task-tags-suggestions"],
    queryFn: () => suggestionsFn({}),
  });
  const suggestions = ((sugQuery.data ?? []) as string[]).filter((t) => !current.includes(t));

  const mut = useMutation({
    mutationFn: (tags: string[]) => updateFn({ data: { taskId: task.id, tags } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["list-tasks"] });
      qc.invalidateQueries({ queryKey: ["task-tags-suggestions"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha"),
  });

  function commit(next: string[]) {
    setCurrent(next);
    mut.mutate(next);
  }

  function addTag(v: string) {
    const t = v.trim();
    if (!t || current.includes(t)) return;
    commit([...current, t]);
    setInput("");
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <TagIcon className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">Tags</h4>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {current.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1">
            {t}
            <button
              onClick={() => commit(current.filter((x) => x !== t))}
              className="opacity-60 hover:opacity-100"
              aria-label={`remover ${t}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        {current.length === 0 && <span className="text-xs text-muted-foreground">Sem tags</span>}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nova tag"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(input);
            }
          }}
        />
        <Button size="sm" onClick={() => addTag(input)} disabled={!input.trim()}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {suggestions.slice(0, 12).map((s) => (
            <button
              key={s}
              className="text-[11px] text-muted-foreground border rounded px-1.5 py-0.5 hover:bg-muted"
              onClick={() => addTag(s)}
            >
              +{s}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ============= CHECKLIST =============
function ChecklistSection({ taskId }: { taskId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listChecklist);
  const addFn = useServerFn(addChecklistItem);
  const toggleFn = useServerFn(toggleChecklistItem);
  const removeFn = useServerFn(removeChecklistItem);
  const [title, setTitle] = useState("");

  const query = useQuery({
    queryKey: ["task-checklist", taskId],
    queryFn: () => listFn({ data: { taskId } }),
  });

  const items = (query.data ?? []) as Array<{
    id: string;
    title: string;
    is_done: boolean;
  }>;
  const done = items.filter((i) => i.is_done).length;

  const addMut = useMutation({
    mutationFn: () => addFn({ data: { taskId, title } }),
    onSuccess: () => {
      setTitle("");
      qc.invalidateQueries({ queryKey: ["task-checklist", taskId] });
    },
  });
  const toggleMut = useMutation({
    mutationFn: (v: { id: string; isDone: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-checklist", taskId] }),
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-checklist", taskId] }),
  });

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-muted-foreground" />
          <h4 className="text-sm font-semibold">Checklist</h4>
        </div>
        {items.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {done}/{items.length}
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {items.map((i) => (
          <div key={i.id} className="flex items-center gap-2 group">
            <Checkbox
              checked={i.is_done}
              onCheckedChange={(v) => toggleMut.mutate({ id: i.id, isDone: Boolean(v) })}
            />
            <span
              className={`text-sm flex-1 ${i.is_done ? "line-through text-muted-foreground" : ""}`}
            >
              {i.title}
            </span>
            <button
              onClick={() => removeMut.mutate(i.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
              aria-label="remover item"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground">Nenhum item no checklist.</p>
        )}
      </div>
      <div className="flex gap-2 mt-3">
        <Input
          value={title}
          placeholder="Novo item"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim()) {
              e.preventDefault();
              addMut.mutate();
            }
          }}
        />
        <Button
          size="sm"
          disabled={!title.trim() || addMut.isPending}
          onClick={() => addMut.mutate()}
        >
          {addMut.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
        </Button>
      </div>
    </section>
  );
}

// ============= DEPENDENCIES =============
function DependenciesSection({ task }: { task: TaskLite }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listDependencies);
  const addFn = useServerFn(addDependency);
  const removeFn = useServerFn(removeDependency);
  const tasksFn = useServerFn(listAllProjectTasks);
  const [pick, setPick] = useState("");

  const depsQuery = useQuery({
    queryKey: ["task-deps", task.id],
    queryFn: () => listFn({ data: { taskId: task.id } }),
  });
  const tasksQuery = useQuery({
    queryKey: ["project-tasks-for-dep", task.project_id],
    queryFn: () => tasksFn({ data: task.project_id ? { projectId: task.project_id } : {} }),
  });

  const deps = (depsQuery.data ?? []) as Array<{
    id: string;
    depends_on_task_id: string;
    project_tasks?: { id: string; title: string } | null;
  }>;
  const candidates = ((tasksQuery.data ?? []) as Array<{ id: string; title: string }>).filter(
    (t) => t.id !== task.id && !deps.some((d) => d.depends_on_task_id === t.id),
  );

  const addMut = useMutation({
    mutationFn: (dependsOnTaskId: string) => addFn({ data: { taskId: task.id, dependsOnTaskId } }),
    onSuccess: () => {
      setPick("");
      qc.invalidateQueries({ queryKey: ["task-deps", task.id] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha"),
  });
  const removeMut = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-deps", task.id] }),
  });

  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">Dependências</h4>
      </div>
      <div className="space-y-1.5">
        {deps.map((d) => (
          <div key={d.id} className="flex items-center gap-2 group">
            <span className="text-sm flex-1 truncate">
              {d.project_tasks?.title ?? d.depends_on_task_id}
            </span>
            <button
              onClick={() => removeMut.mutate(d.id)}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        {deps.length === 0 && <p className="text-xs text-muted-foreground">Sem dependências.</p>}
      </div>
      <div className="flex gap-2 mt-3">
        <Select value={pick} onValueChange={setPick}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Depende de..." />
          </SelectTrigger>
          <SelectContent>
            {candidates.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" disabled={!pick || addMut.isPending} onClick={() => addMut.mutate(pick)}>
          {addMut.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Plus className="h-3 w-3" />
          )}
        </Button>
      </div>
    </section>
  );
}
