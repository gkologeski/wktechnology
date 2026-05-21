import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { pushContactsToHubspot, listHubspotSyncState } from "@/lib/hubspot-sync.functions";
import { relinkHubspotActivities, countActivitiesToRelink } from "@/lib/hubspot-relink.functions";
import { Loader2, ArrowUpDown, Link2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/hubspot-sync")({
  component: HubspotSyncPage,
});

type Row = { id: string; entity: string; local_id: string; hubspot_id: string; last_synced_at: string; direction: string };
type ActType = "note" | "task" | "call" | "meeting" | "email";

function HubspotSyncPage() {
  const push = useServerFn(pushContactsToHubspot);
  const list = useServerFn(listHubspotSyncState);
  const relink = useServerFn(relinkHubspotActivities);
  const countRelink = useServerFn(countActivitiesToRelink);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [relinkBusy, setRelinkBusy] = useState<ActType | "all" | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<Record<string, { total: number; linked: number; pending: number }>>({});
  const [progress, setProgress] = useState<string>("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const load = async () => {
    const r = await list({});
    setRows(r.state as Row[]);
  };
  const refreshCounts = async () => {
    const c = await countRelink({});
    setCounts(c.counts);
    setStats(c.stats);
    setLastUpdate(new Date());
  };
  useEffect(() => {
    void load();
    void refreshCounts();
    const id = setInterval(() => { void refreshCounts(); }, 2000);
    return () => clearInterval(id);
  }, []);

  const doPush = async () => {
    setBusy(true);
    try {
      const r = await push({ data: { limit: 50 } });
      toast.success(`Sync: ${r.pushed} novos, ${r.updated} atualizados, ${r.failed} falhas`);
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const runRelink = async (type: ActType) => {
    setRelinkBusy(type);
    setProgress("");
    let totalProcessed = 0;
    let totalUpdated = 0;
    let cursor: string | undefined;
    try {
      while (true) {
        const r = await relink({ data: { type, batchSize: 500, afterId: cursor } });
        totalProcessed += r.processed;
        totalUpdated += r.updated;
        setProgress(`${type}: ${totalProcessed.toLocaleString("pt-BR")} processadas, ${totalUpdated.toLocaleString("pt-BR")} vinculadas...`);
        if (!r.hasMore || !r.nextCursor) break;
        cursor = r.nextCursor;
      }
      toast.success(`${type}: ${totalProcessed} processadas, ${totalUpdated} vinculadas`);
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setRelinkBusy(null); setProgress(""); }
  };


  const runRelinkAll = async () => {
    setRelinkBusy("all");
    try {
      for (const t of ["note", "task", "call", "meeting", "email"] as ActType[]) {
        if ((counts[t] ?? 0) === 0) continue;
        setProgress(`Iniciando ${t}...`);
        let totalProcessed = 0;
        let totalUpdated = 0;
        let cursor: string | undefined;
        while (true) {
          const r = await relink({ data: { type: t, batchSize: 500, afterId: cursor } });
          totalProcessed += r.processed;
          totalUpdated += r.updated;
          setProgress(`${t}: ${totalProcessed.toLocaleString("pt-BR")} processadas, ${totalUpdated.toLocaleString("pt-BR")} vinculadas...`);
          if (!r.hasMore || !r.nextCursor) break;
          cursor = r.nextCursor;
        }

      }
      toast.success("Re-vinculação completa");
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setRelinkBusy(null); setProgress(""); }
  };

  const totalPending = Object.values(counts).reduce((a, b) => a + b, 0);

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
        <CardHeader>
          <CardTitle>Re-vincular atividades importadas</CardTitle>
          <CardDescription>
            Busca as associações no HubSpot para atividades que vieram sem vínculo de contato/empresa/negócio/lead e atualiza somente os FKs nulos. Não reimporta conteúdo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
            {(["note", "task", "call", "meeting", "email"] as ActType[]).map((t) => (
              <div key={t} className="border rounded p-2 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="capitalize font-medium">{t}</span>
                  <Badge variant={counts[t] ? "default" : "outline"}>{counts[t] ?? 0}</Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!relinkBusy || !counts[t]}
                  onClick={() => runRelink(t)}
                >
                  {relinkBusy === t ? <Loader2 className="h-3 w-3 animate-spin" /> : "Re-vincular"}
                </Button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">{totalPending.toLocaleString("pt-BR")} pendentes no total</span>
            <Button onClick={runRelinkAll} disabled={!!relinkBusy || totalPending === 0}>
              {relinkBusy === "all" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
              Re-vincular todas
            </Button>
          </div>
          {progress && <p className="text-xs text-muted-foreground">{progress}</p>}
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
