// Tela do importador Jibble → TechProjects (contêiner: dados e ações).
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ClipboardCheck, Download, Eye, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, FormSection, PageHeader, Skeletons } from "@/components/techhire/ui";
import {
  MappingsTable,
  StagingTable,
  type MappingRow,
  type StagingRow,
  type TargetOption,
} from "@/components/projects/clockify-import/clockify-review";
import {
  advanceJibbleImportRun,
  confirmJibbleImportPreview,
  confirmJibbleImportSource,
  decideJibbleImportDuplicate,
  getJibbleImportStatus,
  jibbleImportTargetOptions,
  listJibbleImportDuplicates,
  listJibbleImportMappings,
  listJibbleImportStaging,
  removeJibbleImportConnection,
  saveJibbleImportConnection,
  setJibbleImportMapping,
  setJibbleImportRunState,
  startJibbleImportRun,
  testJibbleImportConnection,
} from "@/lib/integrations/jibble/jibble.functions";
import { JB_STATUS_LABEL } from "@/lib/integrations/jibble/jibble-format";
import {
  JB_ENTITY_LABEL,
  JB_REASON_LABEL,
  canReadWholeOrg,
} from "@/lib/integrations/jibble/jibble-map";
import {
  JbConnectionSection,
  JbDuplicatesTable,
  JbOrgSection,
  JbReport,
  JbRunProgress,
  JbRunsHistory,
  type JbConnectionView,
  type JbDuplicateRow,
  type JbRunView,
} from "./jibble-sections";

const ACTIVE = ["queued", "running", "cancel_requested"];
const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");
const STAGING_ENTITIES = [
  "interval",
  "time_entry",
  "hour_entry",
  "timesheet_day",
  "person",
  "project",
  "activity",
  "client",
];

type MapEntity = "person" | "client" | "project";

