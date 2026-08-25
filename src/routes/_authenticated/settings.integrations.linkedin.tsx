import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Linkedin,
  Link2,
  Power,
  RefreshCw,
  Clock,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  getLinkedinAccount,
  startLinkedinConnect,
  disconnectLinkedinAccount,
  updateDailyWindow,
  getRateUsage,
  reconcileLinkedinAccount,
  checkUnipileCredentials,
} from "@/lib/unipile/accounts.functions";

const searchSchema = z
  .object({
    connected: z
      .union([z.string(), z.number(), z.boolean()])
      .transform((v) => (v === true || v === 1 || v === "1" ? "1" : "0"))
      .optional(),
    // `state` = connect_token devolvido pelo hosted auth (API v2).
    state: z.string().trim().max(128).optional(),
  })
  .passthrough();

export const Route = createFileRoute("/_authenticated/settings/integrations/linkedin")({
  validateSearch: (s: Record<string, unknown>) => searchSchema.parse(s),
  component: LinkedinIntegrationPage,
});

type AccountRow = {
  id: string;
  status: "pending" | "connected" | "disconnected" | "error";
  unipile_account_id: string | null;
  display_name: string | null;
  connected_at: string | null;
  last_seen_at: string | null;
  daily_window: { tz?: string; start_hour?: number; end_hour?: number } | null;
  last_error: string | null;
};

type Bucket = { endpoint: string; count: number; day_utc: string; last_request_at?: string };

const STATUS_LABEL: Record<AccountRow["status"], string> = {
  connected: "Conectado",
  pending: "Aguardando conexão",
  disconnected: "Desconectado",
  error: "Erro",
};
const STATUS_VARIANT: Record<
  AccountRow["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  connected: "default",
  pending: "secondary",
  disconnected: "outline",
  error: "destructive",
};

