import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getRecordWhatsAppSuppressions,
  getWhatsAppSuppressionStats,
  releaseWhatsAppSuppression,
} from "@/lib/whatsapp/whatsapp-suppressions.functions";

const recordKey = (entity: "contact" | "lead", id: string) =>
  ["whatsapp-suppressions", entity, id] as const;

/** Bloqueios da Meta dos telefones de um Contato/Lead + se o usuário pode liberar. */
export function useRecordWhatsAppSuppressions(entity: "contact" | "lead", id: string) {
  const load = useServerFn(getRecordWhatsAppSuppressions);
  return useQuery({
    queryKey: recordKey(entity, id),
    queryFn: () => load({ data: { entity, id } }),
    staleTime: 60_000,
  });
}

export function useReleaseWhatsAppSuppression(entity: "contact" | "lead", id: string) {
  const release = useServerFn(releaseWhatsAppSuppression);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (suppressionId: string) => release({ data: { id: suppressionId } }),
    onSettled: () => qc.invalidateQueries({ queryKey: recordKey(entity, id) }),
  });
}

/** Totais de números bloqueados no workspace (sem telefones), para avisos de planejamento. */
export function useWhatsAppSuppressionStats(workspaceId: string | null | undefined) {
  const load = useServerFn(getWhatsAppSuppressionStats);
  return useQuery({
    queryKey: ["whatsapp-suppression-stats", workspaceId],
    enabled: !!workspaceId,
    queryFn: () => load({ data: { workspaceId: workspaceId! } }),
    staleTime: 5 * 60_000,
  });
}
