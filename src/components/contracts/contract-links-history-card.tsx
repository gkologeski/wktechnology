// Histórico de aninhamento/desaninhamento de contratos (compras e aditivos).
// Componente de apresentação: consome apenas a server function de leitura.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listContractLinkEvents } from "@/lib/contracts.functions";
import { formatDateTime } from "@/lib/crm";

const EVENT_LABEL: Record<string, string> = {
  parent_linked: "Contrato aninhado",
  parent_unlinked: "Contrato desaninhado",
  amendment_linked: "Aditivo vinculado",
  amendment_unlinked: "Aditivo desvinculado",
};

type EventRow = {
  id: string;
  event_type: string;
  created_at: string;
  actor_name: string;
  payload: {
    parent_title?: string | null;
    child_title?: string | null;
    parent_contract_id?: string | null;
    previous_parent_contract_id?: string | null;
    amendment_of_id?: string | null;
  };
};

function describe(row: EventRow): string {
  const child = row.payload.child_title ?? "contrato";
  const parent = row.payload.parent_title ?? "contrato principal";
  switch (row.event_type) {
    case "parent_linked":
      return `“${child}” foi aninhado sob “${parent}”.`;
    case "parent_unlinked":
      return `“${child}” foi desaninhado de “${parent}”.`;
    case "amendment_linked":
      return `“${child}” passou a ser aditivo de “${parent}”.`;
    case "amendment_unlinked":
      return `“${child}” deixou de ser aditivo de “${parent}”.`;
    default:
      return `${child} · ${parent}`;
  }
}

export function ContractLinksHistoryCard({ contractId }: { contractId: string }) {
  const list = useServerFn(listContractLinkEvents);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["contract-link-events", contractId],
    queryFn: () => list({ data: { contractId } }),
  });

  const rows = (data ?? []) as EventRow[];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-4 w-4" aria-hidden="true" />
          Histórico de vínculos
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Registro de quando contratos de compra e aditivos foram aninhados ou desaninhados, e por
          quem.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted/60" />
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
            Nenhuma alteração de vínculo registrada.
          </div>
        ) : (
          <ol className="divide-y rounded-lg border">
            {rows.map((row) => (
              <li key={row.id} className="px-3 py-2.5">
                <div className="text-sm font-medium text-foreground">
                  {EVENT_LABEL[row.event_type] ?? row.event_type}
                </div>
                <div className="text-xs text-muted-foreground">{describe(row)}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  {row.actor_name ? `${row.actor_name} · ` : ""}
                  {formatDateTime(row.created_at)}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
