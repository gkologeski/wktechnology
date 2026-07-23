import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { getPaymentsSettings, savePaymentsSettings } from "@/lib/payments-settings.functions";

export const Route = createFileRoute("/_authenticated/settings/payments")({
  component: PaymentsSettingsPage,
});

function PaymentsSettingsPage() {
  const get = useServerFn(getPaymentsSettings);
  const save = useServerFn(savePaymentsSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [gateway, setGateway] = useState<"asaas" | "pagarme" | "mercadopago" | "manual">("manual");
  const [mode, setMode] = useState<"sandbox" | "live">("sandbox");
  const [defaultMethod, setDefaultMethod] = useState<"pix" | "boleto" | "credit_card">("pix");

  useEffect(() => {
    (async () => {
      try {
        const { payments } = await get();
        const p = (payments ?? {}) as {
          gateway?: typeof gateway;
          mode?: typeof mode;
          default_method?: typeof defaultMethod;
        };
        if (p.gateway) setGateway(p.gateway);
        if (p.mode) setMode(p.mode);
        if (p.default_method) setDefaultMethod(p.default_method);
      } finally {
        setLoading(false);
      }
    })();
  }, [get]);

  async function submit() {
    setSaving(true);
    try {
      await save({ data: { gateway, mode, default_method: defaultMethod } });
      toast.success("Salvo");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6 max-w-2xl">
      <PageHeader
        title="Cobrança & Pagamentos"
        description="Configure o gateway para gerar boletos, Pix e cobranças no cartão."
      />

      <Card>
        <CardHeader>
          <CardTitle>Gateway</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Provedor</Label>
            <Select value={gateway} onValueChange={(v) => setGateway(v as typeof gateway)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual (sem integração)</SelectItem>
                <SelectItem value="asaas">Asaas</SelectItem>
                <SelectItem value="pagarme">Pagar.me</SelectItem>
                <SelectItem value="mercadopago">Mercado Pago</SelectItem>
              </SelectContent>
            </Select>
            {gateway !== "manual" && (
              <p className="text-xs text-muted-foreground">
                Credenciais do gateway devem ser configuradas como segredos do servidor (
                <code>{gateway.toUpperCase()}_API_KEY</code> e{" "}
                <code>{gateway.toUpperCase()}_WEBHOOK_SECRET</code>).
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Ambiente</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox</SelectItem>
                <SelectItem value="live">Produção</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Método padrão</Label>
            <Select
              value={defaultMethod}
              onValueChange={(v) => setDefaultMethod(v as typeof defaultMethod)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="credit_card">Cartão de crédito</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Configure no painel do gateway o webhook abaixo (substitua <code>:provider</code> por
            <code>asaas</code>, <code>pagarme</code> ou <code>mercadopago</code>):
          </p>
          <code className="block rounded-md border bg-muted/40 p-2 text-xs">
            https://app.wktechnology.com.br/api/public/payments/br-webhook/:provider
          </code>
        </CardContent>
      </Card>

      <Button onClick={submit} disabled={saving}>
        {saving ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Save className="mr-2 h-4 w-4" />
        )}
        Salvar
      </Button>
    </div>
  );
}
