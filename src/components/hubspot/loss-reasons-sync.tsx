import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  syncHubspotLossReasons,
  backfillLostDealReasons,
} from "@/lib/deal-loss-reasons.functions";

export function HubspotLossReasonsSync() {
  const qc = useQueryClient();
  const syncFn = useServerFn(syncHubspotLossReasons);
  const backfillFn = useServerFn(backfillLostDealReasons);

  const run = useMutation({
    mutationFn: async () => {
      const r = await syncFn();
      const b = await backfillFn();
      return { ...r, ...b };
    },
    onSuccess: (r) => {
      toast.success(
        `${r.upserted} motivo(s) sincronizados · ${r.updated} negócio(s) atualizados (${r.skipped} sem motivo no HubSpot)`,
      );
      qc.invalidateQueries({ queryKey: ["deal-loss-reasons"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Button onClick={() => run.mutate()} disabled={run.isPending}>
      <RefreshCw className={`mr-2 h-4 w-4 ${run.isPending ? "animate-spin" : ""}`} />
      {run.isPending ? "Sincronizando..." : "Sincronizar motivos de perdido"}
    </Button>
  );
}
