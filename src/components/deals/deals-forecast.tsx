import { useMemo } from "react";
import type { Deal } from "@/lib/db-types";
import type { Pipeline } from "@/lib/pipelines";
import { formatCurrency } from "@/lib/crm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function DealsForecast({ pipeline, deals }: { pipeline: Pipeline; deals: Deal[] }) {
  const rows = useMemo(() => {
    return pipeline.stages.map((s) => {
      const stageDeals = deals.filter((d) => (d.stage_id || d.stage) === s.value);
      const amount = stageDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
      const weighted = amount * ((s.probability ?? 0) / 100);
      return { stage: s, count: stageDeals.length, amount, weighted };
    });
  }, [pipeline, deals]);

  const totals = useMemo(
    () => ({
      count: rows.reduce((s, r) => s + r.count, 0),
      amount: rows.reduce((s, r) => s + r.amount, 0),
      weighted: rows.reduce((s, r) => s + r.weighted, 0),
    }),
    [rows],
  );

  const goalKey = `deals:goal:${pipeline.id}`;
  const [goal, setGoal] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(goalKey) ?? "";
  });
  const goalNum = Number(goal) || 0;
  const gap = goalNum - totals.weighted;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <KPI label="Negócios" value={String(totals.count)} />
        <KPI label="Total" value={formatCurrency(totals.amount)} />
        <KPI label="Previsão ponderada" value={formatCurrency(totals.weighted)} accent />
        <div className="rounded-md border bg-card p-3">
          <div className="text-[11px] uppercase tracking-wide text-[var(--hs-text-muted)]">
            Meta
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Input
              type="number"
              value={goal}
              onChange={(e) => {
                setGoal(e.target.value);
                try {
                  localStorage.setItem(goalKey, e.target.value);
                } catch {
                  // ignore
                }
              }}
              placeholder="0"
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setGoal("");
                try {
                  localStorage.removeItem(goalKey);
                } catch {
                  // ignore
                }
              }}
            >
              ×
            </Button>
          </div>
          {goalNum > 0 && (
            <div className={`mt-1 text-xs ${gap > 0 ? "text-destructive" : "text-success"}`}>
              {gap > 0 ? `Falta ${formatCurrency(gap)}` : `Acima ${formatCurrency(-gap)}`}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[var(--hs-surface)]">
              <TableHead className="text-[11px] uppercase tracking-wide">Estágio</TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-right">
                Negócios
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-right">
                Probabilidade
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-right">
                Valor
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wide text-right">
                Ponderado
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.stage.value}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-sm"
                      style={{ background: r.stage.color || "var(--hs-stage-1)" }}
                    />
                    <span className="text-sm font-medium">{r.stage.label}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.count}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {typeof r.stage.probability === "number" ? `${r.stage.probability}%` : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(r.amount)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-semibold">
                  {formatCurrency(r.weighted)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-[var(--hs-surface)] font-semibold">
              <TableCell>Total</TableCell>
              <TableCell className="text-right tabular-nums">{totals.count}</TableCell>
              <TableCell />
              <TableCell className="text-right tabular-nums">
                {formatCurrency(totals.amount)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(totals.weighted)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function KPI({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-md border bg-card p-3 ${accent ? "border-[var(--hs-orange)]" : ""}`}>
      <div className="text-[11px] uppercase tracking-wide text-[var(--hs-text-muted)]">{label}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
