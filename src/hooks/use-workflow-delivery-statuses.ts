import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWorkflowDeliveryStatuses } from "@/lib/workflow-delivery.functions";

/** Status atual (avisos da Meta) dos envios de WhatsApp de uma execução aberta. */
export function useWorkflowDeliveryStatuses(ids: string[]) {
  const fn = useServerFn(getWorkflowDeliveryStatuses);
  const key = [...ids].sort();
  return useQuery({
    queryKey: ["wf-delivery-status", key],
    queryFn: () => fn({ data: { ids: key } }),
    enabled: key.length > 0,
    staleTime: 30_000,
  });
}
