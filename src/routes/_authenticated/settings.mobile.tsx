import { formatDateTime } from "@/lib/crm";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  listMyPushSubscriptions,
  unregisterPushSubscription,
  registerPushSubscription,
  updatePushPreferences,
  sendTestPush,
  getVapidKey,
} from "@/lib/push.functions";
import { registerServiceWorker, usePwaInstall, subscribeToPush, unsubscribeFromPush } from "@/lib/pwa";
import { Trash2, Smartphone, Bell, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings/mobile")({
  component: MobilePage,
});

type Prefs = { mention: boolean; assignment: boolean; sla: boolean; message: boolean; task: boolean; deal: boolean };
type Sub = {
  id: string;
  endpoint: string;
  user_agent: string | null;
  created_at: string;
  preferences: Prefs;
  enabled: boolean;
  last_used_at: string | null;
};

const PREF_LABELS: Record<keyof Prefs, string> = {
  mention: "Menções",
  assignment: "Atribuições",
  sla: "Alertas de SLA",
  message: "Novas mensagens",
  task: "Tarefas",
  deal: "Negócios",
};

function MobilePage() {
  const list = useServerFn(listMyPushSubscriptions);
  const unsub = useServerFn(unregisterPushSubscription);
  const register = useServerFn(registerPushSubscription);
  const updatePrefs = useServerFn(updatePushPreferences);
  const test = useServerFn(sendTestPush);
  const vapidFn = useServerFn(getVapidKey);

  const [subs, setSubs] = useState<Sub[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const { canInstall, installed, install } = usePwaInstall();

  const load = async () => { const r = await list({}); setSubs(r.subs as unknown as Sub[]); };

  useEffect(() => {
    registerServiceWorker();
    if (typeof Notification !== "undefined") setPermission(Notification.permission);
    void load();
    void vapidFn({}).then((r) => setVapidKey(r.publicKey));
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const enablePush = async () => {
    if (!vapidKey) {
      toast.error("Chaves VAPID não configuradas no servidor.");
      return;
    }
    setBusy(true);
    try {
      const s = await subscribeToPush(vapidKey);
      await register({ data: s });
      setPermission("granted");
      toast.success("Notificações ativadas neste dispositivo");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setBusy(false); }
  };

  const disableThisDevice = async () => {
    setBusy(true);
    try {
      const ep = await unsubscribeFromPush();
      if (ep) await unsub({ data: { endpoint: ep } });
      toast.success("Push desativado neste dispositivo");
      await load();
    } finally { setBusy(false); }
  };

  const togglePref = async (sub: Sub, key: keyof Prefs, value: boolean) => {
    const next = { ...sub.preferences, [key]: value };
    await updatePrefs({ data: { id: sub.id, preferences: next } });
    await load();
  };

  const toggleEnabled = async (sub: Sub, enabled: boolean) => {
    await updatePrefs({ data: { id: sub.id, enabled } });
    await load();
  };

  const sendTest = async () => {
    const r = await test({});
    if (r.skipped) toast.error("Configure VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY no backend.");
    else if (r.sent === 0) toast.error("Nenhum dispositivo recebeu (sem subscriptions ativas).");
    else toast.success(`Enviado para ${r.sent} dispositivo(s)`);
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Mobile / PWA</h1>
          <p className="text-sm text-muted-foreground">Instale o app, gerencie push e veja status offline.</p>
        </div>
        <Badge variant={online ? "default" : "destructive"} className="gap-1">
          {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {online ? "Online" : "Offline"}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> Instalar app</CardTitle>
          <CardDescription>Use o CRM como aplicativo no celular ou desktop.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {installed ? (
            <p className="text-sm text-muted-foreground">✅ App instalado.</p>
          ) : canInstall ? (
            <Button onClick={install}>Instalar agora</Button>
          ) : (
            <p className="text-sm text-muted-foreground">
              Use o menu do navegador → "Adicionar à tela inicial" / "Instalar app". No iOS, abra no Safari → Compartilhar → "Adicionar à Tela de Início".
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" /> Notificações push</CardTitle>
          <CardDescription>Permissão: <strong>{permission}</strong> {!vapidKey && "· VAPID não configurado"}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {permission !== "granted" || subs.length === 0 ? (
              <Button onClick={enablePush} disabled={busy || !vapidKey}>Ativar neste dispositivo</Button>
            ) : (
              <>
                <Button variant="outline" onClick={sendTest}>Enviar teste</Button>
                <Button variant="ghost" onClick={disableThisDevice} disabled={busy}>Desativar neste dispositivo</Button>
              </>
            )}
          </div>

          <div className="space-y-3">
            {subs.map((s) => (
              <div key={s.id} className="border rounded-md p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs truncate flex-1">
                    <div className="font-medium truncate">{s.user_agent ?? s.endpoint.slice(0, 60)}</div>
                    <div className="text-muted-foreground">Registrado em {formatDateTime(s.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={s.enabled} onCheckedChange={(v) => toggleEnabled(s, v)} aria-label="Ativo" />
                    <Button variant="ghost" size="sm" onClick={async () => { await unsub({ data: { endpoint: s.endpoint } }); load(); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(Object.keys(PREF_LABELS) as Array<keyof Prefs>).map((k) => (
                    <label key={k} className="flex items-center gap-2 text-xs">
                      <Switch
                        checked={s.preferences?.[k] ?? true}
                        onCheckedChange={(v) => togglePref(s, k, v)}
                        disabled={!s.enabled}
                      />
                      <Label className="cursor-pointer">{PREF_LABELS[k]}</Label>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {subs.length === 0 && <p className="text-xs text-muted-foreground">Nenhum dispositivo registrado.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modo offline</CardTitle>
          <CardDescription>Notas e tarefas criadas sem conexão ficam em fila local e sincronizam automaticamente quando o dispositivo volta a ficar online.</CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>• Shell do app é cacheado pelo service worker (NetworkFirst em HTML).</p>
          <p>• Fila persistida via IndexedDB (last-write-wins ao sincronizar).</p>
          <p>• Indicador "Offline" aparece no topo desta página quando o navegador perde rede.</p>
        </CardContent>
      </Card>
    </div>
  );
}
