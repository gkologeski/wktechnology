// Lista detalhada de um indicador (apresentação): mesmas linhas/filtros do cartão, paginada, com total real.
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState, Skeletons } from "@/components/techhire/ui";
import { DashboardError } from "@/components/dashboard/dashboard-error";
import type { DashDataset, MetricDef } from "@/lib/projects/dashboard-views.shared";
import type { DashDrillPage } from "@/lib/projects/dashboard-views.types";
import { formatSeconds } from "@/lib/projects/reconciliation-labels";
import { DRILL_COLUMNS, alertEvidenceText } from "./drill-columns";

export function DrillSheet({
  open,
  onOpenChange,
  dataset,
  def,
  periodLabel,
  page,
  loading,
  error,
  onRetry,
  onPage,
  canExport,
  exporting,
  onExport,
  onAct,
  readOnly,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dataset: DashDataset;
  def: MetricDef;
  periodLabel: string;
  page: DashDrillPage | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  onPage: (offset: number) => void;
  canExport: boolean;
  exporting: boolean;
  onExport: () => void;
  onAct?: (row: Record<string, unknown>) => void;
  readOnly: boolean;
}) {
  const cols = DRILL_COLUMNS[dataset];
  const total = page ? Number(page.total) : 0;
  const from = page ? page.offset + 1 : 0;
  const to = page ? page.offset + page.rows.length : 0;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-4xl">
        <SheetHeader>
          <SheetTitle>{def.title}</SheetTitle>
          <SheetDescription>
            {def.definition} · {periodLabel}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-text-secondary" aria-live="polite">
            {page
              ? `${total.toLocaleString("pt-BR")} registros no total${
                  page.seconds !== null && page.seconds !== undefined && dataset !== "people"
                    ? ` · ${formatSeconds(Number(page.seconds))}`
                    : ""
                }`
              : "Carregando…"}
          </p>
          {canExport ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onExport}
              disabled={exporting || !page || total === 0}
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Download className="mr-2 h-4 w-4" aria-hidden />
              )}
              Exportar CSV
            </Button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {loading && !page ? (
            <Skeletons.Card lines={8} />
          ) : error ? (
            <DashboardError retry={onRetry} />
          ) : !page || page.rows.length === 0 ? (
            <EmptyState
              compact
              title="Nenhum registro"
              description="Não há registros para este indicador com os filtros atuais."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {cols.map((c) => (
                    <TableHead key={c.key} className={c.numeric ? "text-right" : undefined}>
                      {c.label}
                    </TableHead>
                  ))}
                  {dataset === "alerts" ? <TableHead>Causa</TableHead> : null}
                  {dataset === "alerts" && onAct ? (
                    <TableHead className="sr-only">Ações</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.rows.map((r, i) => (
                  <TableRow key={String(r.id ?? `${page.offset}-${i}`)}>
                    {cols.map((c) => (
                      <TableCell
                        key={c.key}
                        className={c.numeric ? "text-right tabular-nums" : undefined}
                      >
                        {c.render(r)}
                      </TableCell>
                    ))}
                    {dataset === "alerts" ? (
                      <TableCell className="max-w-xs text-xs text-text-secondary">
                        {alertEvidenceText(r)}
                      </TableCell>
                    ) : null}
                    {dataset === "alerts" && onAct ? (
                      <TableCell className="text-right">
                        {r.can_act && !readOnly ? (
                          <Button size="sm" variant="outline" onClick={() => onAct(r)}>
                            Tratar
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        {page && total > page.limit ? (
          <nav
            className="flex items-center justify-between gap-2 border-t border-border-subtle pt-3 text-sm"
            aria-label="Paginação da lista"
          >
            <span className="text-text-secondary">
              {from.toLocaleString("pt-BR")}–{to.toLocaleString("pt-BR")} de{" "}
              {total.toLocaleString("pt-BR")}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={loading || page.offset === 0}
                onClick={() => onPage(Math.max(0, page.offset - page.limit))}
              >
                Anterior
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={loading || to >= total}
                onClick={() => onPage(page.offset + page.limit)}
              >
                Próxima
              </Button>
            </div>
          </nav>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
