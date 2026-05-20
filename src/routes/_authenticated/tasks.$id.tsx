import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PropertiesPanel } from "@/components/properties-panel";
import { TASK_STATUSES, TASK_PRIORITIES, formatDateTime } from "@/lib/crm";
import type { Activity } from "@/lib/db-types";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/tasks/$id")({
  component: TaskDetail,
});

function TaskDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<Activity | null>(null);

  const load = async () => {
    const { data } = await supabase.from("activities").select("*").eq("id", id).single();
    setTask(data as Activity | null);
  };
  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [id]);

  if (!task) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const remove = async () => {
    if (!confirm("Excluir tarefa?")) return;
    await supabase.from("activities").delete().eq("id", task.id);
    toast.success("Excluída");
    navigate({ to: "/tasks" });
  };

  const complete = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("activities").update({ completed: true, task_status: "COMPLETED" }).eq("id", task.id);
    toast.success("Concluída");
    void load();
  };

  const status = TASK_STATUSES.find((s) => s.value === task.task_status)?.label ?? "—";
  const priority = TASK_PRIORITIES.find((p) => p.value === task.task_priority)?.label ?? "—";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/tasks"><ArrowLeft className="h-4 w-4 mr-1" /> Tarefas</Link>
        </Button>
        <div className="flex gap-2">
          {!task.completed && (
            <Button variant="outline" size="sm" onClick={complete}><Check className="h-4 w-4 mr-1" /> Concluir</Button>
          )}
          <Button variant="destructive" size="sm" onClick={remove}><Trash2 className="h-4 w-4 mr-1" /> Excluir</Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{task.subject || "(sem assunto)"}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Venc.: {formatDateTime(task.due_date)} · Criada em {formatDateTime(task.created_at)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Badge variant="outline">{status}</Badge>
            <Badge variant="secondary">{priority}</Badge>
          </div>
        </div>
        {task.body && (
          <p className="mt-4 text-sm whitespace-pre-wrap text-foreground/90">{task.body}</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div />
        <aside>
          <PropertiesPanel
            entity="activities" table="activities" row={task as unknown as Record<string, unknown> & { id: string }}
            props={[
              { key: "subject", label: "Assunto", primary: true },
              { key: "task_status", label: "Status", primary: true },
              { key: "task_priority", label: "Prioridade", primary: true },
              { key: "due_date", label: "Vencimento", primary: true },
              { key: "body", label: "Descrição" },
            ]}
            onSaved={load}
          />
        </aside>
      </div>
    </div>
  );
}
