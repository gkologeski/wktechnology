// Painel de revisão das associações de contratos sugeridas pela IA.
// A IA apenas propõe: o vínculo só é gravado ao aplicar a seleção.
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Link2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import {
  suggestContractLinks,
  type SuggestLinksResult,
  type SuggestedLinkRow,
} from "@/lib/contracts/link-suggest.functions";
import { CONFIDENCE_LABEL, type LinkConfidence } from "@/lib/contracts/link-suggest";
import { linkContractAmendment, linkContractParent } from "@/lib/contracts.functions";

const CONFIDENCE_VARIANT: Record<LinkConfidence, "default" | "secondary" | "outline"> = {
  high: "default",
  medium: "secondary",
  low: "outline",
};

const ROLE_LABEL: Record<string, string> = { provider: "Prestação", client: "Compra" };

export function AiLinkSuggestionsDialog({
  role,
  onOpenChange,
  onApplied,
}: {
  role: "all" | "provider" | "client" | "amendment";
  onOpenChange: (open: boolean) => void;
  onApplied: () => void;
}) {
  const suggestFn = useServerFn(suggestContractLinks);
  const linkParentFn = useServerFn(linkContractParent);
  const linkAmendmentFn = useServerFn(linkContractAmendment);

  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["contracts-ai-link-suggestions", role],
    queryFn: () => suggestFn({ data: { role } }) as Promise<SuggestLinksResult>,
    staleTime: 0,
    retry: false,
  });

  const suggestions = useMemo(() => data?.suggestions ?? [], [data]);

  useEffect(() => {
    // Pré-seleciona apenas as sugestões de alta confiança.
    setSelected(
      Object.fromEntries(suggestions.map((s) => [s.pending_id, s.confidence === "high"])),
    );
  }, [suggestions]);

  const selectedRows = suggestions.filter((s) => selected[s.pending_id]);

  const apply = useMutation({
    mutationFn: async (rows: SuggestedLinkRow[]) => {
      let ok = 0;
      const failures: string[] = [];
      for (const row of rows) {
        try {
          if (row.kind === "amendment") {
            await linkAmendmentFn({
              data: { amendmentId: row.pending_id, mainContractId: row.target_id },
            });
          } else {
            const childId = row.pending.role === "client" ? row.pending_id : row.target_id;
            const parentId = row.pending.role === "client" ? row.target_id : row.pending_id;
            await linkParentFn({ data: { childId, parentId } });
          }
          ok += 1;
        } catch (e) {
          failures.push(`${row.pending.number ?? row.pending.title}: ${(e as Error).message}`);
        }
      }
      return { ok, failures };
    },
    onSuccess: ({ ok, failures }) => {
      if (ok > 0) toast.success(`${ok} vínculo(s) aplicado(s).`);
      if (failures.length) toast.error(`Falha em ${failures.length}: ${failures[0]}`);
      onApplied();
      void refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const highCount = suggestions.filter((s) => s.confidence === "high").length;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Associações sugeridas pela IA
          </DialogTitle>
          <DialogDescription>
            Revise as propostas antes de aplicar. Nada é gravado automaticamente.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2" aria-live="polite">
            <p className="text-sm text-muted-foreground">Analisando contratos…</p>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
            <p className="mt-2 text-sm font-medium">Não foi possível concluir a análise</p>
            <p className="text-xs text-muted-foreground">{(error as Error).message}</p>
            <Button className="mt-3" variant="outline" size="sm" onClick={() => void refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
            </Button>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center">
            <Link2 className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm font-medium">A IA não encontrou associações confiáveis</p>
            <p className="text-xs text-muted-foreground">
              {data?.analyzed ?? 0} contrato(s) analisado(s). Vincule manualmente pela fila.
            </p>
            {data?.notes?.length ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{data.notes[0]}</p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {suggestions.length} sugestão(ões) de {data?.analyzed ?? 0} pendência(s).
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={highCount === 0}
                  onClick={() =>
                    setSelected(
                      Object.fromEntries(
                        suggestions.map((s) => [s.pending_id, s.confidence === "high"]),
                      ),
                    )
                  }
                >
                  Selecionar alta confiança ({highCount})
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    setSelected(Object.fromEntries(suggestions.map((s) => [s.pending_id, false])))
                  }
                >
                  Limpar
                </Button>
              </div>
            </div>

            {data?.notes?.length ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">{data.notes[0]}</p>
            ) : null}

            <div className="rounded-lg border divide-y">
              {suggestions.map((s) => (
                <label
                  key={s.pending_id}
                  htmlFor={`sug-${s.pending_id}`}
                  className="flex cursor-pointer items-start gap-3 p-3 hover:bg-muted/40"
                >
                  <Checkbox
                    id={`sug-${s.pending_id}`}
                    checked={Boolean(selected[s.pending_id])}
                    onCheckedChange={(v) =>
                      setSelected((prev) => ({ ...prev, [s.pending_id]: Boolean(v) }))
                    }
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span className="truncate">
                        {s.pending.number ? `${s.pending.number} · ` : ""}
                        {s.pending.title}
                      </span>
                      <Badge variant="secondary">
                        {s.pending.document_kind === "amendment"
                          ? "Aditivo"
                          : (ROLE_LABEL[s.pending.role] ?? s.pending.role)}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.kind === "amendment" ? "Contrato principal: " : "Vincular com: "}
                      <span className="font-medium text-foreground">
                        {s.target.number ? `${s.target.number} · ` : ""}
                        {s.target.title}
                      </span>{" "}
                      ({ROLE_LABEL[s.target.role] ?? s.target.role})
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={CONFIDENCE_VARIANT[s.confidence]}>
                        Confiança {CONFIDENCE_LABEL[s.confidence]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {s.source === "rule" ? "Regra determinística" : "Análise por IA"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{s.reason}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={apply.isPending}>
            Fechar
          </Button>
          <Button
            variant="outline"
            onClick={() => void refetch()}
            disabled={isFetching || apply.isPending}
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Reanalisar
          </Button>
          <Button
            onClick={() => apply.mutate(selectedRows)}
            disabled={selectedRows.length === 0 || apply.isPending}
          >
            Aplicar selecionadas ({selectedRows.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
