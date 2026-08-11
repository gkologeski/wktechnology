// Padronização em lote dos títulos de contrato, com prévia antes/depois e confirmação.
// Componente de apresentação: consome apenas a server function de padronização,
// que continua validando permissão, escopo e workspace no backend.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Type } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { standardizeContractTitlesByStatus } from "@/lib/contracts.functions";

type Change = { id: string; before: string; after: string };
type Unchanged = { id: string; title: string };
type Skipped = { id: string; title: string; reason: string };

const SKIP_REASON_LABEL: Record<string, string> = {
  missing_parties: "Faltam as partes do contrato (CONTRATANTE/CONTRATADA)",
  same_parties: "CONTRATANTE e CONTRATADA ficaram iguais — revise o papel e as partes",
};


const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "active", label: "Ativo" },
  { value: "renewing", label: "Renovando" },
  { value: "awaiting_signature", label: "Aguard. assinatura" },
  { value: "in_negotiation", label: "Em negociação" },
  { value: "in_review", label: "Em revisão" },
  { value: "draft", label: "Rascunho" },
  { value: "ended", label: "Encerrado" },
  { value: "terminated", label: "Rescindido" },
];

export function ContractTitlesStandardizeDialog({
  onOpenChange,
  onApplied,
}: {
  onOpenChange: (open: boolean) => void;
  onApplied?: () => void;
}) {
  const run = useServerFn(standardizeContractTitlesByStatus);
  const qc = useQueryClient();

  const [statuses, setStatuses] = useState<string[]>(["active"]);
  const [selected, setSelected] = useState<Set<string> | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["contract-titles-standardize", statuses],
    queryFn: () =>
      run({ data: { statuses: statuses as never, preview: true } }) as Promise<{
        scanned: number;
        changes: Change[];
      }>,
  });

  const changes = data?.changes ?? [];
  const ids = useMemo(() => selected ?? new Set(changes.map((c) => c.id)), [selected, changes]);

  const toggle = (id: string) => {
    const next = new Set(ids);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleStatus = (value: string) => {
    setSelected(null);
    setStatuses((prev) =>
      prev.includes(value)
        ? prev.length > 1
          ? prev.filter((s) => s !== value)
          : prev
        : [...prev, value],
    );
  };

  const apply = useMutation({
    mutationFn: () =>
      run({ data: { statuses: statuses as never, ids: Array.from(ids) } }) as Promise<{
        changes: Change[];
      }>,
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["contracts"] });
      await qc.invalidateQueries({ queryKey: ["contract-titles-standardize"] });
      toast.success(`${res.changes.length} título(s) padronizado(s).`);
      onApplied?.();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Type className="h-4 w-4" aria-hidden="true" />
            Padronizar títulos em lote
          </DialogTitle>
          <DialogDescription>
            Aplica o padrão{" "}
            <span className="font-medium">[PRESTAÇÃO] / [COMPRA] / [ADITIVO N]</span> com
            CONTRATANTE X CONTRATADA e o ano da vigência. Revise a prévia abaixo — nada é gravado
            sem sua confirmação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-muted-foreground">
              Status considerados
            </legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {STATUS_OPTIONS.map((s) => (
                <label key={s.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={statuses.includes(s.value)}
                    onCheckedChange={() => toggleStatus(s.value)}
                    aria-label={`Considerar status ${s.label}`}
                  />
                  {s.label}
                </label>
              ))}
            </div>
          </fieldset>

          {isLoading || isFetching ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/60" />
              ))}
            </div>
          ) : isError ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Não foi possível gerar a prévia: {(error as Error)?.message}</p>
              <Button size="sm" variant="outline" onClick={() => void refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : changes.length === 0 ? (
            <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
              Nenhum título precisa de ajuste nos status selecionados
              {data ? ` (${data.scanned} contrato(s) analisado(s))` : ""}.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {data?.scanned ?? 0} analisado(s) · {changes.length} com alteração
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelected(new Set(changes.map((c) => c.id)))}
                  >
                    Selecionar todos
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                    Limpar
                  </Button>
                </div>
              </div>

              <ScrollArea className="max-h-[45vh] rounded-lg border">
                <ul className="divide-y">
                  {changes.map((c) => (
                    <li key={c.id} className="flex items-start gap-3 p-3">
                      <Checkbox
                        checked={ids.has(c.id)}
                        onCheckedChange={() => toggle(c.id)}
                        aria-label={`Selecionar ${c.before || c.after}`}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">
                            Antes
                          </Badge>
                          <span className="truncate line-through">{c.before || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="secondary" className="text-[10px]">
                            Depois
                          </Badge>
                          <span className="truncate font-medium">{c.after}</span>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => apply.mutate()}
            disabled={apply.isPending || ids.size === 0 || changes.length === 0}
          >
            {apply.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Type className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Padronizar {ids.size} título(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
