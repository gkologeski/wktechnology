// Fechamento de competência do projeto: prévia (pendências bloqueantes revalidadas no banco),
// fechamento com retrato do que foi aprovado e reabertura com permissão explícita e motivo.
// Fechar não gera fatura nem pagamento; importados bloqueados ficam fora (histórico).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { SectionHeader, EmptyState, RowSkeleton } from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  closePeriod,
  listPeriodClosings,
  previewPeriodClose,
  reopenPeriod,
} from "@/lib/projects/time-governance.functions";
import { browserTimeZone, formatSeconds } from "@/lib/projects/time-entry.shared";

const br = (iso: string) => iso.split("-").reverse().join("/");

export function ProjectClosingCard({
  projectId,
  from,
  to,
}: {
  projectId: string;
  from: string;
  to: string;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPeriodClosings);
  const previewFn = useServerFn(previewPeriodClose);
  const closeFn = useServerFn(closePeriod);
  const reopenFn = useServerFn(reopenPeriod);
  const [reopenReason, setReopenReason] = useState("");

  const list = useQuery({
    queryKey: ["period-closings", projectId],
    queryFn: () => listFn({ data: { projectId } }),
  });
  const preview = useQuery({
    queryKey: ["close-preview", projectId, from, to],
    queryFn: () => previewFn({ data: { scope: "project", projectId, from, to } }),
    retry: false,
  });
  const refresh = () => {
    for (const k of ["period-closings", "close-preview", "timesheet-overview", "time-entries"]) {
      void qc.invalidateQueries({ queryKey: [k] });
    }
  };

  const close = useMutation({
    mutationFn: () =>
      closeFn({ data: { scope: "project", projectId, from, to, timezone: browserTimeZone() } }),
    onSuccess: (r) => {
      toast.success(
        `Competência fechada: ${r.entries} apontamento(s), ${formatSeconds(r.total_seconds)}`,
      );
      refresh();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      refresh();
    },
  });
  const reopen = useMutation({
    mutationFn: (closingId: string) =>
      reopenFn({ data: { closingId, reason: reopenReason.trim() } }),
    onSuccess: (r) => {
      toast.success(`Competência reaberta (${r.reopened_entries} apontamento(s) liberados)`);
      setReopenReason("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const p = preview.data;
  const blockers = p
    ? [
        p.overlapping_closing && "Já existe competência fechada cobrindo parte do período.",
        p.pending > 0 &&
          `${p.pending} apontamento(s) em rascunho, enviados ou devolvidos (${formatSeconds(p.pending_seconds)}).`,
        p.running_timers > 0 && "Há cronômetro em andamento no projeto.",
        p.missing_acceptance > 0 &&
          `${p.missing_acceptance} apontamento(s) aprovados sem aceite do cliente.`,
        p.eligible === 0 && "Nenhuma hora aprovada para fechar.",
      ].filter(Boolean)
    : [];

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <SectionHeader
        title="Fechamento de competência"
        description="Congela as horas aprovadas do período. Fechado não é fatura nem pagamento. Editar, excluir ou reaprovar só depois de reabrir, com motivo."
      />
      <div className="rounded-md border p-3 text-sm">
        <p className="font-medium">
          Período {br(from)} a {br(to)}
        </p>
        {preview.isLoading ? (
          <RowSkeleton />
        ) : preview.isError ? (
          <p className="text-muted-foreground" role="status">
            {(preview.error as Error).message}
          </p>
        ) : p ? (
          <div className="mt-1 space-y-1">
            <p>
              Elegível: <span className="tabular-nums">{p.eligible}</span> (
              {formatSeconds(p.eligible_seconds)}) · já fechados: {p.already_closed}
            </p>
            <p className="text-muted-foreground">
              Importados bloqueados fora do fechamento: {p.imported_locked} (
              {formatSeconds(p.imported_locked_seconds)})
            </p>
            {blockers.map((b) => (
              <p key={String(b)} className="text-destructive" role="alert">
                {b}
              </p>
            ))}
            <Button
              className="mt-2"
              disabled={blockers.length > 0 || close.isPending}
              onClick={() =>
                void confirmDialog({
                  title: "Fechar a competência?",
                  description: `${p.eligible} apontamento(s) aprovados ficam travados. Reabrir exige permissão específica e motivo.`,
                  confirmLabel: "Fechar competência",
                }).then((ok) => ok && close.mutate())
              }
            >
              {close.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Fechar competência
            </Button>
          </div>
        ) : null}
      </div>

      {list.isLoading ? (
        <RowSkeleton />
      ) : list.isError ? (
        <EmptyState title="Não foi possível carregar" description={(list.error as Error).message} />
      ) : (
        <ul className="divide-y rounded-md border">
          {(list.data?.closings ?? []).length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">Nenhuma competência fechada.</li>
          )}
          {(list.data?.closings ?? []).map((c) => (
            <li key={c.id} className="space-y-2 p-3 text-sm">
              <p className="font-medium">
                {br(c.period_from)}–{br(c.period_to)}{" "}
                <Badge variant={c.status === "closed" ? "default" : "outline"}>
                  {c.status === "closed" ? "Fechada" : "Reaberta"}
                </Badge>
              </p>
              <p className="text-xs text-muted-foreground">
                {c.entry_count} apontamento(s) · {formatSeconds(c.total_seconds)} · fuso{" "}
                {c.timezone} · política v{c.policy_version}
                {c.reopen_reason ? ` · reaberta: ${c.reopen_reason}` : ""}
              </p>
              {c.status === "closed" && (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="grid flex-1 gap-1">
                    <Label htmlFor={`reopen-${c.id}`} className="text-xs">
                      Motivo da reabertura
                    </Label>
                    <Input
                      id={`reopen-${c.id}`}
                      value={reopenReason}
                      onChange={(e) => setReopenReason(e.target.value)}
                      placeholder="Mínimo de 10 caracteres"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reopenReason.trim().length < 10 || reopen.isPending}
                    onClick={() => reopen.mutate(c.id)}
                  >
                    Reabrir
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
