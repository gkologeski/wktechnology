import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Receipt } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { getPaymentsSettings, saveNfseSettings } from "@/lib/payments-settings.functions";

export const Route = createFileRoute("/_authenticated/settings/nfse")({
  component: NfseSettingsPage,
});

function NfseSettingsPage() {
  const get = useServerFn(getPaymentsSettings);
  const save = useServerFn(saveNfseSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [serviceCode, setServiceCode] = useState("");
  const [municipalInscription, setMunicipalInscription] = useState("");
  const [companyIdNfeio, setCompanyIdNfeio] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { nfse } = await get();
        const n = (nfse ?? {}) as { enabled?: boolean; service_code?: string; municipal_inscription?: string; company_id_nfeio?: string };
        setEnabled(!!n.enabled);
        setServiceCode(n.service_code ?? "");
        setMunicipalInscription(n.municipal_inscription ?? "");
        setCompanyIdNfeio(n.company_id_nfeio ?? "");
      } finally {
        setLoading(false);
      }
    })();
  }, [get]);

  async function submit() {
    setSaving(true);
    try {
      await save({
        data: {
          provider: "nfe_io",
          enabled,
          service_code: serviceCode || null,
          municipal_inscription: municipalInscription || null,
          company_id_nfeio: companyIdNfeio || null,
        },
      });
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
      <PageHeader title="NFS-e" description="Emissão de notas fiscais de serviço via NFE.io após pagamento." icon={Receipt} />

      <Card>
        <CardHeader><CardTitle>NFE.io</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Emissão automática após pagamento</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cid">Company ID (NFE.io)</Label>
            <Input id="cid" value={companyIdNfeio} onChange={(e) => setCompanyIdNfeio(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mi">Inscrição municipal</Label>
            <Input id="mi" value={municipalInscription} onChange={(e) => setMunicipalInscription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sc">Código de serviço municipal</Label>
            <Input id="sc" value={serviceCode} onChange={(e) => setServiceCode(e.target.value)} placeholder="Ex: 1.05" />
          </div>
          <p className="text-xs text-muted-foreground">
            A API key da NFE.io deve ser configurada como segredo do servidor (<code>NFEIO_API_KEY</code>).
          </p>
        </CardContent>
      </Card>

      <Button onClick={submit} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Salvar
      </Button>
    </div>
  );
}
