// Revisão em lote do tipo de documento: contratos gravados como Principal que
// aparentam ser TERMO ADITIVO. Componente de apresentação — consome apenas as
// server functions de diagnóstico/aplicação, que validam permissão e workspace.
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileDiff, Loader2 } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  applyContractDocKinds,
  diagnoseContractDocKinds,
  type DocKindDiagnosis,
} from "@/lib/contracts/doc-kind.functions";

const ROLE_LABEL: Record<string, string> = {
  provider: "Prestação (somos a CONTRATADA)",
  client: "Compra (somos a CONTRATANTE)",
};

type Choice = { parentId: string; number: string };

export function ContractDocKindReviewDialog({
  onOpenChange,
  onApplied,
}: {
  onOpenChange: (open: boolean) => void;
  onApplied?: () => void;
}) {
  const diagnose = useServerFn(diagnoseContractDocKinds);
  const apply = useServerFn(applyContractDocKinds);
  const qc = useQueryClient();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [choices, setChoices] = useState<Record<string, Choice>>({});

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["contract-doc-kind-diagnosis"],
    queryFn: () => diagnose() as Promise<DocKindDiagnosis>,
  });

  const suspects = data?.suspects ?? [];

  const choiceFor = (id: string): Choice => {
    const s = suspects.find((x) => x.id === id);
    return (
      choices[id] ?? {
        parentId: s?.suggested_parent?.id ?? "",
        number: s?.amendment_number ?? "",
      }
    );
  };

  const ready = useMemo(
    () => Array.from(selected).filter((id) => choiceFor(id).parentId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, choices, suspects],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const mutation = useMutation({
    mutationFn: () =>
      apply({
        data: {
          items: ready.map((id) => {
            const c = choiceFor(id);
            return {
              id,
              mainContractId: c.parentId,
              amendmentNumber: c.number.trim() || null,
            };
          }),
        },
      }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["contracts"] });
      await qc.invalidateQueries({ queryKey: ["contract-doc-kind-diagnosis"] });
      await qc.invalidateQueries({ queryKey: ["contracts-pending-link"] });
      toast.success(
        `${res.updated} contrato(s) convertido(s) em aditivo${res.retitled ? ` · ${res.retitled} título(s) padronizado(s)` : ""}.`,
      );
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
            <FileDiff className="h-4 w-4" aria-hidden="true" />
            Revisar tipo de documento
          </DialogTitle>
          <DialogDescription>
            Contratos gravados como <span className="font-medium">Principal</span> que aparentam
            ser <span className="font-medium">termo aditivo</span>. Escolha o contrato principal de
            cada um — nada é gravado sem sua confirmação.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted/60" />
            ))}
          </div>
        ) : isError ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Não foi possível gerar o diagnóstico: {(error as Error)?.message}</p>
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : suspects.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            Nenhum contrato com sinais de aditivo foi encontrado
            {data ? ` (${data.total} analisado(s), ${data.amendments} já marcado(s) como aditivo)` : ""}
            .
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {data?.total ?? 0} analisado(s) · {suspects.length} suspeito(s) ·{" "}
                {ready.length} pronto(s) para aplicar
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelected(new Set(suspects.map((s) => s.id)))}
                >
                  Selecionar todos
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  Limpar
                </Button>
              </div>
            </div>

            <ScrollArea className="max-h-[50vh] rounded-lg border">
              <ul className="divide-y">
                {suspects.map((s) => {
                  const c = choiceFor(s.id);
                  return (
                    <li key={s.id} className="flex items-start gap-3 p-3">
                      <Checkbox
                        checked={selected.has(s.id)}
                        onCheckedChange={() => toggle(s.id)}
                        aria-label={`Selecionar ${s.title || s.number || s.id}`}
                        className="mt-1"
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium">{s.title || "—"}</span>
                          {s.number ? (
                            <Badge variant="outline" className="text-[10px]">
                              {s.number}
                            </Badge>
                          ) : null}
                          <Badge variant="secondary" className="text-[10px]">
                            {ROLE_LABEL[s.role] ?? s.role}
                          </Badge>
                        </div>
                        <ul className="space-y-0.5 text-xs text-muted-foreground">
                          {s.reasons.map((r, i) => (
                            <li key={i}>• {r}</li>
                          ))}
                        </ul>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="min-w-[16rem] flex-1">
                            <Select
                              value={c.parentId}
                              onValueChange={(value) =>
                                setChoices((prev) => ({ ...prev, [s.id]: { ...c, parentId: value } }))
                              }
                            >
                              <SelectTrigger aria-label="Contrato principal">
                                <SelectValue
                                  placeholder={
                                    s.candidates.length
                                      ? "Escolha o contrato principal"
                                      : "Nenhum candidato — vincule manualmente"
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {s.candidates.map((cand) => (
                                  <SelectItem key={cand.id} value={cand.id}>
                                    {cand.number ? `${cand.number} · ` : ""}
                                    {cand.title || cand.id}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Input
                            className="w-28"
                            placeholder="Nº aditivo"
                            aria-label="Número do aditivo"
                            value={c.number}
                            onChange={(e) =>
                              setChoices((prev) => ({
                                ...prev,
                                [s.id]: { ...c, number: e.target.value },
                              }))
                            }
                          />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || ready.length === 0}
          >
            {mutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileDiff className="mr-2 h-4 w-4" aria-hidden="true" />
            )}
            Converter {ready.length} em aditivo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
