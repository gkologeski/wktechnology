import { Fragment, useMemo, useState } from "react";
import type { Deal } from "@/lib/db-types";
import type { Pipeline } from "@/lib/pipelines";
import { formatCurrency, formatDate } from "@/lib/crm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight } from "lucide-react";
import { responsibleId } from "@/lib/entity/responsible";

export function DealsList({
  pipeline,
  deals,
  lookups,
  onOpen,
}: {
  pipeline: Pipeline;
  deals: Deal[];
  lookups: {
    companies: Map<string, string>;
    contacts: Map<string, string>;
    owners: Map<string, string>;
  };
  onOpen: (d: Deal) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const s of pipeline.stages) map.set(s.value, []);
    for (const d of deals) {
      const key = d.stage_id || (d.stage as string);
      const arr = map.get(key);
      if (arr) arr.push(d);
    }
    return map;
  }, [deals, pipeline]);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-[var(--hs-surface)]">
            <TableHead className="text-[11px] uppercase tracking-wide w-[30%]">Negócio</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wide">Empresa</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wide">Contato</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wide">Responsável</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wide text-right">Valor</TableHead>
            <TableHead className="text-[11px] uppercase tracking-wide">Fechamento</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pipeline.stages.map((s) => {
            const rows = grouped.get(s.value) ?? [];
            const total = rows.reduce((sum, d) => sum + Number(d.value || 0), 0);
            const isCollapsed = collapsed[s.value];
            return (
              <Fragment key={s.value}>
                <TableRow
                  className="bg-muted/40 cursor-pointer hover:bg-muted/60"
                  onClick={() => setCollapsed((c) => ({ ...c, [s.value]: !c[s.value] }))}
                >
                  <TableCell colSpan={6} className="py-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      {isCollapsed ? (
                        <ChevronRight className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                      <span
                        className="inline-block h-2 w-2 rounded-sm"
                        style={{ background: s.color || "var(--hs-stage-1)" }}
                      />
                      <span className="font-semibold uppercase tracking-wide">{s.label}</span>
                      <span className="text-[var(--hs-text-muted)]">· {rows.length} negócios</span>
                      <span className="ml-auto tabular-nums font-semibold">
                        {formatCurrency(total)}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
                {!isCollapsed &&
                  rows.map((d) => (
                    <TableRow key={d.id} className="cursor-pointer" onClick={() => onOpen(d)}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-sm">
                        {d.company_id ? (lookups.companies.get(d.company_id) ?? "—") : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {d.primary_contact_id
                          ? (lookups.contacts.get(d.primary_contact_id) ?? "—")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {lookups.owners.get(responsibleId(d) ?? "") ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(Number(d.value), d.currency)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {d.expected_close_date ? formatDate(d.expected_close_date) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
