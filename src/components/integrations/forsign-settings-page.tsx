import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, KeyRound, RefreshCw } from "lucide-react";
import { PageHeader, EmptyState, Skeletons, StatusBadge } from "@/components/techhire/ui";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  getForsignSettings,
  saveForsignSettings,
  testForsignSettings,
} from "@/lib/integrations/forsign/forsign.functions";

const STATUS: Record<string, { label: string; tone: "open" | "closed" | "draft" }> = {
  connected: { label: "Conectado", tone: "open" },
  failed: { label: "Falha na conexão", tone: "closed" },
  not_configured: { label: "Não configurado", tone: "draft" },
};

export function ForsignSettingsPage() {
  const { can, isLoading: loading } = usePermissions();
  const allowed = can("techcontracts.forsign_settings.manage.workspace");
  const load = useServerFn(getForsignSettings);
  const save = useServerFn(saveForsignSettings);
  const test = useServerFn(testForsignSettings);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["forsign-settings"],
    queryFn: () => load(),
    enabled: allowed,
    retry: false,
  });
  const [apiKey, setApiKey] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      const r = await fn();
      qc.setQueryData(["forsign-settings"], r);
      setApiKey("");
      setSecret("");
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível concluir.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Skeletons.Card />;
  if (!allowed)
    return (
      <EmptyState
        title="Sem acesso"
        description="Você não tem permissão para configurar a integração ForSign."
      />
    );
  const s = q.data;
  const st = STATUS[s?.status ?? "not_configured"];
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <PageHeader
        title="ForSign"
        description="Envie contratos para assinatura no ForSign e receba o PDF assinado automaticamente."
      />
      {q.isLoading ? (
        <Skeletons.Card />
      ) : q.error ? (
        <EmptyState
          title="Não foi possível carregar"
          description={q.error.message}
          action={<Button onClick={() => q.refetch()}>Tentar de novo</Button>}
        />
      ) : s ? (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Conexão</CardTitle>
                <StatusBadge status={st.tone} label={st.label} />
              </div>
              <CardDescription>
                Gere a chave no painel do ForSign em Configurações › Desenvolvedor › Configurações.
                {s.keyLast4 ? ` Chave salva termina em ••••${s.keyLast4}.` : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {s.lastError && (
                <p role="alert" className="text-sm text-destructive">
                  {s.lastError}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="fs-key">Chave da API (X-Api-Key)</Label>
                <Input
                  id="fs-key"
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={
                    s.configured ? "Deixe em branco para manter a atual" : "Cole a chave"
                  }
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="fs-enabled"
                  checked={s.enabled || !s.configured}
                  disabled={busy || !s.configured}
                  onCheckedChange={(v) =>
                    run(
                      () => save({ data: { enabled: v } }),
                      v ? "Integração ativada." : "Integração desativada.",
                    )
                  }
                />
                <Label htmlFor="fs-enabled">Integração ativa neste workspace</Label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy || apiKey.trim().length < 16}
                  onClick={() =>
                    run(
                      () => save({ data: { apiKey: apiKey.trim(), enabled: true } }),
                      "Chave salva.",
                    )
                  }
                >
                  <KeyRound className="mr-2 h-4 w-4" aria-hidden />
                  Salvar e testar
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || !s.configured}
                  onClick={() => run(() => test(), "Conexão testada.")}
                >
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
                  Testar conexão
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Aviso automático (webhook)</CardTitle>
                <StatusBadge
                  status={s.hasWebhookSecret ? "open" : "draft"}
                  label={s.hasWebhookSecret ? "Segredo salvo" : "Pendente"}
                />
              </div>
              <CardDescription>
                No ForSign, em Configurações › Desenvolvedor › Webhooks, crie webhooks com este
                endereço para as ações "Documento assinado", "Operação concluída", "Documento
                pronto" e "Atualização da operação". Depois copie o segredo gerado pelo ForSign e
                cole abaixo. Sem webhook, o TechERP confere os envios a cada 2 minutos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fs-url">Endereço do webhook</Label>
                <div className="flex gap-2">
                  <Input id="fs-url" readOnly value={s.webhookUrl} />
                  <Button
                    variant="outline"
                    aria-label="Copiar endereço do webhook"
                    onClick={() => {
                      void navigator.clipboard.writeText(s.webhookUrl);
                      toast.success("Endereço copiado.");
                    }}
                  >
                    <Copy className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fs-secret">Segredo do webhook (gerado pelo ForSign)</Label>
                <Input
                  id="fs-secret"
                  type="password"
                  autoComplete="off"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value)}
                  placeholder={
                    s.hasWebhookSecret ? "Deixe em branco para manter o atual" : "Cole o segredo"
                  }
                />
              </div>
              <Button
                disabled={busy || secret.trim().length < 16 || !s.configured}
                onClick={() =>
                  run(
                    () => save({ data: { webhookSecret: secret.trim(), enabled: s.enabled } }),
                    "Segredo salvo.",
                  )
                }
              >
                Salvar segredo
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
