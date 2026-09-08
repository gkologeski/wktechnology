// Visão do gestor — revisão e aprovação de horas do TechProjects.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { MetricCard, EmptyState, RowSkeleton } from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTeamTimeOverview } from "@/lib/projects/time-metrics.functions";
import { approveTimeEntriesV2, rejectTimeEntries } from "@/lib/projects/time-approval.functions";
import {
  formatMinutes,
  TIME_ENTRY_STATUS,
  TIME_ENTRY_STATUS_LABEL,
  type TimeEntryStatus,
} from "@/lib/projects/time-entry.shared";

export function HoursReviewPanel({ from, to }: { from: string; to: string }) {
  const qc = useQueryClient();
  const overviewFn = useServerFn(getTeamTimeOverview);
  const approveFn = useServerFn(approveTimeEntriesV2);
  const rejectFn = useServerFn(rejectTimeEntries);

  const [status, setStatus] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");

  const query = useQuery({
    queryKey: ["team-time-overview", from, to, status],
    queryFn: () =>
      overviewFn({ data: { from, to, status: status === "all" ? undefined : status } }),
  });

  const done = () => {
    setSelected(new Set());
    setReason("");
    void qc.invalidateQueries({ queryKey: ["team-time-overview"] });
    void qc.invalidateQueries({ queryKey: ["time-entries"] });
  };

  const approve = useMutation({
    mutationFn: (ids: string[]) => approveFn({ data: { ids } }),
    onSuccess: (r) => {
      toast.success(`${r.approved} apontamento(s) aprovado(s)`);
      done();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: (ids: string[]) => rejectFn({ data: { ids, reason: reason.trim() } }),
    onSuccess: (r) => {
      toast.success(`${r.rejected} apontamento(s) rejeitado(s)`);
      done();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const entries = query.data?.entries ?? [];
  const ids = Array.from(selected);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Total no período" value={formatMinutes(query.data?.total ?? 0)} />
        <MetricCard label="Profissionais" value={String(query.data?.byUser.length ?? 0)} />
        <MetricCard label="Projetos" value={String(query.data?.byProject.length ?? 0)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-48" aria-label="Filtrar por situação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as situações</SelectItem>
            {TIME_ENTRY_STATUS.map((s) => (
              <SelectItem key={s} value={s}>
                {TIME_ENTRY_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.isLoading ? (
        <div className="space-y-2">
          <RowSkeleton />
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : query.isError ? (
        <EmptyState
          title="Não foi possível carregar as horas"
          description="Tente novamente em instantes."
          action={
            <Button variant="outline" onClick={() => void query.refetch()}>
              Tentar novamente
            </Button>
          }
        />
      ) : entries.length === 0 ? (
        <EmptyState
          title="Nenhum apontamento no período"
          description="Ajuste o período ou a situação para ver resultados."
        />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <SummaryList
              title="Por profissional"
              rows={(query.data?.byUser ?? []).map((u) => ({ label: u.name, minutes: u.minutes }))}
            />
            <SummaryList
              title="Por projeto"
              rows={(query.data?.byProject ?? []).map((p) => ({
                label: p.name,
                minutes: p.minutes,
              }))}
            />
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Data</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Atividade</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(e.id)}
                        onCheckedChange={() => toggle(e.id)}
                        aria-label={`Selecionar apontamento de ${e.entry_date}`}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {(e.entry_date ?? "").split("-").reverse().join("/")}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {e.projects?.name ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate">
                      {e.project_tasks?.title ?? e.description ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMinutes(e.duration_minutes)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {TIME_ENTRY_STATUS_LABEL[(e.status ?? "draft") as TimeEntryStatus]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {ids.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
            <span className="text-sm">{ids.length} selecionado(s)</span>
            <Input
              className="w-full sm:w-64"
              placeholder="Motivo da rejeição"
              value={reason}
              onChange={(ev) => setReason(ev.target.value)}
              aria-label="Motivo da rejeição"
            />
            <Button
              variant="outline"
              disabled={reason.trim().length < 3 || reject.isPending}
              onClick={() => reject.mutate(ids)}
            >
              Rejeitar
            </Button>
            <Button disabled={approve.isPending} onClick={() => approve.mutate(ids)}>
              Aprovar
            </Button>
            <Button variant="ghost" onClick={() => setSelected(new Set())}>
              Limpar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; minutes: number }[];
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-sm font-medium">{title}</p>
      <ul className="space-y-1">
        {rows.slice(0, 8).map((r) => (
          <li key={r.label} className="flex justify-between gap-2 text-sm">
            <span className="truncate text-muted-foreground">{r.label}</span>
            <span className="tabular-nums">{formatMinutes(r.minutes)}</span>
          </li>
        ))}
        {rows.length === 0 && <li className="text-sm text-muted-foreground">Sem dados</li>}
      </ul>
    </div>
  );
}
