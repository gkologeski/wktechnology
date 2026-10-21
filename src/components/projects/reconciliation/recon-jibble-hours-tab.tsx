// Horas do Jibble lançadas só por duração (sem início/fim). Mostra a classificação de cada
// lançamento e só deixa materializar os "candidatos" (dia sem intervalo do Jibble e sem
// apontamento de outra fonte, pessoa e projeto mapeados), por ação explícita com justificativa.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { EmptyState, MetricCard, RowSkeleton, SectionHeader } from "@/components/techhire/ui";
import { Button } from "@/components/ui/button";
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
import { confirmDialog } from "@/components/ui/confirm-dialog";
import {
  materializeJibbleHours,
  previewJibbleHours,
} from "@/lib/projects/time-governance.functions";
import { JIBBLE_HOUR_CLASS_LABEL } from "@/lib/projects/time-workflow.types";
import { formatSeconds } from "@/lib/projects/time-entry.shared";

const PAGE = 50;
const br = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

export function ReconJibbleHoursTab() {
  const qc = useQueryClient();
  const previewFn = useServerFn(previewJibbleHours);
  const materializeFn = useServerFn(materializeJibbleHours);
  const [cls, setCls] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");

  const q = useQuery({
    queryKey: ["jibble-hours", cls, page],
    queryFn: () =>
      previewFn({ data: { classification: cls === "all" ? null : cls, page, pageSize: PAGE } }),
  });
  const run = useMutation({
    mutationFn: () =>
      materializeFn({ data: { stagingIds: Array.from(selected), note: note.trim() } }),
    onSuccess: (r) => {
      toast.success(
        `${r.created} apontamento(s) criados como histórico importado; ${r.skipped} ignorado(s)`,
      );
      setSelected(new Set());
      setNote("");
      void qc.invalidateQueries({ queryKey: ["jibble-hours"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const summary = q.data?.summary ?? {};
  const rows = q.data?.rows ?? [];
  const total = q.data?.total ?? 0;
  const cand = summary["candidate"];

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Horas sem horário (Jibble)"
        description="Lançamentos do Jibble com só a duração. Nada é importado automaticamente: só candidatos sem cobertura no dia podem virar apontamento, e ficam como histórico bloqueado (não aprovado). O restante permanece em revisão."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Candidatos"
          value={String(cand?.count ?? 0)}
          hint={formatSeconds(cand?.seconds ?? 0)}
        />
        <MetricCard
          label="Cobertos por intervalos"
          value={String(summary["covered"]?.count ?? 0)}
          hint={formatSeconds(summary["covered"]?.seconds ?? 0)}
        />
        <MetricCard
          label="Em revisão"
          value={String(
            [
              "partial_coverage",
              "other_entries_same_day",
              "no_person",
              "no_project",
              "project_unmapped",
              "invalid",
            ].reduce((a, k) => a + (summary[k]?.count ?? 0), 0),
          )}
        />
        <MetricCard label="Já materializados" value={String(summary["materialized"]?.count ?? 0)} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={cls}
          onValueChange={(v) => {
            setCls(v);
            setPage(0);
            setSelected(new Set());
          }}
        >
          <SelectTrigger className="w-80" aria-label="Filtrar por classificação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as classificações</SelectItem>
            {Object.entries(JIBBLE_HOUR_CLASS_LABEL).map(([k, l]) => (
              <SelectItem key={k} value={k}>
                {l} ({summary[k]?.count ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {q.isLoading ? (
        <div className="space-y-2">
          <RowSkeleton />
          <RowSkeleton />
        </div>
      ) : q.isError ? (
        <EmptyState title="Não foi possível carregar" description={(q.error as Error).message} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nenhum lançamento nesta classificação"
          description="Os dados vêm da coleta do Jibble já feita; nada foi lido de novo da origem."
        />
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Data</TableHead>
                <TableHead>Pessoa</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead className="text-right">Duração</TableHead>
                <TableHead className="text-right">Intervalos no dia</TableHead>
                <TableHead className="text-right">ERP no dia</TableHead>
                <TableHead>Classificação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.staging_id}>
                  <TableCell>
                    <Checkbox
                      disabled={r.classification !== "candidate"}
                      checked={selected.has(r.staging_id)}
                      aria-label={`Selecionar lançamento de ${br(r.entry_date)}`}
                      onCheckedChange={(v) =>
                        setSelected((prev) => {
                          const n = new Set(prev);
                          if (v) n.add(r.staging_id);
                          else n.delete(r.staging_id);
                          return n;
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {br(r.entry_date)}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate">
                    {r.user_name ?? `Jibble ${r.person_external_id?.slice(0, 8) ?? "—"}`}
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate">
                    {r.project_name ?? (r.project_external_id ? "Sem mapeamento" : "Sem projeto")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSeconds(r.seconds)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSeconds(r.day_interval_seconds)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatSeconds(r.day_erp_seconds)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {JIBBLE_HOUR_CLASS_LABEL[r.classification] ?? r.classification}
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
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
          <span className="text-sm">{selected.size} candidato(s)</span>
          <Input
            className="w-full sm:w-80"
            placeholder="Justificativa (mín. 5 caracteres)"
            aria-label="Justificativa da materialização"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            disabled={note.trim().length < 5 || run.isPending}
            onClick={() =>
              void confirmDialog({
                title: "Criar apontamentos a partir destes lançamentos?",
                description:
                  "Entram como histórico importado bloqueado (não aprovado, não faturado), com origem Jibble. O servidor reconfere a classificação antes de gravar.",
                confirmLabel: "Criar apontamentos",
              }).then((ok) => ok && run.mutate())
            }
          >
            {run.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Materializar
          </Button>
        </div>
      )}
    </div>
  );
}
