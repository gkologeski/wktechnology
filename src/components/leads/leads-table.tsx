import { Fragment } from "react";
import { ArrowRightLeft, MoreHorizontal } from "lucide-react";
import { Can } from "@/lib/access-control/use-permissions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { GridColumnDef } from "@/hooks/use-grid-columns";
import type { Lead } from "@/lib/db-types";
import type { LeadGridRow } from "@/lib/leads/constants";
import { Td, Th } from "@/components/leads/table-primitives";

export function LeadsTable({
  visibleColumns,
  rows,
  isLoading,
  isError,
  listError,
  refetch,
  allSelected,
  someSelected,
  selectedIds,
  toggleAll,
  toggleOne,
  onOpenLead,
  onConvertLead,
  onRemoveLead,
}: {
  visibleColumns: GridColumnDef<LeadGridRow>[];
  rows: LeadGridRow[];
  isLoading: boolean;
  isError: boolean;
  listError: unknown;
  refetch: () => void;
  allSelected: boolean;
  someSelected: boolean;
  selectedIds: Set<string>;
  toggleAll: () => void;
  toggleOne: (id: string) => void;
  onOpenLead: (id: string) => void;
  onConvertLead: (lead: Lead) => void;
  onRemoveLead: (id: string) => void;
}) {
  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
        <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          <th className="w-10 border-b px-3 py-2.5">
            <Checkbox
              checked={allSelected}
              ref={(el) => {
                if (el && "indeterminate" in el)
                  (el as unknown as { indeterminate: boolean }).indeterminate =
                    !allSelected && someSelected;
              }}
              onCheckedChange={toggleAll}
            />
          </th>
          {visibleColumns.map((col) => (
            <Fragment key={col.key}>
              {col.header ?? <Th className={col.headerClassName}>{col.label}</Th>}
            </Fragment>
          ))}
          <th className="w-10 border-b px-3 py-2.5" />
        </tr>
      </thead>
      <tbody>
        {isLoading ? (
          <tr>
            <td
              colSpan={visibleColumns.length + 2}
              className="px-3 py-16 text-center text-sm text-muted-foreground"
            >
              Carregando leads…
            </td>
          </tr>
        ) : isError ? (
          <tr>
            <td colSpan={visibleColumns.length + 2} className="px-3 py-16 text-center">
              <p className="text-sm font-medium text-foreground">
                Não foi possível carregar os leads.
              </p>
              <p className="mx-auto mt-1 max-w-xl text-xs text-muted-foreground" aria-live="polite">
                {listError instanceof Error ? listError.message : "Erro inesperado."}
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => void refetch()}>
                Tentar novamente
              </Button>
            </td>
          </tr>
        ) : rows.length === 0 ? (
          <tr>
            <td
              colSpan={visibleColumns.length + 2}
              className="px-3 py-16 text-center text-sm text-muted-foreground"
            >
              Nenhum lead encontrado com os filtros atuais.
            </td>
          </tr>
        ) : (
          rows.map((lead) => {
            const checked = selectedIds.has(lead.id);
            return (
              <tr
                key={lead.id}
                className={cn(
                  "group h-12 border-b transition-colors hover:bg-primary/5",
                  checked && "bg-primary/5",
                )}
              >
                <Td className="w-10">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => toggleOne(lead.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Td>
                {visibleColumns.map((col) => (
                  <Td key={col.key} className={col.className}>
                    {col.render(lead)}
                  </Td>
                ))}
                <Td className="w-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onOpenLead(lead.id)}>Abrir</DropdownMenuItem>
                      {lead.status !== "qualified" && lead.status !== "disqualified" && (
                        <DropdownMenuItem onClick={() => onConvertLead(lead as unknown as Lead)}>
                          <ArrowRightLeft className="mr-2 h-3.5 w-3.5" /> Converter
                        </DropdownMenuItem>
                      )}
                      <Can any={["techsales.leads.delete.own", "techsales.leads.delete.workspace"]}>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => onRemoveLead(lead.id)}
                        >
                          Excluir
                        </DropdownMenuItem>
                      </Can>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
