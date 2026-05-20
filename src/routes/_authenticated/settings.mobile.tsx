import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listMyPushSubscriptions, unregisterPushSubscription } from "@/lib/push.functions";
import { registerServiceWorker, usePwaInstall } from "@/lib/pwa";
import { Trash2, Smartphone, Bell } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/mobile")({
  component: MobilePage,
});

type Sub = { id: string; endpoint: string; user_agent: string | null; created_at: string };

function MobilePage() {
  const list = useServerFn(listMyPushSubscriptions);
  const unsub = useServerFn(unregisterPushSubscription);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const { canInstall, install } = usePwaInstall();

  const load = async () => { const r = await list({}); setSubs(r.subs as Sub[]); };

  useEffect(() => {
    registerServiceWorker();
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
    void load();
  }, []);

  const askNotifications = async () => {
    if (typeof Notification === "undefined") return;
    const p = await Notification.requestPermission();
    setPermission(p);
    if (p === "granted") toast.success("Notificações ativadas");
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mobile / PWA</h1>
        <p className="text-sm text-muted-foreground">Instale o app e ative notificações push.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> Instalar app</CardTitle>
          <CardDescription>Use o CRM como aplicativo no seu celular ou desktop.</CardDescription>
        </CardHeader>
        <CardContent>
          {canInstall ? (
            <Button onClick={install}>Instalar agora</Button>
          ) : (
            <p className="text-sm text-muted-foreground">Use o menu do navegador → "Adicionar à tela inicial" / "Instalar app".</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" /> Notificações push</CardTitle>
          <CardDescription>Permissão atual: <strong>{permission}</strong></CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {permission !== "granted" && <Button onClick={askNotifications}>Ativar notificações</Button>}
          <div className="space-y-2">
            {subs.map((s) => (
              <div key={s.id} className="border rounded-md p-3 text-xs flex justify-between gap-2">
                <span className="truncate flex-1">{s.user_agent ?? s.endpoint.slice(0, 50)}…</span>
                <Button variant="ghost" size="sm" onClick={async () => { await unsub({ data: { endpoint: s.endpoint } }); load(); }}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            {subs.length === 0 && <p className="text-xs text-muted-foreground">Nenhum dispositivo registrado ainda.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