function LinkedinIntegrationPage() {
  const search = useSearch({ from: Route.id });
  const loadAccount = useServerFn(getLinkedinAccount);
  const loadUsage = useServerFn(getRateUsage);
  const startConnect = useServerFn(startLinkedinConnect);
  const disconnect = useServerFn(disconnectLinkedinAccount);
  const saveWindow = useServerFn(updateDailyWindow);
  const reconcile = useServerFn(reconcileLinkedinAccount);
  const checkCreds = useServerFn(checkUnipileCredentials);

  const [account, setAccount] = useState<AccountRow | null>(null);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [credStatus, setCredStatus] = useState<{
    ok: boolean;
    message: string;
    detail?: string | null;
  } | null>(null);
  const [tz, setTz] = useState("America/Sao_Paulo");
  const [startHour, setStartHour] = useState(8);
  const [endHour, setEndHour] = useState(20);

  const refresh = async () => {
    setLoading(true);
    try {
      const [a, u] = await Promise.all([loadAccount({}), loadUsage({})]);
      setAccount((a.account as AccountRow | null) ?? null);
      setBuckets((u.buckets as Bucket[]) ?? []);
      if (a.account?.daily_window) {
        const w = a.account.daily_window as AccountRow["daily_window"];
        setTz(w?.tz ?? "America/Sao_Paulo");
        setStartHour(w?.start_hour ?? 8);
        setEndHour(w?.end_hour ?? 20);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (search.connected === "1") {
      toast.success("Conta LinkedIn conectada via Unipile.");
      // Fallback caso o webhook ainda não tenha chegado: reconcilia via API.
      // Na v2 o `state` é a correlação com o connect_token emitido no início.
      (async () => {
        try {
          await reconcile({ data: search.state ? { state: search.state } : {} });
        } catch {
          /* ignora */
        }
        await refresh();
      })();
    }
    if (search.connected === "0") toast.error("Falha ao conectar conta LinkedIn.");
  }, [search.connected, search.state]);

  const onCheckCredentials = async () => {
    setChecking(true);
    try {
      const r = await checkCreds({});
      setCredStatus({ ok: r.ok, message: r.message, detail: "detail" in r ? r.detail : null });
      if (r.ok) toast.success(r.message);
      else toast.error(r.message);
    } catch (e) {
      const message = (e as Error).message;
      setCredStatus({ ok: false, message });
      toast.error(message);
    } finally {
      setChecking(false);
    }
  };

  const onConnect = async () => {
    setConnecting(true);
    try {
      const r = await startConnect({});
      if (r.url) window.location.href = r.url;
      else toast.error("Não foi possível iniciar a conexão.");
    } catch (e) {
      const message = (e as Error).message;
      setCredStatus({ ok: false, message });
      toast.error(message);
    } finally {
      setConnecting(false);
    }
  };

  const onDisconnect = async () => {
    if (!(await confirmDialog("Desconectar conta LinkedIn?"))) return;
    await disconnect({});
    toast.success("Desconectada.");
    refresh();
  };

  const onSaveWindow = async () => {
    try {
      await saveWindow({ data: { tz, start_hour: startHour, end_hour: endHour } });
      toast.success("Janela horária atualizada.");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const dailyLimits: Record<string, number> = {
    "profile.fetch": 80,
    "profile.search": 20,
    "message.send": 40,
    "invite.send": 15,
    "chat.list": 200,
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Linkedin className="h-6 w-6 text-[#0A66C2]" />
            LinkedIn via Unipile
          </h1>
          <p className="text-sm text-muted-foreground">
            Conecte sua conta LinkedIn para buscar perfis, capturar candidatos e enviar mensagens
            respeitando limites human-like.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Status da conta
            {account && (
              <Badge variant={STATUS_VARIANT[account.status]}>{STATUS_LABEL[account.status]}</Badge>
            )}
          </CardTitle>
          <CardDescription>
            A conexão é feita via Unipile Hosted Auth — suas credenciais LinkedIn nunca passam pelo
            TechHire.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : !account || account.status === "disconnected" ? (
            <Button onClick={onConnect} disabled={connecting}>
              <Link2 className="h-4 w-4 mr-2" />
              {connecting ? "Abrindo Unipile…" : "Conectar LinkedIn"}
            </Button>
          ) : account.status === "pending" ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Conexão pendente. Se já fechou a janela, tente novamente.
              </p>
              <Button onClick={onConnect} disabled={connecting}>
                <Link2 className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          ) : account.status === "error" ? (
            <div className="space-y-2">
              <p className="text-sm text-destructive">
                {account.last_error ?? "Erro ao conectar."}
              </p>
              <Button onClick={onConnect} disabled={connecting}>
                <Link2 className="h-4 w-4 mr-2" />
                Reconectar
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-sm">
                <span className="text-muted-foreground">Conectada em:</span>{" "}
                {account.connected_at ? new Date(account.connected_at).toLocaleString() : "—"}
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Último uso:</span>{" "}
                {account.last_seen_at ? new Date(account.last_seen_at).toLocaleString() : "—"}
              </div>
              <Button variant="outline" onClick={onDisconnect}>
                <Power className="h-4 w-4 mr-2" />
                Desconectar
              </Button>
            </div>
          )}

          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Credenciais da API Unipile</p>
                <p className="text-xs text-muted-foreground">
                  Verifique se a chave da API (v2) configurada é aceita pela Unipile.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onCheckCredentials}
                disabled={checking}
                aria-label="Testar credenciais da API Unipile"
              >
                <KeyRound className={`h-4 w-4 mr-2 ${checking ? "animate-pulse" : ""}`} />
                {checking ? "Testando…" : "Testar credenciais"}
              </Button>
            </div>
            {credStatus && (
              <div
                role="status"
                aria-live="polite"
                className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
                  credStatus.ok
                    ? "border-primary/30 bg-primary/5 text-foreground"
                    : "border-destructive/30 bg-destructive/5 text-destructive"
                }`}
              >
                {credStatus.ok ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <div className="space-y-1">
                  <p>{credStatus.message}</p>
                  {credStatus.detail && (
                    <p className="text-xs opacity-80 break-all">{credStatus.detail}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Janela horária (uso human-like)
          </CardTitle>
          <CardDescription>
            Requisições só são executadas dentro desta janela no fuso indicado, simulando uso
            humano.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Fuso horário</Label>
              <Input
                value={tz}
                onChange={(e) => setTz(e.target.value)}
                placeholder="America/Sao_Paulo"
              />
            </div>
            <div>
              <Label>Início (h)</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={startHour}
                onChange={(e) => setStartHour(parseInt(e.target.value || "0", 10))}
              />
            </div>
            <div>
              <Label>Fim (h)</Label>
              <Input
                type="number"
                min={1}
                max={24}
                value={endHour}
                onChange={(e) => setEndHour(parseInt(e.target.value || "0", 10))}
              />
            </div>
          </div>
          <Button onClick={onSaveWindow} disabled={!account || account.status === "disconnected"}>
            Salvar janela
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Uso de hoje</CardTitle>
          <CardDescription>
            Cada operação respeita um budget diário separado para proteger sua conta LinkedIn.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {Object.entries(dailyLimits).map(([endpoint, limit]) => {
            const used = buckets.find((b) => b.endpoint === endpoint)?.count ?? 0;
            const pct = Math.min(100, Math.round((used / limit) * 100));
            return (
              <div key={endpoint} className="space-y-1">
                <div className="flex items-center justify-between">
                  <code className="text-xs">{endpoint}</code>
                  <span className="text-muted-foreground">
                    {used} / {limit}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded">
                  <div className="h-full bg-primary rounded" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
