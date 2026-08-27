import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  deleteSubstatus,
  reorderSubstatuses,
  saveSubstatus,
  substatusesForStage,
  substatusesKey,
  suggestedSubstatuses,
  useInvalidateSubstatuses,
  usePipelineSubstatuses,
  type StageSubstatus,
} from "@/lib/pipelines/substatuses";

/**
 * Substatus de uma etapa dentro do editor de pipelines.
 * Só aparece para pipelines já salvos (precisa do `pipeline_id`).
 */
export function StageSubstatusesEditor({
  pipelineId,
  stageValue,
  stageLabel,
  stageType,
  canManage,
}: {
  pipelineId: string;
  stageValue: string;
  stageLabel: string;
  stageType?: "open" | "won" | "lost";
  canManage: boolean;
}) {
  const q = usePipelineSubstatuses(pipelineId);
  const invalidate = useInvalidateSubstatuses();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  /** Aplica a nova ordem direto no cache, para a lista reagir na hora. */
  const reorderLocally = (ids: string[]) => {
    qc.setQueryData<StageSubstatus[]>(substatusesKey(pipelineId), (prev) => {
      if (!prev) return prev;
      const positions = new Map(ids.map((id, i) => [id, i]));
      return prev
        .map((r) => (positions.has(r.id) ? { ...r, position: positions.get(r.id) as number } : r))
        .sort((a, b) =>
          a.stage_value === b.stage_value
            ? a.position - b.position
            : a.stage_value.localeCompare(b.stage_value),
        );
    });
  };

  const rows = substatusesForStage(q.data, stageValue, { includeInactive: true });

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      invalidate(pipelineId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar substatus");
    } finally {
      setBusy(false);
    }
  };

  const add = (name: string, isDefault = false) =>
    run(async () => {
      await saveSubstatus({
        pipeline_id: pipelineId,
        stage_value: stageValue,
        name,
        position: rows.length,
        is_default: isDefault,
      });
      toast.success("Substatus criado");
    });

  const patch = (row: StageSubstatus, changes: Partial<StageSubstatus>) =>
    run(async () => {
      await saveSubstatus({ ...row, ...changes });
    });

  const move = (index: number, dir: -1 | 1) =>
    run(async () => {
      const next = [...rows];
      const j = index + dir;
      if (j < 0 || j >= next.length) return;
      [next[index], next[j]] = [next[j], next[index]];
      const ids = next.map((r) => r.id);
      // Reordena na hora e reverte no cache se o banco recusar.
      reorderLocally(ids);
      try {
        await reorderSubstatuses(ids);
      } catch (e) {
        invalidate(pipelineId);
        throw e;
      }
    });

  const remove = (row: StageSubstatus) =>
    run(async () => {
      if (!(await confirmDialog(`Excluir substatus "${row.name}"?`))) return;
      await deleteSubstatus(row.id);
      toast.success("Substatus excluído");
    });

  const seed = () =>
    run(async () => {
      const names = suggestedSubstatuses(stageType);
      const existing = new Set(rows.map((r) => r.name.toLowerCase()));
      let position = rows.length;
      let created = 0;
      for (const name of names) {
        if (existing.has(name.toLowerCase())) continue;
        await saveSubstatus({
          pipeline_id: pipelineId,
          stage_value: stageValue,
          name,
          position: position++,
        });
        created++;
      }
      toast.success(created > 0 ? `${created} substatus sugeridos` : "Nada a sugerir");
    });

  return (
    <div className="rounded-md border bg-muted/20 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Substatus de “{stageLabel}”
        </Label>
        {canManage && (
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={seed} disabled={busy}>
              <Sparkles className="h-3 w-3 mr-1" /> Sugerir
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => add(`Novo substatus ${rows.length + 1}`)}
              disabled={busy}
            >
              <Plus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
          </div>
        )}
      </div>

      {q.isLoading && <p className="text-xs text-muted-foreground">Carregando substatus…</p>}
      {q.error && (
        <p className="text-xs text-destructive" role="alert">
          Erro ao carregar substatus. Recarregue a página.
        </p>
      )}
      {!q.isLoading && rows.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Nenhum substatus nesta etapa. Sem substatus, a etapa continua funcionando como hoje.
        </p>
      )}

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={row.id} className="grid gap-2 sm:grid-cols-12 items-end">
            <div className="sm:col-span-4 space-y-1">
              <Label className="text-[10px] text-muted-foreground">Nome</Label>
              <Input
                defaultValue={row.name}
                disabled={!canManage || busy}
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== row.name) void patch(row, { name });
                }}
              />
            </div>
            <div className="sm:col-span-3 space-y-1">
              <Label className="text-[10px] text-muted-foreground">Descrição</Label>
              <Input
                defaultValue={row.description ?? ""}
                disabled={!canManage || busy}
                onBlur={(e) => {
                  const description = e.target.value.trim() || null;
                  if (description !== (row.description ?? null)) void patch(row, { description });
                }}
              />
            </div>
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-[10px] text-muted-foreground">Cor</Label>
              <Input
                defaultValue={row.color ?? ""}
                placeholder="var(--…) ou #hex"
                disabled={!canManage || busy}
                onBlur={(e) => {
                  const color = e.target.value.trim() || null;
                  if (color !== (row.color ?? null)) void patch(row, { color });
                }}
              />
            </div>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                <Switch
                  checked={row.is_default}
                  disabled={!canManage || busy}
                  onCheckedChange={(v) => void patch(row, { is_default: v })}
                  aria-label={`Definir ${row.name} como padrão`}
                />
                Padrão
              </label>
              <label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
                <Switch
                  checked={row.is_active}
                  disabled={!canManage || busy}
                  onCheckedChange={(v) => void patch(row, { is_active: v })}
                  aria-label={`Ativar ${row.name}`}
                />
                Ativo
              </label>
              {!row.is_active && (
                <Badge variant="secondary" className="text-[10px]">
                  Inativo
                </Badge>
              )}
            </div>
            {canManage && (
              <div className="sm:col-span-1 flex justify-end gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Mover para cima"
                  onClick={() => void move(i, -1)}
                  disabled={i === 0 || busy}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Mover para baixo"
                  onClick={() => void move(i, 1)}
                  disabled={i === rows.length - 1 || busy}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Excluir substatus"
                  onClick={() => void remove(row)}
                  disabled={busy}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
