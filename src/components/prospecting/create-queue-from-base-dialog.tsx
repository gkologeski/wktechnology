/**
 * Cria (ou alimenta) uma fila manual de contatos a partir da aba "Base".
 * Componente de apresentação; toda a escrita passa por server functions
 * (`upsertQueue` / `addToQueue`), que aplicam RLS/RBAC.
 */
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listQueues, upsertQueue, addToQueue } from "@/lib/prospecting/queues.functions";

export function CreateQueueFromBaseDialog({
  open,
  onOpenChange,
  ids,
  suggestedName,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** IDs de contatos selecionados na Base. */
  ids: string[];
  suggestedName: string;
  onCreated?: () => void;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listQueues);
  const upsert = useServerFn(upsertQueue);
  const add = useServerFn(addToQueue);

  const [mode, setMode] = useState<"new" | "existing">("new");
  const [name, setName] = useState(suggestedName);
  const [queueId, setQueueId] = useState("");

  useEffect(() => {
    if (open) {
      setName(suggestedName);
      setMode("new");
      setQueueId("");
    }
  }, [open, suggestedName]);

  const queuesQ = useQuery({
    queryKey: ["prospecting", "queues"],
    queryFn: () => list(),
    enabled: open,
    refetchOnMount: "always",
  });

  const manualContactQueues = useMemo(
    () =>
      (queuesQ.data ?? []).filter(
        (q) =>
          (q as { entity: string }).entity === "contact" &&
          (q as { kind?: string }).kind === "manual",
      ),
    [queuesQ.data],
  );

  const save = useMutation({
    mutationFn: async () => {
      if (mode === "existing") {
        if (!queueId) throw new Error("Selecione uma fila.");
        const r = await add({ data: { queue_id: queueId, ids } });
        const target = manualContactQueues.find((q) => q.id === queueId);
        return { label: target?.name ?? "fila", added: r.added, total: r.total, id: queueId };
      }
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Informe um nome para a fila.");
      const r = await upsert({
        data: {
          name: trimmed,
          entity: "contact",
          kind: "manual",
          item_ids: ids,
          filters: {},
          sort: {},
          is_shared: false,
        },
      });
      return { label: trimmed, added: ids.length, total: ids.length, id: r.id };
    },
    onSuccess: (r) => {
      toast.success(`Fila "${r.label}": ${r.added} contato(s) — total ${r.total}.`);
      qc.invalidateQueries({ queryKey: ["prospecting", "queues"] });
      qc.invalidateQueries({ queryKey: ["prospecting", "queue-items"] });
      qc.invalidateQueries({ queryKey: ["prospecting", "queue-count"] });
      onOpenChange(false);
      onCreated?.();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar fila de prospecção</DialogTitle>
          <DialogDescription>
            {ids.length} contato(s) selecionado(s) serão trabalhados em fila.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="base-queue-mode">Destino</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <SelectTrigger id="base-queue-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Criar nova fila</SelectItem>
                <SelectItem value="existing" disabled={manualContactQueues.length === 0}>
                  Adicionar a uma fila existente
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mode === "new" ? (
            <div className="space-y-1.5">
              <Label htmlFor="base-queue-name">Nome da fila</Label>
              <Input
                id="base-queue-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Base · Ganhos · Fábrica de Software"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="base-queue-existing">Fila manual de contatos</Label>
              <Select value={queueId} onValueChange={setQueueId}>
                <SelectTrigger id="base-queue-existing">
                  <SelectValue
                    placeholder={
                      queuesQ.isLoading ? "Carregando filas…" : "Selecione uma fila manual"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {manualContactQueues.map((q) => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={
              save.isPending ||
              ids.length === 0 ||
              (mode === "new" ? !name.trim() : !queueId) ||
              false
            }
          >
            {save.isPending
              ? "Criando…"
              : mode === "new"
                ? "Criar fila"
                : "Adicionar à fila"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
