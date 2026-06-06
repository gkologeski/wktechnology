// Painel two-way HubSpot: toggle auto-push, push manual, e fila de conflitos.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, RefreshCw, ArrowDownToLine, ArrowUpToLine, AlertTriangle } from "lucide-react";
import { useState } from "react";
import {
  pushEntityNow,
  pushAllNow,
  listSyncConflicts,
  resolveSyncConflict,
  getHubspotSyncConfig,
  setHubspotAutoPush,
} from "@/lib/hubspot-twoway.functions";

const ENTITY_LABELS: Record<string, string> = {
  contact: "Contatos",
  company: "Empresas",
  deal: "Negócios",
};

export function HubspotTwoWaySync() {
  const qc = useQueryClient();
  const pushOneFn = useServerFn(pushEntityNow);
  const pushAllFn = useServerFn(pushAllNow);
  const listConflictsFn = useServerFn(listSyncConflicts);
  const resolveFn = useServerFn(resolveSyncConflict);
  const getCfgFn = useServerFn(getHubspotSyncConfig);
  const setAutoFn = useServerFn(setHubspotAutoPush);

  const [busy, setBusy] = useState<string | null>(null);

  const { data: cfg, refetch: refetchCfg } = useQuery({
    queryKey: ["hubspot", "twoway-config"],
    queryFn: () => getCfgFn(),
  });

  const { data: conflicts, refetch: refetchConflicts } = useQuery({
    queryKey: ["hubspot", "conflicts"],
    queryFn: () => listConflictsFn(),
    refetchInterval: 30_000,
  });

  async function toggleAutoPush(enabled: boolean) {
    try {
      await setAutoFn({ data: { enabled } });
      toast.success(enabled ? "Auto-push ativado (a cada minuto)." : "Auto-push desativado.");
      refetchCfg();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar configuração");
    }
  }

  async function runPushAll() {
    setBusy("all");
    try {
      const res = await pushAllFn({ data: { limit: 50 } });
      const summary = res
        .map((r) => `${ENTITY_LABELS[r.entity]}: +${r.created}/~${r.updated}/⚠${r.conflicts}/✗${r.failed}`)
        .join(" • ");
      toast.success(`Sincronização concluída — ${summary}`);
      qc.invalidateQueries({ queryKey: ["hubspot", "conflicts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao sincronizar");
    } finally { setBusy(null); }
  }

  async function runPushOne(entity: "contact" | "company" | "deal") {
    setBusy(entity);
    try {
      const r = await pushOneFn({ data: { entity, limit: 50 } });
      toast.success(`${ENTITY_LABELS[entity]} — ${r.created} criados, ${r.updated} atualizados, ${r.conflicts} conflitos, ${r.failed} falhas`);
      qc.invalidateQueries({ queryKey: ["hubspot", "conflicts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally { setBusy(null); }
  }

  async function resolve(id: string, strategy: "local_wins" | "remote_wins") {
    try {
      await resolveFn({ data: { id, strategy } });
      toast.success(strategy === "local_wins" ? "Local enviado para o HubSpot." : "Versão do HubSpot mantida.");
      refetchConflicts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao resolver");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <p className="font-medium">Auto-push periódico</p>
          <p className="text-xs text-muted-foreground">
            A cada execução do cron HubSpot (~1 min), envia até 10 registros alterados de cada entidade.
          </p>
        </div>
        <Switch
          checked={!!cfg?.auto_push_enabled}
          onCheckedChange={(v) => toggleAutoPush(!!v)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={runPushAll} disabled={busy !== null}>
          {busy === "all" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Sincronizar agora (tudo)
        </Button>
        {(["contact", "company", "deal"] as const).map((e) => (
          <Button key={e} variant="outline" onClick={() => runPushOne(e)} disabled={busy !== null}>
            {busy === e ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowUpToLine className="h-4 w-4 mr-2" />}
            {ENTITY_LABELS[e]}
          </Button>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Conflitos pendentes
            <Badge variant="secondary">{conflicts?.length ?? 0}</Badge>
          </h3>
        </div>
        {(!conflicts || conflicts.length === 0) ? (
          <p className="text-sm text-muted-foreground">Sem conflitos. Tudo em sincronia.</p>
        ) : (
          <div className="rounded-md border divide-y">
            {conflicts.map((c) => (
              <div key={c.id} className="p-3 flex items-start justify-between gap-3">
                <div className="text-sm space-y-1 min-w-0">
                  <div className="font-medium">
                    {ENTITY_LABELS[c.entity as string] ?? c.entity} · <span className="font-mono text-xs">{String(c.local_id).slice(0, 8)} ↔ HS {String(c.hubspot_id).slice(0, 8)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.conflict_reason ?? "Conflito detectado."}</p>
                  <p className="text-xs text-muted-foreground">
                    Local: {c.local_updated_at ? new Date(c.local_updated_at as string).toLocaleString("pt-BR") : "—"} ·
                    {" "}HubSpot: {c.remote_updated_at ? new Date(c.remote_updated_at as string).toLocaleString("pt-BR") : "—"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="outline" onClick={() => resolve(c.id as string, "local_wins")}>
                    <ArrowUpToLine className="h-3.5 w-3.5 mr-1" /> Manter local
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => resolve(c.id as string, "remote_wins")}>
                    <ArrowDownToLine className="h-3.5 w-3.5 mr-1" /> Manter HubSpot
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
