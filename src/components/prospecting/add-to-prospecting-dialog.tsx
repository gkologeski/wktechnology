/**
 * Dialog compartilhado para adicionar leads/contatos à Suíte de Prospecção.
 * Duas abas:
 *  - Fila: escolhe fila manual existente ou cria nova; itens são acrescidos.
 *  - Cadência: inscreve em cadência ativa (dedupe automático).
 */
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listQueues,
  upsertQueue,
  addToQueue,
  enrollInCadence,
} from "@/lib/prospecting/queues.functions";
import { listCadences } from "@/lib/prospecting/cadences.functions";

// Suíte de Prospecção aceita apenas leads.
const entity = "lead" as const;

export function AddToProspectingDialog({
  open,
  onOpenChange,
  ids,
  alreadyCount = 0,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ids: string[];
  /** Quantos dos leads informados já existiam antes desta operação. */
  alreadyCount?: number;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listQueues);
  const listCad = useServerFn(listCadences);
  const upsert = useServerFn(upsertQueue);
  const add = useServerFn(addToQueue);
  const enroll = useServerFn(enrollInCadence);

  const [tab, setTab] = useState<"queue" | "cadence">("queue");
  const [queueId, setQueueId] = useState<string>("");
  const [newQueueName, setNewQueueName] = useState<string>("");
  const [cadenceId, setCadenceId] = useState<string>("");

  const queuesQ = useQuery({
    queryKey: ["prospecting", "queues"],
    queryFn: () => list(),
    enabled: open,
    refetchOnMount: "always",
  });
  const cadencesQ = useQuery({
    queryKey: ["prospecting", "cadences"],
    queryFn: () => listCad(),
    enabled: open,
  });

  const leadQueues = useMemo(
    () => (queuesQ.data ?? []).filter((q) => (q as { entity: string }).entity === entity),
    [queuesQ.data],
  );
  const manualQueues = useMemo(
    () => leadQueues.filter((q) => (q as { kind?: string }).kind === "manual"),
    [leadQueues],
  );
  const dynamicQueues = useMemo(
    () => leadQueues.filter((q) => (q as { kind?: string }).kind !== "manual"),
    [leadQueues],
  );

  const addMut = useMutation({
    mutationFn: async () => {
      let targetId = queueId;
      if (!targetId && newQueueName.trim()) {
        const r = await upsert({
          data: {
            name: newQueueName.trim(),
            entity,
            kind: "manual",
            item_ids: ids,
            filters: {},
            sort: {},
            is_shared: false,
          },
        });
        targetId = r.id;
        return { total: ids.length, added: ids.length, created: true, id: targetId };
      }
      if (!targetId) throw new Error("Selecione uma fila ou informe um nome.");
      const r = await add({ data: { queue_id: targetId, ids } });
      return { ...r, created: false, id: targetId };
    },
    onSuccess: (r) => {
      const queueName =
        newQueueName.trim() || (manualQueues.find((q) => q.id === r.id)?.name ?? "fila");
      toast.success(
        r.created
          ? `Fila "${queueName}" criada com ${ids.length} item(ns).`
          : `${r.added} adicionado(s) em "${queueName}" — total ${r.total}.`,
      );

      qc.invalidateQueries({ queryKey: ["prospecting", "queues"] });
      qc.invalidateQueries({ queryKey: ["prospecting", "queue-items"] });
      onOpenChange(false);
      setQueueId("");
      setNewQueueName("");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const enrollMut = useMutation({
    mutationFn: () => enroll({ data: { cadence_id: cadenceId, entity, ids } }),
    onSuccess: (r) => {
      toast.success(
        `${r.enrolled} inscrito(s)${r.skipped ? ` · ${r.skipped} já existia(m)` : ""}.`,
      );
      qc.invalidateQueries({ queryKey: ["prospecting"] });
      onOpenChange(false);
      setCadenceId("");
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Adicionar {ids.length} {entity === "lead" ? "lead(s)" : "contato(s)"} à prospecção
          </DialogTitle>
          {alreadyCount > 0 && (
            <DialogDescription>
              {alreadyCount} deste(s) lead(s) já haviam sido importados anteriormente.
            </DialogDescription>
          )}
        </DialogHeader>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="queue">Fila manual</TabsTrigger>
            <TabsTrigger value="cadence">Cadência</TabsTrigger>
          </TabsList>
          <TabsContent value="queue" className="space-y-3 pt-3">
            <div className="space-y-1">
              <Label>Fila existente</Label>
              <Select
                value={queueId}
                onValueChange={(v) => {
                  setQueueId(v);
                  setNewQueueName("");
                }}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      queuesQ.isLoading
                        ? "Carregando filas..."
                        : manualQueues.length
                          ? "Selecione uma fila manual"
                          : "Nenhuma fila manual"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {manualQueues.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.name}
                    </SelectItem>
                  ))}
                  {dynamicQueues.map((q) => (
                    <SelectItem key={q.id} value={q.id} disabled>
                      {q.name} — fila dinâmica, não aceita itens manuais
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!queuesQ.isLoading && manualQueues.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  {dynamicQueues.length
                    ? "As filas existentes são dinâmicas (baseadas em filtros). Crie uma fila manual abaixo para adicionar estes leads."
                    : "Nenhuma fila manual encontrada. Crie uma abaixo."}
                </p>
              )}
            </div>
            <div className="text-xs text-muted-foreground text-center">ou</div>
            <div className="space-y-1">
              <Label>Criar nova fila manual</Label>
              <Input
                placeholder="Nome da nova fila"
                value={newQueueName}
                onChange={(e) => {
                  setNewQueueName(e.target.value);
                  setQueueId("");
                }}
              />
            </div>
          </TabsContent>
          <TabsContent value="cadence" className="space-y-3 pt-3">
            <div className="space-y-1">
              <Label>Cadência ativa</Label>
              <Select value={cadenceId} onValueChange={setCadenceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma cadência" />
                </SelectTrigger>
                <SelectContent>
                  {(cadencesQ.data ?? [])
                    .filter((c) => (c as { enabled?: boolean }).enabled !== false)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Inscrições duplicadas na mesma cadência são ignoradas automaticamente.
              </p>
            </div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {tab === "queue" ? (
            <Button
              disabled={addMut.isPending || (!queueId && !newQueueName.trim())}
              onClick={() => addMut.mutate()}
            >
              {addMut.isPending ? "Adicionando..." : "Adicionar à fila"}
            </Button>
          ) : (
            <Button disabled={enrollMut.isPending || !cadenceId} onClick={() => enrollMut.mutate()}>
              {enrollMut.isPending ? "Inscrevendo..." : "Inscrever na cadência"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
