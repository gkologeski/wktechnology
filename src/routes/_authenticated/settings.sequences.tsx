import { formatDateTime } from "@/lib/crm";
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Trash2, Pencil, Zap, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import {
  listSequences,
  saveSequence,
  deleteSequence,
  listEnrollments,
  updateEnrollmentStatus,
  triggerSequencesTickNow,
  type SequenceListItem,
  type EnrollmentListItem,
} from "@/lib/sequences.functions";
import {
  SequenceBuilder,
  EMPTY_DRAFT,
  type SequenceDraft,
} from "@/components/sequences/sequence-builder";
import { ENTITY_LABELS } from "@/lib/sequences/types";
import { confirmDialog } from "@/components/ui/confirm-dialog";

export const Route = createFileRoute("/_authenticated/settings/sequences")({
  component: SequencesPage,
});

function SequencesPage() {
  const listFn = useServerFn(listSequences);
  const saveFn = useServerFn(saveSequence);
  const deleteFn = useServerFn(deleteSequence);
  const enrFn = useServerFn(listEnrollments);
  const enrStatusFn = useServerFn(updateEnrollmentStatus);
  const tickFn = useServerFn(triggerSequencesTickNow);

  const [rows, setRows] = useState<SequenceListItem[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentListItem[]>([]);
  const [draft, setDraft] = useState<SequenceDraft | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const [s, e] = await Promise.all([listFn(), enrFn({ data: { limit: 50 } })]);
      setRows(s);
      setEnrollments(e);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  const handleSave = async (d: SequenceDraft) => {
    try {
      await saveFn({ data: d });
      toast.success("Sequência salva");
      setDraft(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };
  const handleDelete = async (id: string) => {
    if (!(await confirmDialog("Excluir esta sequência?"))) return;
    try {
      await deleteFn({ data: { id } });
      toast.success("Removida");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };
  const handleToggle = async (row: SequenceListItem, enabled: boolean) => {
    try {
      await saveFn({
        data: { id: row.id, name: row.name, entity: row.entity, enabled, steps: row.steps },
      });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };
  const handleTick = async () => {
    try {
      const r = await tickFn();
      toast.success(`Processados: ${r.processed} enrollment(s)`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };
  const handleEnrStatus = async (id: string, status: "active" | "paused" | "removed") => {
    try {
      await enrStatusFn({ data: { id, status } });
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
          <h2 className="text-lg font-semibold">Sequências</h2>
          <p className="text-sm text-muted-foreground">
            Cadências automáticas de tarefas e e-mails.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTick}>
            <Zap className="h-4 w-4 mr-1" /> Rodar agora
          </Button>
          <Button onClick={() => setDraft({ ...EMPTY_DRAFT })}>
            <Plus className="h-4 w-4 mr-1" /> Nova sequência
          </Button>
        </div>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">Sequências</TabsTrigger>
          <TabsTrigger value="enrollments">Inscrições ({enrollments.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-3 mt-3">
          {loading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!loading && rows.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                Nenhuma sequência ainda. Crie uma para começar.
              </CardContent>
            </Card>
          )}
          {rows.map((row) => (
            <Card key={row.id}>
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    {row.name}
                    {row.active_enrollments > 0 && (
                      <Badge variant="secondary">{row.active_enrollments} ativas</Badge>
                    )}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ENTITY_LABELS[row.entity]} · {row.steps?.length ?? 0} passo(s) ·{" "}
                    {row.completed_enrollments} concluída(s)
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
                        steps: row.steps,
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

        <TabsContent value="enrollments" className="mt-3">
          <Card>
            <CardContent className="p-0">
              {enrollments.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Nenhuma inscrição.</p>
              ) : (
                <ul className="divide-y">
                  {enrollments.map((e) => (
                    <li key={e.id} className="flex items-center gap-3 p-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {namesById[e.sequence_id] ?? e.sequence_id}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Passo {e.current_step + 1} ·{" "}
                          {e.next_run_at
                            ? `próximo em ${formatDateTime(e.next_run_at)}`
                            : "sem próximo"}
                        </div>
                      </div>
                      <Badge
                        variant={
                          e.status === "active"
                            ? "default"
                            : e.status === "completed"
                              ? "secondary"
                              : e.status === "paused"
                                ? "outline"
                                : "destructive"
                        }
                      >
                        {e.status}
                      </Badge>
                      {e.status === "active" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Pausar"
                          onClick={() => handleEnrStatus(e.id, "paused")}
                        >
                          <Pause className="h-4 w-4" />
                        </Button>
                      )}
                      {e.status === "paused" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Retomar"
                          onClick={() => handleEnrStatus(e.id, "active")}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {e.status !== "removed" && e.status !== "completed" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Remover"
                          onClick={() => handleEnrStatus(e.id, "removed")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <SequenceBuilder
        open={!!draft}
        draft={draft}
        onClose={() => setDraft(null)}
        onSave={handleSave}
      />
    </div>
  );
}
