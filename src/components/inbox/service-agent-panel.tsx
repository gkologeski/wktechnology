import { usePermissions } from "@/lib/access-control/use-permissions";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getServiceInboxState,
  setServiceInboxOwner,
  verifyServiceInboxIdentity,
} from "@/lib/prospecting/sdr/service-inbox.functions";

export function ServiceAgentPanel({
  channel,
  sourceId,
}: {
  channel: "email" | "chat";
  sourceId: string;
}) {
  const permissions = usePermissions();
  const qc = useQueryClient();
  const [reviewed, setReviewed] = useState(false);
  const get = useServerFn(getServiceInboxState);
  const owner = useServerFn(setServiceInboxOwner);
  const verify = useServerFn(verifyServiceInboxIdentity);
  const data = { channel, source_id: sourceId };
  const key = ["service-agent-inbox", channel, sourceId];
  const query = useQuery({ queryKey: key, queryFn: () => get({ data }), refetchInterval: 15000 });
  const change = useMutation({
    mutationFn: (next: "ai" | "human") => owner({ data: { ...data, owner: next } }),
    onSuccess: () => {
      setReviewed(false);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const confirm = useMutation({
    mutationFn: () => verify({ data }),
    onSuccess: () => {
      toast.success("Identidade confirmada para este atendimento.");
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (query.isError)
    return (
      <div role="status" className="border-b px-4 py-2 text-xs text-muted-foreground">
        Não foi possível consultar o estado do agente.{" "}
        <Button variant="link" size="sm" onClick={() => void query.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  const state = query.data;
  if (!state?.active) return null;
  return (
    <section
      aria-label="Agente deste atendimento"
      className="shrink-0 space-y-2 border-b bg-product-panel px-4 py-2 text-xs"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">
          {state.agent_name} · {state.owner === "ai" ? "Agente atendendo" : "Atendimento humano"}
        </span>
        {state.can_control && (
          <Button
            variant="outline"
            size="sm"
            disabled={
              change.isPending || (state.owner !== "ai" && !!state.delivery_uncertain && !reviewed)
            }
            onClick={() => change.mutate(state.owner === "ai" ? "human" : "ai")}
          >
            {state.owner === "ai" ? "Assumir atendimento" : "Devolver ao agente"}
          </Button>
        )}
        <span className="text-muted-foreground">
          {state.context_approved
            ? "Identidade e contexto confirmados"
            : "Contexto privado do CRM bloqueado"}
        </span>
        {state.can_verify &&
          permissions.can("system.channels.approve.workspace") &&
          !state.context_approved && (
            <Button
              variant="outline"
              size="sm"
              disabled={confirm.isPending}
              title="Confirme apenas após verificar que a pessoa associada é quem está conversando."
              onClick={() => confirm.mutate()}
            >
              Confirmar identidade da pessoa associada
            </Button>
          )}
      </div>
      {state.delivery_uncertain && (
        <label className="flex items-start gap-2 text-amber-700">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(event) => setReviewed(event.target.checked)}
          />
          Conferi o histórico e o provedor antes de retomar. Há um envio sem confirmação; ele não
          será reenviado automaticamente.
        </label>
      )}
      {state.draft && (
        <details>
          <summary className="cursor-pointer font-medium">
            Resposta proposta · revisar antes de enviar
          </summary>
          <p className="mt-2 whitespace-pre-wrap">{state.draft}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void navigator.clipboard.writeText(state.draft!).then(
                () => toast.success("Rascunho copiado."),
                () => toast.error("Não foi possível copiar."),
              )
            }
          >
            Copiar rascunho
          </Button>
        </details>
      )}
    </section>
  );
}
