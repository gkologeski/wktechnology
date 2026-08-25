import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { syncHubspotLossReasons, backfillLostDealReasons } from "@/lib/deal-loss-reasons.functions";

export function HubspotLossReasonsSync() {
  const qc = useQueryClient();
  const syncFn = useServerFn(syncHubspotLossReasons);
  const backfillFn = useServerFn(backfillLostDealReasons);
  const [propertyName, setPropertyName] = useState("closed_lost_reason");

  const run = useMutation({
    mutationFn: async () => {
      const name = propertyName.trim() || "closed_lost_reason";
      const r = await syncFn({ data: { propertyName: name } });
      const b = await backfillFn({ data: { propertyName: name } });
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
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1">
        <Label htmlFor="loss-reason-property" className="text-xs">
          Propriedade no HubSpot
        </Label>
        <Input
          id="loss-reason-property"
          value={propertyName}
          onChange={(e) => setPropertyName(e.target.value)}
          placeholder="closed_lost_reason"
          disabled={run.isPending}
        />
        <p className="text-xs text-muted-foreground">
          Use o nome interno da propriedade (ex.: <code>closed_lost_reason</code> ou uma
          personalizada como <code>motivo_da_perda</code>).
        </p>
      </div>
      <Button onClick={() => run.mutate()} disabled={run.isPending}>
        <RefreshCw className={`mr-2 h-4 w-4 ${run.isPending ? "animate-spin" : ""}`} />
        {run.isPending ? "Sincronizando..." : "Sincronizar motivos de perdido"}
      </Button>
    </div>
  );
}
