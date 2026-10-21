// Fila do aprovador: só itens enviados que o usuário pode decidir (aprovador explícito do
// projeto/profissional, delegação vigente, deny e autoaprovação respeitados no banco).
// Cada decisão confere a revisão do apontamento: se mudou desde a leitura, o banco recusa.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { MetricCard, EmptyState, RowSkeleton } from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  decidePendingItems,
  getTimesheetOverview,
  listPendingApprovals,
} from "@/lib/projects/time-workflow.functions";
import { formatSeconds, REVIEW_FLAG_LABEL } from "@/lib/projects/time-entry.shared";
import type { PendingItem } from "@/lib/projects/time-workflow.types";

const PAGE = 50;
const br = (iso: string) => iso.split("-").reverse().join("/");

export function HoursReviewPanel({ from, to }: { from: string; to: string }) {
  const qc = useQueryClient();
  const pendingFn = useServerFn(listPendingApprovals);
  const overviewFn = useServerFn(getTimesheetOverview);
  const decideFn = useServerFn(decidePendingItems);

  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Map<string, PendingItem>>(new Map());
  const [reason, setReason] = useState("");

  const pending = useQuery({
    queryKey: ["pending-approvals", page],
    queryFn: () => pendingFn({ data: { page, pageSize: PAGE } }),
  });
  const overview = useQuery({
    queryKey: ["timesheet-overview", from, to, "review"],
    queryFn: () => overviewFn({ data: { from, to } }),
  });

  const done = () => {
    setSelected(new Map());
    setReason("");
    for (const k of ["pending-approvals", "timesheet-overview", "time-entries", "timesheet"]) {
      void qc.invalidateQueries({ queryKey: [k] });
    }
  };
  const decide = useMutation({
    mutationFn: (action: "approve" | "reject") =>
      decideFn({
        data: {
          items: Array.from(selected.values()).map((i) => ({
            itemId: i.item_id,
            revision: i.revision,
          })),
          action,
          reason: action === "reject" ? reason.trim() : undefined,
        },
      }),
    onSuccess: (r) => {
      toast.success(
        `${r.decided} apontamento(s) ${r.action === "approve" ? "aprovado(s)" : "devolvido(s)"}`,
      );
      done();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      void pending.refetch();
    },
  });

  const items = pending.data?.items ?? [];
  const total = pending.data?.total ?? 0;
  const toggle = (i: PendingItem) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(i.item_id)) next.delete(i.item_id);
      else next.set(i.item_id, i);
      return next;
    });
  const allOnPage = items.length > 0 && items.every((i) => selected.has(i.item_id));
  const t = overview.data?.totals;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Aguardando sua decisão"
          value={String(total)}
          hint={formatSeconds(pending.data?.total_seconds ?? 0)}
        />
        <MetricCard label="Enviado no período" value={formatSeconds(t?.submitted ?? 0)} />
        <MetricCard
          label="Aprovado no período"
          value={formatSeconds(t?.approved ?? 0)}
          tone="positive"
        />
        <MetricCard
          label="Importado (histórico)"
          value={formatSeconds(t?.locked_import ?? 0)}
          hint="Bloqueado, não aprovado"
        />
      </div>

      {pending.isLoading ? (
        <div className="space-y-2">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : pending.isError ? (
        <EmptyState
          title="Não foi possível carregar a fila"
          description={(pending.error as Error).message}
          action={
            <Button variant="outline" onClick={() => void pending.refetch()}>
              Tentar novamente
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          title="Nada aguardando sua decisão"
          description="Aparecem aqui só os envios dos projetos e profissionais em que você é aprovador (ou delegado vigente). Você nunca aprova as próprias horas."
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allOnPage}
                    aria-label="Selecionar todos da página"
                    onCheckedChange={(v) =>
                      setSelected((prev) => {
                        const next = new Map(prev);
                        for (const i of items) {
                          if (v) next.set(i.item_id, i);
                          else next.delete(i.item_id);
                        }
                        return next;
                      })
                    }
                  />
                </TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Projeto · atividade</TableHead>
                <TableHead>Horário</TableHead>
                <TableHead className="text-right">Duração</TableHead>
                <TableHead>Alertas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((i) => (
                <TableRow key={i.item_id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(i.item_id)}
                      onCheckedChange={() => toggle(i)}
                      aria-label={`Selecionar ${i.user_name} em ${br(i.entry_date)}`}
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {br(i.entry_date)}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate">{i.user_name}</TableCell>
                  <TableCell className="max-w-[260px]">
                    <span className="block truncate">{i.project_name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {i.task_title ?? "—"}
                      {i.description ? ` · ${i.description}` : ""}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm tabular-nums">
                    {i.start_time && i.end_time
                      ? `${i.start_time.slice(0, 5)}–${i.end_time.slice(0, 5)}`
                      : "sem horário"}
                    {i.timezone && (
                      <span className="block text-xs text-muted-foreground">{i.timezone}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSeconds(i.seconds)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {(i.review_flags ?? []).map((f) => REVIEW_FLAG_LABEL[f] ?? f).join(" · ") ||
                      "—"}
                    {!i.billable && <span className="block">Interno (não faturável)</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between gap-2 border-t p-2 text-sm">
            <span className="text-muted-foreground">
              {page * PAGE + 1}–{Math.min(total, (page + 1) * PAGE)} de {total}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={(page + 1) * PAGE >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
            <span className="text-sm">{selected.size} selecionado(s)</span>
            <Input
              className="w-full sm:w-64"
              placeholder="Motivo da devolução"
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
              aria-label="Motivo da devolução"
            />
            <Button
              variant="outline"
              disabled={reason.trim().length < 3 || decide.isPending}
              onClick={() => decide.mutate("reject")}
            >
              Devolver
            </Button>
            <Button disabled={decide.isPending} onClick={() => decide.mutate("approve")}>
              Aprovar
            </Button>
            <Button variant="ghost" onClick={() => setSelected(new Map())}>
              Limpar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
