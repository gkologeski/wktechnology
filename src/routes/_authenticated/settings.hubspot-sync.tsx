import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { pushContactsToHubspot, listHubspotSyncState } from "@/lib/hubspot-sync.functions";
import { Loader2, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/hubspot-sync")({
  component: HubspotSyncPage,
});

type Row = { id: string; entity: string; local_id: string; hubspot_id: string; last_synced_at: string; direction: string };

function HubspotSyncPage() {
  const push = useServerFn(pushContactsToHubspot);
  const list = useServerFn(listHubspotSyncState);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => { const r = await list({}); setRows(r.state as Row[]); };
  useEffect(() => { void load(); }, []);

  const doPush = async () => {
    setBusy(true);
    try {
      const r = await push({ data: { limit: 50 } });
      toast.success(`Sync: ${r.pushed} novos, ${r.updated} atualizados, ${r.failed} falhas`);
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Sync HubSpot</h1>
        <p className="text-sm text-muted-foreground">Sincronização bidirecional de contatos com HubSpot.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Enviar contatos para HubSpot</CardTitle>
          <CardDescription>Cria contatos novos no HubSpot e atualiza os já mapeados.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={doPush} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowUpDown className="h-4 w-4 mr-2" />}
            Sincronizar agora
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Mapeamentos ativos</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum mapeamento ainda.</p> :
           <div className="space-y-1 max-h-96 overflow-auto">
            {rows.map((r) => (
              <div key={r.id} className="text-xs border-b py-2 flex justify-between gap-2">
                <span><Badge variant="outline">{r.entity}</Badge> <code className="ml-2">{r.local_id.slice(0,8)} ↔ {r.hubspot_id}</code></span>
                <span className="text-muted-foreground">{new Date(r.last_synced_at).toLocaleString("pt-BR")}</span>
              </div>
            ))}
           </div>}
        </CardContent>
      </Card>
    </div>
  );
}
