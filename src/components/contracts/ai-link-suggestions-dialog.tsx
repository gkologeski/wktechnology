// Painel de revisão das associações de contratos sugeridas pela IA.
// A IA apenas propõe: o vínculo só é gravado ao aplicar a seleção.
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ChevronDown, Link2, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  decideContractLinkSuggestion,
  suggestContractLinks,
  type SuggestLinksResult,
  type SuggestedLinkRow,
} from "@/lib/contracts/link-suggest.functions";
import {
  CONFIDENCE_LABEL,
  ROLE_INFERRED_LABEL,
  type LinkConfidence,
  type LinkEvidenceSide,
} from "@/lib/contracts/link-suggest";

import { linkContractAmendment, linkContractParent } from "@/lib/contracts.functions";
import { formatDate } from "@/lib/crm";

const CONFIDENCE_VARIANT: Record<LinkConfidence, "default" | "secondary" | "outline"> = {
  high: "default",
  medium: "secondary",
  low: "outline",
};

const ROLE_LABEL: Record<string, string> = { provider: "Prestação", client: "Compra" };

function formatCnpj(value: string | null): string {
  const d = (value ?? "").replace(/\D/g, "");
  if (d.length !== 14) return value ?? "—";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function EvidenceSide({ title, side }: { title: string; side: LinkEvidenceSide }) {
  return (
    <div className="space-y-1 rounded-md border bg-muted/30 p-2">
      <p className="text-xs font-medium text-foreground">{title}</p>
      <p className="text-[11px] text-muted-foreground">Papel gravado: {side.role_label}</p>
      {side.role_inferred ? (
        <p
          className={
            side.role_conflict
              ? "text-[11px] font-medium text-amber-700 dark:text-amber-400"
              : "text-[11px] text-muted-foreground"
          }
        >
          Papel pelos CNPJs: {ROLE_INFERRED_LABEL[side.role_inferred]}
          {side.role_conflict ? " — divergente do papel gravado" : ""}
        </p>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        CONTRATANTE: {side.contracting_name ?? "não identificada"} ·{" "}
        {formatCnpj(side.contracting_cnpj)}
        {side.contracting_is_ours ? " (nossa empresa)" : ""}
      </p>
      <p className="text-[11px] text-muted-foreground">
        CONTRATADA: {side.counterparty_name ?? "não identificada"} ·{" "}
        {formatCnpj(side.counterparty_cnpj)}
        {side.counterparty_is_ours ? " (nossa empresa)" : ""}
      </p>
      <p className="text-[11px] text-muted-foreground">
        Vigência: {side.starts_at ? formatDate(side.starts_at) : "—"} até{" "}
        {side.ends_at ? formatDate(side.ends_at) : "indeterminada"}
      </p>
    </div>
  );
}

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
  const decideFn = useServerFn(decideContractLinkSuggestion);
  const qc = useQueryClient();

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["contracts-ai-link-suggestions", role],
    queryFn: () => suggestFn({ data: { role } }) as Promise<SuggestLinksResult>,
    staleTime: 0,
    retry: false,
  });

  const suggestions = useMemo(
    () => (data?.suggestions ?? []).filter((s) => !hidden[s.pending_id]),
    [data, hidden],
  );

  useEffect(() => {
    // Pré-seleciona apenas as sugestões de alta confiança.
    setSelected(
      Object.fromEntries(
        (data?.suggestions ?? []).map((s) => [s.pending_id, s.confidence === "high"]),
      ),
    );
    setHidden({});
  }, [data]);

  const invalidateHistory = () =>
    void qc.invalidateQueries({ queryKey: ["contract-ai-suggestion-history"] });

  const selectedRows = suggestions.filter((s) => selected[s.pending_id]);

  const apply = useMutation({
    mutationFn: async (rows: SuggestedLinkRow[]) => {
      let ok = 0;
      const failures: string[] = [];
      for (const row of rows) {
        const origin = {
          suggestion_id: row.id,
          confidence: row.confidence,
          reason: row.reason,
          source: row.source,
        };
        try {
          if (row.kind === "amendment") {
            await linkAmendmentFn({
              data: { amendmentId: row.pending_id, mainContractId: row.target_id, origin },
            });
          } else {
            const childId = row.pending.role === "client" ? row.pending_id : row.target_id;
            const parentId = row.pending.role === "client" ? row.target_id : row.pending_id;
            await linkParentFn({ data: { childId, parentId, origin } });
          }
          if (row.id) await decideFn({ data: { id: row.id, status: "applied" } });
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
      invalidateHistory();
      onApplied();
      void refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dismiss = useMutation({
    mutationFn: async (row: SuggestedLinkRow) => {
      if (row.id) await decideFn({ data: { id: row.id, status: "dismissed" } });
      return row.pending_id;
    },
    onSuccess: (pendingId) => {
      setHidden((prev) => ({ ...prev, [pendingId]: true }));
      toast.success("Sugestão ignorada e registrada no histórico.");
      invalidateHistory();
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
            Revise os motivos e as evidências antes de aplicar. Nada é gravado automaticamente.
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
            <p className="mt-2 text-sm font-medium">Nenhuma associação para revisar</p>
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

            {data?.role_conflicts?.length ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  Contratos com papel divergente dos CNPJs extraídos
                </p>
                <ul className="mt-2 space-y-1">
                  {data.role_conflicts.map((c) => (
                    <li key={c.id} className="text-[11px] text-muted-foreground">
                      <Link
                        to="/contracts/$id"
                        params={{ id: c.id }}
                        className="font-medium text-primary underline-offset-2 hover:underline focus-visible:underline"
                      >
                        {c.number ? `${c.number} · ` : ""}
                        {c.title}
                      </Link>{" "}
                      — gravado como {ROLE_LABEL[c.stored_role] ?? c.stored_role}, os CNPJs indicam{" "}
                      {ROLE_LABEL[c.inferred_role]}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Nada é corrigido automaticamente: ajuste o papel no contrato quando necessário.
                </p>
              </div>
            ) : null}

            <div className="rounded-lg border divide-y">
              {suggestions.map((s) => (
                <div key={s.pending_id} className="flex items-start gap-3 p-3">
                  <Checkbox
                    id={`sug-${s.pending_id}`}
                    checked={Boolean(selected[s.pending_id])}
                    onCheckedChange={(v) =>
                      setSelected((prev) => ({ ...prev, [s.pending_id]: Boolean(v) }))
                    }
                    className="mt-1"
                    aria-label="Selecionar sugestão"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <label
                      htmlFor={`sug-${s.pending_id}`}
                      className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium"
                    >
                      <span className="truncate">
                        {s.pending.number ? `${s.pending.number} · ` : ""}
                        {s.pending.title}
                      </span>
                      <Badge variant="secondary">
                        {s.pending.document_kind === "amendment"
                          ? "Aditivo"
                          : (ROLE_LABEL[s.pending.role] ?? s.pending.role)}
                      </Badge>
                    </label>
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
                      {s.evidence?.role_conflict ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500/60 text-amber-700 dark:text-amber-400"
                        >
                          <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />
                          Papel divergente — revisar
                        </Badge>
                      ) : null}
                    </div>
                    {s.evidence?.role_conflict ? (
                      <Link
                        to="/contracts/$id"
                        params={{ id: s.pending_id }}
                        className="text-xs font-medium text-primary underline-offset-2 hover:underline focus-visible:underline"
                      >
                        Abrir contrato para corrigir Papel/Tipo de documento
                      </Link>
                    ) : null}

                    <p className="text-xs text-muted-foreground">{s.reason}</p>

                    {s.evidence ? (
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-muted-foreground"
                          >
                            <ChevronDown className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                            Ver evidências
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2 space-y-2">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <EvidenceSide title="Contrato pendente" side={s.evidence.pending} />
                            <EvidenceSide title="Contrato sugerido" side={s.evidence.target} />
                          </div>
                          <ul className="space-y-1 text-[11px] text-muted-foreground">
                            {s.evidence.referenced_number ? (
                              <li>Número citado no documento: {s.evidence.referenced_number}</li>
                            ) : null}
                            <li>
                              Vigências:{" "}
                              {s.evidence.overlapping_period === null
                                ? "sem datas suficientes para comparar"
                                : s.evidence.overlapping_period
                                  ? "períodos compatíveis (há sobreposição)"
                                  : "períodos sem sobreposição"}
                            </li>
                          </ul>
                        </CollapsibleContent>
                      </Collapsible>
                    ) : null}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => dismiss.mutate(s)}
                    disabled={dismiss.isPending || apply.isPending}
                    aria-label="Ignorar sugestão"
                    title="Ignorar sugestão"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
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
