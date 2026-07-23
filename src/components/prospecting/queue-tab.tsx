/**
 * Aba "Fila" da Suíte de Prospecção — gerenciamento de filas configuráveis
 * e workspace de qualificação (split view com lista + painel).
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Plus, Trash2, Filter, Users, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AtsSectionHeader, EmptyState } from "@/components/ats/ui";
import {
  listQueues,
  upsertQueue,
  deleteQueue,
  listQueueItems,
} from "@/lib/prospecting/queues.functions";

type QueueEntity = "lead" | "contact";

export function QueueTab() {
  const list = useServerFn(listQueues);
  const del = useServerFn(deleteQueue);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["prospecting", "queues"],
    queryFn: () => list(),
  });

  const [openNew, setOpenNew] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const queues = data ?? [];
  const activeQueue = queues.find((q) => q.id === activeId) ?? queues[0];

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Fila removida.");
      setActiveId(null);
      qc.invalidateQueries({ queryKey: ["prospecting", "queues"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="space-y-4">
      <AtsSectionHeader
        title="Filas de prospecção"
        description="Filas configuráveis por status, fonte e score para o SDR/BDR trabalhar."
        action={
          <Button size="sm" onClick={() => setOpenNew(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nova fila
          </Button>
        }
      />

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : queues.length === 0 ? (
        <EmptyState
          icon={Filter}
          title="Nenhuma fila configurada"
          description="Crie uma fila para começar a trabalhar prospecções por status, fonte ou score."
          action={
            <Button size="sm" onClick={() => setOpenNew(true)}>
              <Plus className="w-4 h-4 mr-1" /> Nova fila
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-12 gap-4">
          <aside className="col-span-12 lg:col-span-3 space-y-2">
            {queues.map((q) => (
              <button
                key={q.id}
                onClick={() => setActiveId(q.id)}
                className={`w-full text-left rounded-md border p-3 transition-colors ${
                  activeQueue?.id === q.id ? "bg-accent border-accent-foreground/20" : "hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  {q.entity === "lead" ? (
                    <Users className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <User className="w-4 h-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium truncate">{q.name}</span>
                </div>
                {q.description ? (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {q.description}
                  </p>
                ) : null}
              </button>
            ))}
          </aside>
          <section className="col-span-12 lg:col-span-9">
            {activeQueue ? (
              <QueueWorkspace
                queueId={activeQueue.id}
                queueName={activeQueue.name}
                onDelete={() => {
                  if (confirm(`Excluir a fila "${activeQueue.name}"?`))
                    delMut.mutate(activeQueue.id);
                }}
              />
            ) : null}
          </section>
        </div>
      )}

      <QueueDialog
        open={openNew}
        onOpenChange={setOpenNew}
        onSaved={() => {
          setOpenNew(false);
          qc.invalidateQueries({ queryKey: ["prospecting", "queues"] });
        }}
      />
    </div>
  );
}

function QueueWorkspace({
  queueId,
  queueName,
  onDelete,
}: {
  queueId: string;
  queueName: string;
  onDelete: () => void;
}) {
  const listItems = useServerFn(listQueueItems);
  const { data, isLoading } = useQuery({
    queryKey: ["prospecting", "queue-items", queueId],
    queryFn: () => listItems({ data: { queue_id: queueId, limit: 50, offset: 0 } }),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{queueName}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {data?.total ?? 0} {data?.entity === "lead" ? "leads" : "contatos"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive">
          <Trash2 className="w-4 h-4 mr-1" /> Excluir fila
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando fila...</div>
        ) : !data?.items || data.items.length === 0 ? (
          <EmptyState
            title="Nenhum item na fila"
            description="Ajuste os filtros da fila ou aguarde a chegada de novos leads/contatos."
          />
        ) : (
          <div className="divide-y">
            {data.items.map((it) => (
              <QueueItemRow key={(it as { id: string }).id} entity={data.entity} item={it as Record<string, unknown>} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QueueItemRow({
  entity,
  item,
}: {
  entity: string;
  item: Record<string, unknown>;
}) {
  const id = String(item.id);
  const name =
    entity === "lead"
      ? String(item.name ?? "—")
      : `${item.first_name ?? ""} ${item.last_name ?? ""}`.trim() || "—";
  const email = item.email ? String(item.email) : null;
  const status = item.status ? String(item.status) : null;
  const score = typeof item.lead_score === "number" ? item.lead_score : null;
  const detailHref = entity === "lead" ? `/leads/${id}` : `/contacts/${id}`;

  return (
    <div className="flex items-center justify-between py-3 gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{name}</span>
          {status ? (
            <Badge variant="outline" className="text-[10px]">
              {status}
            </Badge>
          ) : null}
          {score != null ? (
            <Badge variant="secondary" className="text-[10px]">
              score {score}
            </Badge>
          ) : null}
        </div>
        {email ? (
          <p className="text-xs text-muted-foreground truncate">{email}</p>
        ) : null}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button asChild variant="outline" size="sm">
          <Link to={detailHref}>Abrir</Link>
        </Button>
      </div>
    </div>
  );
}

function QueueDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const upsert = useServerFn(upsertQueue);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [entity, setEntity] = useState<QueueEntity>("lead");
  const [statusCsv, setStatusCsv] = useState("");
  const [sourceCsv, setSourceCsv] = useState("");
  const [scoreMin, setScoreMin] = useState<string>("");
  const [scoreMax, setScoreMax] = useState<string>("");
  const [search, setSearch] = useState("");

  const save = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          name,
          description: description || null,
          entity,
          filters: {
            ...(statusCsv
              ? { status: statusCsv.split(",").map((s) => s.trim()).filter(Boolean) }
              : {}),
            ...(sourceCsv
              ? { source: sourceCsv.split(",").map((s) => s.trim()).filter(Boolean) }
              : {}),
            ...(scoreMin ? { score_min: Number(scoreMin) } : {}),
            ...(scoreMax ? { score_max: Number(scoreMax) } : {}),
            ...(search ? { search } : {}),
          },
          sort: { field: "updated_at", dir: "desc" },
          is_shared: false,
        },
      }),
    onSuccess: () => {
      toast.success("Fila criada.");
      setName("");
      setDescription("");
      setStatusCsv("");
      setSourceCsv("");
      setScoreMin("");
      setScoreMax("");
      setSearch("");
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova fila de prospecção</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Entidade</Label>
              <Select value={entity} onValueChange={(v) => setEntity(v as QueueEntity)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Leads</SelectItem>
                  <SelectItem value="contact">Contatos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="space-y-1">
            <Label>Status (separados por vírgula)</Label>
            <Input
              value={statusCsv}
              onChange={(e) => setStatusCsv(e.target.value)}
              placeholder="new, working"
            />
          </div>
          <div className="space-y-1">
            <Label>Fontes (separadas por vírgula)</Label>
            <Input
              value={sourceCsv}
              onChange={(e) => setSourceCsv(e.target.value)}
              placeholder="site, linkedin"
            />
          </div>
          {entity === "lead" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Score mín.</Label>
                <Input
                  type="number"
                  value={scoreMin}
                  onChange={(e) => setScoreMin(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Score máx.</Label>
                <Input
                  type="number"
                  value={scoreMax}
                  onChange={(e) => setScoreMax(e.target.value)}
                />
              </div>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label>Busca livre (nome/email)</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!name || save.isPending} onClick={() => save.mutate()}>
            Criar fila
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
