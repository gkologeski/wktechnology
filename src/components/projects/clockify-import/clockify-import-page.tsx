// Tela do importador Clockify → TechProjects (contêiner: dados e ações).
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, ClipboardCheck, Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { FormSection, PageHeader, Skeletons } from "@/components/techhire/ui";
import {
  advanceClockifyImportRun,
  clockifyImportTargetOptions,
  confirmClockifyImportPreview,
  createClockifyImportIdentity,
  createClockifyImportIdentitiesBulk,
  reopenClockifyImportEntries,
  getClockifyImportRun,
  getClockifyImportStatus,
  listClockifyImportMappings,
  listClockifyImportStaging,
  removeClockifyImportConnection,
  saveClockifyImportConnection,
  selectClockifyImportSource,
  setClockifyImportMapping,
  setClockifyImportRunState,
  startClockifyImportRun,
  testClockifyImportConnection,
} from "@/lib/integrations/clockify/clockify.functions";
import { ENTITY_LABEL, STAGING_STATUS_LABEL } from "@/lib/integrations/clockify/clockify-format";
import {
  ConnectionSection,
  ImportReport,
  PreviewReport,
  RunProgress,
  SourceSection,
  type ClockifyReport,
  type ConnectionView,
  type RunView,
  type SourceWorkspaceView,
} from "./clockify-sections";
import { canReadWholeWorkspace } from "@/lib/integrations/clockify/clockify-access";
import {
  MappingsTable,
  StagingTable,
  type MappingRow,
  type StagingRow,
  type TargetOption,
} from "./clockify-review";

const DRY = [
  "start",
  "workspace",
  "users",
  "groups",
  "clients",
  "projects",
  "tasks",
  "tags",
  "custom_fields",
  "approvals",
  "expenses",
  "invoices",
  "holidays",
  "time_off_policies",
  "time_entries",
  "in_progress",
  "reconcile",
  "mappings",
  "plan",
  "done",
];
const IMP = ["start", "projects_write", "members_write", "tasks_write", "entries_write", "done"];
const ACTIVE = ["queued", "running", "cancel_requested"];

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Algo deu errado. Tente de novo.");

