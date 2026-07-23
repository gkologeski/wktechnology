import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Trash2, ExternalLink, KeyRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  listZapierSubscriptions,
  deleteZapierSubscription,
  ZAPIER_TRIGGERS,
  ZAPIER_ACTIONS,
} from "@/lib/zapier.functions";

export const Route = createFileRoute("/_authenticated/settings/zapier")({
  component: ZapierSettingsPage,
});

function ZapierSettingsPage() {
  const list = useServerFn(listZapierSubscriptions);
  const del = useServerFn(deleteZapierSubscription);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["zapier-subs"], queryFn: list });
  const [busy, setBusy] = useState(false);

  const baseUrl = "https://app.wktechnology.com.br";

  async function remove(id: string) {
    setBusy(true);
    try {
      await del({ data: { id } });
      toast.success("Removido");
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 p-6 max-w-3xl">
      <PageHeader
        title="Zapier / Make"
        description="Triggers e actions REST para publicar automações no Zapier e Make."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" />
            Autenticação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Use uma API key do CRM como Bearer token em todas as chamadas. Crie uma chave em{" "}
            <Link to="/settings/api-keys" className="underline">
              API Keys
            </Link>
            .
          </p>
          <code className="block rounded-md border bg-muted/40 p-2 text-xs">
            Authorization: Bearer lvb_...
          </code>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Triggers (REST Hooks)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            Configure o Zapier para usar REST Hook. Subscribe POST cria a inscrição, Unsubscribe
            DELETE remove.
          </p>
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase text-muted-foreground">Subscribe URL</div>
            <code className="block rounded-md border bg-muted/40 p-2 text-xs">
              POST {baseUrl}/api/public/zapier/subscribe
            </code>
            <div className="text-xs text-muted-foreground">
              Body: {`{ "event": "lead.created", "target_url": "https://hooks.zapier.com/..." }`}
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase text-muted-foreground">
              Unsubscribe URL
            </div>
            <code className="block rounded-md border bg-muted/40 p-2 text-xs">
              DELETE {baseUrl}/api/public/zapier/unsubscribe/{`{id}`}
            </code>
          </div>
          <div className="space-y-1">
            <div className="text-xs font-medium uppercase text-muted-foreground">
              Perform List (test)
            </div>
            <code className="block rounded-md border bg-muted/40 p-2 text-xs">
              GET {baseUrl}/api/public/zapier/triggers/{`{event}`}
            </code>
          </div>
          <div>
            <div className="text-xs font-medium uppercase text-muted-foreground mb-1">
              Eventos suportados
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ZAPIER_TRIGGERS.map((t) => (
                <Badge key={t} variant="outline">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Actions reutilizam a API pública v1 do CRM. Autenticadas com a mesma API key.
          </p>
          <div className="space-y-1">
            {ZAPIER_ACTIONS.map((a) => (
              <div key={a.key} className="flex items-center justify-between rounded-md border p-2">
                <div>
                  <div className="font-medium">{a.label}</div>
                  <code className="text-xs text-muted-foreground">
                    {a.method} {baseUrl}
                    {a.path}
                  </code>
                </div>
                <Badge variant="outline">{a.key}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Inscrições ativas</span>
            <Button variant="ghost" size="sm" asChild>
              <a href="https://zapier.com" target="_blank" rel="noreferrer">
                Abrir Zapier <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (data?.subscriptions ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma inscrição. Crie um Zap usando a Subscribe URL acima.
            </p>
          ) : (
            <div className="space-y-2">
              {data!.subscriptions.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-md border p-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{s.event}</div>
                    <div className="text-xs text-muted-foreground truncate">{s.target_url}</div>
                    {s.last_delivery_at && (
                      <div className="text-xs text-muted-foreground">
                        Última entrega: {new Date(s.last_delivery_at).toLocaleString()} · status{" "}
                        {s.last_delivery_status ?? "—"}
                      </div>
                    )}
                  </div>
                  {!s.active && <Badge variant="destructive">Inativa</Badge>}
                  <Button size="icon" variant="ghost" onClick={() => remove(s.id)} disabled={busy}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
