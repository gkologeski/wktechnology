// Copiar a semana anterior: prévia do que será criado (como rascunho) e do que fica de fora.
// Nunca copia aprovação, fechamento, importado, nem cria duplicado/sobreposição.
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RowSkeleton } from "@/components/techhire/ui";
import { listTimesheet } from "@/lib/project-timer.functions";
import { saveTimeEntry } from "@/lib/projects/time-tracking.functions";
import {
  browserTimeZone,
  formatSeconds,
  planWeekCopy,
  type CopyCandidate,
} from "@/lib/projects/time-entry.shared";

type Row = CopyCandidate & {
  description: string | null;
  billable: boolean;
  duration_minutes: number | null;
  projects?: { name: string } | null;
  project_tasks?: { title: string } | null;
};

const shiftIso = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const br = (iso: string) => iso.split("-").reverse().join("/");

export function CopyWeekDialog({
  open,
  onOpenChange,
  from,
  to,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  from: string;
  to: string;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listTimesheet);
  const saveFn = useServerFn(saveTimeEntry);
  const prevFrom = shiftIso(from, -7);
  const prevTo = shiftIso(to, -7);

  const q = useQuery({
    queryKey: ["copy-week", from, to],
    enabled: open,
    staleTime: 0,
    queryFn: async () => {
      const [prev, cur] = await Promise.all([
        listFn({ data: { from: prevFrom, to: prevTo, scope: "me" } }),
        listFn({ data: { from, to, scope: "me" } }),
      ]);
      return { prev: prev as unknown as Row[], cur: cur as unknown as Row[] };
    },
  });

  const plan = useMemo(() => {
    if (!q.data) return null;
    const p = planWeekCopy(q.data.prev, q.data.cur, 7);
    const noTask = p.copy.filter((c) => !c.task_id);
    return {
      copy: p.copy.filter((c) => c.task_id) as (Row & { target_date: string })[],
      skipped: [
        ...p.skipped,
        ...noTask.map((c) => ({ id: c.id, reason: "Sem atividade vinculada" })),
      ],
    };
  }, [q.data]);

  const run = useMutation({
    mutationFn: async () => {
      let ok = 0;
      const failed: string[] = [];
      for (const e of plan!.copy) {
        try {
          const interval = !!(e.start_time && e.end_time);
          await saveFn({
            data: {
              projectId: e.project_id,
              taskId: e.task_id,
              entryDate: e.target_date,
              mode: interval ? "interval" : "duration",
              startTime: interval ? e.start_time!.slice(0, 5) : undefined,
              endTime: interval ? e.end_time!.slice(0, 5) : undefined,
              durationSeconds: interval
                ? undefined
                : (e.duration_seconds ?? (e.duration_minutes ?? 0) * 60),
              timezone: browserTimeZone(),
              description: e.description,
              billable: e.billable,
            },
          });
          ok++;
        } catch (err) {
          failed.push(`${br(e.target_date)}: ${(err as Error).message}`);
        }
      }
      return { ok, failed };
    },
    onSuccess: ({ ok, failed }) => {
      if (ok) toast.success(`${ok} apontamento(s) copiado(s) como rascunho`);
      if (failed.length)
        toast.error(`${failed.length} não copiado(s)`, {
          description: failed.slice(0, 3).join(" · "),
        });
      for (const k of ["timesheet", "timesheet-overview", "time-entries", "my-time-summary"]) {
        void qc.invalidateQueries({ queryKey: [k] });
      }
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Copiar semana anterior</DialogTitle>
          <DialogDescription>
            De {br(prevFrom)}–{br(prevTo)} para {br(from)}–{br(to)}. Os itens entram como rascunho;
            aprovação e fechamento nunca são copiados.
          </DialogDescription>
        </DialogHeader>
        {q.isLoading ? (
          <div className="space-y-2">
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : q.isError ? (
          <p className="text-sm text-destructive" role="alert">
            Não foi possível montar a prévia.
          </p>
        ) : plan ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-semibold">{plan.copy.length}</span> serão criados ·{" "}
              <span className="font-semibold">{plan.skipped.length}</span> ficam de fora
            </p>
            {plan.copy.length > 0 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {plan.copy.map((c) => (
                  <li key={c.id} className="flex justify-between gap-2">
                    <span className="truncate">
                      {br(c.target_date)} · {c.projects?.name ?? "Projeto"}
                      {c.project_tasks?.title ? ` · ${c.project_tasks.title}` : ""}
                    </span>
                    <span className="tabular-nums">
                      {c.start_time && c.end_time
                        ? `${c.start_time.slice(0, 5)}–${c.end_time.slice(0, 5)}`
                        : formatSeconds(c.duration_seconds ?? (c.duration_minutes ?? 0) * 60)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {plan.skipped.length > 0 && (
              <ul className="max-h-28 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {plan.skipped.map((s) => (
                  <li key={s.id}>{s.reason}</li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!plan || plan.copy.length === 0 || run.isPending}
            onClick={() => run.mutate()}
          >
            {run.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Copiar {plan?.copy.length ?? 0} item(ns)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
