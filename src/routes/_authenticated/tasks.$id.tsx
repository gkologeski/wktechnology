import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trash2, Check, CalendarClock, User2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PropertiesPanel } from "@/components/properties-panel";
import { TASK_STATUSES, TASK_PRIORITIES, formatDateTime } from "@/lib/crm";
import type { Activity } from "@/lib/db-types";
import { toast } from "sonner";
import { useWorkspaceMembers } from "@/hooks/use-workspace-members";

export const Route = createFileRoute("/_authenticated/tasks/$id")({
  component: TaskDetail,
});

type TaskRow = Activity & { created_by?: string | null };

const isHtml = (s: string) => /<\/?[a-z][\s\S]*>/i.test(s);

function TaskDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState<TaskRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { data: members, nameFor } = useWorkspaceMembers();

  const load = async () => {
    const { data } = await supabase.from("activities").select("*").eq("id", id).single();
    setTask(data as TaskRow | null);
  };
  useEffect(() => {
    void load(); /* eslint-disable-next-line */
  }, [id]);

  const sanitizedBody = useMemo(() => {
    if (!task?.body) return "";
    return DOMPurify.sanitize(task.body, { USE_PROFILES: { html: true } });
  }, [task?.body]);

  if (!task) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  const remove = async () => {
    const { error } = await supabase.from("activities").delete().eq("id", task.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Excluída");
    qc.removeQueries({ queryKey: ["task", task.id] });
    await qc.invalidateQueries({ queryKey: ["tasks"] });
    await qc.invalidateQueries({ queryKey: ["activities"] });
    navigate({ to: "/tasks" });
  };

  const complete = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("activities")
      .update({ completed: true, task_status: "COMPLETED" })
      .eq("id", task.id);
    toast.success("Concluída");
    void load();
  };

  const reassign = async (newOwnerId: string) => {
    if (!newOwnerId || newOwnerId === task.owner_id) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("activities")
      .update({ owner_id: newOwnerId })
      .eq("id", task.id);
    if (error) return toast.error(error.message);
    toast.success("Responsável atualizado");
    void load();
  };

  const statusLabel = TASK_STATUSES.find((s) => s.value === task.task_status)?.label;
  const priorityLabel = TASK_PRIORITIES.find((p) => p.value === task.task_priority)?.label;

  return (
    <div className="-m-4 md:-m-6 p-6 md:p-8 bg-muted/30 min-h-full space-y-6">
      {/* Header */}
      <div className="bg-card rounded-2xl shadow-sm border border-border/60 p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <Button variant="ghost" size="icon" asChild className="rounded-full">
              <Link to="/tasks">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-bold text-foreground truncate">
                  {task.subject || "(sem assunto)"}
                </h1>
                {statusLabel && (
                  <Badge variant="outline" className="rounded-full">
                    {statusLabel}
                  </Badge>
                )}
                {priorityLabel && (
                  <Badge variant="secondary" className="rounded-full">
                    {priorityLabel}
                  </Badge>
                )}
                {task.completed && (
                  <Badge className="rounded-full bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300">
                    Concluída
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                <CalendarClock className="h-3.5 w-3.5" />
                Venc.: {formatDateTime(task.due_date)}
                <span className="text-border">·</span>
                Criada em {formatDateTime(task.created_at)}
                {task.created_by && task.created_by !== task.owner_id && (
                  <>
                    <span className="text-border">·</span>
                    por{" "}
                    <span className="font-medium text-foreground">
                      {nameFor(task.created_by)}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!task.completed && (
              <Button variant="outline" size="sm" onClick={complete}>
                <Check className="h-4 w-4 mr-1.5" /> Concluir
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
              onClick={() => setConfirmDelete(true)}
              aria-label="Excluir tarefa"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 min-w-0">
          <PropertiesPanel
            entity="activities"
            table="activities"
            row={task as unknown as Record<string, unknown> & { id: string }}
            props={[
              { key: "subject", label: "Assunto", primary: true },
              { key: "task_status", label: "Status", primary: true },
              { key: "task_priority", label: "Prioridade", primary: true },
              { key: "due_date", label: "Vencimento", type: "datetime", primary: true },
              { key: "body", label: "Descrição" },
            ]}
            onSaved={load}
          />
        </aside>

        <div className="space-y-6 min-w-0">
          <section className="bg-card rounded-2xl shadow-sm border border-border/60 p-6">
            <h2 className="text-sm font-semibold text-foreground mb-3">Descrição</h2>
            {task.body ? (
              isHtml(task.body) ? (
                <div
                  className="prose prose-sm dark:prose-invert max-w-none text-foreground/90"
                  dangerouslySetInnerHTML={{ __html: sanitizedBody }}
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap text-foreground/90">{task.body}</p>
              )
            ) : (
              <p className="text-sm text-muted-foreground italic">Sem descrição.</p>
            )}
          </section>

          <section className="bg-card rounded-2xl shadow-sm border border-border/60 p-6">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <User2 className="h-4 w-4 text-muted-foreground" />
              Responsável
            </h2>
            <Select value={task.owner_id ?? ""} onValueChange={reassign}>
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue placeholder="Selecionar responsável" />
              </SelectTrigger>
              <SelectContent>
                {(members ?? []).map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.full_name || m.user_id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={remove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
