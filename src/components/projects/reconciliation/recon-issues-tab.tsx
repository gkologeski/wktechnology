// Aba "Pendências": fila persistida e rastreável. Decisões nunca alteram o apontamento nem o bruto.
import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { EmptyState, FilterBar, Skeletons, StatusBadge } from "@/components/techhire/ui";
import { IsoDateRangePicker } from "@/components/iso-date-range-picker";
import {
  decideReconciliationIssues,
  exportReconciliationIssues,
  listReconciliationIssues,
} from "@/lib/projects/reconciliation.functions";
import {
  ISSUE_STATUS_LABEL,
  ISSUE_TYPES,
  ISSUE_TYPE_LABEL,
  PROVIDER_LABEL,
  RECON_PROVIDERS,
  formatSeconds,
  type IssueAction,
  type IssueStatus,
  type IssueType,
  type ReconProvider,
} from "@/lib/projects/reconciliation-labels";
import { NoteDialog } from "./note-dialog";
import {
  ACTION_LABEL,
  PAGE,
  STATUS_FILTER_LABEL,
  detailText,
  tone,
  type StatusFilter,
} from "./recon-issues-format";

export function ReconIssuesTab({
  from,
  to,
  onPeriod,
}: {
  from?: string;
  to?: string;
  onPeriod: (from: string, to: string) => void;
}) {
  const qc = useQueryClient();
  const [provider, setProvider] = useState<ReconProvider>("all");
  const [type, setType] = useState<IssueType | "any">("any");
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [action, setAction] = useState<IssueAction | null>(null);
  const list = useServerFn(listReconciliationIssues);
  const decide = useServerFn(decideReconciliationIssues);
  const exportFn = useServerFn(exportReconciliationIssues);
  const filters = {
    provider,
    type: type === "any" ? null : type,
    status,
    from: from ?? null,
    to: to ?? null,
  };
  const q = useQuery({
    queryKey: ["recon-issues", filters, page],
    queryFn: () => list({ data: { ...filters, page, pageSize: PAGE } }),
    placeholderData: keepPreviousData,
  });
  const m = useMutation({
    mutationFn: (v: { action: IssueAction; note: string | null }) =>
      decide({ data: { ids: [...sel], ...v } }),
    onSuccess: (r) => {
      toast.success(`${r.updated} alertas atualizados.`);
      setSel(new Set());
      setAction(null);
      void qc.invalidateQueries({ queryKey: ["recon-issues"] });
      void qc.invalidateQueries({ queryKey: ["recon-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const exp = useMutation({
    mutationFn: () => exportFn({ data: filters }),
    onSuccess: (r) => {
      const url = URL.createObjectURL(
        new Blob(["\ufeff" + r.csv], { type: "text/csv;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `pendencias-horas-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${r.rows} alertas exportados.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = q.data?.rows ?? [];
  const pages = Math.max(1, Math.ceil((q.data?.total ?? 0) / PAGE));
  const allOnPage = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const reset = () => {
    setPage(1);
    setSel(new Set());
  };
  return (
    <div className="space-y-4">
      <FilterBar
        chips={
          <>
            <Label className="sr-only" htmlFor="recon-is-provider">
              Fonte
            </Label>
            <Select
              value={provider}
              onValueChange={(v) => {
                setProvider(v as ReconProvider);
                reset();
              }}
            >
              <SelectTrigger id="recon-is-provider" className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RECON_PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PROVIDER_LABEL[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label className="sr-only" htmlFor="recon-is-type">
              Tipo de alerta
            </Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as IssueType | "any");
                reset();
              }}
            >
              <SelectTrigger id="recon-is-type" className="h-8 w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Todos os tipos</SelectItem>
                {ISSUE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {ISSUE_TYPE_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label className="sr-only" htmlFor="recon-is-status">
              Situação
            </Label>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as StatusFilter);
                reset();
              }}
            >
              <SelectTrigger id="recon-is-status" className="h-8 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_FILTER_LABEL) as StatusFilter[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_FILTER_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <IsoDateRangePicker
              size="sm"
              ariaLabel="Período dos alertas"
              from={from}
              to={to}
              onChange={(r) => {
                reset();
                onPeriod(r.from, r.to);
              }}
            />
          </>
        }
        actions={
          <Button size="sm" variant="outline" onClick={() => exp.mutate()} disabled={exp.isPending}>
            <Download className="mr-2 h-4 w-4" aria-hidden />
            Exportar CSV
          </Button>
        }
      />
      {sel.size > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-md border border-border-subtle bg-surface-1 px-3 py-2 text-sm"
          role="region"
          aria-label="Ações em lote"
        >
          <span>{sel.size} selecionados</span>
          {(Object.keys(ACTION_LABEL) as IssueAction[]).map((a) => (
            <Button
              key={a}
              size="sm"
              variant={a === "confirm" ? "default" : "outline"}
              onClick={() => setAction(a)}
            >
              {ACTION_LABEL[a]}
            </Button>
          ))}
        </div>
      ) : null}
      {q.isLoading ? (
        <Skeletons.Card lines={8} />
      ) : q.isError ? (
        <EmptyState
          icon={AlertTriangle}
          title="Não foi possível carregar a fila"
          description={(q.error as Error).message}
          action={<Button onClick={() => void q.refetch()}>Tentar novamente</Button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nenhum alerta com esses filtros"
          description="Mude os filtros ou confira a fila na aba Cobertura."
        />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <Checkbox
                    aria-label="Selecionar a página"
                    checked={allOnPage}
                    onCheckedChange={(c) =>
                      setSel((s) => {
                        const n = new Set(s);
                        for (const r of rows) {
                          if (c) n.add(r.id);
                          else n.delete(r.id);
                        }
                        return n;
                      })
                    }
                  />
                </TableHead>
                <TableHead>Alerta</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Pessoa</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead className="text-right">Impacto</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Checkbox
                      aria-label={`Selecionar alerta ${ISSUE_TYPE_LABEL[r.issue_type as IssueType] ?? r.issue_type}`}
                      checked={sel.has(r.id)}
                      onCheckedChange={(c) =>
                        setSel((s) => {
                          const n = new Set(s);
                          if (c) n.add(r.id);
                          else n.delete(r.id);
                          return n;
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {ISSUE_TYPE_LABEL[r.issue_type as IssueType] ?? r.issue_type}
                  </TableCell>
                  <TableCell>{PROVIDER_LABEL[r.provider as ReconProvider] ?? r.provider}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {r.entry_date
                      ? new Date(`${r.entry_date}T12:00:00Z`).toLocaleDateString("pt-BR", {
                          timeZone: "UTC",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell className="max-w-40 truncate">
                    {r.user_name ?? (r.user_id ? "Sem nome" : "Não vinculada")}
                  </TableCell>
                  <TableCell className="max-w-40 truncate">{r.project_name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSeconds(r.seconds_impact)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={tone(r.status)}
                      label={ISSUE_STATUS_LABEL[r.status as IssueStatus] ?? r.status}
                    />
                  </TableCell>
                  <TableCell className="max-w-80 text-xs text-text-secondary">
                    {detailText(r.issue_type, (r.detail ?? {}) as Record<string, unknown>)}
                    {r.resolution_note ? (
                      <span className="block text-text-tertiary">
                        Justificativa: {r.resolution_note}
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between text-sm text-text-secondary">
            <span aria-live="polite">
              {(q.data?.total ?? 0).toLocaleString("pt-BR")} alertas · página {page} de {pages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </>
      )}
      <NoteDialog
        open={action !== null}
        title={action ? `${ACTION_LABEL[action]} ${sel.size} alertas` : ""}
        description="A decisão fica registrada com seu nome e a data. O apontamento e o registro bruto não são alterados."
        requireNote={action === "confirm" || action === "dismiss"}
        busy={m.isPending}
        onCancel={() => setAction(null)}
        onConfirm={(note) => action && m.mutate({ action, note })}
      />
    </div>
  );
}
