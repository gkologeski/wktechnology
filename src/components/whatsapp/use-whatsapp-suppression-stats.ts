import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { getWhatsAppSuppressionStats } from "@/lib/whatsapp/whatsapp-suppressions.functions";

/**
 * Totais de números bloqueados pela Meta no workspace ativo (sem telefones),
 * para avisos de planejamento. O servidor exige membro ativo do workspace.
 */
export function useWhatsAppSuppressionStats(enabled: boolean) {
  const { workspaceId } = usePermissions();
  const load = useServerFn(getWhatsAppSuppressionStats);
  return useQuery({
    queryKey: ["whatsapp-suppression-stats", workspaceId],
    enabled: enabled && !!workspaceId,
    queryFn: () => load({ data: { workspaceId: workspaceId! } }),
    staleTime: 5 * 60_000,
  });
}
