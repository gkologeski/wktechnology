// Revisão de mapeamentos e do staging do Clockify. Apenas apresentação.
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { EmptyState, StatusBadge } from "@/components/techhire/ui";
import {
  DECISION_LABEL,
  MAPPING_NOTE_LABEL,
  STAGING_STATUS_LABEL,
} from "@/lib/integrations/clockify/clockify-format";
import { ENTRY_REASON_LABEL } from "@/lib/integrations/clockify/clockify-map";

export type MappingRow = {
  external_id: string;
  label: string | null;
  target_id: string | null;
  method: string;
  decision: string;
  candidates: Array<{ id?: string; user_id?: string; name: string | null; status?: string }>;
  note: string | null;
};

export type TargetOption = { id: string; label: string; status: string | null };

const decisionTone = (d: string) =>
  d === "auto" || d === "confirmed"
    ? "open"
    : d === "pending"
      ? "onhold"
      : d === "create"
        ? "draft"
        : "closed";

export function MappingsTable({
  entity,
  rows,
  options,
  onSearch,
  onDecide,
  onCreateIdentity,
  busy,
  sourceLabel = "Clockify",
}: {
  /** Nome da ferramenta de origem exibido nos títulos (padrão: Clockify). */
  sourceLabel?: string;
  entity: "user" | "client" | "project";
  rows: MappingRow[];
  options: TargetOption[];
  onSearch: (q: string) => void;
  onDecide: (
    externalId: string,
    decision: "confirmed" | "ignore" | "create" | "pending",
    targetId?: string | null,
  ) => void;
  onCreateIdentity?: (externalId: string) => void;
  busy: boolean;
}) {
  const [filter, setFilter] = useState<"all" | "pending">("pending");
  const [picked, setPicked] = useState<Record<string, string>>({});
  const visible = useMemo(
    () => (filter === "pending" ? rows.filter((r) => r.decision === "pending") : rows),
    [rows, filter],
  );
  const optionLabel = new Map(options.map((o) => [o.id, o.label]));
  if (!rows.length) {
    return (
      <EmptyState
        compact
        title="Nada para mapear ainda"
        description={`Gere uma prévia para listar os itens do ${sourceLabel}.`}
      />
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor={`f-${entity}`}>Mostrar</Label>
          <Select value={filter} onValueChange={(v) => setFilter(v as "all" | "pending")}>
            <SelectTrigger id={`f-${entity}`} className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Só pendentes</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor={`s-${entity}`}>Buscar destino no ERP</Label>
          <Input
            id={`s-${entity}`}
            placeholder="Digite parte do nome"
            onChange={(e) => onSearch(e.target.value)}
          />
        </div>
      </div>
      {visible.length === 0 ? (
        <EmptyState compact title="Sem pendências" description="Todos os itens já têm decisão." />
      ) : (
        <div className="overflow-auto rounded-md border border-border-subtle">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No {sourceLabel}</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Sugestões (não vinculadas sozinhas)</TableHead>
                <TableHead className="min-w-[18rem]">Decisão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => {
                const sel = picked[r.external_id] ?? r.target_id ?? "";
                return (
                  <TableRow key={r.external_id}>
                    <TableCell className="max-w-[14rem]">
                      <div className="truncate font-medium">{r.label ?? r.external_id}</div>
                      {r.note && (
                        <div className="text-xs text-text-tertiary">
                          {MAPPING_NOTE_LABEL[r.note] ?? r.note}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={decisionTone(r.decision)}
                        label={DECISION_LABEL[r.decision] ?? r.decision}
                      />
                      {r.target_id && (
                        <div className="mt-1 max-w-[12rem] truncate text-xs text-text-secondary">
                          → {optionLabel.get(r.target_id) ?? "registro vinculado"}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[16rem] text-xs text-text-secondary">
                      {r.candidates.length
                        ? r.candidates
                            .map(
                              (c) =>
                                `${c.name ?? "Sem nome"}${c.status && c.status !== "active" ? ` (${c.status === "inactive" ? "inativo" : c.status})` : ""}`,
                            )
                            .join(", ")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          value={sel}
                          onValueChange={(v) => setPicked((p) => ({ ...p, [r.external_id]: v }))}
                        >
                          <SelectTrigger
                            className="w-52"
                            aria-label={`Destino de ${r.label ?? r.external_id}`}
                          >
                            <SelectValue placeholder="Escolher destino" />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              ...r.candidates.map((c) => ({
                                id: (c.user_id ?? c.id) as string,
                                label: c.name ?? "Sem nome",
                                status: c.status ?? null,
                              })),
                              ...options,
                            ]
                              .filter(
                                (o, i, arr) => o.id && arr.findIndex((x) => x.id === o.id) === i,
                              )
                              .map((o) => (
                                <SelectItem key={o.id} value={o.id}>
                                  {o.label}
                                  {o.status === "inactive" ? " (inativo)" : ""}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          disabled={busy || !sel}
                          onClick={() => onDecide(r.external_id, "confirmed", sel)}
                        >
                          Vincular
                        </Button>
                        {entity === "project" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => onDecide(r.external_id, "create")}
                          >
                            Criar novo
                          </Button>
                        )}
                        {entity === "user" && onCreateIdentity && r.decision === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => onCreateIdentity(r.external_id)}
                          >
                            Identidade histórica
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busy}
                          onClick={() => onDecide(r.external_id, "ignore")}
                        >
                          Ignorar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export type StagingRow = {
  externalId: string;
  status: string;
  reason: string | null;
  detail: string | null;
  summary: {
    name: string | null;
    description: string | null;
    start: string | null;
    end: string | null;
  };
};

export function StagingTable({
  rows,
  total,
  page,
  onPage,
  loading,
  reasonLabels = ENTRY_REASON_LABEL,
  periodHeader = "Início / fim (UTC)",
}: {
  reasonLabels?: Record<string, string>;
  periodHeader?: string;
  rows: StagingRow[];
  total: number;
  page: number;
  onPage: (p: number) => void;
  loading: boolean;
}) {
  if (!loading && rows.length === 0) {
    return <EmptyState compact title="Nenhum registro neste filtro" />;
  }
  const pages = Math.max(1, Math.ceil(total / 50));
  return (
    <div className="space-y-2">
      <div className="overflow-auto rounded-md border border-border-subtle">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Registro</TableHead>
              <TableHead>{periodHeader}</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Motivo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.externalId}>
                <TableCell className="max-w-[18rem]">
                  <div className="truncate">
                    {r.summary.name ?? r.summary.description ?? "Sem descrição"}
                  </div>
                  <div className="font-mono text-[11px] text-text-tertiary">{r.externalId}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs tabular-nums">
                  {r.summary.start ?? "—"}
                  <br />
                  {r.summary.start ? (r.summary.end ?? "em andamento") : ""}
                </TableCell>
                <TableCell>{STAGING_STATUS_LABEL[r.status] ?? r.status}</TableCell>
                <TableCell className="max-w-[16rem] text-xs text-text-secondary">
                  {r.reason ? (reasonLabels[r.reason] ?? r.reason) : "—"}
                  {r.detail ? <div className="text-text-tertiary">{r.detail}</div> : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm text-text-secondary">
        <span>
          {total.toLocaleString("pt-BR")} registro(s) · página {page + 1} de {pages}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0 || loading}
            onClick={() => onPage(page - 1)}
          >
            Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page + 1 >= pages || loading}
            onClick={() => onPage(page + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}
