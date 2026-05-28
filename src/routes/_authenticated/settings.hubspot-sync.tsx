import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { pushContactsToHubspot, listHubspotSyncState } from "@/lib/hubspot-sync.functions";
import { relinkHubspotActivities, countActivitiesToRelink } from "@/lib/hubspot-relink.functions";
import { reconcileHubspotActivities } from "@/lib/hubspot-reconcile.functions";
import { reconcileHubspotEntities } from "@/lib/hubspot-reconcile-entities.functions";
import { Loader2, ArrowUpDown, Link2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/hubspot-sync")({
  component: HubspotSyncPage,
});

type Row = { id: string; entity: string; local_id: string; hubspot_id: string; last_synced_at: string; direction: string };
type ActType = "note" | "task" | "call" | "meeting" | "email";
type EntityType = "contact" | "company" | "deal" | "lead";
const ENTITY_LABEL: Record<EntityType, string> = { contact: "Contatos", company: "Empresas", deal: "Negócios", lead: "Leads" };

function HubspotSyncPage() {
  const push = useServerFn(pushContactsToHubspot);
  const list = useServerFn(listHubspotSyncState);
  const relink = useServerFn(relinkHubspotActivities);
  const countRelink = useServerFn(countActivitiesToRelink);
  const reconcile = useServerFn(reconcileHubspotActivities);
  const reconcileEntity = useServerFn(reconcileHubspotEntities);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [relinkBusy, setRelinkBusy] = useState<ActType | "all" | null>(null);
  const [reconcileBusy, setReconcileBusy] = useState<ActType | "all" | null>(null);
  const [reconcileProgress, setReconcileProgress] = useState<string>("");
  const [entityBusy, setEntityBusy] = useState<EntityType | "all" | null>(null);
  const [entityProgress, setEntityProgress] = useState<string>("");
  const [reconcileCursors, setReconcileCursors] = useState<Record<string, boolean>>({});
  const [entityCursors, setEntityCursors] = useState<Record<string, boolean>>({});
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

  const cursorKey = (t: ActType) => `hubspot-relink-cursor:${t}`;
  const getCursor = (t: ActType) => {
    try { return localStorage.getItem(cursorKey(t)) || undefined; } catch { return undefined; }
  };
  const setCursor = (t: ActType, v: string | null) => {
    try {
      if (v) localStorage.setItem(cursorKey(t), v);
      else localStorage.removeItem(cursorKey(t));
    } catch { /* ignore */ }
  };

  const runRelink = async (type: ActType) => {
    setRelinkBusy(type);
    setProgress("");
    let totalProcessed = 0;
    let totalUpdated = 0;
    let cursor: string | undefined = getCursor(type);
    if (cursor) setProgress(`${type}: retomando de cursor anterior...`);
    try {
      while (true) {
        const r = await relink({ data: { type, batchSize: 500, afterId: cursor } });
        totalProcessed += r.processed;
        totalUpdated += r.updated;
        setProgress(`${type}: ${totalProcessed.toLocaleString("pt-BR")} processadas, ${totalUpdated.toLocaleString("pt-BR")} vinculadas...`);
        if (!r.hasMore || !r.nextCursor) {
          setCursor(type, null);
          break;
        }
        cursor = r.nextCursor;
        setCursor(type, cursor);
      }
      toast.success(`${type}: ${totalProcessed} processadas, ${totalUpdated} vinculadas`);
      await load();
    } catch (e) {
      // mantém cursor salvo para retomar depois
      toast.error((e as Error).message);
    }
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
        let cursor: string | undefined = getCursor(t);
        if (cursor) setProgress(`${t}: retomando de cursor anterior...`);
        while (true) {
          const r = await relink({ data: { type: t, batchSize: 500, afterId: cursor } });
          totalProcessed += r.processed;
          totalUpdated += r.updated;
          setProgress(`${t}: ${totalProcessed.toLocaleString("pt-BR")} processadas, ${totalUpdated.toLocaleString("pt-BR")} vinculadas...`);
          if (!r.hasMore || !r.nextCursor) {
            setCursor(t, null);
            break;
          }
          cursor = r.nextCursor;
          setCursor(t, cursor);
        }

      }
      toast.success("Re-vinculação completa");
      await load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setRelinkBusy(null); setProgress(""); }
  };

  const reconcileCursorKey = (t: ActType) => `hubspot-reconcile-cursor:${t}`;
  const getReconcileCursor = (t: ActType) => {
    try { return localStorage.getItem(reconcileCursorKey(t)) || undefined; } catch { return undefined; }
  };
  const setReconcileCursor = (t: ActType, v: string | null) => {
    try {
      if (v) localStorage.setItem(reconcileCursorKey(t), v);
      else localStorage.removeItem(reconcileCursorKey(t));
    } catch { /* ignore */ }
  };

  const runReconcileOne = async (t: ActType) => {
    let totalScanned = 0;
    let totalMissing = 0;
    let totalImported = 0;
    let totalFailed = 0;
    let cursor: string | undefined = getReconcileCursor(t);
    if (cursor) setReconcileProgress(`${t}: retomando varredura...`);
    while (true) {
      const r = await reconcile({ data: { type: t, after: cursor, pages: 3 } });
      totalScanned += r.scanned;
      totalMissing += r.missing;
      totalImported += r.imported;
      totalFailed += r.failed;
      setReconcileProgress(
        `${t}: ${totalScanned.toLocaleString("pt-BR")} verificados, ${totalImported.toLocaleString("pt-BR")} importados${totalFailed ? `, ${totalFailed} falhas` : ""}`,
      );
      if (!r.hasMore || !r.nextAfter) {
        setReconcileCursor(t, null);
        break;
      }
      cursor = r.nextAfter;
      setReconcileCursor(t, cursor ?? null);
    }
    return { scanned: totalScanned, missing: totalMissing, imported: totalImported, failed: totalFailed };
  };

  const runReconcile = async (t: ActType) => {
    setReconcileBusy(t);
    setReconcileProgress("");
    try {
      const r = await runReconcileOne(t);
      toast.success(`${t}: ${r.imported} novos importados (${r.scanned} verificados)`);
      await refreshCounts();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReconcileBusy(null);
      setReconcileProgress("");
    }
  };

  const runReconcileAll = async () => {
    setReconcileBusy("all");
    setReconcileProgress("");
    try {
      let importedAll = 0;
      for (const t of ["note", "task", "call", "meeting", "email"] as ActType[]) {
        setReconcileProgress(`Iniciando ${t}...`);
        const r = await runReconcileOne(t);
        importedAll += r.imported;
      }
      toast.success(`Reconciliação concluída: ${importedAll} novos importados`);
      await refreshCounts();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setReconcileBusy(null);
      setReconcileProgress("");
    }
  };

  const entityCursorKey = (t: EntityType) => `hubspot-reconcile-entity-cursor:${t}`;
  const getEntityCursor = (t: EntityType) => {
    try { return localStorage.getItem(entityCursorKey(t)) || undefined; } catch { return undefined; }
  };
  const setEntityCursor = (t: EntityType, v: string | null) => {
    try {
      if (v) localStorage.setItem(entityCursorKey(t), v);
      else localStorage.removeItem(entityCursorKey(t));
    } catch { /* ignore */ }
  };

  const runEntityOne = async (t: EntityType) => {
    let totalScanned = 0;
    let totalMissing = 0;
    let totalImported = 0;
    let totalFailed = 0;
    let cursor: string | undefined = getEntityCursor(t);
    if (cursor) setEntityProgress(`${ENTITY_LABEL[t]}: retomando varredura...`);
    while (true) {
      const r = await reconcileEntity({ data: { entity: t, after: cursor, pages: 3 } });
      totalScanned += r.scanned;
      totalMissing += r.missing;
      totalImported += r.imported;
      totalFailed += r.failed;
      setEntityProgress(
        `${ENTITY_LABEL[t]}: ${totalScanned.toLocaleString("pt-BR")} verificados, ${totalImported.toLocaleString("pt-BR")} importados${totalFailed ? `, ${totalFailed} falhas` : ""}`,
      );
      if (!r.hasMore || !r.nextAfter) {
        setEntityCursor(t, null);
        break;
      }
      cursor = r.nextAfter;
      setEntityCursor(t, cursor ?? null);
    }
    return { scanned: totalScanned, missing: totalMissing, imported: totalImported, failed: totalFailed };
  };

  const runEntity = async (t: EntityType) => {
    setEntityBusy(t);
    setEntityProgress("");
    try {
      const r = await runEntityOne(t);
      toast.success(`${ENTITY_LABEL[t]}: ${r.imported} novos importados (${r.scanned} verificados)`);
      await refreshCounts();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEntityBusy(null);
      setEntityProgress("");
    }
  };

  const runEntityAll = async () => {
    setEntityBusy("all");
    setEntityProgress("");
    try {
      let importedAll = 0;
      for (const t of ["company", "contact", "deal", "lead"] as EntityType[]) {
        setEntityProgress(`Iniciando ${ENTITY_LABEL[t]}...`);
        const r = await runEntityOne(t);
        importedAll += r.imported;
      }
      toast.success(`Reconciliação concluída: ${importedAll} novos importados`);
      await refreshCounts();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEntityBusy(null);
      setEntityProgress("");
    }
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
          <div className="space-y-2">
            {(["note", "task", "call", "meeting", "email"] as ActType[]).map((t) => {
              const s = stats[t] ?? { total: 0, linked: 0, pending: 0 };
              const pct = s.total > 0 ? Math.round((s.linked / s.total) * 100) : 0;
              return (
                <div key={t} className="border rounded p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="capitalize font-medium w-16">{t}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {s.linked.toLocaleString("pt-BR")} / {s.total.toLocaleString("pt-BR")} vinculadas
                      </span>
                      <Badge variant={s.pending ? "default" : "outline"} className="tabular-nums">
                        {s.pending.toLocaleString("pt-BR")} pendentes
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">{pct}%</span>
                      {(relinkBusy === t || relinkBusy === "all") && (
                        <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Em andamento" />
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!!relinkBusy || !counts[t]}
                        onClick={() => runRelink(t)}
                      >
                        {relinkBusy === t ? <Loader2 className="h-3 w-3 animate-spin" /> : "Re-vincular"}
                      </Button>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-muted rounded overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">
              {totalPending.toLocaleString("pt-BR")} pendentes no total
              {lastUpdate && (
                <span className="ml-2 text-xs">
                  · atualizado {lastUpdate.toLocaleTimeString("pt-BR")}
                  <span className="inline-block ml-1 h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {relinkBusy === "all" && (
                <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Em andamento" />
              )}
              <Button onClick={runRelinkAll} disabled={!!relinkBusy || totalPending === 0}>
                {relinkBusy === "all" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                Re-vincular todas
              </Button>
            </div>
          </div>
          {progress && <p className="text-xs text-muted-foreground">{progress}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verificar registros novos no HubSpot</CardTitle>
          <CardDescription>
            Varre o HubSpot (mais recentes primeiro) e importa para o sistema as notes, tasks, calls, meetings
            e emails que ainda não existem aqui. Não altera registros já presentes. Para vincular contato/empresa/negócio/lead,
            use "Re-vincular" acima depois da importação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(["note", "task", "call", "meeting", "email"] as ActType[]).map((t) => (
              <Button
                key={t}
                size="sm"
                variant="outline"
                disabled={!!reconcileBusy}
                onClick={() => runReconcile(t)}
              >
                {reconcileBusy === t ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-2" />}
                <span className="capitalize">{t}</span>
              </Button>
            ))}
            <div className="ml-auto">
              <Button onClick={runReconcileAll} disabled={!!reconcileBusy}>
                {reconcileBusy === "all" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Verificar todos
              </Button>
            </div>
          </div>
          {reconcileProgress && <p className="text-xs text-muted-foreground">{reconcileProgress}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Verificar registros novos no HubSpot — Entidades</CardTitle>
          <CardDescription>
            Varre o HubSpot (mais recentes primeiro) e importa as Empresas, Contatos, Negócios e Leads
            que ainda não existem aqui. Não altera registros já presentes. Associações entre eles
            (contato↔empresa, negócio↔contato) ficam para o fluxo de importação completa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(["company", "contact", "deal", "lead"] as EntityType[]).map((t) => (
              <Button
                key={t}
                size="sm"
                variant="outline"
                disabled={!!entityBusy}
                onClick={() => runEntity(t)}
              >
                {entityBusy === t ? <Loader2 className="h-3 w-3 mr-2 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-2" />}
                <span>{ENTITY_LABEL[t]}</span>
              </Button>
            ))}
            <div className="ml-auto">
              <Button onClick={runEntityAll} disabled={!!entityBusy}>
                {entityBusy === "all" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Verificar todas as entidades
              </Button>
            </div>
          </div>
          {entityProgress && <p className="text-xs text-muted-foreground">{entityProgress}</p>}
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
