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
import {
  formatMinutes,
  formatSeconds,
  isEditableEntry,
  isImportedLocked,
  REVIEW_FLAG_LABEL,
  TIME_ENTRY_STATUS_LABEL,
  type TimeEntryStatus,
} from "@/lib/projects/time-entry.shared";
import { QuickTimeEntryDialog, type TimeEntryDraft } from "./quick-time-entry-dialog";
import { SubmitPeriodDialog } from "./submit-period-dialog";

export function MyHoursDay({
  date,
  tracked,
  expected,
}: {
  date: string;
  tracked: number;
  /** null = jornada não configurada no People (nenhuma meta presumida). */
  expected: number | null;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listTimeEntries);
  const dupFn = useServerFn(duplicateTimeEntry);
  const delFn = useServerFn(removeTimeEntry);
  const [draft, setDraft] = useState<TimeEntryDraft | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);

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
  const entries = query.data?.entries ?? [];
  const known = expected !== null;
  const exp = expected ?? 0;
  const remaining = Math.max(0, exp - tracked);
  const pct = exp > 0 ? Math.min(100, Math.round((tracked / exp) * 100)) : 0;
  const last = entries[entries.length - 1];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Apontado" value={formatMinutes(tracked)} />
        <MetricCard
          label="Esperado"
          value={known ? formatMinutes(exp) : "Não configurado"}
          hint={known ? undefined : "Jornada não cadastrada no TechPeople"}
        />
        <MetricCard
          label={known && tracked > exp ? "Excedente" : "Restante"}
          value={known ? formatMinutes(tracked > exp ? tracked - exp : remaining) : "—"}
          tone={!known ? undefined : remaining === 0 ? "positive" : "warning"}
        />
      </div>

      <div className="space-y-2">
        {known && <Progress value={pct} aria-label={`Progresso do dia: ${pct}%`} />}
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
            disabled={entries.length === 0}
            onClick={() => setSubmitOpen(true)}
          >
            Enviar dia para aprovação
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
                    {e.projects?.name ?? "Projeto"} ·{" "}
                    {e.start_time && e.end_time
                      ? `${e.start_time.slice(0, 5)}–${e.end_time.slice(0, 5)}`
                      : "sem horário"}{" "}
                    ·{" "}
                    <span className="tabular-nums">
                      {e.duration_seconds != null
                        ? formatSeconds(e.duration_seconds)
                        : formatMinutes(e.duration_minutes)}
                    </span>
                  </p>
                  {e.status === "rejected" && e.reject_reason && (
                    <p className="mt-1 text-xs text-destructive">Devolvido: {e.reject_reason}</p>
                  )}
                  {(e.review_flags ?? []).length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {(e.review_flags ?? []).map((f) => REVIEW_FLAG_LABEL[f] ?? f).join(" · ")}
                    </p>
                  )}
                  {e.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {e.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant={e.status === "rejected" ? "destructive" : "secondary"}>
                    {isImportedLocked(e)
                      ? "Importado (histórico)"
                      : TIME_ENTRY_STATUS_LABEL[(e.status ?? "draft") as TimeEntryStatus]}
                    {e.period_closing_id ? " · fechado" : ""}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar apontamento"
                    disabled={!isEditableEntry(e) || e.entry_kind === "timer"}
                    onClick={() =>
                      setDraft({
                        id: e.id,
                        projectId: e.project_id,
                        taskId: e.task_id,
                        entryDate: e.entry_date ?? undefined,
                        mode: e.start_time && e.end_time ? "interval" : "duration",
                        startTime: e.start_time ?? undefined,
                        endTime: e.end_time ?? undefined,
                        durationSeconds: e.duration_seconds,
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
                    disabled={
                      !(e.status === "draft" || e.status === "rejected") || !!e.period_closing_id
                    }
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

      <SubmitPeriodDialog open={submitOpen} onOpenChange={setSubmitOpen} from={date} to={date} />

      <QuickTimeEntryDialog
        open={!!draft}
        onOpenChange={(v) => !v && setDraft(null)}
        draft={draft ?? undefined}
      />
    </div>
  );
}
