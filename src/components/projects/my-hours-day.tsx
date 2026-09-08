// Minhas Horas — visão do dia: meta, total apontado e lista de apontamentos.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";

import { MetricCard, EmptyState, RowSkeleton } from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  listTimeEntries,
  duplicateTimeEntry,
  removeTimeEntry,
} from "@/lib/projects/time-tracking.functions";
import { submitTimeEntries } from "@/lib/projects/time-approval.functions";
import {
  formatMinutes,
  TIME_ENTRY_STATUS_LABEL,
  type TimeEntryStatus,
} from "@/lib/projects/time-entry.shared";
import { QuickTimeEntryDialog, type TimeEntryDraft } from "./quick-time-entry-dialog";

export function MyHoursDay({
  date,
  tracked,
  expected,
}: {
  date: string;
  tracked: number;
  expected: number;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listTimeEntries);
  const dupFn = useServerFn(duplicateTimeEntry);
  const delFn = useServerFn(removeTimeEntry);
  const submitFn = useServerFn(submitTimeEntries);

  const [draft, setDraft] = useState<TimeEntryDraft | null>(null);

  const query = useQuery({
    queryKey: ["time-entries", date, date],
    queryFn: () => listFn({ data: { from: date, to: date } }),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["time-entries"] });
    void qc.invalidateQueries({ queryKey: ["my-time-summary"] });
    void qc.invalidateQueries({ queryKey: ["my-month-calendar"] });
  };

  const dup = useMutation({
    mutationFn: (id: string) => dupFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Apontamento duplicado");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Apontamento excluído");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const submit = useMutation({
    mutationFn: () => submitFn({ data: { from: date, to: date } }),
    onSuccess: (r) => {
      toast.success(`${r.submitted} apontamento(s) enviado(s) para aprovação`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const entries = query.data?.entries ?? [];
  const remaining = Math.max(0, expected - tracked);
  const pct = expected > 0 ? Math.min(100, Math.round((tracked / expected) * 100)) : 0;
  const last = entries[entries.length - 1];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Apontado" value={formatMinutes(tracked)} />
        <MetricCard label="Esperado" value={formatMinutes(expected)} />
        <MetricCard
          label={tracked > expected ? "Excedente" : "Restante"}
          value={formatMinutes(tracked > expected ? tracked - expected : remaining)}
          tone={remaining === 0 ? "positive" : "warning"}
        />
      </div>

      <div className="space-y-2">
        <Progress value={pct} aria-label={`Progresso do dia: ${pct}%`} />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() =>
              setDraft({
                entryDate: date,
                projectId: last?.project_id ?? null,
                startTime: last?.end_time ?? undefined,
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" /> Apontar horas
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={entries.length === 0 || submit.isPending}
            onClick={() => submit.mutate()}
          >
            Enviar para aprovação
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="space-y-2">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : query.isError ? (
        <EmptyState
          title="Não foi possível carregar os apontamentos"
          description="Verifique sua conexão e tente novamente."
          action={
            <Button variant="outline" onClick={() => void query.refetch()}>
              Tentar novamente
            </Button>
          }
        />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Nenhum apontamento neste dia"
          description="Registre as horas trabalhadas em poucos segundos."
          action={<Button onClick={() => setDraft({ entryDate: date })}>Apontar horas</Button>}
        />
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <Card key={e.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {e.project_tasks?.title ?? "Atividade"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {e.projects?.name ?? "Projeto"} · {(e.start_time ?? "").slice(0, 5)}–
                    {(e.end_time ?? "").slice(0, 5)} · {formatMinutes(e.duration_minutes)}
                  </p>
                  {e.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {e.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary">
                    {TIME_ENTRY_STATUS_LABEL[(e.status ?? "draft") as TimeEntryStatus]}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar apontamento"
                    disabled={e.status === "locked" || e.status === "approved"}
                    onClick={() =>
                      setDraft({
                        id: e.id,
                        projectId: e.project_id,
                        taskId: e.task_id,
                        entryDate: e.entry_date ?? undefined,
                        startTime: e.start_time ?? "09:00",
                        endTime: e.end_time ?? "10:00",
                        description: e.description,
                        billable: e.billable ?? true,
                      })
                    }
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Duplicar apontamento"
                    onClick={() => dup.mutate(e.id)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir apontamento"
                    disabled={e.status === "locked" || e.status === "approved"}
                    onClick={() => {
                      void confirmDialog({
                        title: "Excluir apontamento?",
                        description: "Esta ação não pode ser desfeita.",
                        confirmLabel: "Excluir",
                        variant: "destructive",
                      }).then((ok) => {
                        if (ok) del.mutate(e.id);
                      });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <QuickTimeEntryDialog
        open={!!draft}
        onOpenChange={(v) => !v && setDraft(null)}
        draft={draft ?? undefined}
      />
    </div>
  );
}
