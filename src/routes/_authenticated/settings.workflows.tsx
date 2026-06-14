import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Pencil, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  listWorkflows,
  saveWorkflow,
  deleteWorkflow,
  listRecentRuns,
  triggerTickNow,
} from "@/lib/workflows.functions";
import {
  WorkflowBuilder,
  EMPTY_DRAFT,
  type WorkflowDraft,
} from "@/components/workflows/workflow-builder";
import { WorkflowRunsList } from "@/components/workflows/workflow-runs-list";
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
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
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

  const [rows, setRows] = useState<WorkflowRow[]>([]);
  const [runs, setRuns] = useState<Awaited<ReturnType<typeof listRecentRuns>>>([]);
  const [draft, setDraft] = useState<WorkflowDraft | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleSave = async (d: WorkflowDraft) => {
    try {
      await saveFn({ data: d });
      toast.success("Workflow salvo");
      setDraft(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este workflow?")) return;
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
          trigger: row.trigger,
          actions: row.actions,
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
          <Button variant="outline" onClick={handleTick}>
            <Zap className="h-4 w-4 mr-1" /> Rodar agora
          </Button>
          <Button onClick={() => setDraft({ ...EMPTY_DRAFT })}>
            <Plus className="h-4 w-4 mr-1" /> Novo workflow
          </Button>
        </div>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Workflows</TabsTrigger>
          <TabsTrigger value="runs">Execuções recentes</TabsTrigger>
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
          {rows.map((row) => (
            <Card key={row.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {row.name}
                    {row.errors_24h > 0 && (
                      <Badge variant="destructive">{row.errors_24h} erro(s) hoje</Badge>
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ENTITY_LABELS[row.entity]} · {EVENT_LABELS[row.trigger?.event ?? "created"]} ·{" "}
                    {row.actions?.length ?? 0} ação(ões) · {row.runs_24h} exec / 24h
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Switch checked={row.enabled} onCheckedChange={(v) => handleToggle(row, v)} />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setDraft({
                        id: row.id,
                        name: row.name,
                        entity: row.entity,
                        enabled: row.enabled,
                        trigger: row.trigger ?? { event: "created", filters: [] },
                        actions: row.actions ?? [],
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(row.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="runs" className="mt-3">
          <WorkflowRunsList runs={runs} namesById={namesById} />
        </TabsContent>
      </Tabs>

      <WorkflowBuilder
        open={!!draft}
        draft={draft}
        onClose={() => setDraft(null)}
        onSave={handleSave}
      />
    </div>
  );
}
