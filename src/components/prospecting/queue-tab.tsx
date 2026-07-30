/**
 * Aba "Fila" da Suíte de Prospecção — gerenciamento de filas configuráveis
 * e workspace de qualificação (split view com lista + painel).
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AssigneeFilter, useAssigneeFilter } from "@/components/entity/assignee-filter";
import { AssigneeCell } from "@/components/entity/assignee-cell";
import { Link } from "@tanstack/react-router";
import { Plus, Trash2, Filter, Users, User, Play, Pencil } from "lucide-react";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { AutocompleteChips } from "@/components/ui/autocomplete-chips";
import { listLeadSources } from "@/lib/lead-sources";
import { AtsSectionHeader, EmptyState } from "@/components/ats/ui";
import {
  listQueues,
  upsertQueue,
  deleteQueue,
  listQueueItems,
  countQueueItems,
} from "@/lib/prospecting/queues.functions";
import { listCadences } from "@/lib/prospecting/cadences.functions";


const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "Novo",
  working: "Em trabalho",
  contacted: "Contatado",
  qualified: "Qualificado",
  unqualified: "Desqualificado",
  converted: "Convertido",
  lost: "Perdido",
  nurturing: "Em nutrição",
};

const CONTACT_LIFECYCLE_LABELS: Record<string, string> = {
  subscriber: "Assinante",
  lead: "Lead",
  mql: "MQL",
  sql: "SQL",
  opportunity: "Oportunidade",
  customer: "Cliente",
  evangelist: "Evangelista",
  other: "Outro",
};

function titleCase(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function statusLabel(entity: string, raw: string): string {
  const map = entity === "lead" ? LEAD_STATUS_LABELS : CONTACT_LIFECYCLE_LABELS;
  return map[raw?.toLowerCase?.() ?? ""] ?? titleCase(raw);
}

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
  const [editing, setEditing] = useState<QueueRow | null>(null);
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
              <QueueSidebarItem
                key={q.id}
                queue={q as unknown as Record<string, unknown>}
                active={activeQueue?.id === q.id}
                onClick={() => setActiveId(q.id)}
              />
            ))}
          </aside>
          <section className="col-span-12 lg:col-span-9">
            {activeQueue ? (
              <QueueWorkspace
                queueId={activeQueue.id}
                queueName={activeQueue.name}
                onEdit={() => setEditing(activeQueue as unknown as QueueRow)}
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
      <QueueDialog
        open={!!editing}
        queue={editing}
        onOpenChange={(v) => {
          if (!v) setEditing(null);
        }}
        onSaved={() => {
          setEditing(null);
          qc.invalidateQueries({ queryKey: ["prospecting", "queues"] });
        }}
      />

    </div>
  );
}

function QueueWorkspace({
  queueId,
  queueName,
  onEdit,
  onDelete,
}: {
  queueId: string;
  queueName: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const listItems = useServerFn(listQueueItems);
  const { data, isLoading } = useQuery({
    queryKey: ["prospecting", "queue-items", queueId],
    queryFn: () => listItems({ data: { queue_id: queueId, limit: 50, offset: 0 } }),
  });

  const { assignee, setAssignee, filterRows } = useAssigneeFilter();
  const items = filterRows((data?.items ?? []) as unknown as Array<Record<string, unknown>>);
  const hasItems = items.length > 0;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{queueName}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {data?.total ?? 0} {data?.entity === "lead" ? "leads" : "contatos"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AssigneeFilter value={assignee} onChange={setAssignee} className="h-8 w-44 text-xs" />
          {hasItems ? (
            <Button asChild size="sm">
              <Link to="/prospecting/queues/$queueId/play" params={{ queueId }}>
                <Play className="w-4 h-4 mr-1" /> Iniciar fila
              </Link>
            </Button>
          ) : (
            <Button size="sm" disabled>
              <Play className="w-4 h-4 mr-1" /> Iniciar fila
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="w-4 h-4 mr-1" /> Editar fila
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive">

            <Trash2 className="w-4 h-4 mr-1" /> Excluir fila
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando fila...</div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhum item na fila"
            description="Ajuste os filtros da fila ou aguarde a chegada de novos leads/contatos."
          />
        ) : (
          <div className="divide-y">
            {items.map((it) => (
              <QueueItemRow key={String(it.id)} entity={data?.entity ?? "lead"} item={it} />
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
  const leadName = `${item.first_name ?? ""} ${item.last_name ?? ""}`.trim();
  const contactName = `${item.first_name ?? ""} ${item.last_name ?? ""}`.trim();
  const name =
    entity === "lead"
      ? leadName ||
        (item.email ? String(item.email) : "") ||
        (item.company_name ? String(item.company_name) : "") ||
        "—"
      : contactName || (item.email ? String(item.email) : "") || "—";
  const email = item.email ? String(item.email) : null;
  const statusRaw =
    entity === "lead"
      ? item.status
        ? String(item.status)
        : null
      : item.lifecycle_stage
        ? String(item.lifecycle_stage)
        : null;
  const score = typeof item.score === "number" ? item.score : null;
  

  return (
    <div className="flex items-center justify-between py-3 gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link
            to={entity === "lead" ? "/leads/$id" : "/contacts/$id"}
            params={{ id }}
            className="text-sm font-medium truncate hover:underline"
          >
            {name}
          </Link>
          {statusRaw ? (
            <Badge variant="outline" className="text-[10px]">
              {statusLabel(entity, statusRaw)}
            </Badge>
          ) : null}
          <AssigneeCell assignedTo={(item.assigned_to as string | null) ?? null} />
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
    </div>
  );
}

function QueueSidebarItem({
  queue,
  active,
  onClick,
}: {
  queue: Record<string, unknown>;
  active: boolean;
  onClick: () => void;
}) {
  const countFn = useServerFn(countQueueItems);
  const id = String(queue.id);
  const kind = (queue.kind as string | undefined) ?? "dynamic";
  const manualCount = ((queue.item_ids as string[] | undefined) ?? []).length;
  const { data } = useQuery({
    queryKey: ["prospecting", "queue-count", id],
    queryFn: () => countFn({ data: { queue_id: id } }),
    enabled: kind !== "manual",
    staleTime: 30_000,
  });
  const total = kind === "manual" ? manualCount : (data?.total ?? 0);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-md border p-3 transition-colors ${
        active ? "bg-accent border-accent-foreground/20" : "hover:bg-muted/50"
      }`}
    >
      <div className="flex items-center gap-2">
        {queue.entity === "lead" ? (
          <Users className="w-4 h-4 text-muted-foreground" />
        ) : (
          <User className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="text-sm font-medium truncate flex-1">{String(queue.name)}</span>
        <Badge variant={kind === "manual" ? "secondary" : "outline"} className="text-[10px] shrink-0">
          {kind === "manual" ? `Manual · ${total}` : total}
        </Badge>
      </div>
      {queue.description ? (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {String(queue.description)}
        </p>
      ) : null}
    </button>
  );
}


type QueueRow = {
  id: string;
  name: string;
  description?: string | null;
  entity: string;
  filters?: Record<string, unknown> | null;
  nurture_cadence_id?: string | null;
};

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string" && v.trim()) return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function QueueDialog({
  open,
  onOpenChange,
  onSaved,
  queue,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  queue?: QueueRow | null;
}) {
  const upsert = useServerFn(upsertQueue);
  const listCadFn = useServerFn(listCadences);
  const isEdit = !!queue?.id;

  const initial = useMemo(() => {
    const f = (queue?.filters ?? {}) as Record<string, unknown>;
    return {
      name: queue?.name ?? "",
      description: queue?.description ?? "",
      entity: ((queue?.entity as QueueEntity) ?? "lead") as QueueEntity,
      status: toArray(f.status),
      source: toArray(f.source),
      scoreMin: f.score_min != null ? String(f.score_min) : "",
      scoreMax: f.score_max != null ? String(f.score_max) : "",
      search: typeof f.search === "string" ? f.search : "",
      cadence: queue?.nurture_cadence_id ?? "none",
    };
  }, [queue]);

  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description ?? "");
  const [entity, setEntity] = useState<QueueEntity>(initial.entity);
  const [status, setStatus] = useState<string[]>(initial.status);
  const [source, setSource] = useState<string[]>(initial.source);
  const [scoreMin, setScoreMin] = useState<string>(initial.scoreMin);
  const [scoreMax, setScoreMax] = useState<string>(initial.scoreMax);
  const [search, setSearch] = useState(initial.search);
  const [nurtureCadenceId, setNurtureCadenceId] = useState<string>(initial.cadence);

  // Reidrata o formulário sempre que o modal abre (novo ou edição).
  useEffect(() => {
    if (!open) return;
    setName(initial.name);
    setDescription(initial.description ?? "");
    setEntity(initial.entity);
    setStatus(initial.status);
    setSource(initial.source);
    setScoreMin(initial.scoreMin);
    setScoreMax(initial.scoreMax);
    setSearch(initial.search);
    setNurtureCadenceId(initial.cadence);
  }, [open, initial]);

  const { data: cadences } = useQuery({
    queryKey: ["prospecting", "cadences"],
    queryFn: () => listCadFn(),
    enabled: open,
  });
  const enabledCadences = (cadences ?? []).filter(
    (c) => (c as { enabled?: boolean }).enabled !== false,
  );

  const { data: sources } = useQuery({
    queryKey: ["lead-sources", "active"],
    queryFn: () => listLeadSources(true),
    enabled: open,
  });

  const statusOptions = useMemo(() => {
    const map = entity === "lead" ? LEAD_STATUS_LABELS : CONTACT_LIFECYCLE_LABELS;
    return Object.entries(map).map(([value, label]) => ({ value, label }));
  }, [entity]);

  const sourceOptions = useMemo(
    () => (sources ?? []).map((s) => ({ value: s.name, label: s.name })),
    [sources],
  );

  const save = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          ...(queue?.id ? { id: queue.id } : {}),
          name,
          description: description || null,
          entity,
          filters: {
            ...(status.length ? { status } : {}),
            ...(source.length ? { source } : {}),
            ...(scoreMin ? { score_min: Number(scoreMin) } : {}),
            ...(scoreMax ? { score_max: Number(scoreMax) } : {}),
            ...(search ? { search } : {}),
          },
          sort: { field: "updated_at", dir: "desc" },
          is_shared: false,
          nurture_cadence_id: nurtureCadenceId === "none" ? null : nurtureCadenceId,
        },
      }),
    onSuccess: () => {
      toast.success(isEdit ? "Fila atualizada." : "Fila criada.");
      onSaved();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar fila de prospecção" : "Nova fila de prospecção"}</DialogTitle>
          <DialogDescription>
            A fila seleciona automaticamente os registros que atendem a todos os filtros abaixo.
            Deixe um filtro em branco para não restringir por ele.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="queue-name">Nome</Label>
              <Input id="queue-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Entidade</Label>
              <Select
                value={entity}
                onValueChange={(v) => {
                  setEntity(v as QueueEntity);
                  setStatus([]);
                }}
                disabled={isEdit}
              >
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
            <Label htmlFor="queue-desc">Descrição</Label>
            <Input
              id="queue-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcional"
            />
          </div>
          <div className="space-y-1">
            <Label>{entity === "lead" ? "Status do lead" : "Estágio do ciclo de vida"}</Label>
            <AutocompleteChips
              value={status}
              onChange={setStatus}
              options={statusOptions}
              allowCustom={false}
              placeholder="Selecione um ou mais…"
              emptyLabel="Nenhum status disponível"
            />
            <p className="text-xs text-muted-foreground">
              A fila inclui registros que estejam em qualquer um dos status escolhidos.
            </p>
          </div>
          <div className="space-y-1">
            <Label>Fontes</Label>
            <AutocompleteChips
              value={source}
              onChange={setSource}
              options={sourceOptions}
              placeholder="Selecione ou digite uma nova fonte…"
              emptyLabel="Nenhuma fonte cadastrada"
            />
            <p className="text-xs text-muted-foreground">
              Sugestões vêm das fontes já cadastradas no workspace. Você pode digitar uma nova e
              pressionar Enter.
            </p>
          </div>
          {entity === "lead" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="queue-score-min">Score mín.</Label>
                <Input
                  id="queue-score-min"
                  type="number"
                  value={scoreMin}
                  onChange={(e) => setScoreMin(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="queue-score-max">Score máx.</Label>
                <Input
                  id="queue-score-max"
                  type="number"
                  value={scoreMax}
                  onChange={(e) => setScoreMax(e.target.value)}
                />
              </div>
              <p className="col-span-2 text-xs text-muted-foreground">
                Filtra pelo score calculado pelas regras da aba Scoring.
              </p>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="queue-search">Busca livre</Label>
            <Input
              id="queue-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ex.: acme"
            />
            <p className="text-xs text-muted-foreground">
              Procura por nome, sobrenome, e-mail e empresa, sem diferenciar maiúsculas de
              minúsculas.
            </p>
          </div>
          {entity === "lead" ? (
            <div className="space-y-1">
              <Label>Cadência de nutrição (opcional)</Label>
              <Select value={nurtureCadenceId} onValueChange={setNurtureCadenceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {enabledCadences.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leads enviados para nutrição serão inscritos automaticamente nesta cadência.
              </p>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={!name || save.isPending} onClick={() => save.mutate()}>
            {isEdit ? "Salvar alterações" : "Criar fila"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
