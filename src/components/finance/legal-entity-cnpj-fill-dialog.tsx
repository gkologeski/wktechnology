// Assistente para preencher os CNPJs das empresas do workspace e reprocessar,
// na mesma ação, os contratos cujo papel (Prestação/Compra) ficou divergente.
// Componente de apresentação: consome apenas server functions.
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Building2, RefreshCw, Wand2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCnpj, isValidCnpj, onlyDigits } from "@/lib/cnpj";
import {
  fillLegalEntityCnpjsAndRecalc,
  suggestLegalEntityCnpjs,
  type LegalEntityCnpjSuggestion,
} from "@/lib/legal-entities.functions";

export function LegalEntityCnpjFillDialog({
  onOpenChange,
  onApplied,
}: {
  onOpenChange: (open: boolean) => void;
  onApplied?: () => void;
}) {
  const suggest = useServerFn(suggestLegalEntityCnpjs);
  const fill = useServerFn(fillLegalEntityCnpjsAndRecalc);
  const qc = useQueryClient();

  const [values, setValues] = useState<Record<string, string>>({});
  const [retitle, setRetitle] = useState(true);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["legal-entities", "cnpj-suggestions"],
    queryFn: () => suggest() as Promise<LegalEntityCnpjSuggestion[]>,
  });

  const rows = data ?? [];

  // Semeia os campos com o CNPJ já gravado quando a lista carrega.
  useEffect(() => {
    if (!data) return;
    setValues((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const seed: Record<string, string> = {};
      data.forEach((r) => {
        seed[r.id] = formatCnpj(r.cnpj);
      });
      return seed;
    });
  }, [data]);

  const invalid = useMemo(
    () =>
      rows.filter((r) => {
        const digits = onlyDigits(values[r.id]);
        return digits.length > 0 && !isValidCnpj(digits);
      }),
    [rows, values],
  );

  const duplicated = useMemo(() => {
    const seen = new Map<string, number>();
    rows.forEach((r) => {
      const digits = onlyDigits(values[r.id]);
      if (digits.length === 14) seen.set(digits, (seen.get(digits) ?? 0) + 1);
    });
    return new Set(
      Array.from(seen.entries())
        .filter(([, n]) => n > 1)
        .map(([d]) => d),
    );
  }, [rows, values]);

  const changed = useMemo(
    () => rows.filter((r) => onlyDigits(values[r.id]) !== onlyDigits(r.cnpj)),
    [rows, values],
  );

  const withSuggestion = rows.filter((r) => r.suggested_cnpj);

  function applyAllSuggestions() {
    setValues((prev) => {
      const next = { ...prev };
      rows.forEach((r) => {
        if (r.suggested_cnpj && onlyDigits(next[r.id]).length !== 14) {
          next[r.id] = formatCnpj(r.suggested_cnpj);
        }
      });
      return next;
    });
  }

  const apply = useMutation({
    mutationFn: () =>
      fill({
        data: {
          entities: rows.map((r) => ({ id: r.id, cnpj: onlyDigits(values[r.id]) })),
          retitle,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        `${res.entities_updated} empresa(s) atualizada(s) · ${res.contracts_updated} contrato(s) corrigido(s)` +
          (res.contracts_retitled ? ` · ${res.contracts_retitled} título(s) padronizado(s)` : ""),
      );
      void qc.invalidateQueries({ queryKey: ["legal-entities"] });
      void qc.invalidateQueries({ queryKey: ["contracts"] });
      void qc.invalidateQueries({ queryKey: ["contract-roles-diagnosis"] });
      void qc.invalidateQueries({ queryKey: ["contracts-pending-link"] });
      onApplied?.();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const blocked = invalid.length > 0 || duplicated.size > 0 || changed.length === 0;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Preencher CNPJs das empresas</DialogTitle>
          <DialogDescription>
            O CNPJ das suas empresas é o que define se um contrato é de Prestação (somos a
            CONTRATADA) ou de Compra (somos a CONTRATANTE). Ao salvar, os contratos com papel
            divergente são corrigidos automaticamente.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="font-medium text-destructive">Não foi possível carregar as empresas.</p>
            <p className="mt-1 text-muted-foreground">
              {error instanceof Error ? error.message : "Erro desconhecido"}
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Nenhuma empresa cadastrada</p>
            <p className="text-sm text-muted-foreground">
              Cadastre as empresas do workspace para informar os CNPJs.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {withSuggestion.length} de {rows.length} empresa(s) com CNPJ sugerido pelos
                contratos já importados.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={applyAllSuggestions}
                disabled={withSuggestion.length === 0}
              >
                <Wand2 className="mr-2 h-4 w-4" /> Preencher todos os sugeridos
              </Button>
            </div>

            <ScrollArea className="max-h-[46vh] pr-3">
              <div className="space-y-3">
                {rows.map((r) => {
                  const value = values[r.id] ?? "";
                  const digits = onlyDigits(value);
                  const isInvalid = digits.length > 0 && !isValidCnpj(digits);
                  const isDuplicated = digits.length === 14 && duplicated.has(digits);
                  return (
                    <div
                      key={r.id}
                      className="rounded-lg border border-border bg-card p-3 sm:flex sm:items-center sm:justify-between sm:gap-4"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{r.name}</span>
                          {r.code ? (
                            <Badge variant="secondary" className="shrink-0">
                              {r.code}
                            </Badge>
                          ) : null}
                        </div>
                        {r.suggested_cnpj ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Sugerido em {r.occurrences} contrato(s) como “{r.suggested_from_name}”
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Sem sugestão nos contratos — informe manualmente
                          </p>
                        )}
                      </div>

                      <div className="mt-2 flex items-center gap-2 sm:mt-0">
                        <Label htmlFor={`cnpj-${r.id}`} className="sr-only">
                          CNPJ de {r.name}
                        </Label>
                        <Input
                          id={`cnpj-${r.id}`}
                          inputMode="numeric"
                          placeholder="00.000.000/0000-00"
                          className="w-48 font-mono"
                          aria-invalid={isInvalid || isDuplicated}
                          value={value}
                          onChange={(e) =>
                            setValues((prev) => ({ ...prev, [r.id]: formatCnpj(e.target.value) }))
                          }
                        />
                        {r.suggested_cnpj ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setValues((prev) => ({
                                ...prev,
                                [r.id]: formatCnpj(r.suggested_cnpj),
                              }))
                            }
                          >
                            Usar
                          </Button>
                        ) : null}
                      </div>

                      {isInvalid || isDuplicated ? (
                        <p className="mt-2 flex items-center gap-1 text-xs text-destructive sm:mt-0 sm:basis-full">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {isInvalid ? "CNPJ inválido" : "CNPJ repetido em outra empresa"}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={retitle} onCheckedChange={(v) => setRetitle(v === true)} />
              Regravar os títulos dos contratos corrigidos no padrão CONTRATANTE X CONTRATADA
            </label>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => apply.mutate()} disabled={blocked || apply.isPending}>
            {apply.isPending ? "Salvando e reprocessando..." : "Salvar e reprocessar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