export function JibbleImportPage() {
  const qc = useQueryClient();
  const fStatus = useServerFn(getJibbleImportStatus);
  const fSave = useServerFn(saveJibbleImportConnection);
  const fRemove = useServerFn(removeJibbleImportConnection);
  const fTest = useServerFn(testJibbleImportConnection);
  const fConfirmOrg = useServerFn(confirmJibbleImportSource);
  const fStart = useServerFn(startJibbleImportRun);
  const fAdvance = useServerFn(advanceJibbleImportRun);
  const fState = useServerFn(setJibbleImportRunState);
  const fConfirm = useServerFn(confirmJibbleImportPreview);
  const fMappings = useServerFn(listJibbleImportMappings);
  const fSetMapping = useServerFn(setJibbleImportMapping);
  const fOptions = useServerFn(jibbleImportTargetOptions);
  const fStaging = useServerFn(listJibbleImportStaging);
  const fDups = useServerFn(listJibbleImportDuplicates);
  const fDecide = useServerFn(decideJibbleImportDuplicate);

  const status = useQuery({ queryKey: ["jibble-import", "status"], queryFn: () => fStatus() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["jibble-import"] });
  const act = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onError: (e) => toast.error(errMsg(e)),
    onSettled: () => refresh(),
  });
  const busy = act.isPending;

  const conn = status.data?.connection as JbConnectionView | undefined;
  const runs = (status.data?.runs ?? []) as JbRunView[];
  const activeRun = runs.find((r) => ACTIVE.includes(r.status) || r.status === "paused") ?? null;
  const lastPreview = runs.find((r) => r.kind === "dry_run" && r.status === "completed") ?? null;
  const ready = !!conn?.org?.confirmedAt && canReadWholeOrg(conn.org.access);

  // Avança enquanto a tela está aberta (o agendador, quando ativo, faz o mesmo).
  const live = useQuery({
    queryKey: ["jibble-import", "advance", activeRun?.id],
    enabled: !!activeRun && ACTIVE.includes(activeRun.status),
    queryFn: () => fAdvance({ data: { runId: activeRun!.id } }),
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
  });
  useEffect(() => {
    if (live.data) void qc.invalidateQueries({ queryKey: ["jibble-import", "status"] });
  }, [live.data, qc]);

  const [mapEntity, setMapEntity] = useState<MapEntity>("person");
  const [optQ, setOptQ] = useState("");
  const maps = useQuery({
    queryKey: ["jibble-import", "maps", mapEntity],
    enabled: !!conn?.org,
    queryFn: () => fMappings({ data: { entity: mapEntity } }),
  });
  const opts = useQuery({
    queryKey: ["jibble-import", "opts", mapEntity, optQ],
    enabled: !!conn?.org,
    queryFn: () => fOptions({ data: { entity: mapEntity, q: optQ } }),
  });
  const [dupFilter, setDupFilter] = useState<"pending" | "all">("pending");
  const dups = useQuery({
    queryKey: ["jibble-import", "dups", dupFilter],
    enabled: !!conn?.org,
    queryFn: () =>
      fDups({ data: { decision: dupFilter === "pending" ? "pending" : null, page: 0 } }),
  });
  const [stEntity, setStEntity] = useState("interval");
  const [stStatus, setStStatus] = useState<string>("pending_review");
  const [stPage, setStPage] = useState(0);
  const staging = useQuery({
    queryKey: ["jibble-import", "staging", stEntity, stStatus, stPage],
    enabled: !!conn?.org,
    queryFn: () =>
      fStaging({
        data: { entity: stEntity, status: stStatus === "all" ? null : stStatus, page: stPage },
      }),
  });

  if (status.isLoading)
    return (
      <div className="space-y-4">
        <Skeletons.Card />
        <Skeletons.Card />
      </div>
    );
  if (status.isError || !conn)
    return (
      <EmptyState
        title="Não foi possível abrir o importador"
        description={errMsg(status.error)}
        action={<Button onClick={() => status.refetch()}>Tentar de novo</Button>}
      />
    );

  const start = (kind: "dry_run" | "import", extra: Record<string, unknown> = {}) =>
    act.mutate(async () => {
      await fStart({ data: { kind, ...extra } });
      toast.success(
        kind === "dry_run" ? "Prévia iniciada (somente leitura)." : "Importação iniciada.",
      );
    });

  const stagingRows: StagingRow[] = (staging.data?.rows ?? []).map((r) => ({
    externalId: r.externalId,
    status: r.status,
    reason: r.reason,
    detail: r.detail,
    summary: {
      name: r.summary.name,
      description: r.summary.note ?? (r.summary.type ? `Tipo ${r.summary.type}` : null),
      start: r.period,
      end: r.summary.seconds != null ? `${Math.round(r.summary.seconds / 60)} min` : null,
    },
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="TechProjects · Importações"
        title="Jibble"
        description="Traz pessoas, projetos, atividades e o histórico completo de ponto do Jibble. Nada é gravado no ERP antes de uma prévia conferida."
      />

      <JbConnectionSection
        conn={conn}
        encryptionReady={!!status.data?.encryptionReady}
        busy={busy}
        onSave={(v) =>
          act.mutate(
            async () => (
              await fSave({ data: v }),
              toast.success("Credenciais salvas. Agora teste.")
            ),
          )
        }
        onTest={() =>
          act.mutate(async () => {
            const r = await fTest();
            if (r.ok) toast.success(`Conectado à organização ${r.org?.name ?? ""}.`);
            else toast.error(r.message ?? "Falha no teste.");
          })
        }
        onRemove={async () => {
          if (
            await confirmDialog({
              title: "Remover credenciais do Jibble?",
              description: "Execuções em andamento ficam pausadas.",
              confirmLabel: "Remover",
            })
          )
            act.mutate(() => fRemove());
        }}
      />

      <JbOrgSection
        conn={conn}
        busy={busy}
        onConfirm={(orgId) => act.mutate(() => fConfirmOrg({ data: { orgId } }))}
      />

      <FormSection
        title="3. Prévia, importação e histórico"
        description="A prévia lê tudo do Jibble mês a mês e guarda em staging privado. A importação usa a prévia conferida, em lotes retomáveis."
      >
        {!ready && (
          <Alert>
            <AlertTitle>Ainda não liberado</AlertTitle>
            <AlertDescription>
              Conecte, teste e confirme a organização com papel de proprietário ou administrador.
            </AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          <Button disabled={!ready || busy || !!activeRun} onClick={() => start("dry_run")}>
            <Eye className="mr-1.5 h-4 w-4" aria-hidden /> Gerar prévia completa
          </Button>
          <Button
            variant="outline"
            disabled={!ready || busy || !!activeRun || !lastPreview}
            onClick={() => start("dry_run", { options: { refetch: false } })}
          >
            <RefreshCw className="mr-1.5 h-4 w-4" aria-hidden /> Recalcular com mapeamentos atuais
          </Button>
          {lastPreview && !lastPreview.preview_confirmed_at && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => act.mutate(() => fConfirm({ data: { runId: lastPreview.id } }))}
            >
              <ClipboardCheck className="mr-1.5 h-4 w-4" aria-hidden /> Confirmar prévia conferida
            </Button>
          )}
          <Button
            variant="secondary"
            disabled={!ready || busy || !!activeRun || !lastPreview?.preview_confirmed_at}
            onClick={async () => {
              if (
                await confirmDialog({
                  title: "Importar horas do Jibble?",
                  description:
                    "Grava no TechProjects só o que está pronto na prévia conferida. Pendências, intervalos abertos e possíveis duplicidades continuam em revisão. Sem e-mails, notificações ou faturas.",
                  confirmLabel: "Importar",
                })
              )
                start("import", { previewRunId: lastPreview!.id });
            }}
          >
            <Download className="mr-1.5 h-4 w-4" aria-hidden /> Importar a partir da prévia
          </Button>
        </div>
        {activeRun && (
          <JbRunProgress
            run={activeRun}
            busy={busy}
            onState={(a) => act.mutate(() => fState({ data: { runId: activeRun.id, action: a } }))}
          />
        )}
        <JbRunsHistory
          runs={runs}
          busy={busy || !!activeRun}
          onRollback={async (runId) => {
            if (
              await confirmDialog({
                title: "Desfazer esta importação?",
                description:
                  "Remove só o que esta execução criou. Itens alterados ou usados no ERP depois da importação são mantidos.",
                confirmLabel: "Desfazer",
              })
            )
              act.mutate(() => fStart({ data: { kind: "rollback", targetRunId: runId } }));
          }}
        />
      </FormSection>

      {conn.org && (
        <FormSection
          title="4. Conferir"
          description={
            lastPreview
              ? `Prévia de ${new Date(lastPreview.created_at).toLocaleString("pt-BR")}.`
              : "Gere uma prévia."
          }
        >
          <Tabs defaultValue="resumo">
            <TabsList className="flex-wrap">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="mapas">Mapeamentos</TabsTrigger>
              <TabsTrigger value="dups">Duplicidades</TabsTrigger>
              <TabsTrigger value="staging">Staging</TabsTrigger>
            </TabsList>
            <TabsContent value="resumo" className="pt-4">
              {lastPreview?.report ? (
                <JbReport report={lastPreview.report as never} />
              ) : (
                <EmptyState compact title="Sem prévia concluída" />
              )}
            </TabsContent>
            <TabsContent value="mapas" className="space-y-3 pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="jb-map-entity">Tipo</Label>
                <Select value={mapEntity} onValueChange={(v) => setMapEntity(v as MapEntity)}>
                  <SelectTrigger id="jb-map-entity" className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="person">Pessoas</SelectItem>
                    <SelectItem value="project">Projetos</SelectItem>
                    <SelectItem value="client">Clientes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-text-secondary">
                Pessoas casam só por e-mail igual a um membro do workspace; ninguém ganha acesso,
                convite ou papel. Nome igual de projeto/cliente é só sugestão.
              </p>
              <MappingsTable
                sourceLabel="Jibble"
                entity={mapEntity === "person" ? "user" : mapEntity}
                rows={(maps.data?.rows ?? []) as MappingRow[]}
                options={(opts.data ?? []) as TargetOption[]}
                busy={busy}
                onSearch={setOptQ}
                onDecide={(externalId, decision, targetId) =>
                  act.mutate(() =>
                    fSetMapping({ data: { entity: mapEntity, externalId, decision, targetId } }),
                  )
                }
              />
            </TabsContent>
            <TabsContent value="dups" className="space-y-3 pt-4">
              <p className="text-sm text-text-secondary">
                Intervalos do Jibble que cruzam com apontamentos de outra fonte (Clockify, manual,
                cronômetro) da mesma pessoa. Nada é apagado ou mesclado sozinho: "mesmo evento" só
                registra a origem dupla, sem novo apontamento.
              </p>
              <Select value={dupFilter} onValueChange={(v) => setDupFilter(v as "pending" | "all")}>
                <SelectTrigger className="w-48" aria-label="Filtrar duplicidades">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Só pendentes</SelectItem>
                  <SelectItem value="all">Todas</SelectItem>
                </SelectContent>
              </Select>
              <JbDuplicatesTable
                rows={(dups.data?.rows ?? []) as JbDuplicateRow[]}
                busy={busy}
                onDecide={(id, decision) => act.mutate(() => fDecide({ data: { id, decision } }))}
              />
            </TabsContent>
            <TabsContent value="staging" className="space-y-3 pt-4">
              <div className="flex flex-wrap gap-3">
                <Select value={stEntity} onValueChange={(v) => (setStEntity(v), setStPage(0))}>
                  <SelectTrigger className="w-64" aria-label="Tipo de registro">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGING_ENTITIES.map((e) => (
                      <SelectItem key={e} value={e}>
                        {JB_ENTITY_LABEL[e] ?? e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={stStatus} onValueChange={(v) => (setStStatus(v), setStPage(0))}>
                  <SelectTrigger className="w-48" aria-label="Situação">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {Object.entries(JB_STATUS_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <StagingTable
                rows={stagingRows}
                total={staging.data?.total ?? 0}
                page={stPage}
                onPage={setStPage}
                loading={staging.isLoading}
                reasonLabels={JB_REASON_LABEL}
                periodHeader="Dia / duração"
              />
            </TabsContent>
          </Tabs>
        </FormSection>
      )}
    </div>
  );
}
