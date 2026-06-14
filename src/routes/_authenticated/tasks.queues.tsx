import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Play, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { AddQueueItemsDialog } from "@/components/tasks/add-queue-items-dialog";
import { listTaskQueues, createTaskQueue, deleteTaskQueue } from "@/lib/task-queues.functions";

export const Route = createFileRoute("/_authenticated/tasks/queues")({
  component: QueuesPage,
});

function QueuesPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listTaskQueues);
  const createFn = useServerFn(createTaskQueue);
  const deleteFn = useServerFn(deleteTaskQueue);
  const q = useQuery({ queryKey: ["task_queues"], queryFn: () => listFn() });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: () => createFn({ data: { name, description } }),
    onSuccess: () => {
      toast.success("Fila criada");
      setName("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["task_queues"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Excluída");
      qc.invalidateQueries({ queryKey: ["task_queues"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Filas de tarefas</h1>
        <p className="text-sm text-muted-foreground">
          Agrupe contatos, leads ou deals para executar em série com atalhos de teclado.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova fila</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Prospecção semana 21"
            />
          </div>
          <div>
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
          <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>
            <Plus className="mr-1 h-4 w-4" /> Criar fila
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {q.data?.items.map((row) => (
          <Card key={row.id}>
            <CardContent className="pt-6 space-y-2">
              <div className="font-medium">{row.name}</div>
              {row.description && (
                <p className="text-sm text-muted-foreground">{row.description}</p>
              )}
              <div className="text-xs text-muted-foreground">
                {row.counts.pending} pendentes · {row.counts.total} total
              </div>
              <div className="flex justify-between items-center pt-2 gap-2">
                <AddQueueItemsDialog queueId={row.id} />
                <div className="flex gap-1">
                  <Button asChild size="sm" variant="default">
                    <Link to="/tasks/queues/$queueId/play" params={{ queueId: row.id }}>
                      <Play className="mr-1 h-4 w-4" /> Executar
                    </Link>
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(row.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {q.data?.items.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma fila ainda.</p>
        )}
      </div>
    </div>
  );
}
