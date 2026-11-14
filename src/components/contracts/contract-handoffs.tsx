import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  getContractHandoffs,
  retryContractHandoff,
  reconcileContractHandoffs,
} from "@/lib/contracts/handoffs.functions";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { readViewAs } from "@/lib/view-as-client";
import { formatDateTime } from "@/lib/crm";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
const status = {
  queued: "Aguardando processamento",
  pending: "Pendente",
  blocked: "Impedimento",
  done: "Concluído",
  canceled: "Cancelado",
};
export function ContractHandoffs({ dealId, contractId }: { dealId?: string; contractId?: string }) {
  const p = usePermissions(),
    load = useServerFn(getContractHandoffs),
    retry = useServerFn(retryContractHandoff),
    reconcile = useServerFn(reconcileContractHandoffs),
    qclient = useQueryClient();
  const canManage =
    p.can("techcontracts.handoffs.manage.workspace") &&
    !readViewAs()?.readOnly &&
    readViewAs()?.mode !== "role";
  const q = useQuery({
    queryKey: ["contract-handoffs", p.workspaceId, dealId, contractId],
    queryFn: () => load({ data: { dealId, contractId } }),
    enabled: !!p.workspaceId && !p.isLoading && !p.isError,
    refetchInterval: 30000,
    retry: false,
  });
  const mutation = useMutation({
    mutationFn: async (id: string | null) => {
      if (id) await retry({ data: { id } });
      else if (dealId) await reconcile({ data: { dealId } });
    },
    onSuccess: async () => {
      toast.success("Verificação solicitada. O processamento ocorre em até dois minutos.");
      await qclient.invalidateQueries({ queryKey: ["contract-handoffs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section
      aria-label="Encaminhamentos da contratação"
      className="space-y-3 rounded-md border bg-card p-3 text-sm"
    >
      <p className="font-semibold">Próximas ações</p>
      {q.isLoading ? (
        <p role="status">Conferindo encaminhamentos…</p>
      ) : q.isError ? (
        <div role="alert">
          Não foi possível carregar as próximas ações.{" "}
          <Button size="sm" variant="link" onClick={() => q.refetch()}>
            Tentar novamente
          </Button>
        </div>
      ) : !q.data?.length ? (
        <p className="text-muted-foreground">Nenhum encaminhamento registrado para esta origem.</p>
      ) : (
        <ul className="space-y-3">
          {q.data.map((h) => (
            <li key={h.id} className="space-y-1 border-t pt-2">
              <p className="font-medium">{h.subject}</p>
              <p>
                {status[h.status]}
                {h.status === "pending" && new Date(h.due_at) < new Date()
                  ? " · Prazo vencido"
                  : ""}
              </p>
              <p className="text-muted-foreground">
                Responsável: {h.assignee_name ?? "Será confirmado no processamento"}
              </p>
              <p className="text-xs text-muted-foreground">Prazo: {formatDateTime(h.due_at)}</p>
              {h.blocked_reason && (
                <p role="note" className="text-destructive">
                  {h.blocked_reason}
                </p>
              )}
              <Link to={h.href} className="underline">
                Abrir origem
              </Link>
              {canManage && h.status === "blocked" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate(h.id)}
                >
                  Reprocessar etapa
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && dealId && (
        <Button
          size="sm"
          variant="outline"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(null)}
        >
          Gerar pendências
        </Button>
      )}
    </section>
  );
}
