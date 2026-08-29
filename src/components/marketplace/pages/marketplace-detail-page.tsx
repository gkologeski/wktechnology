import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plug, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  getMarketplaceApp,
  installMarketplaceApp,
  uninstallMarketplaceApp,
  testMarketplaceConnection,
} from "@/lib/marketplace.functions";


export function MarketplaceDetail({ slug }: { slug: string }) {
    const navigate = useNavigate();
  const getFn = useServerFn(getMarketplaceApp);
  const install = useServerFn(installMarketplaceApp);
  const uninstall = useServerFn(uninstallMarketplaceApp);
  const test = useServerFn(testMarketplaceConnection);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["marketplace", slug],
    queryFn: () => getFn({ data: { slug } }),
  });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center p-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { app, installation } = data;
  const installed = !!installation;
  const settingsLink: string | null =
    slug === "slack"
      ? "/settings/notifications/slack"
      : slug === "zapier" || slug === "make"
        ? "/settings/zapier"
        : slug === "whatsapp-cloud"
          ? "/settings/whatsapp"
          : slug === "gmail" || slug === "google-calendar"
            ? "/settings/calendars"
            : slug === "asaas"
              ? "/settings/payments"
              : slug === "nfe-io"
                ? "/settings/nfse"
                : slug === "twilio"
                  ? "/settings/voice-agent"
                  : slug === "hubspot"
                    ? "/settings/hubspot-sync"
                    : null;

  async function doInstall() {
    setBusy(true);
    try {
      await install({ data: { slug, config: {} } });
      toast.success("Instalado");
      await refetch();
      if (settingsLink) navigate({ to: settingsLink });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  }
  async function doUninstall() {
    setBusy(true);
    try {
      await uninstall({ data: { slug } });
      toast.success("Removido");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  }
  async function doTest() {
    setBusy(true);
    try {
      const r = await test({ data: { slug } });
      if (r.ok) toast.success("Conexão OK");
      else toast.error(r.error || "Falha no teste");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-6 max-w-3xl">
      <Link
        to="/settings/marketplace"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 mr-1" /> Marketplace
      </Link>
      <PageHeader title={app.name} description={app.short_description ?? ""} />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-muted grid place-items-center">
              <Plug className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <CardTitle>{app.name}</CardTitle>
              <div className="text-xs text-muted-foreground">
                {app.vendor} · {app.category}
              </div>
            </div>
          </div>
          <div>
            {installed && installation?.status === "active" && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="h-3 w-3" /> Instalado
              </Badge>
            )}
            {installed && installation?.status === "error" && (
              <Badge variant="destructive" className="gap-1">
                <AlertCircle className="h-3 w-3" /> Erro
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground whitespace-pre-line">{app.description}</p>

          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground mb-1">Escopos</div>
            <div className="flex flex-wrap gap-1.5">
              {(app.scopes ?? []).map((s: string) => (
                <Badge key={s} variant="outline">
                  {s}
                </Badge>
              ))}
            </div>
          </div>

          {installation?.last_test_at && (
            <div className="text-xs text-muted-foreground">
              Último teste: {new Date(installation.last_test_at).toLocaleString()}
              {installation.last_test_error ? ` — ${installation.last_test_error}` : ""}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            {!installed && (
              <Button onClick={doInstall} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Instalar
              </Button>
            )}
            {installed && (
              <>
                <Button variant="outline" onClick={doTest} disabled={busy}>
                  Testar conexão
                </Button>
                {settingsLink && (
                  <Button variant="outline" asChild>
                    <Link to={settingsLink}>Abrir configurações</Link>
                  </Button>
                )}
                <Button variant="destructive" onClick={doUninstall} disabled={busy}>
                  Remover
                </Button>
              </>
            )}
            {app.docs_url && (
              <Button variant="ghost" asChild>
                <a href={app.docs_url} target="_blank" rel="noreferrer">
                  Documentação
                </a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
