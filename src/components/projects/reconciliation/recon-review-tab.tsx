import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { IsoDatePicker } from "@/components/iso-date-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/lib/access-control/use-permissions";
import {
  historyReviewedLinks,
  applyReviewedLinks,
  previewReviewedLinks,
  revertReviewedLinks,
  type ReviewPage,
} from "@/lib/projects/reconciliation-review.functions";

export function ReconReviewTab() {
  const permissions = usePermissions();
  const canWrite = permissions.can("techprojects.reconciliation.manage.workspace");
  const preview = useServerFn(previewReviewedLinks),
    apply = useServerFn(applyReviewedLinks),
    revert = useServerFn(revertReviewedLinks);
  const load = useServerFn(historyReviewedLinks),
    qc = useQueryClient();
  const [kind, setKind] = useState<"company" | "time">("time");
  const [from, setFrom] = useState<string | null>(null),
    [to, setTo] = useState<string | null>(null);
  const [page, setPage] = useState<ReviewPage | null>(null),
    [selected, setSelected] = useState<Set<string>>(new Set());
  const [batch, setBatch] = useState(() => crypto.randomUUID());
  const history = useQuery({ queryKey: ["recon-review-history"], queryFn: () => load() });
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["recon-review-history"] });
    void qc.invalidateQueries({ queryKey: ["recon-links"] });
    void qc.invalidateQueries({ queryKey: ["recon-overview"] });
  };
  const read = useMutation({
    mutationFn: (cursor: string | null) => {
      if (!from || !to) throw new Error("Informe o período.");
      return preview({ data: { kind, from, to, cursor } });
    },
    onSuccess: (value) => {
      setPage(value);
      setSelected(new Set());
      setBatch(crypto.randomUUID());
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const write = useMutation({
    mutationFn: () =>
      apply({ data: { batch, rows: (page?.rows ?? []).filter((r) => selected.has(r.id)) } }),
    onSuccess: (value) => {
      toast.success(`${value.changed} registros vinculados. Horas e origem preservadas.`);
      setPage(null);
      setSelected(new Set());
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const undo = useMutation({
    mutationFn: (id: string) => revert({ data: { batch: id } }),
    onSuccess: (value) => {
      toast.success(
        `${value.reverted} revertidos; ${value.skipped_changed_since} preservados por edição posterior.`,
      );
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const clear = () => {
    setPage(null);
    setSelected(new Set());
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Prévia de até 100 registros por página, com evidência exata. Selecione os vínculos antes de
        aplicar. Ambiguidades permanecem em Vínculos/Pendências; negócios e contratos são tratados
        na aba Negócios.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          Base
          <select
            className="block rounded-md border bg-background p-2"
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as "company" | "time");
              clear();
            }}
          >
            <option value="time">Pessoas e alocações dos apontamentos</option>
            <option value="company">Empresas dos projetos</option>
          </select>
        </label>
        <div className="space-y-1 text-sm">
          De
          <IsoDatePicker
            ariaLabel="Início da conferência"
            value={from}
            onChange={(value) => {
              setFrom(value);
              clear();
            }}
          />
        </div>
        <div className="space-y-1 text-sm">
          Até
          <IsoDatePicker
            ariaLabel="Fim da conferência"
            value={to}
            onChange={(value) => {
              setTo(value);
              clear();
            }}
          />
        </div>
        <Button
          disabled={!from || !to || read.isPending || write.isPending}
          onClick={() => read.mutate(null)}
        >
          Consultar prévia
        </Button>
      </div>
      {page && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Selecionar</TableHead>
                <TableHead>Registro</TableHead>
                <TableHead>Vínculos propostos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {page.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Checkbox
                      disabled={!canWrite || write.isPending}
                      checked={selected.has(r.id)}
                      onCheckedChange={(on) =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (on) next.add(r.id);
                          else next.delete(r.id);
                          return next;
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {r.label}
                    <div className="text-xs text-muted-foreground">{r.id}</div>
                  </TableCell>
                  <TableCell>
                    {Object.entries(r.after)
                      .filter(([key, value]) => r.before[key] !== value)
                      .map(([key, value]) => (
                        <div key={key} className="text-xs">
                          {key === "person_id"
                            ? "Pessoa"
                            : key === "allocation_id"
                              ? "Alocação"
                              : "Empresa"}
                          : {value}
                        </div>
                      ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!page.rows.length && (
            <p className="text-sm">
              Nenhum vínculo exato nesta página. Consulte a próxima página ou revise as pendências.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              disabled={!canWrite || !selected.size || write.isPending || read.isPending}
              onClick={() => write.mutate()}
            >
              Aplicar {selected.size} selecionados
            </Button>
            <Button
              variant="outline"
              disabled={!page.cursor || read.isPending || write.isPending}
              onClick={() => read.mutate(page.cursor)}
            >
              Próxima página
            </Button>
          </div>
        </>
      )}
      <h3 className="font-semibold">Lotes assistidos recentes</h3>
      {history.isError && <p role="alert">Não foi possível consultar o histórico.</p>}
      {history.data?.map((b) => (
        <div key={b.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
          <span className="text-sm">
            {new Date(b.created_at).toLocaleString("pt-BR")} · {b.id}
          </span>
          <Button
            variant="outline"
            disabled={!canWrite || !b.reversible || undo.isPending}
            onClick={() => undo.mutate(b.id)}
          >
            Reverter vínculos sem edição posterior
          </Button>
        </div>
      ))}
    </div>
  );
}
