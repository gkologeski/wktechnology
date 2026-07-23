import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Link as LinkIcon, RefreshCw, Plus, Phone, Shield, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  listWabas,
  connectWaba,
  listPhoneNumbers,
  syncPhoneNumbers,
  updatePhoneNumberRouting,
} from "@/lib/whatsapp-meta.functions";

export const Route = createFileRoute("/_authenticated/settings/whatsapp")({
  component: WhatsAppSettings,
});

const WEBHOOK_URL = "https://app.wktechnology.com.br/api/public/meta/whatsapp-webhook";

function WhatsAppSettings() {
  const fetchWabas = useServerFn(listWabas);
  const fetchNumbers = useServerFn(listPhoneNumbers);
  const connect = useServerFn(connectWaba);
  const sync = useServerFn(syncPhoneNumbers);
  const updateRouting = useServerFn(updatePhoneNumberRouting);

  const [wabas, setWabas] = useState<any[]>([]);
  const [numbers, setNumbers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [wabaId, setWabaId] = useState("");
  const [token, setToken] = useState("");
  const [businessName, setBusinessName] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const [w, n] = await Promise.all([fetchWabas(), fetchNumbers()]);
      setWabas(w as any[]);
      setNumbers(n as any[]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function onConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!wabaId || !token) return;
    setSaving(true);
    try {
      await connect({
        data: { waba_id: wabaId, access_token: token, business_name: businessName || undefined },
      });
      toast.success("WABA conectada");
      setWabaId("");
      setToken("");
      setBusinessName("");
      await refresh();
    } catch (err: any) {
      toast.error(err?.message || "Falha ao conectar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="container mx-auto max-w-5xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">WhatsApp Business (Meta)</h1>
        <p className="text-muted-foreground text-sm">
          Integração direta com a Cloud API da Meta. Twilio não é mais necessário para WhatsApp.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="size-4" /> Webhook
          </CardTitle>
          <CardDescription>
            Configure no Meta App Dashboard › WhatsApp › Configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground">Callback URL</Label>
            <div className="font-mono bg-muted rounded px-3 py-2 break-all">{WEBHOOK_URL}</div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Verify Token</Label>
            <div className="font-mono bg-muted rounded px-3 py-2">
              valor do secret <code>META_WHATSAPP_VERIFY_TOKEN</code>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Assine os fields: <code>messages</code>, <code>message_template_status_update</code>,{" "}
            <code>phone_number_quality_update</code>, <code>account_update</code>.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="size-4" /> Conectar WhatsApp Business Account
          </CardTitle>
          <CardDescription>
            Cole o WABA ID e um System User access token (longa duração) gerado no Business Manager.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onConnect} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="waba">WABA ID</Label>
              <Input
                id="waba"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
                placeholder="123456789012345"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="name">Nome (opcional)</Label>
              <Input
                id="name"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Minha Empresa"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="token">System User Access Token</Label>
              <Input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="EAAG..."
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LinkIcon className="size-4 mr-2" />
                )}
                Conectar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contas conectadas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : wabas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma WABA conectada ainda.</p>
          ) : (
            wabas.map((w) => (
              <div key={w.id} className="border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{w.business_name || w.waba_id}</div>
                  <div className="text-xs text-muted-foreground font-mono">{w.waba_id}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={w.status === "connected" ? "default" : "secondary"}>
                    {w.status}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      await sync({ data: { waba_row_id: w.id } });
                      toast.success("Números sincronizados");
                      refresh();
                    }}
                  >
                    <RefreshCw className="size-4 mr-1" /> Sincronizar números
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="size-4" /> Números
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {numbers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum número disponível. Sincronize uma WABA acima.
            </p>
          ) : (
            numbers.map((n) => (
              <div key={n.id} className="border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="font-medium">{n.display_phone_number}</div>
                  <div className="text-xs text-muted-foreground">
                    {n.verified_name} · qualidade: {n.quality_rating || "—"} · tier:{" "}
                    {n.messaging_limit_tier || "—"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {n.is_default && (
                    <Badge>
                      <Check className="size-3 mr-1" /> padrão
                    </Badge>
                  )}
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`def-${n.id}`} className="text-xs">
                      Definir como padrão
                    </Label>
                    <Switch
                      id={`def-${n.id}`}
                      checked={!!n.is_default}
                      onCheckedChange={async (v) => {
                        await updateRouting({ data: { id: n.id, is_default: v } });
                        refresh();
                      }}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
