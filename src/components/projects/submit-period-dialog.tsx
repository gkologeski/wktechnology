// Envio do período para aprovação: prévia (itens, bloqueios, alertas) e confirmação.
// O envio usa o hash da prévia; se algo mudar entre a prévia e o clique, o banco recusa.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Ban, Loader2 } from "lucide-react";

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
import { previewSubmission, submitPeriod } from "@/lib/projects/time-workflow.functions";
import { browserTimeZone, formatSeconds } from "@/lib/projects/time-entry.shared";

const br = (iso: string) => iso.split("-").reverse().join("/");

export function SubmitPeriodDialog({
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
  const previewFn = useServerFn(previewSubmission);
  const submitFn = useServerFn(submitPeriod);

  const preview = useQuery({
    queryKey: ["submission-preview", from, to],
    queryFn: () => previewFn({ data: { from, to } }),
    enabled: open,
    staleTime: 0,
  });

  const submit = useMutation({
    mutationFn: () =>
      submitFn({
        data: { from, to, expectedHash: preview.data!.hash, timezone: browserTimeZone() },
      }),
    onSuccess: (r) => {
      toast.success(
        `Envio v${r.version}: ${r.entries} apontamento(s), ${formatSeconds(r.total_seconds)}`,
      );
      for (const k of [
        "time-entries",
        "my-time-summary",
        "my-month-calendar",
        "timesheet",
        "timesheet-overview",
      ]) {
        void qc.invalidateQueries({ queryKey: [k] });
      }
      onOpenChange(false);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      void preview.refetch();
    },
  });

  const data = preview.data;
  const blocked = (data?.blockers.length ?? 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Enviar para aprovação</DialogTitle>
          <DialogDescription>
            Período de {br(from)} a {br(to)}. Rascunhos e devolvidos entram no envio; o aprovador do
            projeto decide cada item.
          </DialogDescription>
        </DialogHeader>
        {preview.isLoading ? (
          <div className="space-y-2">
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : preview.isError ? (
          <p className="text-sm text-destructive" role="alert">
            {(preview.error as Error).message}
          </p>
        ) : data ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-semibold tabular-nums">{data.entry_count}</span> apontamento(s)
              ·{" "}
              <span className="font-semibold tabular-nums">
                {formatSeconds(data.total_seconds)}
              </span>
            </p>
            {data.blockers.map((b) => (
              <p
                key={`${b.code}-${b.project_id ?? ""}`}
                className="flex gap-2 text-destructive"
                role="alert"
              >
                <Ban className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {b.message}
                {b.code === "no_approver" && " Peça ao gestor do projeto para nomear o aprovador."}
              </p>
            ))}
            {data.warnings.map((w) => (
              <p key={w.code} className="flex gap-2 text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {w.message} ({w.n}
                )
              </p>
            ))}
            {data.entry_count > 0 && (
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                {data.entries.map((e) => (
                  <li key={e.id} className="flex justify-between gap-2">
                    <span className="truncate">
                      {br(e.entry_date)} · {e.project_name}
                      {e.task_title ? ` · ${e.task_title}` : ""}
                    </span>
                    <span className="tabular-nums">{formatSeconds(e.seconds)}</span>
                  </li>
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
            disabled={!data || blocked || data.entry_count === 0 || submit.isPending}
            onClick={() => submit.mutate()}
          >
            {submit.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar envio
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
