import { formatDateTime } from "@/lib/crm";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/access-control/use-permissions";
import {
  INTEGRATIONS_MANAGE,
  INTEGRATIONS_PERMS,
} from "@/lib/access-control/admin-permission-keys";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Trash2, Eye, XCircle } from "lucide-react";
import { getProvider } from "@/lib/integrations/registry";
import {
  listIntegrations,
  upsertIntegration,
  disconnectIntegration,
  listJobs,
  getCreditUsage,
  setCreditLimit,
  sweepZombieJobs,
  cancelJob,
} from "@/lib/integrations/core.functions";
import { enrichCompaniesAddress } from "@/lib/integrations/viacep.functions";
import { HubspotImportWizard } from "@/components/hubspot/import-wizard";
import { ImportTimeline } from "@/components/hubspot/import-timeline";
import { HubspotTwoWaySync } from "@/components/hubspot/two-way-sync";
import { HubspotLossReasonsSync } from "@/components/hubspot/loss-reasons-sync";
import { HubspotMaintenancePanel } from "@/components/hubspot/maintenance-panel";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { confirmDialog } from "@/components/ui/confirm-dialog";


export function IntegrationDetail({ slug }: { slug: string }) {
    const navigate = useNavigate();
  const qc = useQueryClient();
  const provider = getProvider(slug);

  const list = useServerFn(listIntegrations);
  const jobs = useServerFn(listJobs);
  const usage = useServerFn(getCreditUsage);
  const upsert = useServerFn(upsertIntegration);
  const disconnect = useServerFn(disconnectIntegration);
  const setLimit = useServerFn(setCreditLimit);
  const enrichCeps = useServerFn(enrichCompaniesAddress);
  const sweep = useServerFn(sweepZombieJobs);
  const cancel = useServerFn(cancelJob);

  const { data: integrations } = useQuery({
    queryKey: ["integrations", "list"],
    queryFn: () => list({}),
  });
  const { data: jobsData, refetch: refetchJobs } = useQuery({
    queryKey: ["integrations", slug, "jobs"],
    queryFn: () => jobs({ data: { provider: slug } }),
    refetchInterval: 5000,
  });
  const { data: usageData } = useQuery({
    queryKey: ["integrations", slug, "usage"],
    queryFn: () => usage({ data: { provider: slug } }),
    enabled: provider?.authMode === "api_key",
  });

  const [config, setConfig] = useState<Record<string, string>>({});
  const [autoOnCreate, setAutoOnCreate] = useState(false);
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [confirmAbove, setConfirmAbove] = useState("10");
  const [liveJobId, setLiveJobId] = useState<string | null>(null);

  // Limpa jobs zumbis (status "running" sem progresso há mais de ~90s) ao
  // entrar na tela e a cada 30s, para refletir o estado real.
  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const r = await sweep({ data: { provider: slug } });
        if (alive && r.swept > 0) refetchJobs();
      } catch {
        /* silencioso */
      }
    };
    run();
    const t = setInterval(run, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [slug, sweep, refetchJobs]);

  const handleCancelJob = async (jobId: string) => {
    if (!(await confirmDialog("Cancelar esta execução? O job será marcado como falho."))) return;
    try {
      await cancel({ data: { jobId } });
      toast.success("Execução cancelada");
      refetchJobs();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao cancelar");
    }
  };

  if (!provider) {
    return (
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/settings/integrations">
            <ArrowLeft className="h-4 w-4 mr-1" /> Integrações
          </Link>
        </Button>
        <p className="mt-4 text-muted-foreground">Provedor não encontrado.</p>
      </div>
    );
  }

  const integration = (integrations?.items ?? []).find((i) => i.provider === provider.slug);
  const isConnected = integration?.status === "connected";

  const cfg = (integration?.config ?? {}) as Record<string, unknown>;

  const handleConnect = async () => {
    try {
      const merged: Record<string, unknown> = {
        ...cfg,
        ...config,
        auto_enrich_on_create: autoOnCreate,
      };
      await upsert({ data: { provider: provider.slug, status: "connected", config: merged } });
      toast.success(`${provider.name} conectado`);
      qc.invalidateQueries({ queryKey: ["integrations"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const handleDisconnect = async () => {
    if (!(await confirmDialog(`Desconectar ${provider.name}?`))) return;
    await disconnect({ data: { provider: provider.slug } });
    toast.success("Desconectado");
    qc.invalidateQueries({ queryKey: ["integrations"] });
  };

  const handleSaveLimits = async () => {
    await setLimit({
      data: {
        provider: provider.slug,
        monthly_limit: monthlyLimit ? Number(monthlyLimit) : null,
        per_run_confirm_above: Number(confirmAbove || 10),
      },
    });
    toast.success("Limites salvos");
    qc.invalidateQueries({ queryKey: ["integrations", slug, "usage"] });
  };

  const runEnrichAllAddresses = async () => {
    if (
      !(await confirmDialog(
        "Buscar endereço (ViaCEP) de todas as empresas com CEP preenchido e cidade vazia?",
      ))
    )
      return;
    const r = await enrichCeps({ data: { all_missing: true } });
    toast.success(`${r.succeeded} atualizada(s) · ${r.failed} falhas · ${r.skipped} sem CEP`);
    qc.invalidateQueries({ queryKey: ["integrations", slug, "jobs"] });
  };

  return (
    <div>
      <Button variant="ghost" size="sm" asChild className="mb-2">
        <Link to="/settings/integrations">
          <ArrowLeft className="h-4 w-4 mr-1" /> Integrações
        </Link>
      </Button>

      <PageHeader
        title={provider.name}
        description={provider.description}
        actions={
          <>
            <a href={provider.docs} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm">
                Documentação <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </a>
            {isConnected && (
              <Can any={INTEGRATIONS_PERMS.delete}>
                <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                  <Trash2 className="h-4 w-4 mr-1" /> Desconectar
                </Button>
              </Can>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <section className="rounded-lg border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Conexão</h2>
              {isConnected ? (
                <Badge>Conectado</Badge>
              ) : (
                <Badge variant="outline">Não conectado</Badge>
              )}
            </div>

            <ConnectionForm
              provider={provider}
              config={config}
              setConfig={setConfig}
              autoOnCreate={autoOnCreate}
              setAutoOnCreate={setAutoOnCreate}
              currentConfig={cfg}
            />

            <div className="mt-4 flex gap-2">
              <Can any={INTEGRATIONS_MANAGE}>
                <Button onClick={handleConnect}>{isConnected ? "Salvar" : "Conectar"}</Button>
              </Can>
            </div>
          </section>

          {isConnected && provider.supports.enrichAll && provider.slug === "viacep" && (
            <section className="rounded-lg border bg-card p-5">
              <h2 className="font-semibold mb-2">Ações</h2>
              <p className="text-sm text-muted-foreground mb-3">
                Roda em todas as empresas com CEP preenchido e cidade vazia.
              </p>
              <Button onClick={runEnrichAllAddresses}>Enriquecer endereços (ViaCEP)</Button>
            </section>
          )}

          {isConnected && provider.slug === "hubspot" && (
            <Tabs defaultValue="connect" className="w-full">
              <TabsList>
                <TabsTrigger value="connect">Conectar e Integrar</TabsTrigger>
                <TabsTrigger value="operate">Operar e Manter</TabsTrigger>
              </TabsList>
              <TabsContent value="connect" className="space-y-6 mt-4">
                <section className="rounded-lg border bg-card p-5">
                  <h2 className="font-semibold mb-1">Importar do HubSpot</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Importação respeitando árvore de dependências (empresas → contatos → negócios →
                    atividades).
                  </p>
                  <HubspotImportWizard />
                </section>

                <section className="rounded-lg border bg-card p-5">
                  <h2 className="font-semibold mb-1">Sincronização bidirecional</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Envia alterações locais (contatos, empresas, negócios) de volta para o HubSpot.
                    Conflitos (alterado dos dois lados desde a última sync) ficam listados para
                    revisão manual.
                  </p>
                  <HubspotTwoWaySync />
                </section>

                <section className="rounded-lg border bg-card p-5">
                  <h2 className="font-semibold mb-1">Motivos de negócio perdido</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Importa as opções da propriedade <code>closed_lost_reason</code> do HubSpot para
                    a base local e preenche o motivo dos negócios marcados como perdidos que ainda
                    não o tenham registrado.
                  </p>
                  <HubspotLossReasonsSync />
                </section>
              </TabsContent>
              <TabsContent value="operate" className="space-y-6 mt-4">
                <HubspotMaintenancePanel />
              </TabsContent>
            </Tabs>
          )}

          {isConnected && provider.authMode === "api_key" && (
            <section className="rounded-lg border bg-card p-5">
              <h2 className="font-semibold mb-3">Créditos e limites</h2>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Usados este mês</p>
                  <p className="text-2xl font-semibold">{usageData?.used ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Limite mensal</p>
                  <p className="text-2xl font-semibold">{usageData?.monthly_limit ?? "—"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Limite mensal (vazio = sem limite)</Label>
                  <Input
                    type="number"
                    placeholder={String(usageData?.monthly_limit ?? "")}
                    value={monthlyLimit}
                    onChange={(e) => setMonthlyLimit(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Confirmar acima de N créditos por execução</Label>
                  <Input
                    type="number"
                    placeholder={String(usageData?.per_run_confirm_above ?? 10)}
                    value={confirmAbove}
                    onChange={(e) => setConfirmAbove(e.target.value)}
                  />
                </div>
              </div>
              <Button className="mt-3" size="sm" variant="outline" onClick={handleSaveLimits}>
                Salvar limites
              </Button>
            </section>
          )}

          <section className="rounded-lg border bg-card p-5">
            <h2 className="font-semibold mb-3">Histórico de execuções</h2>
            {(jobsData?.items ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma execução ainda.</p>
            ) : (
              <ul className="space-y-2">
                {jobsData!.items.slice(0, 10).map((j) => {
                  const isRunning = j.status === "running";
                  const canInspect =
                    slug === "hubspot" && ["running", "failed", "done"].includes(j.status);
                  const stamp = (j.updated_at ?? j.started_at) as string | null;
                  const idleMs = stamp ? Date.now() - new Date(stamp).getTime() : 0;
                  const idleLabel =
                    idleMs < 60_000
                      ? `${Math.max(0, Math.floor(idleMs / 1000))}s`
                      : idleMs < 3_600_000
                        ? `${Math.floor(idleMs / 60_000)}m`
                        : `${Math.floor(idleMs / 3_600_000)}h${Math.floor((idleMs % 3_600_000) / 60_000)}m`;
                  return (
                    <li
                      key={j.id}
                      className="flex items-center justify-between gap-3 text-sm border-b pb-2 last:border-0"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate">
                          <span className="font-medium">{j.kind}</span>
                          <span className="text-muted-foreground"> · {j.entity ?? "—"}</span>
                          <span className="text-muted-foreground">
                            {" "}
                            · {formatDateTime(j.created_at)}
                          </span>
                        </div>
                        {isRunning && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Última atualização há {idleLabel}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-muted-foreground tabular-nums">
                          {j.succeeded}/{j.total} ok{j.failed ? ` · ${j.failed} falhas` : ""}
                        </span>
                        <Badge
                          variant={
                            j.status === "done"
                              ? "default"
                              : j.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {j.status}
                        </Badge>
                        {canInspect && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setLiveJobId(j.id)}
                            title="Abrir detalhes da execução"
                          >
                            <Eye className="h-3.5 w-3.5 mr-1" />{" "}
                            {isRunning ? "Acompanhar" : "Detalhes"}
                          </Button>
                        )}
                        {isRunning && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelJob(j.id)}
                              title="Cancelar execução"
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <Dialog open={!!liveJobId} onOpenChange={(o) => !o && setLiveJobId(null)}>
            <DialogContent className="max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Acompanhamento em tempo real</DialogTitle>
              </DialogHeader>
              {liveJobId && <ImportTimeline jobId={liveJobId} onReset={() => setLiveJobId(null)} />}
            </DialogContent>
          </Dialog>
        </div>

        <aside className="space-y-4">
          <section className="rounded-lg border bg-card p-4">
            <h3 className="font-semibold mb-2">Recursos</h3>
            <ul className="space-y-1 text-sm">
              {provider.supports.import && <li>✓ Importação</li>}
              {provider.supports.enrich && <li>✓ Enriquecimento individual</li>}
              {provider.supports.bulkEnrich && <li>✓ Enriquecimento em lote</li>}
              {provider.supports.enrichAll && <li>✓ Enriquecer tudo</li>}
              {provider.supports.autoOnCreate && <li>✓ Automático ao criar</li>}
              {provider.supports.pushTask && <li>✓ Criar tarefas externas</li>}
              {provider.supports.sync && <li>✓ Sincronização</li>}
              {provider.supports.addressLookup && <li>✓ Busca de endereço</li>}
            </ul>
          </section>
          <section className="rounded-lg border bg-card p-4 text-sm">
            <h3 className="font-semibold mb-2">Aplicado em</h3>
            <p className="text-muted-foreground">
              {provider.entities
                .map(
                  (e) =>
                    ({ lead: "Leads", contact: "Contatos", company: "Empresas", deal: "Negócios" })[
                      e
                    ],
                )
                .join(", ")}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function ConnectionForm({
  provider,
  config,
  setConfig,
  autoOnCreate,
  setAutoOnCreate,
  currentConfig,
}: {
  provider: ReturnType<typeof getProvider>;
  config: Record<string, string>;
  setConfig: (v: Record<string, string>) => void;
  autoOnCreate: boolean;
  setAutoOnCreate: (b: boolean) => void;
  currentConfig: Record<string, unknown>;
}) {
  if (!provider) return null;

  if (provider.authMode === "none") {
    return (
      <p className="text-sm text-muted-foreground">
        Esta integração não exige autenticação. Clique em <strong>Conectar</strong> para ativá-la.
      </p>
    );
  }

  if (provider.authMode === "connector_gateway") {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Esta integração usa o conector oficial gerenciado pelo Lovable. Conecte sua conta em{" "}
          <strong>Connectors</strong> e depois clique em <strong>Conectar</strong> aqui para
          registrar a conexão no CRM.
        </p>
        <p className="text-muted-foreground">
          Endpoint usado:{" "}
          <code className="bg-muted px-1 rounded">
            connector-gateway.lovable.dev/{provider.slug}
          </code>
        </p>
      </div>
    );
  }

  if (provider.authMode === "api_key") {
    const keyName = `${provider.slug.toUpperCase()}_API_KEY`;
    return (
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Adicione a chave <code className="bg-muted px-1 rounded">{keyName}</code> nos Secrets do
          projeto (Backend → Secrets) e depois clique em <strong>Conectar</strong> para ativar.
        </p>
        <a
          href={provider.docs}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline text-xs"
        >
          Onde encontrar a chave →
        </a>
        {provider.supports.autoOnCreate && (
          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              id="auto"
              checked={autoOnCreate || !!currentConfig.auto_enrich_on_create}
              onCheckedChange={(v) => setAutoOnCreate(!!v)}
            />
            <Label htmlFor="auto" className="cursor-pointer">
              Enriquecer automaticamente ao criar novo registro
            </Label>
          </div>
        )}
      </div>
    );
  }

  if (provider.authMode === "personal_token_or_oauth") {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-muted-foreground">
          Adicione seu Personal Token em{" "}
          <code className="bg-muted px-1 rounded">CLICKUP_API_TOKEN</code> nos Secrets e configure
          abaixo a Lista padrão onde as tarefas serão criadas.
        </p>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label className="text-xs">List ID padrão</Label>
            <Input
              placeholder={String(currentConfig.list_id ?? "")}
              value={config.list_id ?? ""}
              onChange={(e) => setConfig({ ...config, list_id: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Pegue o ID da URL da lista no ClickUp.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (provider.authMode === "oauth") {
    return (
      <div className="space-y-2 text-sm">
        <Badge variant="outline">OAuth — em breve</Badge>
        <p className="text-muted-foreground">
          A autenticação OAuth para {provider.name} ainda não está disponível. Em breve será
          possível conectar diretamente por aqui.
        </p>
      </div>
    );
  }

  return null;
}
