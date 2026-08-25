import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Mail, Plug, RefreshCw, Trash2 } from "lucide-react";
import {
  listEmailAccounts,
  startGmailOAuth,
  disconnectEmailAccount,
} from "@/lib/email-accounts.functions";
import { syncMyEmailAccounts } from "@/lib/gmail-sync.functions";
import { SendEmailDialog } from "@/components/email/send-email-dialog";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { EmailSignatureEditor } from "@/components/email/email-signature-editor";

const searchSchema = z.object({ gmail: z.string().optional() });
const GOOGLE_OAUTH_MESSAGE_ORIGINS = new Set(["https://crm.wktechnology.com.br"]);

function isTrustedGoogleOAuthMessageOrigin(origin: string) {
  return origin === window.location.origin || GOOGLE_OAUTH_MESSAGE_ORIGINS.has(origin);
}

export const Route = createFileRoute("/_authenticated/settings/email")({
  validateSearch: searchSchema,
  component: EmailSettings,
});

function EmailSettings() {
  const qc = useQueryClient();
  const search = useSearch({ from: "/_authenticated/settings/email" });
  const start = useServerFn(startGmailOAuth);
  const list = useServerFn(listEmailAccounts);
  const disconnect = useServerFn(disconnectEmailAccount);
  const syncNow = useServerFn(syncMyEmailAccounts);

  const { data, isLoading } = useQuery({
    queryKey: ["email_accounts"],
    queryFn: () => list(),
  });

  const syncMut = useMutation({
    mutationFn: (accountId?: string) =>
      syncNow({ data: accountId ? { account_id: accountId } : {} }),
    onSuccess: (res) => {
      const inserted = res.results.reduce((a, r) => a + r.inserted, 0);
      const errs = res.results.filter((r) => r.error);
      if (errs.length) toast.error(`Erros: ${errs.map((e) => e.error).join("; ")}`);
      toast.success(
        inserted > 0 ? `${inserted} mensagem(ns) sincronizada(s)` : "Nenhuma mensagem nova",
      );
      qc.invalidateQueries({ queryKey: ["email_accounts"] });
      qc.invalidateQueries({ queryKey: ["email_threads"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (search.gmail === "connected") {
      toast.success("Gmail conectado com sucesso");
      qc.invalidateQueries({ queryKey: ["email_accounts"] });
    }
  }, [search.gmail, qc]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isTrustedGoogleOAuthMessageOrigin(event.origin)) return;
      const data = event.data as { type?: string; integration?: string };
      if (data.type !== "google-oauth-connected" || data.integration !== "gmail") return;
      toast.success("Gmail conectado com sucesso");
      qc.invalidateQueries({ queryKey: ["email_accounts"] });
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [qc]);

  const connect = async () => {
    const oauthWindow = window.open("about:blank", "google-gmail-oauth");
    try {
      const r = await start({
        data: { return_to: "/settings/email", origin: window.location.origin },
      });
      if (oauthWindow) {
        oauthWindow.location.href = r.url;
        oauthWindow.focus();
        toast.info("Finalize a conexão do Google na nova aba.");
        return;
      }
      const fallback = window.open(r.url, "_blank", "noopener,noreferrer");
      if (fallback) {
        toast.info("Finalize a conexão do Google na nova aba.");
        return;
      }
      window.location.assign(r.url);
    } catch (e) {
      oauthWindow?.close();
      toast.error(e instanceof Error ? e.message : "Erro ao iniciar OAuth");
    }
  };

  const remove = async (id: string) => {
    if (!(await confirmDialog("Desconectar esta conta?"))) return;
    try {
      await disconnect({ data: { id } });
      toast.success("Conta desconectada");
      qc.invalidateQueries({ queryKey: ["email_accounts"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const items = data?.items ?? [];

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardContent className="pt-6 flex items-center justify-between gap-4">
          <div>
            <div className="font-medium flex items-center gap-2">
              <Mail className="h-4 w-4" /> Gmail
            </div>
            <p className="text-sm text-muted-foreground">
              Conecte sua conta Gmail para enviar e receber emails dentro do CRM.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <SendEmailDialog />
            <Button onClick={connect}>
              <Plug className="h-4 w-4 mr-1" /> Conectar Gmail
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Contas conectadas</h3>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta conectada ainda.</p>
        ) : (
          items.map((a) => (
            <div key={a.id} className="space-y-2">
              <Card>
                <CardContent className="pt-6 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{a.email}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                      <Badge variant="outline">{a.provider}</Badge>
                      <Badge variant={a.status === "connected" ? "default" : "destructive"}>
                        {a.status}
                      </Badge>
                      {a.last_sync_at && (
                        <span>último sync: {new Date(a.last_sync_at).toLocaleString()}</span>
                      )}
                    </div>
                    {a.last_error && (
                      <p className="text-xs text-destructive mt-1">{a.last_error}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => syncMut.mutate(a.id)}
                      disabled={syncMut.isPending}
                      title="Sincronizar agora"
                    >
                      <RefreshCw
                        className={`h-3 w-3 mr-1 ${syncMut.isPending ? "animate-spin" : ""}`}
                      />
                      Sincronizar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(a.id)}
                      title="Desconectar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <EmailSignatureEditor
                accountId={a.id}
                accountEmail={a.email}
                initialHtml={a.signature_html ?? null}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
