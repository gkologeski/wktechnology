import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { IsoDatePicker } from "@/components/iso-date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { usePermissions } from "@/lib/access-control/use-permissions";
import { useSharedAction } from "@/lib/access-control/use-shared-action";
import { getExecution, startExecution } from "./execution.functions";
import { resourceFor, type RequestKind, type PreparationRow } from "./types";

export type ExecutionContext = {
  status: "blocked" | "ready" | "started";
  problem: string | null;
  manager_name: string | null;
  can_start: boolean;
  revision: number;
  contract: { id: string; status: string; starts_at: string | null; ends_at: string | null } | null;
  start: {
    id: string;
    starts_at: string;
    ends_at: string | null;
    reason: string;
    revision: number;
    authorized_at: string;
    authorized_by_name: string | null;
    signature_intact: boolean;
  } | null;
  engagement: { id: string; status: string; starts_at: string; ends_at: string | null } | null;
  allocations: Array<{
    id: string;
    project_name: string | null;
    allocation_pct: number;
    starts_at: string;
    ends_at: string | null;
    status: string;
  }>;
};
export const executionLabels: Record<ExecutionContext["status"], string> = {
  blocked: "Início bloqueado",
  ready: "Pronto para autorização de início",
  started: "Início autorizado",
};
/** Pure display helper: start never implies access, invites or payments. */
export function executionSummary(c: Pick<ExecutionContext, "status" | "start">): string {
  if (c.status !== "started" || !c.start) return executionLabels[c.status];
  if (!c.start.signature_intact)
    return "Início autorizado — assinatura não está mais íntegra; alocações bloqueadas";
  return "Início autorizado — sem acessos, convites ou financeiro automáticos";
}

const fmt = (d: string | null) =>
  d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "sem término";

export function useExecution(kind: RequestKind, row: PreparationRow) {
  const p = usePermissions(),
    view = useSharedAction(resourceFor(kind), "view"),
    get = useServerFn(getExecution);
  const q = useQuery({
    queryKey: ["hiring-execution", p.workspaceId, row.id, row.revision],
    enabled: view,
    queryFn: () => get({ data: { kind, id: row.id, revision: row.revision } }),
    retry: false,
  });
  return { view, q };
}

/** Lateral: status, responsible manager and the explicit start action. */
export function ExecutionPanel({
  kind,
  row,
  dirty,
  busy,
}: {
  kind: RequestKind;
  row: PreparationRow;
  dirty: boolean;
  busy: boolean;
}) {
  const { view, q } = useExecution(kind, row),
    qc = useQueryClient(),
    act = useServerFn(startExecution);
  const [startsAt, setStartsAt] = useState(""),
    [endsAt, setEndsAt] = useState(""),
    [reason, setReason] = useState(""),
    [operation] = useState(() => crypto.randomUUID());
  const m = useMutation({
    mutationFn: () =>
      act({
        data: {
          kind,
          id: row.id,
          revision: row.revision,
          startsAt,
          endsAt: endsAt || null,
          reason,
          operation,
        },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["hiring-execution"] }),
  });
  if (!view) return null;
  if (q.isLoading) return <p role="status">Carregando execução…</p>;
  if (q.isError)
    return (
      <div role="alert">
        Execução indisponível.
        <Button variant="outline" onClick={() => void q.refetch()}>
          Tentar novamente
        </Button>
      </div>
    );
  const d = q.data as ExecutionContext | undefined;
  if (!d) return null;
  const locked = dirty || busy || m.isPending || q.isFetching;
  return (
    <section className="space-y-3 text-sm" aria-label="Início e execução">
      <h3 className="font-semibold">{executionSummary(d)}</h3>
      {d.problem && <p role="status">{d.problem}</p>}
      <p>Gestor da área: {d.manager_name ?? "Não configurado"}</p>
      {d.contract && (
        <p>
          Vigência do instrumento: {fmt(d.contract.starts_at)} a {fmt(d.contract.ends_at)}
        </p>
      )}
      {d.contract && (
        <Button asChild variant="outline">
          <Link to="/contracts/$id" params={{ id: d.contract.id }}>
            Abrir instrumento assinado
          </Link>
        </Button>
      )}
      {d.can_start && (
        <div className="space-y-2">
          <Label htmlFor={`exec-start-${row.id}`}>Início da atividade</Label>
          <IsoDatePicker
            id={`exec-start-${row.id}`}
            value={startsAt}
            min={d.contract?.starts_at ?? undefined}
            max={d.contract?.ends_at ?? undefined}
            disabled={locked}
            onChange={(v) => setStartsAt(v ?? "")}
          />
          <Label htmlFor={`exec-end-${row.id}`}>Término (opcional, dentro da vigência)</Label>
          <IsoDatePicker
            id={`exec-end-${row.id}`}
            value={endsAt}
            min={startsAt || d.contract?.starts_at || undefined}
            max={d.contract?.ends_at ?? undefined}
            disabled={locked}
            onChange={(v) => setEndsAt(v ?? "")}
          />
          <Label htmlFor={`exec-reason-${row.id}`}>Justificativa do início</Label>
          <Textarea
            id={`exec-reason-${row.id}`}
            value={reason}
            maxLength={2000}
            disabled={locked}
            onChange={(e) => setReason(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Não concede acessos, não envia convites e não gera lançamentos financeiros.
          </p>
          <Button
            disabled={locked || !startsAt || reason.trim().length < 10}
            onClick={() => m.mutate()}
          >
            Autorizar início
          </Button>
        </div>
      )}
      {m.isError && (
        <p role="alert" className="text-destructive">
          {m.error.message}
        </p>
      )}
      {m.isPending && <p role="status">Registrando…</p>}
    </section>
  );
}
