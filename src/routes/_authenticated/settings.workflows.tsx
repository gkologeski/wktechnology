import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/access-control/use-permissions";
import { WORKFLOWS_MANAGE, WORKFLOWS_PERMS } from "@/lib/access-control/admin-permission-keys";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Zap, Upload, TestTube2, Users, ShieldCheck } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  listWorkflows,
  saveWorkflow,
  deleteWorkflow,
  listRecentRuns,
  triggerTickNow,
  publishWorkflow,
  discardDraft,
  testWorkflow,
  bulkEnrollWorkflow,
  listPendingApprovals,
  decideApproval,
} from "@/lib/workflows.functions";
import { searchEntityRecords } from "@/lib/workflow-refs.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import {
  WorkflowBuilder,
  EMPTY_DRAFT,
  type WorkflowDraft,
} from "@/components/workflows/workflow-builder";
import { WorkflowRunsList } from "@/components/workflows/workflow-runs-list";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  ENTITY_LABELS,
  EVENT_LABELS,
  type WorkflowEntity,
  type WorkflowTrigger,
  type WorkflowAction,
} from "@/lib/workflows/types";

export const Route = createFileRoute("/_authenticated/settings/workflows")({
  component: WorkflowsPage,
});

type WorkflowRow = {
  id: string;
  name: string;
  entity: WorkflowEntity;
  enabled: boolean;
  status: string;
  published_version: number;
  has_draft_changes: boolean;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  draft_trigger: WorkflowTrigger;
  draft_actions: WorkflowAction[];
  updated_at: string;
  runs_24h: number;
  errors_24h: number;
};