export function ClockifyImportPage() {
  const qc = useQueryClient();
  const fStatus = useServerFn(getClockifyImportStatus);
  const fSave = useServerFn(saveClockifyImportConnection);
  const fRemove = useServerFn(removeClockifyImportConnection);
  const fTest = useServerFn(testClockifyImportConnection);
  const fSelect = useServerFn(selectClockifyImportSource);
  const fStart = useServerFn(startClockifyImportRun);
  const fAdvance = useServerFn(advanceClockifyImportRun);
  const fRun = useServerFn(getClockifyImportRun);
  const fState = useServerFn(setClockifyImportRunState);
  const fConfirm = useServerFn(confirmClockifyImportPreview);
  const fMappings = useServerFn(listClockifyImportMappings);
  const fSetMapping = useServerFn(setClockifyImportMapping);
  const fOptions = useServerFn(clockifyImportTargetOptions);
  const fStaging = useServerFn(listClockifyImportStaging);
  const fIdentity = useServerFn(createClockifyImportIdentity);
  const fIdentityBulk = useServerFn(createClockifyImportIdentitiesBulk);
  const fReopen = useServerFn(reopenClockifyImportEntries);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);

  const status = useQuery({ queryKey: ["clockify-import", "status"], queryFn: () => fStatus() });
  const [workspaces, setWorkspaces] = useState<SourceWorkspaceView[] | null>(null);
  const [suggestedId, setSuggestedId] = useState<string | null>(null);
  const [noProjectPolicy, setNoProjectPolicy] = useState<"stage" | "fallback">("stage");
  const [erpStatus, setErpStatus] = useState<"locked" | "draft">("locked");
  const [checked, setChecked] = useState(false);

  const runs = (status.data?.runs ?? []) as RunView[];
  const activeRun = runs.find((r) => ACTIVE.includes(r.status) || r.status === "paused") ?? null;
  const lastPreview = runs.find((r) => r.kind === "dry_run" && r.status === "completed") ?? null;
  const lastImport = runs.find((r) => r.kind === "import" && r.status === "completed") ?? null;

  const refresh = () => qc.invalidateQueries({ queryKey: ["clockify-import"] });

  // Avança a execução enquanto a tela estiver aberta (o cron, quando agendado, faz o mesmo).
  const live = useQuery({
    queryKey: ["clockify-import", "run", activeRun?.id],
    enabled: !!activeRun,
    queryFn: () =>
      ACTIVE.includes(activeRun!.status)
        ? fAdvance({ data: { runId: activeRun!.id } })
        : fRun({ data: { runId: activeRun!.id } }),
    refetchInterval: (q) => {
      const s = (q.state.data as RunView | undefined)?.status ?? activeRun?.status;
      return s && ACTIVE.includes(s) ? 3000 : false;
    },
    refetchIntervalInBackground: false,
  });
  const liveRun = (live.data as RunView | undefined) ?? activeRun;
  useEffect(() => {
    if (liveRun && !ACTIVE.includes(liveRun.status) && liveRun.status !== "paused" && activeRun)
      refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRun?.status]);

  const previewDetail = useQuery({
    queryKey: ["clockify-import", "report", lastPreview?.id],
    enabled: !!lastPreview,
    queryFn: () => fRun({ data: { runId: lastPreview!.id } }),
  });
  const importDetail = useQuery({
    queryKey: ["clockify-import", "report", lastImport?.id],
    enabled: !!lastImport,
    queryFn: () => fRun({ data: { runId: lastImport!.id } }),
  });

  const userMaps = useQuery({
    queryKey: ["clockify-import", "map", "user"],
    enabled: !!lastPreview,
    queryFn: () => fMappings({ data: { entity: "user" } }),
  });
  const clientMaps = useQuery({
    queryKey: ["clockify-import", "map", "client"],
    enabled: !!lastPreview,
    queryFn: () => fMappings({ data: { entity: "client" } }),
  });
  const projectMaps = useQuery({
    queryKey: ["clockify-import", "map", "project"],
    enabled: !!lastPreview,
    queryFn: () => fMappings({ data: { entity: "project" } }),
  });

  const [optQ, setOptQ] = useState<Record<string, string>>({ user: "", client: "", project: "" });
  const userOpts = useQuery({
    queryKey: ["clockify-import", "opt", "user", optQ.user],
    enabled: !!lastPreview,
    queryFn: () => fOptions({ data: { entity: "user", q: optQ.user } }),
  });
  const clientOpts = useQuery({
    queryKey: ["clockify-import", "opt", "client", optQ.client],
    enabled: !!lastPreview,
    queryFn: () => fOptions({ data: { entity: "client", q: optQ.client } }),
  });
  const projectOpts = useQuery({
    queryKey: ["clockify-import", "opt", "project", optQ.project],
    enabled: !!lastPreview,
    queryFn: () => fOptions({ data: { entity: "project", q: optQ.project } }),
  });

  const [stEntity, setStEntity] = useState("time_entry");
  const [stStatus, setStStatus] = useState<string>("pending_review");
  const [stPage, setStPage] = useState(0);
  const staging = useQuery({
    queryKey: ["clockify-import", "staging", stEntity, stStatus, stPage],
    enabled: !!lastPreview,
    queryFn: () =>
      fStaging({
        data: { entity: stEntity, status: stStatus === "all" ? null : stStatus, page: stPage },
      }),
  });

  const nameOf = useMemo(() => {
    const u = new Map(
      ((userMaps.data?.rows ?? []) as MappingRow[]).map((r) => [
        r.external_id,
        r.label ?? r.external_id,
      ]),
    );
    const p = new Map(
      ((projectMaps.data?.rows ?? []) as MappingRow[]).map((r) => [
        r.external_id,
        r.label ?? r.external_id,
      ]),
    );
    return (kind: "user" | "project", id: string) =>
      (kind === "user" ? u.get(id) : p.get(id)) ?? id;
  }, [userMaps.data, projectMaps.data]);

  const act = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onError: (e) => toast.error(errMsg(e)),
    onSettled: () => refresh(),
  });
  const busy = act.isPending || bulk !== null;

  const runBulkIdentities = async (total: number) => {
    if (
      !(await confirmDialog({
        title: `Criar ${total} identidades históricas inativas?`,
        description:
          "Cada pessoa pendente ganha um registro sem acesso (conta bloqueada e membro inativo), sem convite, sem e-mail e sem papel do Clockify. Depois, as horas dessas pessoas são gravadas na mesma importação.",
        confirmLabel: "Criar sem acesso",
      }))
    )
      return;
    const skip: string[] = [];
    const created: string[] = [];
    const failed: Array<{ name: string | null; reason: string }> = [];
    setBulk({ done: 0, total });
    try {
      for (let guard = 0; guard < 100; guard++) {
        const r = await fIdentityBulk({ data: { limit: 15, skip } });
        created.push(...r.newUserIds);
        for (const f of r.failed) {
          skip.push(f.externalId);
          failed.push({ name: f.name, reason: f.reason });
        }
        setBulk({ done: created.length + failed.length, total });
        if (r.processed === 0 || r.remaining === 0) break;
      }
      if (created.length) await fReopen({ data: { externalIds: created } });
      toast.success(
        `${created.length} identidades criadas${failed.length ? `; ${failed.length} continuam pendentes` : ""}.${created.length ? " Gravando as horas dessas pessoas." : ""}`,
      );
      if (failed.length)
        toast.warning(
          `Pendentes: ${failed
            .slice(0, 5)
            .map((f) => f.name ?? "?")
            .join(", ")}${failed.length > 5 ? "…" : ""}`,
        );
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBulk(null);
      refresh();
    }
  };

  if (status.isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="TechProjects · Importações" title="Clockify" />
        <Skeletons.Card />
        <Skeletons.Card />
      </div>
    );
  }
  if (status.isError) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="TechProjects · Importações" title="Clockify" />
        <Alert variant="destructive" role="alert">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Não foi possível abrir o importador</AlertTitle>
          <AlertDescription>
            {errMsg(status.error)}{" "}
            <Button variant="link" className="h-auto p-0" onClick={() => status.refetch()}>
              Tentar de novo
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const conn = status.data!.connection as ConnectionView;
  const connected =
    conn.status === "connected" && !!conn.source && canReadWholeWorkspace(conn.source.access);
  const previewReport = (previewDetail.data?.report ?? null) as ClockifyReport | null;
  const importReport = (importDetail.data?.report ?? null) as ClockifyReport | null;
  const previewConfirmed = !!lastPreview?.preview_confirmed_at;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="TechProjects · Importações"
        title="Clockify"
        description="Traz clientes, projetos, tarefas, pessoas e apontamentos do Clockify. Nada é gravado no ERP antes de uma prévia conferida."
      />

      <ConnectionSection
        conn={conn}
        encryptionReady={status.data!.encryptionReady}
        busy={busy}
        onSave={(v) =>
          act.mutate(async () => {
            await fSave({ data: v });
            toast.success("Conexão salva. Agora teste a chave.");
          })
        }
        onTest={() =>
          act.mutate(async () => {
            const r = await fTest();
            if (r.ok) {
              setWorkspaces(r.workspaces);
              setSuggestedId(r.suggestedId);
              toast.success(`Conexão funcionando${r.userName ? ` como ${r.userName}` : ""}.`);
            } else toast.error(r.message ?? "Falha no teste.");
          })
        }
        onRemove={async () => {
          if (
            !(await confirmDialog({
              title: "Remover a chave do Clockify?",
              description: "O staging e o histórico de execuções continuam guardados.",
              confirmLabel: "Remover",
              variant: "destructive",
            }))
          )
            return;
          act.mutate(() => fRemove());
        }}
      />

      {conn.configured && (
        <SourceSection
          conn={conn}
          workspaces={workspaces}
          suggestedId={suggestedId}
          busy={busy}
          onSelect={(id) =>
            act.mutate(async () => {
              await fSelect({ data: { sourceWorkspaceId: id } });
              toast.success("Workspace de origem definido.");
            })
          }
        />
      )}

      <FormSection
        title="3. Prévia (simulação)"
        description="Lê tudo do Clockify só com consultas, guarda no staging privado e calcula o que seria importado. Não grava nada em projetos, tarefas ou horas."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ck-noproj">Apontamentos sem projeto</Label>
            <Select
              value={noProjectPolicy}
              onValueChange={(v) => setNoProjectPolicy(v as "stage" | "fallback")}
            >
              <SelectTrigger id="ck-noproj">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stage">Manter no staging para revisão</SelectItem>
                <SelectItem value="fallback">Criar o projeto “Clockify — sem projeto”</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ck-status">Situação das horas no ERP</Label>
            <Select value={erpStatus} onValueChange={(v) => setErpStatus(v as "locked" | "draft")}>
              <SelectTrigger id="ck-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="locked">Travado (histórico, sem aprovação comercial)</SelectItem>
                <SelectItem value="draft">Rascunho (editável)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy || !connected || !!activeRun}
            onClick={() =>
              act.mutate(() =>
                fStart({
                  data: { kind: "dry_run", options: { refetch: true, noProjectPolicy, erpStatus } },
                }),
              )
            }
          >
            <Eye className="mr-1.5 h-4 w-4" aria-hidden /> Gerar prévia completa
          </Button>
          <Button
            variant="outline"
            disabled={busy || !connected || !!activeRun || !lastPreview}
            onClick={() =>
              act.mutate(() =>
                fStart({
                  data: {
                    kind: "dry_run",
                    options: { refetch: false, noProjectPolicy, erpStatus },
                  },
                }),
              )
            }
          >
            Recalcular com os mapeamentos atuais
          </Button>
        </div>
        {!connected && (
          <p className="text-sm text-text-tertiary">
            Disponível depois de conectar, escolher o workspace de origem e comprovar acesso de
            proprietário ou administrador nele.
          </p>
        )}
        {liveRun && (
          <RunProgress
            run={liveRun}
            phases={liveRun.kind === "import" ? IMP : DRY}
            busy={busy}
            onPause={() =>
              act.mutate(() => fState({ data: { runId: liveRun.id, action: "pause" } }))
            }
            onResume={() =>
              act.mutate(() => fState({ data: { runId: liveRun.id, action: "resume" } }))
            }
            onCancel={async () => {
              if (
                !(await confirmDialog({
                  title: "Cancelar a execução?",
                  description:
                    "Para depois do lote atual. O que já foi gravado continua salvo e uma nova execução não duplica.",
                  confirmLabel: "Cancelar execução",
                  variant: "destructive",
                }))
              )
                return;
              act.mutate(() => fState({ data: { runId: liveRun.id, action: "cancel" } }));
            }}
          />
        )}
      </FormSection>

      {lastPreview && (
        <FormSection
          title="4. Conferir a prévia"
          description={`Prévia concluída em ${new Date(lastPreview.finished_at ?? lastPreview.created_at).toLocaleString("pt-BR")}.`}
        >
          <Tabs defaultValue="resumo">
            <TabsList className="flex-wrap">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="pessoas">Pessoas</TabsTrigger>
              <TabsTrigger value="clientes">Clientes</TabsTrigger>
              <TabsTrigger value="projetos">Projetos</TabsTrigger>
              <TabsTrigger value="staging">Staging</TabsTrigger>
            </TabsList>
            <TabsContent value="resumo" className="pt-4">
              {previewDetail.isLoading ? (
                <Skeletons.Card />
              ) : previewReport ? (
                <PreviewReport report={previewReport} nameOf={nameOf} />
              ) : null}
            </TabsContent>
            <TabsContent value="pessoas" className="pt-4">
              <p className="mb-3 text-sm text-text-secondary">
                Vínculo automático só por e-mail igual a um membro do workspace. Ninguém ganha
                acesso: pessoas inativas continuam inativas e mantêm a autoria das horas. Horas
                nunca são atribuídas a quem importa.
              </p>
              {(() => {
                const pendingCount = (userMaps.data?.rows ?? []).filter(
                  (r) => (r as MappingRow).decision === "pending",
                ).length;
                if (!pendingCount && !bulk) return null;
                return (
                  <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted/40 p-3">
                    <p className="text-sm text-text-secondary" aria-live="polite">
                      {bulk
                        ? `Criando identidades: ${bulk.done} de ${bulk.total}…`
                        : `${pendingCount} pessoas sem vínculo.`}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy || !lastImport}
                      title={lastImport ? undefined : "Requer uma importação concluída"}
                      onClick={() => runBulkIdentities(pendingCount)}
                    >
                      Criar identidade histórica para todos os pendentes
                    </Button>
                  </div>
                );
              })()}
              <MappingsTable
                entity="user"
                rows={(userMaps.data?.rows ?? []) as MappingRow[]}
                options={(userOpts.data ?? []) as TargetOption[]}
                busy={busy}
                onSearch={(q) => setOptQ((s) => ({ ...s, user: q }))}
                onDecide={(externalId, decision, targetId) =>
                  act.mutate(() =>
                    fSetMapping({ data: { entity: "user", externalId, decision, targetId } }),
                  )
                }
                onCreateIdentity={async (externalId) => {
                  if (
                    !(await confirmDialog({
                      title: "Criar identidade histórica inativa?",
                      description:
                        "Cria um registro sem acesso (conta bloqueada e membro inativo), sem convite e sem papel do Clockify, só para guardar a autoria das horas.",
                      confirmLabel: "Criar sem acesso",
                    }))
                  )
                    return;
                  act.mutate(() => fIdentity({ data: { externalId } }));
                }}
              />
            </TabsContent>
            <TabsContent value="clientes" className="pt-4">
              <p className="mb-3 text-sm text-text-secondary">
                Opcional. Nome parecido é só sugestão: o vínculo com uma empresa precisa ser
                escolhido aqui. Sem vínculo, o nome do cliente fica guardado no projeto.
              </p>
              <MappingsTable
                entity="client"
                rows={(clientMaps.data?.rows ?? []) as MappingRow[]}
                options={(clientOpts.data ?? []) as TargetOption[]}
                busy={busy}
                onSearch={(q) => setOptQ((s) => ({ ...s, client: q }))}
                onDecide={(externalId, decision, targetId) =>
                  act.mutate(() =>
                    fSetMapping({ data: { entity: "client", externalId, decision, targetId } }),
                  )
                }
              />
            </TabsContent>
            <TabsContent value="projetos" className="pt-4">
              <p className="mb-3 text-sm text-text-secondary">
                Por padrão cada projeto do Clockify vira um projeto novo, inclusive os arquivados.
                Nome igual a um projeto do ERP aparece como sugestão, nunca é vinculado sozinho.
              </p>
              <MappingsTable
                entity="project"
                rows={(projectMaps.data?.rows ?? []) as MappingRow[]}
                options={(projectOpts.data ?? []) as TargetOption[]}
                busy={busy}
                onSearch={(q) => setOptQ((s) => ({ ...s, project: q }))}
                onDecide={(externalId, decision, targetId) =>
                  act.mutate(() =>
                    fSetMapping({ data: { entity: "project", externalId, decision, targetId } }),
                  )
                }
              />
            </TabsContent>
            <TabsContent value="staging" className="space-y-3 pt-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="space-y-1.5">
                  <Label htmlFor="st-ent">Dado</Label>
                  <Select
                    value={stEntity}
                    onValueChange={(v) => {
                      setStEntity(v);
                      setStPage(0);
                    }}
                  >
                    <SelectTrigger id="st-ent" className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ENTITY_LABEL)
                        .filter(([k]) => k !== "report_summary")
                        .map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-st">Situação</Label>
                  <Select
                    value={stStatus}
                    onValueChange={(v) => {
                      setStStatus(v);
                      setStPage(0);
                    }}
                  >
                    <SelectTrigger id="st-st" className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {Object.entries(STAGING_STATUS_LABEL).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {staging.isError ? (
                <Alert variant="destructive">
                  <AlertDescription>{errMsg(staging.error)}</AlertDescription>
                </Alert>
              ) : (
                <StagingTable
                  rows={(staging.data?.rows ?? []) as StagingRow[]}
                  total={staging.data?.total ?? 0}
                  page={stPage}
                  onPage={setStPage}
                  loading={staging.isLoading}
                />
              )}
            </TabsContent>
          </Tabs>

          <div className="space-y-3 rounded-lg border border-border-subtle bg-surface-1 p-4">
            {previewConfirmed ? (
              <p className="flex items-center gap-2 text-sm">
                <ClipboardCheck className="h-4 w-4 text-status-open" aria-hidden /> Prévia conferida
                em {new Date(lastPreview.preview_confirmed_at!).toLocaleString("pt-BR")}.
              </p>
            ) : (
              <div className="flex items-start gap-2">
                <Checkbox
                  id="ck-confirm"
                  checked={checked}
                  onCheckedChange={(v) => setChecked(v === true)}
                />
                <Label htmlFor="ck-confirm" className="text-sm font-normal leading-snug">
                  Conferi inventário, pessoas, projetos, pendências e totais em segundos. Sei que
                  horas de pessoas sem vínculo, cronômetros abertos e sobreposições ficam no
                  staging.
                </Label>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {!previewConfirmed && (
                <Button
                  variant="outline"
                  disabled={busy || !checked}
                  onClick={() => act.mutate(() => fConfirm({ data: { runId: lastPreview.id } }))}
                >
                  Confirmar prévia
                </Button>
              )}
              <Button
                disabled={busy || !previewConfirmed || !!activeRun}
                onClick={async () => {
                  if (
                    !(await confirmDialog({
                      title: "Importar para o TechProjects?",
                      description:
                        "Grava projetos, tarefas, membros e horas em lotes. Reexecutar não duplica e não sobrescreve edições feitas no ERP. Nenhum workflow, cobrança ou convite é disparado.",
                      confirmLabel: "Importar agora",
                    }))
                  )
                    return;
                  act.mutate(() =>
                    fStart({ data: { kind: "import", previewRunId: lastPreview.id } }),
                  );
                }}
              >
                <Download className="mr-1.5 h-4 w-4" aria-hidden /> Importar
              </Button>
            </div>
          </div>
        </FormSection>
      )}

      {importReport && (
        <FormSection
          title="5. Resultado da última importação"
          description={`Concluída em ${new Date(lastImport!.finished_at ?? lastImport!.created_at).toLocaleString("pt-BR")}.`}
        >
          <ImportReport report={importReport} nameOf={nameOf} />
        </FormSection>
      )}
    </div>
  );
}
