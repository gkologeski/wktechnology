// Histórico das sugestões de vínculo geradas pela IA: o que foi proposto,
// se foi aplicado, ignorado ou reavaliado, e quando.
// Componente de apresentação: consome apenas a server function de leitura.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listContractLinkSuggestions,
  type SuggestionHistoryRow,
} from "@/lib/contracts/link-suggest.functions";
import { CONFIDENCE_LABEL, SUGGESTION_STATUS_LABEL } from "@/lib/contracts/link-suggest";
import { formatDateTime } from "@/lib/crm";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  proposed: "secondary",
  applied: "default",
  dismissed: "outline",
  superseded: "outline",
};

const STATUS_OPTIONS = ["all", "proposed", "applied", "dismissed", "superseded"] as const;
type StatusFilter = (typeof STATUS_OPTIONS)[number];

function contractLabel(c: { number: string | null; title: string }) {
  return c.number ? `${c.number} · ${c.title}` : c.title;
}

export function AiLinkSuggestionsHistoryCard({ contractId }: { contractId?: string }) {
  const listFn = useServerFn(listContractLinkSuggestions);
  const [status, setStatus] = useState<StatusFilter>("all");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["contract-ai-suggestion-history", contractId ?? "all", status],
    queryFn: () =>
      listFn({
        data: {
          ...(contractId ? { contractId } : {}),
          ...(status === "all" ? {} : { status }),
          limit: 50,
        },
      }) as Promise<SuggestionHistoryRow[]>,
  });

  const rows = data ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
              Histórico de sugestões da IA
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              O que a IA propôs, se foi aplicado ou ignorado e quando a proposta foi reavaliada.
            </p>
          </div>
          <div className="w-[190px]">
            <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
              <SelectTrigger aria-label="Filtrar por situação">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situações</SelectItem>
                {STATUS_OPTIONS.filter((s) => s !== "all").map((s) => (
                  <SelectItem key={s} value={s}>
                    {SUGGESTION_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Não foi possível carregar o histórico: {(error as Error)?.message}</p>
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
            Nenhuma sugestão registrada ainda. Use “Analisar com IA” na fila de vinculação.
          </div>
        ) : (
          <ol className="divide-y rounded-lg border">
            {rows.map((row) => (
              <li key={row.id} className="space-y-1 px-3 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_VARIANT[row.status] ?? "secondary"}>
                    {SUGGESTION_STATUS_LABEL[row.status] ?? row.status}
                  </Badge>
                  <Badge variant="outline">Confiança {CONFIDENCE_LABEL[row.confidence]}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {row.source === "rule" ? "Regra determinística" : "Análise por IA"}
                  </span>
                </div>
                <div className="text-sm">
                  <Link
                    to="/contracts/$id"
                    params={{ id: row.pending.id }}
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {contractLabel(row.pending)}
                  </Link>
                  <span className="text-muted-foreground">
                    {row.kind === "amendment" ? " → aditivo de " : " → vincular com "}
                  </span>
                  <Link
                    to="/contracts/$id"
                    params={{ id: row.target.id }}
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {contractLabel(row.target)}
                  </Link>
                </div>
                {row.reason ? <p className="text-xs text-muted-foreground">{row.reason}</p> : null}
                <div className="text-[11px] text-muted-foreground">
                  Proposta em {formatDateTime(row.created_at)}
                  {row.decided_at
                    ? ` · decidida em ${formatDateTime(row.decided_at)}${
                        row.decided_by_name ? ` por ${row.decided_by_name}` : ""
                      }`
                    : ""}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