function WorkflowsPage() {
  const listFn = useServerFn(listWorkflows);
  const saveFn = useServerFn(saveWorkflow);
  const deleteFn = useServerFn(deleteWorkflow);
  const runsFn = useServerFn(listRecentRuns);
  const tickFn = useServerFn(triggerTickNow);
  const publishFn = useServerFn(publishWorkflow);
  const discardFn = useServerFn(discardDraft);
  const testFn = useServerFn(testWorkflow);
  const bulkFn = useServerFn(bulkEnrollWorkflow);

  const [rows, setRows] = useState<WorkflowRow[]>([]);
  const [runs, setRuns] = useState<Awaited<ReturnType<typeof listRecentRuns>>>([]);
  const [draft, setDraft] = useState<WorkflowDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [testTarget, setTestTarget] = useState<WorkflowRow | null>(null);
  const [testEntityId, setTestEntityId] = useState("");
  const [testResult, setTestResult] = useState<Awaited<ReturnType<typeof testWorkflow>> | null>(
    null,
  );
  const [testing, setTesting] = useState(false);
  const [activeTab, setActiveTab] = useState("list");
  const [runsWorkflowId, setRunsWorkflowId] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const [w, r] = await Promise.all([listFn(), runsFn({ data: { limit: 20 } })]);
      setRows(w as unknown as WorkflowRow[]);
      setRuns(r);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const editingRow = draft?.id ? (rows.find((r) => r.id === draft.id) ?? null) : null;

  const handleSave = async (d: WorkflowDraft) => {
    try {
      const res = await saveFn({ data: d });
      const id = (res as { id?: string } | undefined)?.id ?? d.id;
      toast.success("Rascunho salvo — publique para ativar", {
        action: id
          ? {
              label: "Publicar",
              onClick: () => {
                void handlePublishById(id);
              },
            }
          : undefined,
      });
      setDraft(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  };

  const handleSaveAndPublish = async (d: WorkflowDraft) => {
    try {
      const res = await saveFn({ data: d });
      const id = (res as { id?: string } | undefined)?.id ?? d.id;
      if (!id) throw new Error("Não foi possível identificar o workflow salvo");
      const r = await publishFn({ data: { id } });
      toast.success(`Publicado — v${r.version}`);
      setDraft(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao publicar");
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmDialog("Excluir este workflow?"))) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Workflow removido");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover");
    }
  };

  const handleToggle = async (row: WorkflowRow, enabled: boolean) => {
    try {
      await saveFn({
        data: {
          id: row.id,
          name: row.name,
          entity: row.entity,
          enabled,
          trigger: row.draft_trigger ?? row.trigger ?? { event: "created", filters: [] },
          actions: row.draft_actions ?? row.actions ?? [],
        },
      });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const handleTick = async () => {
    try {
      const r = await tickFn();
      toast.success(`Processados: ${r.processed} evento(s)`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const handlePublishById = async (id: string) => {
    try {
      const r = await publishFn({ data: { id } });
      toast.success(`Publicado — v${r.version}`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao publicar");
    }
  };

  const handlePublish = (row: WorkflowRow) => handlePublishById(row.id);

  const handleDiscard = async (row: WorkflowRow) => {
    if (
      !(await confirmDialog("Descartar alterações do rascunho e voltar para a versão publicada?"))
    )
      return;
    try {
      await discardFn({ data: { id: row.id } });
      toast.success("Rascunho descartado");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const handleBulk = async (row: WorkflowRow) => {
    if (
      !(await confirmDialog(
        `Aplicar "${row.name}" aos registros existentes de ${ENTITY_LABELS[row.entity]} que batem no gatilho? (limite 200)`,
      ))
    )
      return;
    try {
      const r = await bulkFn({ data: { workflowId: row.id, limit: 200 } });
      toast.success(`${r.enqueued} registro(s) inscrito(s), ${r.processed} processado(s)`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const runTest = async () => {
    if (!testTarget || !testEntityId) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await testFn({
        data: {
          workflowId: testTarget.id,
          entity: testTarget.entity,
          entityId: testEntityId,
          useDraft: true,
        },
      });
      setTestResult(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no teste");
    } finally {
      setTesting(false);
    }
  };

  const namesById = Object.fromEntries(rows.map((r) => [r.id, r.name]));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Workflows</h2>
          <p className="text-sm text-muted-foreground">
            Automações disparadas por eventos nos seus registros.
          </p>
        </div>
        <div className="flex gap-2">
          <Can any={WORKFLOWS_MANAGE}>
            <Button variant="outline" onClick={handleTick}>
              <Zap className="h-4 w-4 mr-1" /> Rodar agora
            </Button>
          </Can>
          <Can any={WORKFLOWS_PERMS.create}>
            <Button onClick={() => setDraft({ ...EMPTY_DRAFT })}>
              <Plus className="h-4 w-4 mr-1" /> Novo workflow
            </Button>
          </Can>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">Workflows</TabsTrigger>
          <TabsTrigger value="runs">Execuções recentes</TabsTrigger>
          <TabsTrigger value="approvals">
            <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Aprovações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-3 mt-3">
          {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!loading && rows.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Nenhum workflow ainda. Crie o primeiro para começar a automatizar.
              </CardContent>
            </Card>
          )}
          {rows.map((row) => {
            const isPublished = row.status === "published" && !row.has_draft_changes;
            const draftTrigger = row.draft_trigger ??
              row.trigger ?? { event: "created", filters: [] };
            const draftActions = row.draft_actions ?? row.actions ?? [];
            return (
              <Card key={row.id}>
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div className="min-w-0">
                    <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                      {row.name}
                      {isPublished ? (
                        <Badge variant="secondary">Publicado v{row.published_version}</Badge>
                      ) : row.published_version > 0 ? (
                        <Badge variant="outline">
                          Rascunho pendente (publicado v{row.published_version})
                        </Badge>
                      ) : (
                        <Badge variant="outline">Rascunho</Badge>
                      )}
                      {row.errors_24h > 0 && (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="h-6 px-2"
                          onClick={() => {
                            setRunsWorkflowId(row.id);
                            setActiveTab("runs");
                          }}
                        >
                          {row.errors_24h} erro(s) hoje
                        </Button>
                      )}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {ENTITY_LABELS[row.entity]} · {EVENT_LABELS[draftTrigger.event ?? "created"]}{" "}
                      · {draftActions.length} ação(ões) · {row.runs_24h} exec / 24h
                    </p>
                    {!isPublished && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {row.published_version > 0
                          ? `A versão v${row.published_version} continua em execução; publique para aplicar o rascunho.`
                          : "Ainda não publicado — o workflow não executa até ser publicado."}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    <Switch checked={row.enabled} onCheckedChange={(v) => handleToggle(row, v)} />
                    {!isPublished && (
                      <>
                        <Button size="sm" variant="default" onClick={() => handlePublish(row)}>
                          <Upload className="h-3.5 w-3.5 mr-1" /> Publicar
                        </Button>
                        {row.published_version > 0 && row.has_draft_changes && (
                          <Button size="sm" variant="ghost" onClick={() => handleDiscard(row)}>
                            Descartar
                          </Button>
                        )}
                      </>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setTestTarget(row);
                        setTestEntityId("");
                        setTestResult(null);
                      }}
                    >
                      <TestTube2 className="h-3.5 w-3.5 mr-1" /> Testar
                    </Button>
                    {row.published_version > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => handleBulk(row)}>
                        <Users className="h-3.5 w-3.5 mr-1" /> Aplicar existentes
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setDraft({
                          id: row.id,
                          name: row.name,
                          entity: row.entity,
                          enabled: row.enabled,
                          trigger: draftTrigger,
                          actions: draftActions,
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Can any={WORKFLOWS_PERMS.delete}>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(row.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </Can>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="runs" className="mt-3">
          {runsWorkflowId && (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2">
              <p className="text-sm">
                Execuções de <strong>{namesById[runsWorkflowId] ?? "workflow"}</strong>
              </p>
              <Button variant="ghost" size="sm" onClick={() => setRunsWorkflowId(null)}>
                Mostrar todas
              </Button>
            </div>
          )}
          <WorkflowRunsList
            runs={runsWorkflowId ? runs.filter((run) => run.workflow_id === runsWorkflowId) : runs}
            namesById={namesById}
          />
        </TabsContent>

        <TabsContent value="approvals" className="mt-3">
          <PendingApprovalsList
            listFn={useServerFn(listPendingApprovals)}
            decideFn={useServerFn(decideApproval)}
            namesById={namesById}
          />
        </TabsContent>
      </Tabs>

      <WorkflowBuilder
        open={!!draft}
        draft={draft}
        onClose={() => {
          setDraft(null);
          // Revalida a lista ao sair da edição, para não exibir dados defasados.
          void refresh();
        }}
        onSave={handleSave}
        onSaveAndPublish={handleSaveAndPublish}
        publishedVersion={editingRow?.published_version ?? 0}
        hasDraftChanges={editingRow ? editingRow.has_draft_changes : true}
      />

      <Dialog
        open={!!testTarget}
        onOpenChange={(o) => {
          if (!o) {
            setTestTarget(null);
            setTestResult(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Testar workflow com registro</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Executa a versão <strong>rascunho</strong> contra um registro de{" "}
              <strong>{testTarget ? ENTITY_LABELS[testTarget.entity] : ""}</strong>. Nenhuma ação
              real é executada — apenas simulada e registrada no histórico como teste.
            </p>
            {testTarget && (
              <RecordPicker
                entity={testTarget.entity}
                value={testEntityId}
                onChange={setTestEntityId}
              />
            )}
            {testResult && (
              <div className="rounded-md border p-3 space-y-1 max-h-64 overflow-auto bg-muted/40">
                <p className="text-xs font-medium">
                  Gatilho: {testResult.triggerOk ? "✓ passa" : "✗ não passa"}
                </p>
                {testResult.log.map((l, i) => (
                  <div key={i} className="text-xs font-mono whitespace-pre">
                    {l.ok ? "· " : "✗ "}
                    {l.step}
                    {l.note ? ` — ${l.note}` : ""}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTestTarget(null)}>
              Fechar
            </Button>
            <Button onClick={runTest} disabled={!testEntityId || testing}>
              {testing ? "Executando…" : "Executar teste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type ApprovalRow = Awaited<ReturnType<typeof listPendingApprovals>>[number];

function PendingApprovalsList({
  listFn,
  decideFn,
  namesById,
}: {
  listFn: ReturnType<typeof useServerFn<typeof listPendingApprovals>>;
  decideFn: ReturnType<typeof useServerFn<typeof decideApproval>>;
  namesById: Record<string, string>;
}) {
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [comment, setComment] = useState("");

  const refresh = async () => {
    setLoading(true);
    try {
      const r = (await listFn()) as unknown as ApprovalRow[];
      setRows(r);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const handleDecide = async (id: string, decision: "approved" | "rejected") => {
    setDecidingId(id);
    try {
      await decideFn({ data: { approvalId: id, decision, comment: comment || undefined } });
      toast.success(decision === "approved" ? "Aprovado — workflow retomado" : "Rejeitado");
      setComment("");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setDecidingId(null);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma aprovação pendente.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <Card key={r.id}>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
              {r.title}
              <Badge variant="outline">{namesById[r.workflow_id] ?? "Workflow"}</Badge>
              <Badge variant="secondary">{r.entity}</Badge>
            </CardTitle>
            {r.note && <p className="text-xs text-muted-foreground mt-1">{r.note}</p>}
            <p className="text-[11px] text-muted-foreground mt-1">
              Registro: {r.entity_id} · Criada em {new Date(r.created_at).toLocaleString()}
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <Textarea
              placeholder="Comentário da decisão (opcional)"
              value={decidingId === r.id ? comment : ""}
              onFocus={() => setDecidingId(r.id)}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDecide(r.id, "rejected")}
                disabled={decidingId === r.id}
              >
                Rejeitar
              </Button>
              <Button
                size="sm"
                onClick={() => handleDecide(r.id, "approved")}
                disabled={decidingId === r.id}
              >
                Aprovar
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RecordPicker({
  entity,
  value,
  onChange,
}: {
  entity: WorkflowEntity;
  value: string;
  onChange: (id: string) => void;
}) {
  const searchFn = useServerFn(searchEntityRecords);
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<{ id: string; label: string }[]>([]);
  const [labelById, setLabelById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // Reset when entity changes
  useEffect(() => {
    setItems([]);
    setLabelById({});
    setQuery("");
  }, [entity]);

  // Debounced search when open
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const rows = (await searchFn({
          data: { entity, q: query || undefined },
        })) as { id: string; label: string }[];
        if (cancelled) return;
        setItems(rows);
        setLabelById((prev) => {
          const next = { ...prev };
          for (const r of rows) next[r.id] = r.label;
          return next;
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, query, entity, searchFn]);

  // Resolve label for pre-selected id if missing
  useEffect(() => {
    if (!value || labelById[value]) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = (await searchFn({ data: { entity, ids: [value] } })) as {
          id: string;
          label: string;
        }[];
        if (cancelled) return;
        setLabelById((prev) => ({
          ...prev,
          ...Object.fromEntries(rows.map((r) => [r.id, r.label])),
        }));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [value, entity, searchFn, labelById]);

  const displayLabel = value ? (labelById[value] ?? value) : "Selecione um registro…";

  if (manual) {
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label>ID do registro (UUID)</Label>
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={() => setManual(false)}
          >
            Voltar para busca
          </button>
        </div>
        <Input
          placeholder="uuid do registro"
          value={value}
          onChange={(e) => onChange(e.target.value.trim())}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label>Registro</Label>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:underline"
          onClick={() => setManual(true)}
        >
          Colar UUID
        </button>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className={value ? "" : "text-muted-foreground"}>{displayLabel}</span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Buscar…" value={query} onValueChange={setQuery} />
            <CommandList>
              {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Buscando…</div>}
              {!loading && items.length === 0 && (
                <CommandEmpty>Nenhum registro encontrado.</CommandEmpty>
              )}
              <CommandGroup>
                {items.map((it) => (
                  <CommandItem
                    key={it.id}
                    value={it.id}
                    onSelect={() => {
                      onChange(it.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={"mr-2 h-4 w-4 " + (value === it.id ? "opacity-100" : "opacity-0")}
                    />
                    <span className="truncate">{it.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
