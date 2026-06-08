import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listAdsAccounts, connectAdsAccount, disconnectAdsAccount, listAudiences } from "@/lib/ads-sync.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/page-header";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/settings/ads-sync")({
  component: AdsSyncPage,
});

function AdsSyncPage() {
  const fetchAccounts = useServerFn(listAdsAccounts);
  const fetchAudiences = useServerFn(listAudiences);
  const connect = useServerFn(connectAdsAccount);
  const disconnect = useServerFn(disconnectAdsAccount);
  const accounts = useQuery({ queryKey: ["ads-accounts"], queryFn: () => fetchAccounts() });
  const audiences = useQuery({ queryKey: ["ads-audiences"], queryFn: () => fetchAudiences() });
  const [provider, setProvider] = useState<"meta" | "google">("meta");
  const [accountId, setAccountId] = useState("");
  const [name, setName] = useState("");

  async function handleConnect() {
    if (!accountId || !name) return toast.error("Preencha os campos");
    await connect({ data: { provider, external_account_id: accountId, display_name: name } });
    toast.success("Conta conectada");
    setAccountId(""); setName("");
    accounts.refetch();
  }

  return (
    <div className="p-6 space-y-4 max-w-4xl">
      <PageHeader title="Sincronização de anúncios" description="Conecte Meta e Google Ads, sincronize audiências e Lead Ads" />

      <Card className="p-4 space-y-3">
        <h3 className="font-semibold">Conectar conta</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <Label>Provedor</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as typeof provider)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="meta">Meta Ads</SelectItem>
                <SelectItem value="google">Google Ads</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>ID externo</Label><Input value={accountId} onChange={(e) => setAccountId(e.target.value)} /></div>
          <div><Label>Nome de exibição</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        </div>
        <Button onClick={handleConnect}>Conectar</Button>
      </Card>

      <Card className="p-4 space-y-2">
        <h3 className="font-semibold">Contas conectadas</h3>
        {(accounts.data?.accounts ?? []).map((a) => (
          <div key={a.id} className="flex items-center justify-between border rounded p-3">
            <div>
              <div className="font-medium">{a.display_name}</div>
              <div className="text-xs text-muted-foreground">{a.provider} · {a.external_account_id}</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{a.status}</Badge>
              <Button size="sm" variant="ghost" onClick={async () => {
                await disconnect({ data: { id: a.id } }); accounts.refetch();
              }}>Remover</Button>
            </div>
          </div>
        ))}
        {(accounts.data?.accounts?.length ?? 0) === 0 && (
          <p className="text-muted-foreground text-sm">Nenhuma conta conectada.</p>
        )}
      </Card>

      <Card className="p-4 space-y-2">
        <h3 className="font-semibold">Audiências sincronizadas</h3>
        {(audiences.data?.audiences ?? []).map((a) => (
          <div key={a.id} className="flex items-center justify-between border rounded p-3">
            <div>
              <div className="font-medium">{a.name}</div>
              <div className="text-xs text-muted-foreground">Tamanho estimado: {a.size_estimate ?? "—"}</div>
            </div>
            <Badge>{a.status}</Badge>
          </div>
        ))}
        {(audiences.data?.audiences?.length ?? 0) === 0 && (
          <p className="text-muted-foreground text-sm">Nenhuma audiência sincronizada.</p>
        )}
      </Card>
    </div>
  );
}
