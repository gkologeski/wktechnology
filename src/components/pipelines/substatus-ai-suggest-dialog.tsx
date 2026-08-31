// Revisão humana das sugestões de substatus geradas por IA.
// Nada é criado ou reordenado antes da confirmação do gestor.
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { suggestStageSubstatusesWithAi } from "@/lib/pipelines/substatus-ai.functions";
import type { SubstatusSuggestion } from "@/lib/pipelines/substatus-ai.server";

export type SubstatusAiProposalItem = SubstatusSuggestion & { selected: boolean };

type Props = {
  open: boolean;
  setOpen: (b: boolean) => void;
  pipelineId: string;
  stageValue: string;
  stageLabel: string;
  /** Aplica a proposta (criação + reordenação) na ordem recebida. */
  onApply: (items: SubstatusAiProposalItem[]) => Promise<void>;
};

export function SubstatusAiSuggestDialog({
  open,
  setOpen,
  pipelineId,
  stageValue,
  stageLabel,
  onApply,
}: Props) {
  const suggest = useServerFn(suggestStageSubstatusesWithAi);
  const [items, setItems] = useState<SubstatusAiProposalItem[]>([]);
  const [rationale, setRationale] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const run = useMutation({
    mutationFn: () => suggest({ data: { pipelineId, stageValue } }),
    onSuccess: (res) => {
      setItems(res.substatuses.map((s) => ({ ...s, selected: true })));
      setRationale(res.rationale);
    },
  });

  useEffect(() => {
    if (open) {
      setItems([]);
      setRationale(null);
      run.reset();
      run.mutate();
    }
    // Dispara uma única geração por abertura do diálogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pipelineId, stageValue]);

  const selected = items.filter((i) => i.selected);

  const apply = async () => {
    if (selected.length === 0) {
      toast.error("Selecione ao menos um substatus.");
      return;
    }
    setApplying(true);
    try {
      await onApply(items);
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao aplicar as sugestões.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Sugerir substatus com IA
          </DialogTitle>
          <DialogDescription>
            Proposta de substatus e ordem para a etapa “{stageLabel}”. Revise antes de aplicar —
            nada é gravado sem sua confirmação.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {run.isPending && (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
              <p className="text-xs text-muted-foreground">Gerando sugestões…</p>
            </div>
          )}

          {run.isError && (
            <div
              className="space-y-2 rounded-md border border-destructive/40 p-4 text-sm"
              role="alert"
            >
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                {run.error instanceof Error ? run.error.message : "Falha ao gerar sugestões."}
              </p>
              <Button variant="outline" size="sm" onClick={() => run.mutate()}>
                Tentar novamente
              </Button>
            </div>
          )}

          {!run.isPending && !run.isError && items.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma sugestão para esta etapa.
            </p>
          )}

          {items.map((item, index) => (
            <div
              key={`${item.name}-${index}`}
              className="flex items-start gap-3 rounded-md border p-3"
            >
              <Checkbox
                id={`ai-sub-${index}`}
                checked={item.selected}
                onCheckedChange={(v) =>
                  setItems((prev) =>
                    prev.map((it, i) => (i === index ? { ...it, selected: v === true } : it)),
                  )
                }
                aria-label={`Incluir ${item.name}`}
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {index + 1}º
                  </Badge>
                  {item.exists && (
                    <Badge variant="outline" className="text-[10px]">
                      Já existe
                    </Badge>
                  )}
                  {item.is_default && (
                    <Badge variant="outline" className="text-[10px]">
                      Padrão
                    </Badge>
                  )}
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor={`ai-sub-name-${index}`}
                    className="text-[10px] text-muted-foreground"
                  >
                    Nome
                  </Label>
                  <Input
                    id={`ai-sub-name-${index}`}
                    value={item.name}
                    onChange={(e) =>
                      setItems((prev) =>
                        prev.map((it, i) => (i === index ? { ...it, name: e.target.value } : it)),
                      )
                    }
                  />
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                )}
              </div>
            </div>
          ))}

          {rationale && <p className="text-xs text-muted-foreground">{rationale}</p>}
        </div>

        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {selected.length} de {items.length} selecionado(s)
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={applying}>
              Cancelar
            </Button>
            <Button onClick={apply} disabled={applying || run.isPending || selected.length === 0}>
              {applying ? "Aplicando…" : "Aplicar sugestões"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
